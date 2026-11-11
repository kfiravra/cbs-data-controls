import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SYNTHETIC_GLOSSARY } from '../../../testing/synthetic-glossary';
import { ControlSummary, Page } from '../../core/api/api.types';
import { problemInterceptor } from '../../core/http/problem.interceptor';
import { LIST_PAGE_SIZE, ListStore, ListView } from './list.store';

const VIEW: ListView = { search: '', entity: null, state: 'active', sort: 'name', dir: 'asc', page: 1 };

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

  async function next(url: string, where: (request: TestRequest['request']) => boolean = () => true): Promise<TestRequest> {
    for (let turn = 0; turn < 50; turn++) {
      const [found] = http.match((request) => request.url === url && where(request));
      if (found) {
        return found;
      }
      await Promise.resolve();
    }
    throw new Error(`no request to ${url}`);
  }

  /** The question for the page of the view: the one that asks for a whole page. */
  const nextPage = () => next('/api/v1/controls', (request) => request.params.get('pageSize') === String(LIST_PAGE_SIZE));
  /** The question beside it, for the count of the other tab: one control of it, for its total. */
  const nextCount = () => next('/api/v1/controls', (request) => request.params.get('pageSize') === '1');

  /** Shows a view and answers its two questions; answers with the page's request. */
  async function shown(view: ListView, page: Page<ControlSummary>, other = 0): Promise<TestRequest> {
    store.show(view);
    const request = await nextPage();
    request.flush(page);
    (await nextCount()).flush({ items: [], total: other, page: 1, pageSize: 1 });
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
    expect(sent).toEqual({ active: 'true', sort: 'name', dir: 'asc', page: '1', pageSize: String(LIST_PAGE_SIZE) });
    expect(store.page()?.items.map((item) => item.id)).toEqual([1, 2]);
    expect(store.loading()).toBe(false);
  });

  it('asks with the search, the root entity, the state, the order and the page of the view', async () => {
    const view: ListView = { search: 'pay', entity: 'customer', state: 'archived', sort: 'violations', dir: 'desc', page: 3 };
    const request = await shown(view, pageOf());

    const sent = Object.fromEntries(request.request.params.keys().map((key) => [key, request.request.params.get(key)]));
    expect(sent).toEqual({
      search: 'pay',
      rootEntity: 'customer',
      active: 'false',
      sort: 'violations',
      dir: 'desc',
      page: '3',
      pageSize: String(LIST_PAGE_SIZE),
    });
  });

  it('lets the page of a newer question stand when an older one was still on its way', async () => {
    store.show({ ...VIEW, search: 'a' });
    const older = await nextPage();
    const olderCount = await nextCount();
    store.show({ ...VIEW, search: 'ab' });

    expect(older.cancelled).toBe(true);
    expect(olderCount.cancelled).toBe(true);
    (await nextPage()).flush(pageOf(5));
    (await nextCount()).flush(pageOf());
    expect(store.page()?.items.map((item) => item.id)).toEqual([5]);
  });

  it('keeps the failure and stops waiting when the list cannot be read, and reads it again on reload', async () => {
    await shown(VIEW, pageOf(1, 2));
    store.show({ ...VIEW, search: 'pay' });
    (await nextPage()).error(new ProgressEvent('error'));
    (await nextCount()).flush(pageOf());
    expect(store.failure()?.code).toBe('NETWORK_ERROR');
    expect(store.loading()).toBe(false);
    // the rows of the question before would stand under the new search, and so would its counts
    expect(store.page()).toBeNull();
    expect(store.counts()).toEqual({ active: null, archived: null });

    store.reload();
    (await nextPage()).flush(pageOf(1));
    (await nextCount()).flush(pageOf());

    expect(store.failure()).toBeNull();
    expect(store.page()?.total).toBe(1);
  });

  describe('the counts of the two tabs', () => {
    it('are the total of the page that is shown and, asked beside it, the total of the other tab', async () => {
      store.show({ ...VIEW, search: 'pay', entity: 'customer', page: 2 });
      (await nextPage()).flush(pageOf(1, 2, 3));
      const count = await nextCount();

      // the same search and filter, the other state, and one control only: its total is what is wanted
      const sent = Object.fromEntries(count.request.params.keys().map((key) => [key, count.request.params.get(key)]));
      expect(sent).toEqual({
        search: 'pay',
        rootEntity: 'customer',
        active: 'false',
        sort: 'name',
        dir: 'asc',
        page: '1',
        pageSize: '1',
      });
      count.flush({ items: [summary(9)], total: 148, page: 1, pageSize: 1 });

      expect(store.counts()).toEqual({ active: 3, archived: 148 });
    });

    it('are the other way round when the archive is the tab that is shown', async () => {
      await shown({ ...VIEW, state: 'archived' }, pageOf(4, 5), 6);

      expect(store.counts()).toEqual({ active: 6, archived: 2 });
    });

    it('leave the other tab unknown, and the list as it is, when that count cannot be read', async () => {
      store.show(VIEW);
      (await nextPage()).flush(pageOf(1));
      (await nextCount()).error(new ProgressEvent('error'));

      expect(store.counts()).toEqual({ active: 1, archived: null });
      expect(store.failure()).toBeNull();
      expect(store.page()?.total).toBe(1);
    });
  });

  describe('archiving from a row', () => {
    it('archives the control and reads the list again, so the control leaves its tab', async () => {
      await shown(VIEW, pageOf(1, 2), 0);

      const archiving = store.archive(store.page()!.items[0]);
      const request = await next('/api/v1/controls/1');
      expect(request.request.method).toBe('DELETE');
      request.flush(null, { status: 204, statusText: 'No Content' });

      expect(await archiving).toBe(true);
      (await nextPage()).flush(pageOf(2));
      (await nextCount()).flush({ items: [summary(1)], total: 1, page: 1, pageSize: 1 });
      expect(store.page()?.items.map((item) => item.id)).toEqual([2]);
      expect(store.counts()).toEqual({ active: 1, archived: 1 });
    });

    it('keeps the failure and the list as it is when the control cannot be archived', async () => {
      await shown(VIEW, pageOf(1));

      const archiving = store.archive(store.page()!.items[0]);
      (await next('/api/v1/controls/1')).flush(
        { type: 'about:blank', title: 'DATABASE_UNAVAILABLE', status: 503, code: 'DATABASE_UNAVAILABLE', params: {}, correlationId: 'x' },
        { status: 503, statusText: 'Unavailable' },
      );

      expect(await archiving).toBe(false);
      expect(store.archiveFailure()?.code).toBe('DATABASE_UNAVAILABLE');
      expect(store.page()?.items.map((item) => item.id)).toEqual([1]);
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
