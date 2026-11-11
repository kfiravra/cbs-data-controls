import { ActivatedRouteSnapshot } from '@angular/router';

import { ControlsSort } from '../../core/api/api.types';
import { ListState, ListView } from './list.store';

export const LIST_STATES: readonly ListState[] = ['active', 'archived'];
export const LIST_SORTS: readonly ControlsSort[] = ['name', 'rootEntity', 'lastRun', 'violations'];
export const DEFAULT_VIEW: ListView = { search: '', entity: null, state: 'active', sort: 'name', dir: 'asc', page: 1 };

/** What the address shows: the list alone with its view, or a panel over it. */
export interface Address {
  /** The path of the open panel (`runs/12`, `controls/new`); null when the list stands alone. */
  readonly panel: string | null;
  /** The list's view as the address describes it; null under a panel, whose query is its own. */
  readonly own: ListView | null;
}

/**
 * Reads the address from the list's route: a child route is a panel, and then the query belongs to the
 * panel (its `page` and `search` are not the list's). Anything the address does not say is the default.
 */
export function addressOf(route: ActivatedRouteSnapshot): Address {
  const child = route.firstChild;
  if (child) {
    return { panel: child.url.map((segment) => segment.path).join('/'), own: null };
  }
  const query = route.queryParamMap;
  const state = query.get('state');
  const sort = query.get('sort');
  const page = query.get('page');
  return {
    panel: null,
    own: {
      search: query.get('search') ?? '',
      entity: query.get('entity') || null,
      state: LIST_STATES.find((candidate) => candidate === state) ?? 'active',
      sort: LIST_SORTS.find((candidate) => candidate === sort) ?? 'name',
      dir: query.get('dir') === 'desc' ? 'desc' : 'asc',
      page: page && /^[1-9]\d*$/.test(page) ? Number(page) : 1,
    },
  };
}

/** The query parameters of a view: what is the default is left out of the address. */
export function queryOf(view: ListView): Record<string, string | number | null> {
  const entries = Object.entries(view) as [keyof ListView, string | number | null][];
  return Object.fromEntries(entries.map(([name, value]) => [name, value === DEFAULT_VIEW[name] ? null : value]));
}

export function sameView(a: ListView, b: ListView): boolean {
  return (Object.keys(DEFAULT_VIEW) as (keyof ListView)[]).every((name) => a[name] === b[name]);
}
