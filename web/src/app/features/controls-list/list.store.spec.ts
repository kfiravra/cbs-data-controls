import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SYNTHETIC_GLOSSARY } from '../../../testing/synthetic-glossary';
import { ControlSummary, Page } from '../../core/api/api.types';
import { problemInterceptor } from '../../core/http/problem.interceptor';
import { LIST_PAGE_SIZE, ListStore, ListView } from './list.store';

const VIEW: ListView = { search: '', entity: null, state: 'active', page: 1 };

function summary(id: number): ControlSummary {
  return {
    id,
    name: `control ${id}`,
    description: null,
    rootEntity: 'order',
    version: 1,
    isActive: true,
    createdAt: '2026-11-01T07:00:00.000Z',
    updatedAt: '2026-11-01T07:00:00.000Z',
    lastRun: null,
  };
}

const pageOf = (...ids: number[]): Page<ControlSummary> => ({
  items: ids.map(summary),
  total: ids.length,
  page: 1,
  pageSize: LIST_PAGE_SIZE,
});

describe('ListStore', () => {
  let http: HttpTestingController;
  let store: ListStore;

  async function next(url: string): Promise<TestRequest> {
    for (let turn = 0; turn < 50; turn++) {
      const [found] = http.match((request) => request.url === url);
      if (found) {
        return found;
      }
      await Promise.resolve();
    }
    throw new Error(`no request to ${url}`);
  }

  async function shown(view: ListView, page: Page<ControlSummary>): Promise<TestRequest> {
    store.show(view);
    const request = await next('/api/v1/controls');
    request.flush(page);
    return request;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([problemInterceptor])), provideHttpClientTesting(), ListStore],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(ListStore);
  });

  afterEach(() => {
    http.match('/api/v1/glossary').forEach((request) => request.flush(SYNTHETIC_GLOSSARY));
    http.verify();
  });

  it('asks for the active controls of the first page when the address says nothing', async () => {
    const request = await shown(VIEW, pageOf(1, 2));

    const sent = Object.fromEntries(request.request.params.keys().map((key) => [key, request.request.params.get(key)]));
    expect(sent).toEqual({ active: 'true', page: '1', pageSize: String(LIST_PAGE_SIZE) });
    expect(store.page()?.items.map((item) => item.id)).toEqual([1, 2]);
    expect(store.loading()).toBe(false);
  });

  it('asks with the search, the root entity, the state and the page of the view', async () => {
    const request = await shown({ search: 'pay', entity: 'customer', state: 'archived', page: 3 }, pageOf());

    const sent = Object.fromEntries(request.request.params.keys().map((key) => [key, request.request.params.get(key)]));
    expect(sent).toEqual({ search: 'pay', rootEntity: 'customer', active: 'false', page: '3', pageSize: String(LIST_PAGE_SIZE) });
  });

  it('asks for archived and active controls together when the view is of all', async () => {
    const request = await shown({ ...VIEW, state: 'all' }, pageOf());

    expect(request.request.params.get('active')).toBe('all');
  });

  it('lets the page of a newer question stand when an older one was still on its way', async () => {
    store.show({ ...VIEW, search: 'a' });
    const older = await next('/api/v1/controls');
    store.show({ ...VIEW, search: 'ab' });

    expect(older.cancelled).toBe(true);
    (await next('/api/v1/controls')).flush(pageOf(5));
    expect(store.page()?.items.map((item) => item.id)).toEqual([5]);
  });

  it('keeps the failure and stops waiting when the list cannot be read, and reads it again on reload', async () => {
    await shown(VIEW, pageOf(1, 2));
    store.show({ ...VIEW, search: 'pay' });
    (await next('/api/v1/controls')).error(new ProgressEvent('error'));
    expect(store.failure()?.code).toBe('NETWORK_ERROR');
    expect(store.loading()).toBe(false);
    // the rows of the question before would stand under the new search
    expect(store.page()).toBeNull();

    store.reload();
    (await next('/api/v1/controls')).flush(pageOf(1));

    expect(store.failure()).toBeNull();
    expect(store.page()?.total).toBe(1);
  });

  describe('an empty list', () => {
    const answerAll = async (total: number) => {
      const request = await next('/api/v1/controls');
      expect(request.request.params.get('active')).toBe('all');
      expect(request.request.params.get('pageSize')).toBe('1');
      request.flush({ items: [], total, page: 1, pageSize: 1 });
      await Promise.resolve();
      await Promise.resolve();
    };

    it('is a first use when no control exists at all, archived ones included', async () => {
      await shown(VIEW, pageOf());
      await answerAll(0);

      expect(store.anyControl()).toBe(false);
    });

    it('is a list whose controls are all archived when some control exists', async () => {
      await shown(VIEW, pageOf());
      await answerAll(4);

      expect(store.anyControl()).toBe(true);
    });

    it('needs no second question when the view already holds archived and active controls', async () => {
      await shown({ ...VIEW, state: 'all' }, pageOf());

      expect(store.anyControl()).toBe(false);
    });

    it('is not asked about when a search or a filter narrows the list, or when the list has rows', async () => {
      await shown({ ...VIEW, search: 'pay' }, pageOf());
      await shown({ ...VIEW, entity: 'customer' }, pageOf());
      await shown({ ...VIEW, state: 'archived' }, pageOf());
      await shown(VIEW, pageOf(1));

      expect(store.anyControl()).toBeNull();
    });
  });

  describe('a run from the list', () => {
    it('puts the finished run on its row and leaves the other rows as they were', async () => {
      await shown(VIEW, pageOf(1, 2));
      const untouched = store.page()!.items[0];

      const running = store.run(store.page()!.items[1]);
      expect([...store.running()]).toEqual([2]);
      const request = await next('/api/v1/controls/2/runs');
      expect(request.request.method).toBe('POST');
      request.flush({ id: 41, controlId: 2, startedAt: '2026-11-10T07:12:00.000Z', status: 'succeeded', totalCount: 3 });
      await running;

      expect(store.page()!.items[1].lastRun).toEqual({
        id: 41,
        startedAt: '2026-11-10T07:12:00.000Z',
        status: 'succeeded',
        totalCount: 3,
      });
      expect(store.page()!.items[0]).toBe(untouched);
      expect(store.running().size).toBe(0);
    });

    it('puts a run that stopped on its row too: a failed run is the run, not a failed request', async () => {
      await shown(VIEW, pageOf(1));

      const running = store.run(store.page()!.items[0]);
      (await next('/api/v1/controls/1/runs')).flush({
        id: 42,
        controlId: 1,
        startedAt: '2026-11-10T07:12:00.000Z',
        status: 'timed_out',
        totalCount: null,
      });
      await running;

      expect(store.page()!.items[0].lastRun?.status).toBe('timed_out');
      expect(store.failure()).toBeNull();
    });

    it('keeps the failure and frees the row when the run cannot be started', async () => {
      await shown(VIEW, pageOf(1));

      const running = store.run(store.page()!.items[0]);
      (await next('/api/v1/controls/1/runs')).flush(
        { type: 'about:blank', title: 'DATABASE_UNAVAILABLE', status: 503, code: 'DATABASE_UNAVAILABLE', params: {}, correlationId: 'x' },
        { status: 503, statusText: 'Unavailable' },
      );
      await running;

      expect(store.runFailure()?.code).toBe('DATABASE_UNAVAILABLE');
      expect(store.failure()).toBeNull();
      expect(store.running().size).toBe(0);
      expect(store.page()!.items[0].lastRun).toBeNull();
    });

    it('does not start a second run of a control whose run is on its way', async () => {
      await shown(VIEW, pageOf(1));

      const first = store.run(store.page()!.items[0]);
      await store.run(store.page()!.items[0]);

      const requests = http.match('/api/v1/controls/1/runs');
      expect(requests).toHaveLength(1);
      requests[0].flush({ id: 43, controlId: 1, startedAt: '2026-11-10T07:12:00.000Z', status: 'succeeded', totalCount: 0 });
      await first;
    });
  });
});
