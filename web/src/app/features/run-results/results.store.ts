import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, firstValueFrom, map, of, switchMap } from 'rxjs';

import { ApiError, toApiError } from '../../core/api/api-error';
import {
  Control,
  DefinitionError,
  Page,
  ResultItem,
  ResultsQuery,
  ResultsSort,
  Run,
  SortDirection,
  TextPart,
} from '../../core/api/api.types';
import { ControlsApi } from '../../core/api/controls.api';
import { RunsApi } from '../../core/api/runs.api';
import { MarksService } from '../../core/definition/marks.service';
import { GlossaryService } from '../../core/glossary/glossary.service';

export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZES = [10, 25, 50, 100] as const;
/** How many of a control's runs the picker offers, newest first. */
export const HISTORY_SIZE = 50;

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

/** What stands where the rows would be, chosen from the run; `neverRun` is a control with no run to show. */
export type RunState =
  | 'neverRun'
  | 'running'
  | 'noViolations'
  | 'violations'
  | 'timedOut'
  | 'outdated'
  | 'failed';

const NO_MARKS: ReadonlyMap<string, string> = new Map();

type Rows = { readonly page: Page<ResultItem> } | { readonly failure: ApiError };

/**
 * The state of the results panel, provided by its page: the run, the marks of the version that ran, the
 * current page of its violations and the control's other runs. Everything after the run itself is read from
 * the stored snapshot. Opened by a control and not by a run, it holds the control with no run yet.
 */
@Injectable()
export class ResultsStore {
  private readonly glossaryService = inject(GlossaryService);
  private readonly runsApi = inject(RunsApi);
  private readonly controlsApi = inject(ControlsApi);
  private readonly marksService = inject(MarksService);
  /** The page of rows to read; null drops a request that is on its way (another run was opened). */
  private readonly asked = new Subject<{ runId: number; query: ResultsQuery } | null>();
  /** Counts the calls of `open` and `openControl`: an older one that lands after a newer one changes nothing. */
  private turn = 0;

  readonly glossary = this.glossaryService.glossary;
  readonly glossaryError = this.glossaryService.error;

  readonly loadState = signal<LoadState>('loading');
  readonly run = signal<Run | null>(null);
  /** The control, when the panel was opened by it and it has no run. */
  readonly control = signal<Control | null>(null);
  /** The rule of a control with no run, in the engine's words; null when the engine did not say. */
  private readonly controlSentence = signal<readonly TextPart[] | null>(null);
  /** A failed load of the run or of its rows. */
  readonly failure = signal<ApiError | null>(null);
  /** A run that could not be started. */
  readonly rerunFailure = signal<ApiError | null>(null);
  /** Node id to mark, from the definition of the version that ran; empty when it could not be read. */
  readonly marks = signal<ReadonlyMap<string, string>>(NO_MARKS);
  readonly rows = signal<Page<ResultItem> | null>(null);
  readonly rowsLoading = signal(false);
  readonly rerunning = signal(false);
  /** The control's runs, newest first, as far as `HISTORY_SIZE`; null until read, and when they cannot be. */
  readonly history = signal<Page<Run> | null>(null);

  /** The control the panel is about. */
  readonly controlId = computed(() => this.run()?.controlId ?? this.control()?.id ?? null);

  readonly sentenceParts = computed(() => this.run()?.sentenceParts ?? this.controlSentence());

  readonly state = computed<RunState | null>(() => {
    const run = this.run();
    switch (run?.status) {
      case undefined:
        return this.control() ? 'neverRun' : null;
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
        switchMap((question) =>
          question === null
            ? EMPTY
            : this.runsApi.results(question.runId, question.query).pipe(
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

  private begin(): number {
    this.asked.next(null);
    this.loadState.set('loading');
    this.run.set(null);
    this.control.set(null);
    this.controlSentence.set(null);
    this.rows.set(null);
    this.rowsLoading.set(false);
    this.marks.set(NO_MARKS);
    this.failure.set(null);
    this.rerunFailure.set(null);
    void this.glossaryService.load();
    return ++this.turn;
  }

  private fail(error: unknown): void {
    const failure = toApiError(error);
    this.loadState.set(failure.status === 404 ? 'notFound' : 'failed');
    this.failure.set(failure.status === 404 ? null : failure);
  }

  /**
   * Reads a run, the definition of the version that ran (for the marks), the control's other runs (for the
   * picker) and the glossary (for labels).
   */
  async open(runId: number): Promise<void> {
    const turn = this.begin();
    try {
      const run = await firstValueFrom(this.runsApi.get(runId));
      if (turn !== this.turn) {
        return;
      }
      // the runs of another control are not this run's history
      if (this.history()?.items[0]?.controlId !== run.controlId) {
        this.history.set(null);
      }
      this.run.set(run);
      this.loadState.set('ready');
      void this.readMarks(run);
      void this.readHistory(run.controlId);
    } catch (error) {
      if (turn === this.turn) {
        this.fail(error);
      }
    }
  }

  /**
   * Opens the panel by a control. Answers the id of its newest run, which the panel then shows; null when
   * the control has none, and then the store holds the control itself: its name, its rule and its state.
   */
  async openControl(controlId: number): Promise<number | null> {
    const turn = this.begin();
    this.history.set(null);
    try {
      const runs = await firstValueFrom(this.controlsApi.runs(controlId, { page: 1, pageSize: 1 }));
      if (turn !== this.turn) {
        return null;
      }
      if (runs.items.length > 0) {
        return runs.items[0].id;
      }
      const control = await firstValueFrom(this.controlsApi.get(controlId));
      if (turn !== this.turn) {
        return null;
      }
      this.control.set(control);
      this.marks.set(this.marksService.of(control.definition.where));
      this.loadState.set('ready');
      void this.readSentence(control);
    } catch (error) {
      if (turn === this.turn) {
        this.fail(error);
      }
    }
    return null;
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

  /** Runs the control, again or for the first time; the new run, or null when it could not be started. */
  async rerun(): Promise<Run | null> {
    const controlId = this.controlId();
    if (controlId === null || this.rerunning()) {
      return null;
    }
    this.rerunning.set(true);
    this.rerunFailure.set(null);
    try {
      return await firstValueFrom(this.runsApi.start(controlId));
    } catch (error) {
      this.rerunFailure.set(toApiError(error));
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
      if (this.run()?.id === run.id) {
        this.marks.set(NO_MARKS);
      }
    }
  }

  private async readHistory(controlId: number): Promise<void> {
    try {
      const history = await firstValueFrom(this.controlsApi.runs(controlId, { page: 1, pageSize: HISTORY_SIZE }));
      if (this.controlId() === controlId) {
        this.history.set(history);
      }
    } catch {
      // without its other runs the run stays readable: the head says when it ran, and offers no other
      if (this.controlId() === controlId) {
        this.history.set(null);
      }
    }
  }

  private async readSentence(control: Control): Promise<void> {
    try {
      const answer = await firstValueFrom(this.controlsApi.validate(control.definition));
      if (this.control()?.id === control.id) {
        this.controlSentence.set(answer.sentenceParts);
      }
    } catch {
      // the rule in words is the engine's: without it the name and the state still stand
    }
  }
}
