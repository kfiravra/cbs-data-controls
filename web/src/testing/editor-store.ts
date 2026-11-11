import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Control, DefinitionError, TextPart } from '../app/core/api/api.types';
import { Definition } from '../app/core/definition/definition.types';
import { DraftCondition } from '../app/core/definition/draft';
import { problemInterceptor } from '../app/core/http/problem.interceptor';
import { EditorStore, VALIDATE_DEBOUNCE_MS } from '../app/features/control-editor/editor.store';
import { SYNTHETIC_GLOSSARY } from './synthetic-glossary';
import { provideTestTranslations, t } from './translate';

/** Support for the specs of the editor store: a stored control, and the store driven through its requests. */
export const VALIDATE = '/api/v1/controls/validate';
export const letters = t('common.markLetters').split(' ');

export const STORED: Definition = {
  schemaVersion: 1,
  rootEntity: 'order',
  where: {
    type: 'group',
    op: 'and',
    children: [
      { type: 'condition', id: 'c1', left: { field: 'total' }, operator: 'above', value: 100 },
      { type: 'condition', id: 'c2', left: { field: 'reference' }, operator: 'same', value: 'x' },
    ],
  },
};

export function control(overrides: Partial<Control> = {}): Control {
  return {
    id: 7,
    name: 'stored control',
    description: 'what it finds',
    rootEntity: 'order',
    version: 3,
    isActive: true,
    createdAt: '2026-11-01T07:00:00.000Z',
    updatedAt: '2026-11-09T14:40:00.000Z',
    concurrencyToken: 'token-3',
    definition: STORED,
    ...overrides,
  };
}

export function problem(status: number, code: string, errors?: DefinitionError[]) {
  return { type: 'about:blank', title: code, status, code, params: {}, ...(errors ? { errors } : {}), correlationId: 'x' };
}

export const sentenceOf = (...clauses: [string, string][]): TextPart[] =>
  clauses.map(([nodeId, text]) => ({ text, nodeId }));

/** The store under fake timers, with the requests it makes in hand. Call it in `beforeEach`. */
export function editorHarness() {
  vi.useFakeTimers();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([problemInterceptor])),
      provideHttpClientTesting(),
      provideTestTranslations(),
      EditorStore,
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const store = TestBed.inject(EditorStore);

  /** Runs the effects, so the validate loop sees the last edit. */
  const settle = () => TestBed.tick();
  const wait = (milliseconds: number) => vi.advanceTimersByTime(milliseconds);
  const firstRow = () => store.draft().children[0] as DraftCondition;

  /** The request the store makes next, once the promises before it have run. */
  async function next(url: string): Promise<TestRequest> {
    for (let turn = 0; turn < 50; turn++) {
      const [found] = http.match(url);
      if (found) {
        return found;
      }
      await Promise.resolve();
    }
    throw new Error(`no request to ${url}`);
  }

  async function open(target: Parameters<EditorStore['open']>[0], stored?: Control): Promise<void> {
    const opening = store.open(target);
    (await next('/api/v1/glossary')).flush(SYNTHETIC_GLOSSARY);
    if (stored) {
      (await next(`/api/v1/controls/${stored.id}`)).flush(stored);
    }
    await opening;
    settle();
  }

  /** A new control with one finished row: total above 5. */
  async function openComplete(): Promise<string> {
    await open({ id: null });
    const id = firstRow().id;
    store.apply({ kind: 'field', id, left: { field: 'total' }, scope: 'order' });
    store.apply({ kind: 'operator', id, operator: 'above' });
    store.apply({ kind: 'value', id, value: '5' });
    settle();
    return id;
  }

  function answerValidate(parts: TextPart[]): TestRequest {
    wait(VALIDATE_DEBOUNCE_MS);
    const request = http.expectOne(VALIDATE);
    request.flush({ valid: true, sentence: '', sentenceParts: parts, conditions: [] });
    return request;
  }

  /** Call it in `afterEach`: no request may be left unanswered. */
  function finish(): void {
    http.verify();
    vi.useRealTimers();
  }

  return { http, store, settle, wait, firstRow, next, open, openComplete, answerValidate, finish };
}
