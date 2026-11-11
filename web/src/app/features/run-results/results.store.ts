import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, firstValueFrom, map, of, switchMap } from 'rxjs';

import { ApiError, toApiError } from '../../core/api/api-error';
import {
  Control,
  Definition,
  DefinitionError,
  Page,
  ResultItem,
  ResultsQuery,
  Run,
  SortDirection,
  TextPart,
} from '../../core/api/api.types';
import { ControlsApi } from '../../core/api/controls.api';
import { RunsApi } from '../../core/api/runs.api';
import { MarksService } from '../../core/definition/marks.service';
import { GlossaryService } from '../../core/glossary/glossary.service';
import { REASONS_COLUMN } from '../../shared/results-table/results-table.component';

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
  /**
   * The column the records are sorted by: the key of an identifying field, the reasons column
   * (`REASONS_COLUMN`), or null for the order of the run. The order itself is the server's.
   */
  readonly sort: string | null;
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

/** A view's order in the api's words: a column is an identifying field unless it is the reasons column. */
function sortOf(view: ResultsView): Pick<ResultsQuery, 'sort' | 'field' | 'dir'> {
  if (view.sort === null) {
    return { sort: 'key', dir: view.dir };
  }
  return view.sort === REASONS_COLUMN
    ? { sort: 'reasons', dir: view.dir }
    : { sort: 'field', field: view.sort, dir: view.dir };
}

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
  /**
   * The rule in the engine's words where no run carries it: a control with no run, or a run that stopped
   * before it had one. Null when the engine did not say.
   */
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

  /**
   * Whether a control is active, as last read beside one of its runs; null until read, and when it cannot
   * be. Kept by the control's id, as its runs are: another run of the same control knows it at once.
   */
  private readonly controlState = signal<{ readonly id: number; readonly active: boolean } | null>(null);

  /** The control the panel is about. */
  readonly controlId = computed(() => this.run()?.controlId ?? this.control()?.id ?? null);

  /** The control is in the archive: its runs are read, and it is neither run nor edited. */
  readonly archived = computed(() => {
    const state = this.controlState();
    const known = state?.id === this.controlId() ? state.active : null;
    return (this.control()?.isActive ?? known) === false;
  });

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
      void this.readControlState(run);
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
      void this.readSentence(() => this.control()?.id === control.id, control.definition);
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
        ...sortOf(view),
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
        if (run.sentenceParts === null) {
          // a run that stopped has no sentence of its own: the rule it was running is asked for once
          void this.readSentence(() => this.run()?.id === run.id, version.definition);
        }
      }
    } catch {
      // without the version's definition the screen stays readable: reasons and clauses stand without marks
      if (this.run()?.id === run.id) {
        this.marks.set(NO_MARKS);
      }
    }
  }

  /**
   * A run does not say whether its control is archived; the control does. Until it answers, and when it
   * does not, the panel offers the run and the edit: the api refuses them for an archived control.
   */
  private async readControlState(run: Run): Promise<void> {
    try {
      const control = await firstValueFrom(this.controlsApi.get(run.controlId));
      if (this.run()?.id === run.id) {
        this.controlState.set({ id: control.id, active: control.isActive });
      }
    } catch {
      // not knowing is no failure of the panel: the run stays readable, with its buttons
      if (this.run()?.id === run.id) {
        this.controlState.set(null);
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

  /**
   * Asks the engine for a definition's sentence; `current` says whether the answer is still wanted. The rule
   * in words is the engine's: when it does not say, the name and the state stand without it.
   */
  private async readSentence(current: () => boolean, definition: Definition): Promise<void> {
    const parts = await firstValueFrom(
      this.controlsApi.validate(definition).pipe(
        map((answer): readonly TextPart[] | null => answer.sentenceParts),
        catchError(() => of(null)),
      ),
    );
    if (parts !== null && current()) {
      this.controlSentence.set(parts);
    }
  }
}
