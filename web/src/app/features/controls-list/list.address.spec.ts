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

  it('gives the search, what is checked, the tab and the page as the query says them', () => {
    expect(addressOf(route({ search: 'pay', entity: 'employee', state: 'archived', page: '3' })).own).toEqual({
      search: 'pay',
      entity: 'employee',
      state: 'archived',
      page: 3,
    });
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
    expect(queryOf(DEFAULT_VIEW)).toEqual({ search: null, entity: null, state: null, page: null });
    expect(queryOf({ search: 'pay', entity: null, state: 'archived', page: 2 })).toEqual({
      search: 'pay',
      entity: null,
      state: 'archived',
      page: 2,
    });
  });

  it('tells two views apart by what they show, not by which object holds them', () => {
    expect(sameView(DEFAULT_VIEW, { ...DEFAULT_VIEW })).toBe(true);
    expect(sameView(DEFAULT_VIEW, { ...DEFAULT_VIEW, page: 2 })).toBe(false);
  });
});
