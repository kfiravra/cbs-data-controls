import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, firstValueFrom, forkJoin, map, of, switchMap } from 'rxjs';

import { ApiError, toApiError } from '../../core/api/api-error';
import {
  ActiveFilter,
  ControlSummary,
  ControlsQuery,
  ControlsSort,
  LastRun,
  Page,
  SortDirection,
} from '../../core/api/api.types';
import { ControlsApi } from '../../core/api/controls.api';
import { RunsApi } from '../../core/api/runs.api';
import { GlossaryService } from '../../core/glossary/glossary.service';

export const LIST_PAGE_SIZE = 25;

/** The two tabs of the list: the controls that can run, and the archive. */
export type ListState = 'active' | 'archived';

/** What the list shows; it lives in the query parameters of the address. */
export interface ListView {
  readonly search: string;
  /** The root entity the list is narrowed to; null for all. */
  readonly entity: string | null;
  readonly state: ListState;
  /** The column the list is ordered by, and which way; the order itself is the server's. */
  readonly sort: ControlsSort;
  readonly dir: SortDirection;
  readonly page: number;
}

/** How many controls each tab holds under the search and the filter; null while it is not known. */
export type TabCounts = Readonly<Record<ListState, number | null>>;

const ACTIVE: Record<ListState, ActiveFilter> = { active: 'true', archived: 'false' };
const OTHER: Record<ListState, ListState> = { active: 'archived', archived: 'active' };
const UNKNOWN: TabCounts = { active: null, archived: null };
const UNSORTED = { sort: undefined, dir: undefined };

type Listed = { readonly page: Page<ControlSummary> } | { readonly failure: ApiError };

interface Answer {
  readonly state: ListState;
  readonly listed: Listed;
  /** The number of controls in the other tab; null when it could not be read. */
  readonly other: number | null;
}

/**
 * The state of the controls list, provided by its page: the current page of controls, the count of each
 * tab, and the controls that are running now. A run from the list stays on the list: the row's result is
 * replaced in place.
 */
@Injectable()
export class ListStore {
  private readonly glossaryService = inject(GlossaryService);
  private readonly controlsApi = inject(ControlsApi);
  private readonly runsApi = inject(RunsApi);
  private readonly asked = new Subject<{ readonly state: ListState; readonly query: ControlsQuery }>();
  private last: ListView | null = null;

  readonly glossary = this.glossaryService.glossary;
  readonly glossaryError = this.glossaryService.error;
  readonly page = signal<Page<ControlSummary> | null>(null);
  readonly counts = signal<TabCounts>(UNKNOWN);
  readonly loading = signal(true);
  /** A list that could not be read. */
  readonly failure = signal<ApiError | null>(null);
  /** A run that could not be started. */
  readonly runFailure = signal<ApiError | null>(null);
  /** A control that could not be archived. */
  readonly archiveFailure = signal<ApiError | null>(null);
  /** The ids of the controls whose run is on its way. */
  readonly running = signal<ReadonlySet<number>>(new Set());

  constructor() {
    // the newest question wins: an older page never replaces a newer one. The other tab's count is asked
    // beside the page (one control of it, for its total): not knowing it is no failure of the list
    this.asked
      .pipe(
        switchMap(({ state, query }) =>
          forkJoin({
            listed: this.controlsApi.list(query).pipe(
              map((page): Listed => ({ page })),
              catchError((error: unknown) => of<Listed>({ failure: toApiError(error) })),
            ),
            // one control of the other tab, for its total: in no order, so the server sorts nothing for it
            other: this.controlsApi.list({ ...query, ...UNSORTED, active: ACTIVE[OTHER[state]], page: 1, pageSize: 1 }).pipe(
              map((page): number | null => page.total),
              catchError(() => of(null)),
            ),
          }).pipe(map((answer): Answer => ({ state, ...answer }))),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(({ state, listed, other }) => {
        this.loading.set(false);
        if ('page' in listed) {
          this.page.set(listed.page);
          const total = listed.page.total;
          this.counts.set(state === 'active' ? { active: total, archived: other } : { active: other, archived: total });
        } else {
          // the rows of an older question would stand under the new search and filters
          this.page.set(null);
          this.counts.set(UNKNOWN);
          this.failure.set(listed.failure);
        }
      });
  }

  /** Asks for the page a view describes. The glossary is read beside it, for the labels. */
  show(view: ListView): void {
    this.last = view;
    this.loading.set(true);
    this.failure.set(null);
    void this.glossaryService.load();
    this.asked.next({
      state: view.state,
      query: {
        search: view.search,
        rootEntity: view.entity ?? undefined,
        active: ACTIVE[view.state],
        sort: view.sort,
        dir: view.dir,
        page: view.page,
        pageSize: LIST_PAGE_SIZE,
      },
    });
  }

  /** Reads the current view again: after controls were created, changed or archived, or to try again. */
  reload(): void {
    if (this.last) {
      this.show(this.last);
    }
  }

  /**
   * Runs a control and puts the finished run on its row, whatever its outcome. Answers with the run as the
   * row now shows it; null when the control was already running or the run could not be started.
   */
  async run(control: ControlSummary): Promise<LastRun | null> {
    if (this.running().has(control.id)) {
      return null;
    }
    this.running.update((ids) => new Set(ids).add(control.id));
    this.runFailure.set(null);
    try {
      const run = await firstValueFrom(this.runsApi.start(control.id));
      const lastRun: LastRun = { id: run.id, startedAt: run.startedAt, status: run.status, totalCount: run.totalCount };
      this.page.update(
        (page) =>
          page && { ...page, items: page.items.map((item) => (item.id === control.id ? { ...item, lastRun } : item)) },
      );
      return lastRun;
    } catch (error) {
      this.runFailure.set(toApiError(error));
      return null;
    } finally {
      this.running.update((ids) => new Set([...ids].filter((id) => id !== control.id)));
    }
  }

  /** Archives a control: it leaves the active tab for the archive, with its runs. True when it did. */
  async archive(control: ControlSummary): Promise<boolean> {
    this.archiveFailure.set(null);
    try {
      await firstValueFrom(this.controlsApi.archive(control.id));
      this.reload();
      return true;
    } catch (error) {
      this.archiveFailure.set(toApiError(error));
      return false;
    }
  }
}
