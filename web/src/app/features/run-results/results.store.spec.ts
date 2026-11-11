import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SYNTHETIC_GLOSSARY } from '../../../testing/synthetic-glossary';
import { provideTestTranslations, t } from '../../../testing/translate';
import { Control, Page, Run, RunError, RunStatus } from '../../core/api/api.types';
import { Definition } from '../../core/definition/definition.types';
import { problemInterceptor } from '../../core/http/problem.interceptor';
import { HISTORY_SIZE, ResultsStore, ResultsView } from './results.store';

const DEFINITION: Definition = {
  schemaVersion: 1,
  rootEntity: 'order',
  where: {
    type: 'group',
    op: 'or',
    children: [
      { type: 'condition', id: 'c1', left: { field: 'total' }, operator: 'above', value: 100 },
      { type: 'condition', id: 'c2', left: { field: 'reference' }, operator: 'absent' },
    ],
  },
};
const VIEW: ResultsView = { page: 1, size: 25, search: '', condition: null, sort: 'key', dir: 'asc' };
const letters = t('common.markLetters').split(' ');

function run(status: RunStatus, totalCount: number | null, error: RunError | null = null): Run {
  return {
    id: 41,
    controlId: 7,
    controlName: 'a control',
    controlVersion: 3,
    rootEntity: 'order',
    runDate: '2026-11-10',
    language: 'he',
    startedAt: '2026-11-10T07:12:00.000Z',
    finishedAt: status === 'running' ? null : '2026-11-10T07:12:01.000Z',
    status,
    totalCount,
    storedCount: totalCount,
    capExceeded: false,
    durationMs: 412,
    sentence: null,
    sentenceParts: null,
    conditions: null,
    error,
    previousRun: null,
  };
}

const CONTROL: Control = {
  id: 7,
  name: 'a control',
  description: null,
  rootEntity: 'order',
  version: 3,
  isActive: true,
  createdAt: '2026-11-01T07:00:00.000Z',
  updatedAt: '2026-11-01T07:00:00.000Z',
  concurrencyToken: 'token-3',
  definition: DEFINITION,
};
const HISTORY = '/api/v1/controls/7/runs';

const pageOf = (...runs: Run[]): Page<Run> => ({ items: runs, total: runs.length, page: 1, pageSize: HISTORY_SIZE });

