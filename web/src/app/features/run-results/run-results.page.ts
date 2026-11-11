import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, untracked } from '@angular/core';
import { MatFormField } from '@angular/material/form-field';
import { MatOption, MatSelect, MatSelectTrigger } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { Run } from '../../core/api/api.types';
import { findEntity } from '../../core/glossary/glossary.lookups';
import { CountedService } from '../../core/i18n/counted.service';
import { FormatService } from '../../core/i18n/format.service';
import { LanguageService } from '../../core/i18n/language.service';
import { ListChanges } from '../../core/list/list-changes';
import { BannerComponent } from '../../shared/banner/banner.component';
import { ErrorBannerComponent } from '../../shared/banner/error-banner.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { NotFoundComponent } from '../../shared/not-found/not-found.component';
import { PageHeadComponent } from '../../shared/page-head/page-head.component';
import { DisplaySort, ResultColumn, ResultsTableComponent } from '../../shared/results-table/results-table.component';
import { PreviousRunFact, RunFact, RunOverviewComponent } from '../../shared/run-overview/run-overview.component';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { StatePanelComponent } from '../../shared/state-panel/state-panel.component';
import { TableFootComponent } from '../../shared/table-foot/table-foot.component';
import { TextPartsComponent } from '../../shared/text-parts/text-parts.component';
import { ToolbarComponent } from '../../shared/toolbar/toolbar.component';
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, REASONS_COLUMN, ResultsStore, ResultsView } from './results.store';

const NUMBER = /^[1-9]\d*$/;
const positive = (text: string | undefined, fallback: number) => (text && NUMBER.test(text) ? Number(text) : fallback);

/** A run in the picker of the control's runs. */
interface RunOption {
  readonly id: number;
  /** When it ran and what it found, on one line. */
  readonly text: string;
}

/**
 * The results panel: one run of a control. From the top: the control in words on a tint; one block with
 * what the run found (the count, the run's facts, the count by condition, which filters); the violating
 * records with the reason for each, as wide as the panel; and at the foot, always in view, how many are
 * shown and the pager. The head holds a picker of the control's other runs. Opened by a control with no run
 * yet, it shows the control's rule, that it has not run, and a run button. An archived control is read the
 * same way and is neither run nor edited. Search, filter, sort and paging live in the address, so back and
 * reload keep them.
 */
