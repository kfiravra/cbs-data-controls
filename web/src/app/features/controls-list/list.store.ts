import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, firstValueFrom, map, of, switchMap } from 'rxjs';

import { ApiError, toApiError } from '../../core/api/api-error';
import { ActiveFilter, ControlSummary, ControlsQuery, Page } from '../../core/api/api.types';
import { ControlsApi } from '../../core/api/controls.api';
import { RunsApi } from '../../core/api/runs.api';
import { GlossaryService } from '../../core/glossary/glossary.service';

export const LIST_PAGE_SIZE = 25;

export type ListState = 'active' | 'archived' | 'all';

/** What the list shows; it lives in the query parameters of the address. */
export interface ListView {
  readonly search: string;
  /** The root entity the list is narrowed to; null for all. */
  readonly entity: string | null;
  readonly state: ListState;
  readonly page: number;
}

const ACTIVE: Record<ListState, ActiveFilter> = { active: 'true', archived: 'false', all: 'all' };

type Listed = { readonly page: Page<ControlSummary> } | { readonly failure: ApiError };

/**
 * The state of the controls list, provided by its page: the current page of controls and the controls that
 * are running now. A run from the list stays on the list: the row's result is replaced in place.
 */
@Injectable()
export class ListStore {
  private readonly glossaryService = inject(GlossaryService);
  private readonly controlsApi = inject(ControlsApi);
  private readonly runsApi = inject(RunsApi);
  private readonly asked = new Subject<ControlsQuery>();
  private last: ListView | null = null;

  readonly glossary = this.glossaryService.glossary;
  readonly glossaryError = this.glossaryService.error;
  readonly page = signal<Page<ControlSummary> | null>(null);
  readonly loading = signal(true);
  /** A list that could not be read. */
  readonly failure = signal<ApiError | null>(null);
  /** A run that could not be started. */
  readonly runFailure = signal<ApiError | null>(null);
  /**
   * Whether any control exists at all, archived ones included: asked only when the active list comes back
   * empty with nothing narrowing it, to tell a first use from a list whose controls are all archived.
   */
  readonly anyControl = signal<boolean | null>(null);
  /** The ids of the controls whose run is on its way. */
  readonly running = signal<ReadonlySet<number>>(new Set());

  constructor() {
    // the newest question wins: an older page never replaces a newer one
    this.asked
      .pipe(
        switchMap((query) =>
          this.controlsApi.list(query).pipe(
            map((page): Listed => ({ page })),
            catchError((error: unknown) => of<Listed>({ failure: toApiError(error) })),
          ),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((listed) => {
        this.loading.set(false);
        if ('page' in listed) {
          this.page.set(listed.page);
          void this.learnWhetherAnyExists(listed.page);
        } else {
          // the rows of an older question would stand under the new search and filters
          this.page.set(null);
          this.failure.set(listed.failure);
        }
      });
  }

  private async learnWhetherAnyExists(page: Page<ControlSummary>): Promise<void> {
    const view = this.last;
    if (!view || page.total > 0 || view.search !== '' || view.entity !== null || view.state === 'archived') {
      return;
    }
    if (view.state === 'all') {
      this.anyControl.set(false);
      return;
    }
    try {
      const all = await firstValueFrom(this.controlsApi.list({ active: 'all', page: 1, pageSize: 1 }));
      this.anyControl.set(all.total > 0);
    } catch {
      // not knowing is no failure of the list: the empty list stands without either explanation
      this.anyControl.set(null);
    }
  }

  /** Asks for the page a view describes. The glossary is read beside it, for the labels. */
  show(view: ListView): void {
    this.last = view;
    this.loading.set(true);
    this.failure.set(null);
    this.anyControl.set(null);
    void this.glossaryService.load();
    this.asked.next({
      search: view.search,
      rootEntity: view.entity ?? undefined,
      active: ACTIVE[view.state],
      page: view.page,
      pageSize: LIST_PAGE_SIZE,
    });
  }

  /** Reads the current view again: after controls were created, or to try again. */
  reload(): void {
    if (this.last) {
      this.show(this.last);
    }
  }

  /** Runs a control and puts the finished run on its row, whatever its outcome. */
  async run(control: ControlSummary): Promise<void> {
    if (this.running().has(control.id)) {
      return;
    }
    this.running.update((ids) => new Set(ids).add(control.id));
    this.runFailure.set(null);
    try {
      const run = await firstValueFrom(this.runsApi.start(control.id));
      const lastRun = { id: run.id, startedAt: run.startedAt, status: run.status, totalCount: run.totalCount };
      this.page.update(
        (page) =>
          page && { ...page, items: page.items.map((item) => (item.id === control.id ? { ...item, lastRun } : item)) },
      );
    } catch (error) {
      this.runFailure.set(toApiError(error));
    } finally {
      this.running.update((ids) => new Set([...ids].filter((id) => id !== control.id)));
    }
  }
}
