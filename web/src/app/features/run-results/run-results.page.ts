import { ChangeDetectionStrategy, Component, computed, effect, inject, input, untracked } from '@angular/core';
import { MatFormField } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ResultsSort, SortDirection } from '../../core/api/api.types';
import { findEntity } from '../../core/glossary/glossary.lookups';
import { CountedService } from '../../core/i18n/counted.service';
import { FormatService } from '../../core/i18n/format.service';
import { LanguageService } from '../../core/i18n/language.service';
import { BannerComponent } from '../../shared/banner/banner.component';
import { ErrorBannerComponent } from '../../shared/banner/error-banner.component';
import { BreakdownComponent } from '../../shared/breakdown/breakdown.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { NotFoundComponent } from '../../shared/not-found/not-found.component';
import { PageHeadComponent } from '../../shared/page-head/page-head.component';
import { DisplaySort, ResultColumn, ResultsTableComponent } from '../../shared/results-table/results-table.component';
import { PreviousRunFact, RunFact, RunSummaryComponent } from '../../shared/run-summary/run-summary.component';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { StatePanelComponent } from '../../shared/state-panel/state-panel.component';
import { TableFootComponent } from '../../shared/table-foot/table-foot.component';
import { TextPartsComponent } from '../../shared/text-parts/text-parts.component';
import { ToolbarComponent } from '../../shared/toolbar/toolbar.component';
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, ResultsStore, ResultsView } from './results.store';

const positive = (text: string | undefined, fallback: number) => (text && /^[1-9]\d*$/.test(text) ? Number(text) : fallback);

/**
 * The results of one run: the control in words, the summary, the breakdown by condition and the violating
 * records with the reason for each. Search, filter, sort and paging live in the address, so back and reload
 * keep them.
 */
@Component({
  selector: 'app-run-results-page',
  imports: [
    BannerComponent,
    BreakdownComponent,
    ErrorBannerComponent,
    IconComponent,
    MatFormField,
    MatOption,
    MatSelect,
    NotFoundComponent,
    PageHeadComponent,
    ResultsTableComponent,
    RouterLink,
    RunSummaryComponent,
    SkeletonComponent,
    StatePanelComponent,
    TableFootComponent,
    TextPartsComponent,
    ToolbarComponent,
    TranslatePipe,
  ],
  providers: [ResultsStore],
  templateUrl: './run-results.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RunResultsPage {
  protected readonly store = inject(ResultsStore);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly format = inject(FormatService);
  private readonly language = inject(LanguageService);
  private readonly countedText = inject(CountedService);

  protected readonly pageSizes = PAGE_SIZES;

  /** The run's id from the route. */
  readonly id = input.required<string>();
  readonly page = input<string>();
  readonly size = input<string>();
  readonly search = input<string>();
  readonly condition = input<string>();
  readonly sort = input<string>();
  readonly dir = input<string>();

  /** A run id is a positive integer; anything else in the address names no run. */
  private readonly runId = computed(() => (/^[1-9]\d*$/.test(this.id()) ? Number(this.id()) : null));
  protected readonly notFound = computed(() => this.runId() === null || this.store.loadState() === 'notFound');

  /** The view the address describes; anything the address does not say is the default. */
  protected readonly view = computed<ResultsView>(() => {
    const size = positive(this.size(), DEFAULT_PAGE_SIZE);
    return {
      page: positive(this.page(), 1),
      size: (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE,
      search: this.search() ?? '',
      condition: this.condition() || null,
      sort: this.sort() === 'display' ? 'display' : 'key',
      dir: this.dir() === 'desc' ? 'desc' : 'asc',
    };
  });

  protected readonly displaySort = computed<DisplaySort>(() => (this.view().sort === 'display' ? this.view().dir : null));

  private readonly entity = computed(() => {
    const glossary = this.store.glossary();
    const run = this.store.run();
    return glossary && run ? findEntity(glossary, run.rootEntity) : undefined;
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

  protected readonly meta = computed(() => {
    const run = this.store.run();
    return run
      ? this.text('results.meta', {
          date: this.format.date(run.startedAt),
          time: this.format.time(run.startedAt),
          version: run.controlVersion,
        })
      : undefined;
  });

  protected readonly noun = computed(() => this.counted('results.noun', this.store.run()?.totalCount ?? 0));

  protected readonly facts = computed<RunFact[]>(() => {
    const run = this.store.run();
    if (!run) {
      return [];
    }
    // counted as it is shown, to one decimal: 1,020 ms is "one second", 412 ms is "0.4 seconds"
    const shown = Math.round((run.durationMs ?? 0) / 100) / 10;
    const seconds = this.counted('results.seconds', shown, { count: this.format.seconds(run.durationMs ?? 0) });
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
    effect(() => {
      const id = this.runId();
      if (id !== null) {
        untracked(() => void this.store.open(id));
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

  private text(key: string, params: object = {}): string {
    return this.translate.instant(key, params) as string;
  }

  private counted(baseKey: string, count: number, params: Record<string, unknown> = {}): string {
    return this.countedText.text(baseKey, count, params);
  }

  /** Changes the address; the view and the rows follow it. A change of what is shown goes back to page 1. */
  protected go(change: Partial<Record<keyof ResultsView, string | number | null>>): void {
    const defaults: Record<string, string | number | null> = {
      page: 1,
      size: DEFAULT_PAGE_SIZE,
      search: '',
      condition: null,
      sort: 'key',
      dir: 'asc',
    };
    const next: Record<string, string | number | null> = { ...this.view(), ...('page' in change ? {} : { page: 1 }), ...change };
    const queryParams = Object.fromEntries(
      Object.entries(next).map(([name, value]) => [name, value === defaults[name] ? null : value]),
    );
    void this.router.navigate([], { queryParams, replaceUrl: 'search' in change });
  }

  protected setSort(sort: DisplaySort): void {
    const by: ResultsSort = sort === null ? 'key' : 'display';
    const dir: SortDirection = sort ?? 'asc';
    this.go({ sort: by, dir });
  }

  protected async rerun(): Promise<void> {
    const run = await this.store.rerun();
    if (run) {
      await this.router.navigate(['/runs', run.id]);
    }
  }

  protected reload(): void {
    const id = this.runId();
    if (id !== null) {
      void this.store.open(id);
    }
  }

  /** A text identifying field reads as the record's name; a number as its reference. */
  protected isNumber(column: ResultColumn): boolean {
    return column.field?.type === 'number';
  }

  protected editControl(): void {
    void this.router.navigate(['/controls', this.store.run()?.controlId]);
  }
}