@Component({
  selector: 'app-run-results-page',
  imports: [
    BannerComponent,
    ErrorBannerComponent,
    IconComponent,
    MatFormField,
    MatOption,
    MatSelect,
    MatSelectTrigger,
    NotFoundComponent,
    PageHeadComponent,
    ResultsTableComponent,
    RouterLink,
    RunOverviewComponent,
    SkeletonComponent,
    StatePanelComponent,
    TableFootComponent,
    TextPartsComponent,
    ToolbarComponent,
    TranslatePipe,
  ],
  providers: [ResultsStore],
  templateUrl: './run-results.page.html',
  host: { class: 'sheet__screen' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RunResultsPage {
  protected readonly store = inject(ResultsStore);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly format = inject(FormatService);
  private readonly language = inject(LanguageService);
  private readonly countedText = inject(CountedService);
  private readonly listChanges = inject(ListChanges);

  protected readonly pageSizes = PAGE_SIZES;
  /**
   * True once the panel was left (its X, Esc, another address). An answer that lands after that (a run that
   * was on its way, the newest run of a control) must not navigate: it would open the panel again.
   */
  private left = false;

  /** The run's id, on the address of a run. */
  readonly id = input<string>();
  /** The control's id, on the address of a control's results: its newest run, or none yet. */
  readonly controlId = input<string>();
  readonly page = input<string>();
  readonly size = input<string>();
  readonly search = input<string>();
  readonly condition = input<string>();
  readonly sort = input<string>();
  readonly dir = input<string>();

  /** What the address names: a run, a control, or nothing (an id is a positive integer). */
  private readonly target = computed<{ readonly run: number } | { readonly control: number } | null>(() => {
    const run = this.id();
    const control = this.controlId();
    if (run !== undefined) {
      return NUMBER.test(run) ? { run: Number(run) } : null;
    }
    return control !== undefined && NUMBER.test(control) ? { control: Number(control) } : null;
  });

  protected readonly notFound = computed(() => this.target() === null || this.store.loadState() === 'notFound');

  /** The view the address describes; anything the address does not say is the default. */
  protected readonly view = computed<ResultsView>(() => {
    const size = positive(this.size(), DEFAULT_PAGE_SIZE);
    return {
      page: positive(this.page(), 1),
      size: (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE,
      search: this.search() ?? '',
      condition: this.condition() || null,
      sort: this.sortColumn(),
      dir: this.dir() === 'desc' ? 'desc' : 'asc',
    };
  });

  protected readonly displaySort = computed<DisplaySort>(() => {
    const { sort, dir } = this.view();
    return sort === null ? null : { column: sort, dir };
  });

  /** Every order the records can take, for the select that sorts where the table has no head (below 640px). */
  protected readonly sortOptions = computed(() =>
    [...this.columns().map((column) => ({ key: column.key, label: column.label })), { key: REASONS_COLUMN, label: this.text('results.table.reasons') }].flatMap(
      (column) => (['asc', 'desc'] as const).map((dir) => ({ value: `${column.key}:${dir}`, text: `results.sort.${dir}`, column: column.label })),
    ),
  );

  /**
   * The column the address asks to sort by, when the table has it: the reasons, or an identifying field of
   * the records. Anything else (an older link, a field of another control) is the order of the run.
   */
  private readonly sortColumn = computed(() => {
    const asked = this.sort();
    const known = asked === REASONS_COLUMN || this.columns().some((column) => column.key === asked);
    return asked && known ? asked : null;
  });

  private readonly entity = computed(() => {
    const glossary = this.store.glossary();
    const key = this.store.run()?.rootEntity ?? this.store.control()?.rootEntity;
    return glossary && key ? findEntity(glossary, key) : undefined;
  });

  /** The label of the records a run checked; a dash while the glossary cannot be read. */
  protected readonly entityLabel = computed(
    () => this.language.text(this.entity()?.label.plural) || this.text('common.none'),
  );

  /** A column per identifying field, in the glossary's order: a JSON object has none. */
  protected readonly columns = computed<ResultColumn[]>(() => {
    const entity = this.entity();
    const keys = entity?.identifyingFields ?? Object.keys(this.store.rows()?.items[0]?.display ?? {});
    return keys.map((key) => {
      const field = entity?.fields.find((candidate) => candidate.key === key);
      return { key, field, label: this.language.text(field?.label) || this.text('common.none') };
    });
  });

  protected readonly title = computed(
    () => this.store.run()?.controlName ?? this.store.control()?.name ?? this.text('results.title'),
  );

  /**
   * The control's runs for the picker, newest first: offered when there is another run to choose. The run
   * on the screen is always among them, also when it is older than the ones that were read.
   */
  protected readonly runs = computed<RunOption[] | null>(() => {
    const current = this.store.run();
    const history = this.store.history();
    if (!current || !history || history.total < 2) {
      return null;
    }
    const runs = history.items.some((run) => run.id === current.id)
      ? history.items
      : [...history.items, current].sort((a, b) => b.startedAt.localeCompare(a.startedAt) || b.id - a.id);
    return runs.map((run) => ({ id: run.id, text: this.runText(run) }));
  });

  protected readonly pickedText = computed(() => {
    const id = this.store.run()?.id;
    return this.runs()?.find((option) => option.id === id)?.text ?? '';
  });

  /** The picker says when the run was; the line beside it then says only which version ran. */
  protected readonly meta = computed(() => {
    const run = this.store.run();
    if (!run) {
      return undefined;
    }
    return this.runs()
      ? this.text('results.metaVersion', { version: run.controlVersion })
      : this.text('results.meta', {
          date: this.format.date(run.startedAt),
          time: this.format.time(run.startedAt),
          version: run.controlVersion,
        });
  });

  protected readonly noun = computed(() => this.counted('results.noun', this.store.run()?.totalCount ?? 0));

  /**
   * Why a failed run stopped, in the past tense of its code (`results.failed.reasons` holds the codes of
   * contracts/api.md, `RunError`); a code with no text of its own there reads as a fault.
   */
  protected readonly failedReason = computed(() => {
    const key = `results.failed.reasons.${this.store.run()?.error?.code ?? 'INTERNAL_ERROR'}`;
    return this.translate.instant(key) === key ? 'results.failed.reasons.INTERNAL_ERROR' : key;
  });

  protected readonly facts = computed<RunFact[]>(() => {
    const run = this.store.run();
    if (!run) {
      return [];
    }
    // counted as it is shown, to one decimal: 1,020 ms is "one second", 412 ms is "0.4 seconds". A run that
    // rounds to nothing (the engine answers the sample data in a few milliseconds) is said in words:
    // "0 seconds" reads as a run that did not happen
    const shown = Math.round((run.durationMs ?? 0) / 100) / 10;
    const seconds =
      shown === 0
        ? this.text('results.summary.durationUnder')
        : this.counted('results.seconds', shown, { count: this.format.seconds(run.durationMs ?? 0) });
    return [
      { label: this.text('results.summary.checked'), text: this.entityLabel() },
      { label: this.text('results.summary.duration'), text: seconds },
    ];
  });

  protected readonly previous = computed<PreviousRunFact | null>(() => {
    const earlier = this.store.run()?.previousRun;
    return earlier
      ? {
          label: this.text('results.summary.previous', { date: this.format.date(earlier.startedAt) }),
          text: this.counted('results.violations', earlier.totalCount),
          link: ['/runs', earlier.id],
        }
      : null;
  });

  protected readonly capParams = computed(() => {
    const run = this.store.run();
    return { total: this.format.number(run?.totalCount ?? 0), stored: this.format.number(run?.storedCount ?? 0) };
  });

  protected readonly timeoutParams = computed(() => ({
    timeoutSeconds: this.store.run()?.error?.params['timeoutSeconds'] ?? '',
  }));

  /** The outdated conditions by their marks: the label of a field that left the glossary no longer exists. */
  protected readonly outdatedText = computed(() => {
    const marks = this.store.outdatedMarks();
    if (marks.length === 0) {
      return this.text('errors.CONTROL_DEFINITION_OUTDATED.body');
    }
    const list = new Intl.ListFormat(this.language.locale, { type: 'conjunction' }).format(marks);
    return this.counted('results.outdated', marks.length, { marks: list });
  });

  /** Rows are on their way: the first page of a run, or a run that is starting again. */
  protected readonly tableLoading = computed(
    () => (this.store.rows() === null && this.store.rowsLoading()) || this.store.rerunning(),
  );

  /** True when the rows asked for are none because of the search or the filter, not because the run has none. */
  protected readonly nothingMatches = computed(() => {
    const view = this.view();
    return this.store.rows()?.total === 0 && (view.search !== '' || view.condition !== null);
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.left = true));
    effect(() => {
      const target = this.target();
      if (target) {
        untracked(() => void this.open(target));
      }
    });
    // the rows follow the address, once the run they belong to is there
    effect(() => {
      const view = this.view();
      if (this.store.state() === 'violations') {
        untracked(() => this.store.show(view));
      }
    });
  }

  /** The control this panel is about: the list gives the focus back to its row when the panel closes. */
  panelControl(): number | null {
    return this.store.controlId();
  }

  private async open(target: { readonly run: number } | { readonly control: number }): Promise<void> {
    if ('run' in target) {
      await this.store.open(target.run);
      return;
    }
    // a control with runs is shown by its newest one, at that run's own address
    const newest = await this.store.openControl(target.control);
    if (newest !== null && !this.left) {
      await this.router.navigate(['/runs', newest], { replaceUrl: true });
    }
  }

  private text(key: string, params: object = {}): string {
    return this.translate.instant(key, params) as string;
  }

  private counted(baseKey: string, count: number, params: Record<string, unknown> = {}): string {
    return this.countedText.text(baseKey, count, params);
  }

  /** A run as one line of the picker: its day and time, and what it found or how it ended. */
  private runText(run: Run): string {
    const result =
      run.status === 'succeeded'
        ? run.totalCount
          ? this.counted('results.picker.found', run.totalCount)
          : this.text('results.picker.none')
        : this.text(run.status === 'running' ? 'results.picker.running' : 'results.picker.stopped');
    return this.text('results.picker.option', {
      date: this.format.date(run.startedAt),
      time: this.format.time(run.startedAt),
      result,
    });
  }

  /** Changes the address; the view and the rows follow it. A change of what is shown goes back to page 1. */
  protected go(change: Partial<Record<keyof ResultsView, string | number | null>>): void {
    const defaults: Record<string, string | number | null> = {
      page: 1,
      size: DEFAULT_PAGE_SIZE,
      search: '',
      condition: null,
      sort: null,
      dir: 'asc',
    };
    const next: Record<string, string | number | null> = { ...this.view(), ...('page' in change ? {} : { page: 1 }), ...change };
    const queryParams = Object.fromEntries(
      Object.entries(next).map(([name, value]) => [name, value === defaults[name] ? null : value]),
    );
    void this.router.navigate([], { queryParams, replaceUrl: 'search' in change });
  }

  protected setSort(sort: DisplaySort): void {
    this.go({ sort: sort?.column ?? null, dir: sort?.dir ?? 'asc' });
  }

  /** An order chosen in the select, as `<column>:<direction>`, or `key` for the order of the run. */
  protected sortTo(value: string): void {
    const [column, direction] = value.split(':');
    this.setSort(value === 'key' ? null : { column, dir: direction === 'desc' ? 'desc' : 'asc' });
  }

  /** Another run of the control, chosen in the picker: its own address, with no search or filter carried over. */
  protected pick(runId: number): void {
    if (runId !== this.store.run()?.id) {
      void this.router.navigate(['/runs', runId]);
    }
  }

  /** Runs the control, again or for the first time, and shows the new run. */
  protected async rerun(): Promise<void> {
    const first = this.store.run() === null;
    const run = await this.store.rerun();
    if (run && this.left) {
      // the panel is gone: the list is told, so the control's row shows this run
      this.listChanges.report();
    }
    if (run && !this.left) {
      // the address of a control with no run does not stay in the history: Back would find a run there
      await this.router.navigate(['/runs', run.id], { replaceUrl: first });
    }
  }

  protected reload(): void {
    const target = this.target();
    if (target) {
      void this.open(target);
    }
  }

  protected editControl(): void {
    void this.router.navigate(['/controls', this.store.controlId()]);
  }
}
