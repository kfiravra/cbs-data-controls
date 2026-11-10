import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, firstValueFrom, map, of, switchMap } from 'rxjs';

import { ApiError, toApiError } from '../../core/api/api-error';
import { DefinitionError, Page, ResultItem, ResultsQuery, ResultsSort, Run, SortDirection } from '../../core/api/api.types';
import { ControlsApi } from '../../core/api/controls.api';
import { RunsApi } from '../../core/api/runs.api';
import { MarksService } from '../../core/definition/marks.service';
import { GlossaryService } from '../../core/glossary/glossary.service';

export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZES = [10, 25, 50, 100] as const;

/** What the results screen shows of a run's rows; it lives in the query parameters of the address. */
export interface ResultsView {
  readonly page: number;
  readonly size: number;
  readonly search: string;
  /** The node the rows are filtered by; null for all violations. */
  readonly condition: string | null;
  readonly sort: ResultsSort;
  readonly dir: SortDirection;
}

export type LoadState = 'loading' | 'ready' | 'notFound' | 'failed';

/** What stands where the rows would be, chosen from the run. */
export type RunState =
  | 'running'
  | 'noViolations'
  | 'violations'
  | 'timedOut'
  | 'outdated'
  | 'failed';

const NO_MARKS: ReadonlyMap<string, string> = new Map();

type Rows = { readonly page: Page<ResultItem> } | { readonly failure: ApiError };

/**
 * The state of the results screen, provided by its page: the run, the marks of the version that ran, and
 * the current page of its violations. Everything after the run itself is read from the stored snapshot.
 */
@Injectable()
export class ResultsStore {
  private readonly glossaryService = inject(GlossaryService);
  private readonly runsApi = inject(RunsApi);
  private readonly controlsApi = inject(ControlsApi);
  private readonly marksService = inject(MarksService);
  private readonly asked = new Subject<{ runId: number; query: ResultsQuery }>();

  readonly glossary = this.glossaryService.glossary;
  readonly glossaryError = this.glossaryService.error;

  readonly loadState = signal<LoadState>('loading');
  readonly run = signal<Run | null>(null);
  /** A failed load of the run or of its rows, or a run that could not be started again. */
  readonly failure = signal<ApiError | null>(null);
  /** Node id to mark, from the definition of the version that ran; empty when it could not be read. */
  readonly marks = signal<ReadonlyMap<string, string>>(NO_MARKS);
  readonly rows = signal<Page<ResultItem> | null>(null);
  readonly rowsLoading = signal(false);
  readonly rerunning = signal(false);
  readonly traced = signal<string | null>(null);

  readonly state = computed<RunState | null>(() => {
    const run = this.run();
    switch (run?.status) {
      case undefined:
        return null;
      case 'running':
        return 'running';
      case 'timed_out':
        return 'timedOut';
      case 'failed':
        return run.error?.code === 'CONTROL_DEFINITION_OUTDATED' ? 'outdated' : 'failed';
      case 'succeeded':
        return run.totalCount === 0 ? 'noViolations' : 'violations';
    }
  });

  /** The marks of the conditions an outdated run could not use, in the order of the definition. */
  readonly outdatedMarks = computed(() => {
    const errors = (this.run()?.error?.params['errors'] ?? []) as readonly DefinitionError[];
    const ids = new Set(errors.flatMap((error) => (error.nodeId ? [error.nodeId] : [])));
    return [...this.marks()].filter(([id]) => ids.has(id)).map(([, mark]) => mark);
  });

  constructor() {
    // the newest question wins: an older page never replaces a newer one
    this.asked
      .pipe(
        switchMap(({ runId, query }) =>
          this.runsApi.results(runId, query).pipe(
            map((page): Rows => ({ page })),
            catchError((error: unknown) => of<Rows>({ failure: toApiError(error) })),
          ),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((rows) => {
        this.rowsLoading.set(false);
        if ('page' in rows) {
          this.rows.set(rows.page);
        } else {
          this.failure.set(rows.failure);
        }
      });
  }

  /** Reads a run, the definition of the version that ran (for the marks), and the glossary (for labels). */
  async open(runId: number): Promise<void> {
    this.loadState.set('loading');
    this.run.set(null);
    this.rows.set(null);
    this.marks.set(NO_MARKS);
    this.failure.set(null);
    void this.glossaryService.load();
    try {
      const run = await firstValueFrom(this.runsApi.get(runId));
      this.run.set(run);
      this.loadState.set('ready');
      void this.readMarks(run);
    } catch (error) {
      const failure = toApiError(error);
      this.loadState.set(failure.status === 404 ? 'notFound' : 'failed');
      this.failure.set(failure.status === 404 ? null : failure);
    }
  }

  /** Asks for the page of rows a view describes. Only a run with violations has rows. */
  show(view: ResultsView): void {
    const run = this.run();
    if (!run || this.state() !== 'violations') {
      return;
    }
    this.rowsLoading.set(true);
    this.failure.set(null);
    this.asked.next({
      runId: run.id,
      query: {
        page: view.page,
        pageSize: view.size,
        search: view.search,
        condition: view.condition ?? undefined,
        sort: view.sort,
        dir: view.dir,
      },
    });
  }

  /** Runs the control again; the new run, or null when it could not be started. */
  async rerun(): Promise<Run | null> {
    const run = this.run();
    if (!run || this.rerunning()) {
      return null;
    }
    this.rerunning.set(true);
    this.failure.set(null);
    try {
      return await firstValueFrom(this.runsApi.start(run.controlId));
    } catch (error) {
      this.failure.set(toApiError(error));
      return null;
    } finally {
      this.rerunning.set(false);
    }
  }

  private async readMarks(run: Run): Promise<void> {
    try {
      const version = await firstValueFrom(this.controlsApi.version(run.controlId, run.controlVersion));
      if (this.run()?.id === run.id) {
        this.marks.set(this.marksService.of(version.definition.where));
      }
    } catch {
      // without the version's definition the screen stays readable: reasons and clauses stand without marks
      this.marks.set(NO_MARKS);
    }
  }
}
