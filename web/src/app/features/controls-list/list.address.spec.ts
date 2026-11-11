import { ActivatedRouteSnapshot, UrlSegment, convertToParamMap } from '@angular/router';

import { DEFAULT_VIEW, addressOf, queryOf, sameView } from './list.address';

/** A snapshot of the list's route, as far as `addressOf` reads it. */
function route(query: Record<string, string>, child?: string): ActivatedRouteSnapshot {
  const firstChild = child ? { url: child.split('/').map((path) => new UrlSegment(path, {})) } : null;
  return { queryParamMap: convertToParamMap(query), firstChild } as unknown as ActivatedRouteSnapshot;
}

describe('the address of the list', () => {
  it('is the default view when it says nothing', () => {
    expect(addressOf(route({}))).toEqual({ panel: null, own: DEFAULT_VIEW });
  });

  it('gives the search, what is checked, the tab, the order and the page as the query says them', () => {
    const query = { search: 'pay', entity: 'employee', state: 'archived', sort: 'lastRun', dir: 'desc', page: '3' };

    expect(addressOf(route(query)).own).toEqual({
      search: 'pay',
      entity: 'employee',
      state: 'archived',
      sort: 'lastRun',
      dir: 'desc',
      page: 3,
    });
  });

  it('takes a column it does not know, and a direction that is not a word of the api, as the default order', () => {
    expect(addressOf(route({ sort: 'createdAt', dir: 'down' })).own).toEqual(DEFAULT_VIEW);
    expect(addressOf(route({ sort: 'violations' })).own).toEqual({ ...DEFAULT_VIEW, sort: 'violations' });
  });

  it('takes a tab it does not know, and a page that is no positive number, as the default', () => {
    expect(addressOf(route({ state: 'all', page: '0' })).own).toEqual(DEFAULT_VIEW);
    expect(addressOf(route({ page: 'two' })).own?.page).toBe(1);
  });

  it('names the panel by its path and gives no view under it: the query there is the panel\'s own', () => {
    expect(addressOf(route({ page: '2', search: 'levi' }, 'runs/12'))).toEqual({ panel: 'runs/12', own: null });
    expect(addressOf(route({}, 'controls/7/runs')).panel).toBe('controls/7/runs');
  });

  it('writes a view back as a query that leaves out what is the default', () => {
    expect(queryOf(DEFAULT_VIEW)).toEqual({ search: null, entity: null, state: null, sort: null, dir: null, page: null });
    expect(queryOf({ ...DEFAULT_VIEW, search: 'pay', state: 'archived', sort: 'violations', dir: 'desc', page: 2 })).toEqual({
      search: 'pay',
      entity: null,
      state: 'archived',
      sort: 'violations',
      dir: 'desc',
      page: 2,
    });
  });

  it('tells two views apart by what they show, not by which object holds them', () => {
    expect(sameView(DEFAULT_VIEW, { ...DEFAULT_VIEW })).toBe(true);
    expect(sameView(DEFAULT_VIEW, { ...DEFAULT_VIEW, page: 2 })).toBe(false);
    expect(sameView(DEFAULT_VIEW, { ...DEFAULT_VIEW, dir: 'desc' })).toBe(false);
  });
});