describe('ResultsStore', () => {
  let http: HttpTestingController;
  let store: ResultsStore;

  async function next(url: string, method = 'GET'): Promise<TestRequest> {
    for (let turn = 0; turn < 50; turn++) {
      const [found] = http.match((request) => request.url === url && request.method === method);
      if (found) {
        return found;
      }
      await Promise.resolve();
    }
    throw new Error(`no ${method} request to ${url}`);
  }

  const settle = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };

  /** Opens a run and answers what the store reads beside it: the version that ran, and the control's runs. */
  async function open(stored: Run, withVersion = true, history: Page<Run> = pageOf(stored)): Promise<void> {
    const opening = store.open(stored.id);
    (await next('/api/v1/glossary')).flush(SYNTHETIC_GLOSSARY);
    (await next(`/api/v1/runs/${stored.id}`)).flush(stored);
    await opening;
    const version = await next('/api/v1/controls/7/versions/3');
    if (withVersion) {
      version.flush({ version: 3, createdAt: stored.startedAt, definition: DEFINITION });
    } else {
      version.flush(null, { status: 404, statusText: 'Not Found' });
    }
    (await next(HISTORY)).flush(history);
    await settle();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([problemInterceptor])),
        provideHttpClientTesting(),
        provideTestTranslations(),
        ResultsStore,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(ResultsStore);
  });

  afterEach(() => http.verify());

  describe('the state chosen from a run', () => {
    const cases: [string, Run, string][] = [
      ['a run that found violations', run('succeeded', 23), 'violations'],
      ['a run that found none', run('succeeded', 0), 'noViolations'],
      ['a run that timed out', run('timed_out', null, { code: 'QUERY_TIMEOUT', params: { timeoutSeconds: 30 } }), 'timedOut'],
      ['a run of an outdated definition', run('failed', null, { code: 'CONTROL_DEFINITION_OUTDATED', params: { errors: [] } }), 'outdated'],
      ['a run that failed otherwise', run('failed', null, { code: 'DATABASE_UNAVAILABLE', params: {} }), 'failed'],
      ['a run still in progress', run('running', null), 'running'],
    ];

    for (const [name, stored, state] of cases) {
      it(`is ${state} for ${name}`, async () => {
        await open(stored);

        expect(store.loadState()).toBe('ready');
        expect(store.state()).toBe(state);
      });
    }

    it('is not found when no run has the id', async () => {
      const opening = store.open(9);
      (await next('/api/v1/glossary')).flush(SYNTHETIC_GLOSSARY);
      (await next('/api/v1/runs/9')).flush(
        { type: 'about:blank', title: 'RUN_NOT_FOUND', status: 404, code: 'RUN_NOT_FOUND', params: { id: 9 }, correlationId: 'x' },
        { status: 404, statusText: 'Not Found' },
      );
      await opening;

      expect(store.loadState()).toBe('notFound');
      expect(store.failure()).toBeNull();
    });

    it('keeps the failure when the run cannot be read', async () => {
      const opening = store.open(9);
      (await next('/api/v1/glossary')).flush(SYNTHETIC_GLOSSARY);
      (await next('/api/v1/runs/9')).error(new ProgressEvent('error'));
      await opening;

      expect(store.loadState()).toBe('failed');
      expect(store.failure()?.code).toBe('NETWORK_ERROR');
    });
  });

  describe('marks', () => {
    it('come from the definition of the version that ran, in its order', async () => {
      await open(run('succeeded', 23));

      expect([...store.marks()]).toEqual([
        ['c1', letters[0]],
        ['c2', letters[1]],
      ]);
    });

    it('name the outdated conditions of a run that could not use them', async () => {
      await open(
        run('failed', null, {
          code: 'CONTROL_DEFINITION_OUTDATED',
          params: { errors: [{ code: 'UNKNOWN_FIELD', path: '/where/children/1/left', nodeId: 'c2', params: {} }] },
        }),
      );

      expect(store.outdatedMarks()).toEqual([letters[1]]);
    });

    it('are left out, and the screen stays readable, when the version cannot be read', async () => {
      await open(run('succeeded', 23), false);

      expect(store.marks().size).toBe(0);
      expect(store.state()).toBe('violations');
      expect(store.failure()).toBeNull();
    });
  });

  describe('rows', () => {
    it('are asked for without a search or a condition when the view has none', async () => {
      await open(run('succeeded', 23));

      store.show(VIEW);
      const request = await next('/api/v1/runs/41/results');

      expect(request.request.params.keys().sort()).toEqual(['dir', 'page', 'pageSize', 'sort']);
      request.flush({ items: [], total: 23, page: 1, pageSize: 25 });
    });

    it('are asked for with everything the view of the address says', async () => {
      await open(run('succeeded', 23));

      store.show({ ...VIEW, page: 2, size: 10, search: 'levi', condition: 'c2', sort: 'display', dir: 'desc' });
      const request = await next('/api/v1/runs/41/results');

      const sent = Object.fromEntries(request.request.params.keys().map((key) => [key, request.request.params.get(key)]));
      expect(sent).toEqual({ page: '2', pageSize: '10', search: 'levi', condition: 'c2', sort: 'display', dir: 'desc' });
      expect(store.rowsLoading()).toBe(true);
      request.flush({ items: [], total: 0, page: 2, pageSize: 10 });
      expect(store.rowsLoading()).toBe(false);
      expect(store.rows()).toEqual({ items: [], total: 0, page: 2, pageSize: 10 });
    });

    it('are not asked for when the run has none to show', async () => {
      await open(run('succeeded', 0));

      store.show(VIEW);

      http.expectNone((request) => request.url === '/api/v1/runs/41/results');
    });

    it('of an older question never replace those of a newer one', async () => {
      await open(run('succeeded', 23));

      store.show({ ...VIEW, search: 'a' });
      const older = await next('/api/v1/runs/41/results');
      store.show({ ...VIEW, search: 'ab' });

      expect(older.cancelled).toBe(true);
      (await next('/api/v1/runs/41/results')).flush({ items: [], total: 4, page: 1, pageSize: 25 });
      expect(store.rows()?.total).toBe(4);
    });

    it('of a run that was left never land on the run that was opened after it', async () => {
      await open(run('succeeded', 23));
      store.show(VIEW);
      const left = await next('/api/v1/runs/41/results');

      const opening = store.open(42);
      expect(left.cancelled).toBe(true);
      (await next('/api/v1/runs/42')).flush({ ...run('succeeded', 5), id: 42 });
      await opening;
      (await next('/api/v1/controls/7/versions/3')).flush({ version: 3, createdAt: '', definition: DEFINITION });
      (await next(HISTORY)).flush(pageOf());

      expect(store.run()?.id).toBe(42);
      expect(store.rows()).toBeNull();
      expect(store.rowsLoading()).toBe(false);
    });

    it('keep the failure and stop waiting when a page cannot be read', async () => {
      await open(run('succeeded', 23));

      store.show(VIEW);
      (await next('/api/v1/runs/41/results')).error(new ProgressEvent('error'));

      expect(store.rowsLoading()).toBe(false);
      expect(store.failure()?.code).toBe('NETWORK_ERROR');
    });
  });

  it('leaves the screen to the newer of two runs when the older one answers last', async () => {
    const older = store.open(41);
    (await next('/api/v1/glossary')).flush(SYNTHETIC_GLOSSARY);
    const first = await next('/api/v1/runs/41');
    const newer = store.open(42);
    (await next('/api/v1/runs/42')).flush({ ...run('succeeded', 5), id: 42 });
    await newer;

    first.flush(run('succeeded', 23));
    await older;
    http.match('/api/v1/controls/7/versions/3').forEach((request) =>
      request.flush({ version: 3, createdAt: '', definition: DEFINITION }),
    );
    http.match((request) => request.url === HISTORY).forEach((request) => request.flush(pageOf()));

    expect([store.run()?.id, store.run()?.totalCount]).toEqual([42, 5]);
  });

  describe('the other runs of the control', () => {
    const earlier: Run = { ...run('succeeded', 30), id: 40, startedAt: '2026-11-09T07:00:00.000Z' };

    it('are read beside the run, newest first and as many as the picker offers', async () => {
      const opening = store.open(41);
      (await next('/api/v1/glossary')).flush(SYNTHETIC_GLOSSARY);
      (await next('/api/v1/runs/41')).flush(run('succeeded', 23));
      await opening;
      (await next('/api/v1/controls/7/versions/3')).flush({ version: 3, createdAt: '', definition: DEFINITION });
      const request = await next(HISTORY);

      expect(request.request.params.get('page')).toBe('1');
      expect(request.request.params.get('pageSize')).toBe(String(HISTORY_SIZE));
      request.flush(pageOf(run('succeeded', 23), earlier));
      await settle();
      expect(store.history()?.items.map((item) => item.id)).toEqual([41, 40]);
    });

    it('stay on the screen while another run of the same control is opened, so the picker does not blink', async () => {
      await open(run('succeeded', 23), true, pageOf(run('succeeded', 23), earlier));

      const opening = store.open(40);
      (await next('/api/v1/runs/40')).flush(earlier);
      await opening;

      expect(store.history()?.items.map((item) => item.id)).toEqual([41, 40]);
      (await next('/api/v1/controls/7/versions/3')).flush({ version: 3, createdAt: '', definition: DEFINITION });
      (await next(HISTORY)).flush(pageOf(run('succeeded', 23), earlier));
    });

    it('are dropped when the run that is opened belongs to another control', async () => {
      await open(run('succeeded', 23), true, pageOf(run('succeeded', 23), earlier));

      const opening = store.open(90);
      (await next('/api/v1/runs/90')).flush({ ...run('succeeded', 1), id: 90, controlId: 8 });
      await opening;

      expect(store.history()).toBeNull();
      (await next('/api/v1/controls/8/versions/3')).flush({ version: 3, createdAt: '', definition: DEFINITION });
      (await next('/api/v1/controls/8/runs')).flush(pageOf());
    });

    it('are left out, and the run stays readable, when they cannot be read', async () => {
      const opening = store.open(41);
      (await next('/api/v1/glossary')).flush(SYNTHETIC_GLOSSARY);
      (await next('/api/v1/runs/41')).flush(run('succeeded', 23));
      await opening;
      (await next('/api/v1/controls/7/versions/3')).flush({ version: 3, createdAt: '', definition: DEFINITION });
      (await next(HISTORY)).error(new ProgressEvent('error'));
      await settle();

      expect(store.history()).toBeNull();
      expect(store.state()).toBe('violations');
      expect(store.failure()).toBeNull();
    });
  });

  describe('opened by a control', () => {
    /** Starts opening by the control and answers its runs; `opening` ends when the store has read what it needs. */
    async function openControl(runs: Page<Run>): Promise<{ opening: Promise<number | null> }> {
      const opening = store.openControl(7);
      (await next('/api/v1/glossary')).flush(SYNTHETIC_GLOSSARY);
      const request = await next(HISTORY);
      expect(request.request.params.get('pageSize')).toBe('1');
      request.flush(runs);
      return { opening };
    }

    it('answers the newest run of a control that has runs, and holds nothing itself', async () => {
      const { opening } = await openControl(pageOf(run('succeeded', 23)));

      expect(await opening).toBe(41);
      expect(store.control()).toBeNull();
      expect(store.state()).toBeNull();
    });

    it('holds a control that never ran: its state, the marks of its conditions and its rule in the engine\'s words', async () => {
      const { opening } = await openControl(pageOf());
      (await next('/api/v1/controls/7')).flush(CONTROL);

      expect(await opening).toBeNull();
      expect(store.loadState()).toBe('ready');
      expect(store.state()).toBe('neverRun');
      expect(store.controlId()).toBe(7);
      expect([...store.marks()].map(([id]) => id)).toEqual(['c1', 'c2']);

      const parts = [{ text: 'total above 100', nodeId: 'c1' }];
      (await next('/api/v1/controls/validate', 'POST')).flush({ valid: true, sentence: '', sentenceParts: parts, conditions: [] });
      await settle();
      expect(store.sentenceParts()).toEqual(parts);
    });

    it('stands without the rule in words when the engine does not answer', async () => {
      const { opening } = await openControl(pageOf());
      (await next('/api/v1/controls/7')).flush(CONTROL);
      await opening;
      (await next('/api/v1/controls/validate', 'POST')).error(new ProgressEvent('error'));
      await settle();

      expect(store.sentenceParts()).toBeNull();
      expect(store.state()).toBe('neverRun');
      expect(store.failure()).toBeNull();
    });

    it('is not found when no control has the id', async () => {
      const opening = store.openControl(7);
      (await next('/api/v1/glossary')).flush(SYNTHETIC_GLOSSARY);
      (await next(HISTORY)).flush(
        { type: 'about:blank', title: 'CONTROL_NOT_FOUND', status: 404, code: 'CONTROL_NOT_FOUND', params: { id: 7 }, correlationId: 'x' },
        { status: 404, statusText: 'Not Found' },
      );

      expect(await opening).toBeNull();
      expect(store.loadState()).toBe('notFound');
    });

    it('runs the control for the first time and gives the run back', async () => {
      const { opening } = await openControl(pageOf());
      (await next('/api/v1/controls/7')).flush(CONTROL);
      await opening;
      (await next('/api/v1/controls/validate', 'POST')).flush({ valid: true, sentence: '', sentenceParts: [], conditions: [] });

      const running = store.rerun();
      (await next(HISTORY, 'POST')).flush(run('succeeded', 2));

      expect((await running)?.id).toBe(41);
    });
  });

  describe('running again', () => {
    it('starts a run of the same control and gives the new run back', async () => {
      await open(run('succeeded', 23));

      const running = store.rerun();
      expect(store.rerunning()).toBe(true);
      const request = await next(HISTORY, 'POST');
      request.flush({ ...run('succeeded', 21), id: 42 });

      expect((await running)?.id).toBe(42);
      expect(store.rerunning()).toBe(false);
    });

    it('keeps the failure and gives nothing back when the run cannot be started', async () => {
      await open(run('succeeded', 23));

      const running = store.rerun();
      (await next(HISTORY, 'POST')).flush(
        { type: 'about:blank', title: 'CONTROL_ARCHIVED', status: 409, code: 'CONTROL_ARCHIVED', params: { id: 7 }, correlationId: 'x' },
        { status: 409, statusText: 'Conflict' },
      );

      expect(await running).toBeNull();
      expect(store.rerunFailure()?.code).toBe('CONTROL_ARCHIVED');
      expect(store.failure()).toBeNull();
    });
  });
});
