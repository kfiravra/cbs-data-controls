import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SYNTHETIC_GLOSSARY } from '../../../testing/synthetic-glossary';
import { provideTestTranslations } from '../../../testing/translate';
import { Control, DefinitionError, TextPart } from '../../core/api/api.types';
import { Definition } from '../../core/definition/definition.types';
import { DraftCondition } from '../../core/definition/draft';
import { problemInterceptor } from '../../core/http/problem.interceptor';
import { EditorStore, VALIDATE_DEBOUNCE_MS } from './editor.store';

const VALIDATE = '/api/v1/controls/validate';

const STORED: Definition = {
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

function control(overrides: Partial<Control> = {}): Control {
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

function problem(status: number, code: string, errors?: DefinitionError[]) {
  return { type: 'about:blank', title: code, status, code, params: {}, ...(errors ? { errors } : {}), correlationId: 'x' };
}

const sentenceOf = (...clauses: [string, string][]): TextPart[] =>
  clauses.map(([nodeId, text]) => ({ text, nodeId }));

describe('EditorStore', () => {
  let http: HttpTestingController;
  let store: EditorStore;

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

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([problemInterceptor])),
        provideHttpClientTesting(),
        provideTestTranslations(),
        EditorStore,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(EditorStore);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  describe('the validate loop', () => {
    it('sends nothing for an unfinished draft', async () => {
      await open({ id: null });
      store.apply({ kind: 'field', id: firstRow().id, left: { field: 'total' }, scope: 'order' });
      settle();

      wait(5 * VALIDATE_DEBOUNCE_MS);

      http.expectNone(VALIDATE);
      expect(store.sentence().parts).toBeNull();
    });

    it('asks for the sentence of a complete draft 400ms after the last edit, and not before', async () => {
      const id = await openComplete();

      wait(VALIDATE_DEBOUNCE_MS - 1);
      http.expectNone(VALIDATE);
      wait(1);
      const request = http.expectOne(VALIDATE);

      expect(request.request.body).toEqual({
        definition: {
          schemaVersion: 1,
          rootEntity: 'order',
          where: {
            type: 'group',
            op: 'and',
            children: [{ type: 'condition', id, left: { field: 'total' }, operator: 'above', value: 5 }],
          },
        },
      });
      request.flush({ valid: true, sentence: '', sentenceParts: sentenceOf([id, 'total above 5']), conditions: [] });
      expect(store.sentence()).toEqual({ parts: sentenceOf([id, 'total above 5']), stale: false });
    });

    it('keeps the last valid sentence, dimmed at once, when the draft becomes unfinished again', async () => {
      const id = await openComplete();
      answerValidate(sentenceOf([id, 'total above 5']));

      store.apply({ kind: 'value', id, value: undefined });
      settle();

      expect(store.sentence()).toEqual({ parts: sentenceOf([id, 'total above 5']), stale: true });
      wait(5 * VALIDATE_DEBOUNCE_MS);
      http.expectNone(VALIDATE);
    });

    it('does not dim the sentence while a complete draft waits for its answer', async () => {
      const id = await openComplete();
      answerValidate(sentenceOf([id, 'total above 5']));

      store.apply({ kind: 'value', id, value: '6' });
      settle();
      wait(VALIDATE_DEBOUNCE_MS);

      expect(store.sentence().stale).toBe(false);
      http.expectOne(VALIDATE).flush({ valid: true, sentence: '', sentenceParts: [], conditions: [] });
    });

    it('cancels the request of an older draft, so its answer never replaces a newer one', async () => {
      const id = await openComplete();
      wait(VALIDATE_DEBOUNCE_MS);
      const older = http.expectOne(VALIDATE);

      store.apply({ kind: 'value', id, value: '6' });
      settle();
      expect(older.cancelled).toBe(true);

      const newer = answerValidate(sentenceOf([id, 'total above 6']));
      expect(newer.request.body.definition.where.children[0].value).toBe(6);
      expect(store.sentence().parts).toEqual(sentenceOf([id, 'total above 6']));
    });

    it('restarts the wait on every edit, so typing sends one request', async () => {
      const id = await openComplete();

      wait(VALIDATE_DEBOUNCE_MS - 50);
      store.apply({ kind: 'value', id, value: '55' });
      settle();
      wait(VALIDATE_DEBOUNCE_MS - 50);
      http.expectNone(VALIDATE);

      wait(50);
      expect(http.expectOne(VALIDATE).request.body.definition.where.children[0].value).toBe(55);
    });

    it('dims the sentence and names the refused condition by its mark, with no error on its row', async () => {
      const id = await openComplete();
      answerValidate(sentenceOf([id, 'total above 5']));
      store.apply({ kind: 'value', id, value: '7' });
      settle();
      wait(VALIDATE_DEBOUNCE_MS);

      http
        .expectOne(VALIDATE)
        .flush(problem(422, 'DEFINITION_INVALID', [{ code: 'VALUE_TYPE_MISMATCH', path: '/where/children/0/value', nodeId: id, params: {} }]), {
          status: 422,
          statusText: 'Unprocessable',
        });

      expect(store.sentence().stale).toBe(true);
      expect(store.status()).toMatchObject({ kind: 'invalid', mark: store.marks().get(id) });
      expect(store.messages().size).toBe(0);
      expect(store.failure()).toBeNull();
    });

    it('shows the failure when the engine does not answer, and asks again on retry', async () => {
      const id = await openComplete();
      wait(VALIDATE_DEBOUNCE_MS);
      http.expectOne(VALIDATE).flush(problem(503, 'ENGINE_UNAVAILABLE'), { status: 503, statusText: 'Unavailable' });
      expect(store.failure()?.code).toBe('ENGINE_UNAVAILABLE');
      expect(store.sentence().stale).toBe(true);

      store.revalidate();
      settle();
      answerValidate(sentenceOf([id, 'total above 5']));

      expect(store.failure()).toBeNull();
      expect(store.sentence().stale).toBe(false);
    });

    it('flags the conditions whose clause was rewritten, once, for the settle', async () => {
      const id = await openComplete();
      answerValidate(sentenceOf([id, 'total above 5']));
      expect(store.settling().size).toBe(0);

      store.apply({ kind: 'value', id, value: '6' });
      settle();
      answerValidate(sentenceOf([id, 'total above 6']));
      expect([...store.settling()]).toEqual([id]);

      wait(1000);
      expect(store.settling().size).toBe(0);
    });
  });

  describe('opening', () => {
    it('starts a new control on the first root entity, with nothing to lose yet', async () => {
      await open({ id: null });

      expect(store.loadState()).toBe('ready');
      expect(store.rootEntity()).toBe(SYNTHETIC_GLOSSARY.entities.find((entity) => entity.rootable)!.key);
      expect(store.dirty()).toBe(false);
    });

    it('loads a stored control with its details and its conditions under their own ids', async () => {
      await open({ id: 7 }, control());

      expect(store.name()).toBe('stored control');
      expect(store.rootEntity()).toBe('order');
      expect(store.draft().children.map((child) => (child as DraftCondition).id)).toEqual(['c1', 'c2']);
      expect(store.dirty()).toBe(false);
      answerValidate(sentenceOf(['c1', 'a'], ['c2', 'b']));
    });

    it('gives a new row of a stored control an id above the ids it came with', async () => {
      await open({ id: 7 }, control());
      answerValidate([]);

      store.apply({ kind: 'addCondition', group: store.draft().key });

      const added = store.draft().children[2] as DraftCondition;
      expect(['c1', 'c2']).not.toContain(added.id);
      expect(Number(added.id.slice(1))).toBeGreaterThan(2);
    });

    it('starts a copy from another control: its conditions, a new name, and no control behind it', async () => {
      await open({ id: null, from: 7, copyName: (name) => `${name} (copy)` }, control());

      expect(store.control()).toBeNull();
      expect(store.name()).toBe('stored control (copy)');
      expect(store.draft().children).toHaveLength(2);
      expect(store.dirty()).toBe(true);
      answerValidate([]);
    });

    it('starts from a suggested control', async () => {
      await open({ id: null, draft: { name: 'suggested', description: 'why', definition: STORED } });

      expect([store.name(), store.description(), store.control()]).toEqual(['suggested', 'why', null]);
      answerValidate([]);
    });

    it('says so at once, on the rows, when a stored control no longer validates', async () => {
      await open({ id: 7 }, control());
      wait(VALIDATE_DEBOUNCE_MS);

      http
        .expectOne(VALIDATE)
        .flush(problem(422, 'DEFINITION_INVALID', [{ code: 'UNKNOWN_FIELD', path: '/where/children/1/left', nodeId: 'c2', params: {} }]), {
          status: 422,
          statusText: 'Unprocessable',
        });

      expect(store.outdated()).toBe(true);
      expect(store.messages().get('c2')).toEqual([
        { key: 'errors.definition.UNKNOWN_FIELD', params: {}, input: 'left', index: undefined },
      ]);
    });

    it('is not found when no control has the id', async () => {
      const opening = store.open({ id: 9 });
      (await next('/api/v1/glossary')).flush(SYNTHETIC_GLOSSARY);
      (await next('/api/v1/controls/9')).flush(problem(404, 'CONTROL_NOT_FOUND'), { status: 404, statusText: 'Not Found' });
      await opening;

      expect(store.loadState()).toBe('notFound');
      expect(store.failure()).toBeNull();
    });
  });

  describe('saving', () => {
    it('sends nothing and shows what is missing when a detail or a row is unfinished', async () => {
      await open({ id: null });

      const outcome = await store.save();

      expect(outcome).toEqual({ kind: 'invalid' });
      expect(store.nameIssue()).toBe('required');
      expect(store.messages().get(firstRow().id)).toEqual([
        { key: 'editor.issues.missingField', params: { max: SYNTHETIC_GLOSSARY.limits.maxListValues }, input: 'left', index: undefined },
      ]);
      http.expectNone('/api/v1/controls');
    });

    it('points the focus at the first unfinished input when the details are in order', async () => {
      const id = await openComplete();
      wait(VALIDATE_DEBOUNCE_MS);
      http.expectOne(VALIDATE).flush({ valid: true, sentence: '', sentenceParts: [], conditions: [] });
      store.setName('a name');
      store.apply({ kind: 'value', id, value: 'not a number' });

      await store.save();

      expect(store.focus()).toEqual({ node: id, input: 'value' });
    });

    it('creates a new control and takes what the server stored', async () => {
      const id = await openComplete();
      answerValidate([]);
      store.setName('  a name  ');

      const saving = store.save();
      const request = await next('/api/v1/controls');
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toMatchObject({ name: 'a name', description: null });
      expect(request.request.body.definition.where.children[0].id).toBe(id);
      expect(store.saveState()).toBe('saving');
      request.flush(control({ id: 12, version: 1, name: 'a name' }));

      expect(await saving).toMatchObject({ kind: 'saved', created: true, newVersion: false });
      expect(store.control()?.id).toBe(12);
      expect(store.dirty()).toBe(false);
      expect(store.saveState()).toBe('idle');
    });

    it('updates a stored control with its token, and says when the save made a new version', async () => {
      await open({ id: 7 }, control());
      answerValidate([]);
      store.apply({ kind: 'value', id: 'c1', value: '200' });

      const saving = store.save();
      const request = await next('/api/v1/controls/7');
      expect(request.request.method).toBe('PUT');
      expect(request.request.body.concurrencyToken).toBe('token-3');
      request.flush(control({ version: 4, concurrencyToken: 'token-4' }));

      expect(await saving).toMatchObject({ kind: 'saved', created: false, newVersion: true });
      expect(store.control()?.concurrencyToken).toBe('token-4');
      settle();
      answerValidate([]);
    });

    it('keeps the version when only the name changed', async () => {
      await open({ id: 7 }, control());
      answerValidate([]);
      store.setName('renamed');

      const saving = store.save();
      (await next('/api/v1/controls/7')).flush(control({ name: 'renamed', concurrencyToken: 'token-3b' }));

      expect(await saving).toMatchObject({ kind: 'saved', newVersion: false });
    });

    it('puts each error of a refused save on its row and its input, and keeps the rest for the screen', async () => {
      await open({ id: 7 }, control());
      answerValidate([]);
      store.setName('renamed');

      const saving = store.save();
      (await next('/api/v1/controls/7')).flush(
        problem(422, 'DEFINITION_INVALID', [
          { code: 'TOO_DEEP', path: '/where', params: { max: 4, actual: 5 } },
          { code: 'VALUE_TYPE_MISMATCH', path: '/where/children/0/value', nodeId: 'c1', params: {} },
          // no node id: the row is found by the path, in the definition that was sent
          { code: 'UNKNOWN_FIELD', path: '/where/children/1/left', params: {} },
        ]),
        { status: 422, statusText: 'Unprocessable' },
      );

      expect(await saving).toEqual({ kind: 'failed' });
      expect(store.messages().get('c1')).toEqual([
        { key: 'errors.definition.VALUE_TYPE_MISMATCH', params: {}, input: 'value', index: undefined },
      ]);
      expect(store.messages().get('c2')).toEqual([
        { key: 'errors.definition.UNKNOWN_FIELD', params: {}, input: 'left', index: undefined },
      ]);
      expect(store.treeErrors().map((error) => error.code)).toEqual(['TOO_DEEP']);
      expect(store.focus()).toEqual({ node: 'c1', input: 'value' });
      expect([...store.openNodes()].sort()).toEqual(['c1', 'c2']);
    });

    it('drops what the server said about a row when that row is edited, and keeps it for the others', async () => {
      await open({ id: 7 }, control());
      answerValidate([]);
      const saving = store.save();
      (await next('/api/v1/controls/7')).flush(
        problem(422, 'DEFINITION_INVALID', [
          { code: 'VALUE_TYPE_MISMATCH', path: '/where/children/0/value', nodeId: 'c1', params: {} },
          { code: 'UNKNOWN_FIELD', path: '/where/children/1/left', nodeId: 'c2', params: {} },
        ]),
        { status: 422, statusText: 'Unprocessable' },
      );
      await saving;

      store.apply({ kind: 'value', id: 'c1', value: '300' });

      expect([...store.messages().keys()]).toEqual(['c2']);
      settle();
      answerValidate([]);
    });

    it('says that the control was saved elsewhere, and reads it again when asked', async () => {
      await open({ id: 7 }, control());
      answerValidate([]);
      store.setName('mine');

      const saving = store.save();
      (await next('/api/v1/controls/7')).flush(problem(409, 'CONCURRENCY_CONFLICT'), { status: 409, statusText: 'Conflict' });
      await saving;
      expect(store.conflict()).toBe(true);
      expect(store.failure()).toBeNull();

      const reloading = store.reload();
      (await next('/api/v1/controls/7')).flush(control({ name: 'theirs', version: 4, concurrencyToken: 'token-4' }));
      await reloading;

      expect(store.conflict()).toBe(false);
      expect([store.name(), store.control()?.concurrencyToken]).toEqual(['theirs', 'token-4']);
      settle();
      answerValidate([]);
    });

    it('becomes read-only when the server says the control is archived', async () => {
      await open({ id: 7 }, control());
      answerValidate([]);
      store.setName('renamed');

      const saving = store.save();
      (await next('/api/v1/controls/7')).flush(problem(409, 'CONTROL_ARCHIVED'), { status: 409, statusText: 'Conflict' });
      await saving;

      expect(store.archived()).toBe(true);
    });

    it('runs the control after the save when asked to save and run', async () => {
      await open({ id: 7 }, control());
      answerValidate([]);

      const saving = store.save(true);
      (await next('/api/v1/controls/7')).flush(control());
      const started = await next('/api/v1/controls/7/runs');
      expect(store.saveState()).toBe('running');
      expect(started.request.method).toBe('POST');
      started.flush({ id: 41, controlId: 7, status: 'succeeded' });

      expect(await saving).toMatchObject({ kind: 'ran', run: { id: 41 } });
    });

    it('keeps the save and shows the failure when the run after it does not start', async () => {
      await open({ id: 7 }, control());
      answerValidate([]);

      const saving = store.save(true);
      (await next('/api/v1/controls/7')).flush(control({ concurrencyToken: 'token-3b' }));
      (await next('/api/v1/controls/7/runs')).flush(problem(503, 'DATABASE_UNAVAILABLE'), { status: 503, statusText: 'Unavailable' });

      expect(await saving).toEqual({ kind: 'failed' });
      expect(store.failure()?.code).toBe('DATABASE_UNAVAILABLE');
      expect(store.control()?.concurrencyToken).toBe('token-3b');
      expect(store.dirty()).toBe(false);
    });
  });

  describe('the root entity and the archive', () => {
    it('starts the conditions over for another root entity, and gives a way back', async () => {
      await open({ id: 7 }, control());
      answerValidate([]);
      const before = store.draft();

      const undo = store.chooseRoot('customer');

      expect(store.rootEntity()).toBe('customer');
      expect(store.draft().children).toHaveLength(1);
      expect((store.draft().children[0] as DraftCondition).left).toBeUndefined();
      expect(store.dirty()).toBe(true);

      undo!();
      expect([store.rootEntity(), store.draft()]).toEqual(['order', before]);
      expect(store.chooseRoot('order')).toBeNull();
    });

    it('archives the stored control', async () => {
      await open({ id: 7 }, control());
      answerValidate([]);

      const archiving = store.archive();
      const request = await next('/api/v1/controls/7');
      expect(request.request.method).toBe('DELETE');
      request.flush(null, { status: 204, statusText: 'No Content' });

      expect(await archiving).toBe(true);
    });
  });
});
