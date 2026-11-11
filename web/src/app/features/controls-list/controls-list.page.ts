import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Overlay } from '@angular/cdk/overlay';
import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField } from '@angular/material/form-field';
import { MatOption, MatSelect, MatSelectTrigger } from '@angular/material/select';
import { MatTooltip } from '@angular/material/tooltip';
import { ActivatedRoute, NavigationEnd, NavigationStart, Router, RouterLink, RouterOutlet } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { filter, fromEvent, map } from 'rxjs';

import { ControlSummary, ControlsSort, SortDirection } from '../../core/api/api.types';
import { rootEntities } from '../../core/glossary/glossary.lookups';
import { CountedService } from '../../core/i18n/counted.service';
import { FormatService } from '../../core/i18n/format.service';
import { LanguageService } from '../../core/i18n/language.service';
import { ListChanges } from '../../core/list/list-changes';
import { SUGGESTIONS_OPENER } from '../../core/suggestions/suggestions-opener';
import { ErrorBannerComponent } from '../../shared/banner/error-banner.component';
import { confirm } from '../../shared/confirm-dialog/confirm-dialog.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { PageHeadComponent } from '../../shared/page-head/page-head.component';
import { StatePanelComponent } from '../../shared/state-panel/state-panel.component';
import { TableFootComponent } from '../../shared/table-foot/table-foot.component';
import { ToastService } from '../../shared/toast/toast.service';
import { ToolbarComponent } from '../../shared/toolbar/toolbar.component';
import { ControlsTableComponent, LIST_COLUMNS } from './controls-table.component';
import { Address, DEFAULT_VIEW, LIST_SORTS, LIST_STATES, addressOf, queryOf, sameView } from './list.address';
import { ListStore, ListView } from './list.store';
import { resultOf } from './run-result';

const ALL = '';

/** Every order the list can take, for the select that sorts where the table has no head (below 640px). */
const SORT_OPTIONS = LIST_COLUMNS.flatMap((column) =>
  (['asc', 'desc'] as const).map((dir) => ({
    value: `${column.key}:${dir}`,
    text: `list.sort.${dir}`,
    column: column.label,
  })),
);

/** A screen shown in the panel says which control it is about, so a closing panel can find that control's row. */
interface PanelScreen {
  panelControl(): number | null;
}

function isPanelScreen(screen: unknown): screen is PanelScreen {
  return typeof (screen as Partial<PanelScreen> | null)?.panelControl === 'function';
}

/**
 * Where the focus goes once the list has been read again: the row of a control (the title, when the panel
 * was about none or the list does not hold it), or the row at a place in the list.
 */
type FocusWish = { readonly control: number | null } | { readonly rowAt: number };

/**
 * The one page of the product: the list of controls, each with its last run and its result, under two tabs
 * (active, archive), a search and a filter. A control or a run opens over the list, in a panel that holds
 * the routed screen: the list stays where it was, and gets the focus back when the panel closes. Search,
 * filter, tab and page live in the address while the list stands alone, and in memory under a panel.
 */
@Component({
  selector: 'app-controls-list-page',
  imports: [
    CdkTrapFocus,
    ControlsTableComponent,
    ErrorBannerComponent,
    IconComponent,
    MatFormField,
    MatOption,
    MatSelect,
    MatSelectTrigger,
    MatTooltip,
    PageHeadComponent,
    RouterLink,
    RouterOutlet,
    StatePanelComponent,
    TableFootComponent,
    ToolbarComponent,
    TranslatePipe,
  ],
  providers: [ListStore],
  templateUrl: './controls-list.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlsListPage {
  protected readonly store = inject(ListStore);
  protected readonly language = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly counted = inject(CountedService);
  private readonly format = inject(FormatService);
  private readonly openSuggestions = inject(SUGGESTIONS_OPENER);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly changes = inject(ListChanges);
  /** Holds the page still behind an open panel, as it is held behind a dialog: the scrollbar keeps its place. */
  private readonly scrollBlock = inject(Overlay).scrollStrategies.block();

  private readonly listing = viewChild.required<ElementRef<HTMLElement>>('listing');
  private readonly sheet = viewChild<ElementRef<HTMLElement>>('sheet');

  protected readonly states = LIST_STATES;
  protected readonly all = ALL;
  protected readonly sortOptions = SORT_OPTIONS;

  private readonly address = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => addressOf(this.route.snapshot)),
    ),
    { initialValue: addressOf(this.route.snapshot) },
  );

  /**
   * The view of the list. The address says it while the list stands alone; under a panel the list keeps the
   * view it had, because the panel's own query (`page`, `search`) is not the list's.
   */
  protected readonly view = linkedSignal<Address, ListView>({
    source: this.address,
    computation: (address, previous) => address.own ?? previous?.value ?? DEFAULT_VIEW,
    equal: sameView,
  });

  protected readonly panelOpen = computed(() => this.address().panel !== null);

  protected readonly entities = computed(() => {
    const glossary = this.store.glossary();
    return glossary ? rootEntities(glossary) : [];
  });

  protected readonly entityLabel = computed(() => {
    const chosen = this.entities().find((entity) => entity.key === this.view().entity);
    return chosen ? this.language.text(chosen.label.plural) : null;
  });

  protected readonly narrowed = computed(() => this.view().search !== '' || this.view().entity !== null);

  /** The count on each tab, formatted; a dash while it is not known. */
  protected readonly counts = computed(() => {
    const counts = this.store.counts();
    const text = (count: number | null) => (count === null ? null : this.format.number(count));
    return { active: text(counts.active), archived: text(counts.archived) };
  });

  /**
   * What a run from the list is doing or has found, said to assistive technology: the row changes in place,
   * and a change in place is silent. A run that could not be started is said by its banner, which is an alert.
   */
  protected readonly announcement = signal('');

  /**
   * Why the list is empty: no control exists at all (the first-use state), every control is archived, the
   * archive holds nothing, or the search and the filter match nothing. Null while the list has rows, is on
   * its way, or while the other tab's count is not known.
   */
  protected readonly empty = computed<'first' | 'noActive' | 'noArchived' | 'noMatch' | null>(() => {
    if (this.store.loading() || this.store.page()?.total !== 0) {
      return null;
    }
    if (this.narrowed()) {
      return 'noMatch';
    }
    const { active, archived } = this.store.counts();
    if (this.view().state === 'archived') {
      return 'noArchived';
    }
    return archived === null || active === null ? null : archived > 0 ? 'noActive' : 'first';
  });

  /** The element of the list that had the focus when a panel opened: the focus goes back to it. */
  private opener: HTMLElement | null = null;
  /** The control the panel that just closed was about. */
  private leftControl: number | null = null;
  /** Where the focus goes once the list has been read again. */
  private readonly focusWish = signal<FocusWish | null>(null);

  /** The panel the address showed last; undefined before the first look. */
  private lastPanel: string | null | undefined;
  /** The late changes already answered with a read of the list. */
  private seenChanges = inject(ListChanges).reported();

  constructor() {
    this.followView();
    this.followPanel();
    this.followLateChanges();
    this.holdPageUnderPanel();
    this.rememberOpener();
    this.closeOnEscape();
    this.focusWhenRead();
  }

  /** The list follows its view. */
  private followView(): void {
    effect(() => {
      const view = this.view();
      untracked(() => this.store.show(view));
    });
  }

  /**
   * A panel that closes, or moves on to another address (a save, a run), leaves the list behind it out of
   * date: the list is read again, and a closing panel gives the focus back. A panel that opens changes nothing.
   */
  private followPanel(): void {
    effect(() => {
      const panel = this.address().panel;
      untracked(() => {
        const before = this.lastPanel;
        this.lastPanel = panel;
        if (before === undefined || before === null || before === panel) {
          return;
        }
        this.store.reload();
        if (panel === null) {
          this.returnFocus();
        }
      });
    });
  }

  /** A save or a run that landed after its panel was closed: the row it changed is read again. */
  private followLateChanges(): void {
    effect(() => {
      const reported = this.changes.reported();
      untracked(() => {
        if (reported > this.seenChanges) {
          this.store.reload();
        }
        this.seenChanges = reported;
      });
    });
  }

  /** The page behind an open panel does not scroll. */
  private holdPageUnderPanel(): void {
    effect(() => (this.panelOpen() ? this.scrollBlock.enable() : this.scrollBlock.disable()));
    inject(DestroyRef).onDestroy(() => this.scrollBlock.disable());
  }

  /** What had the focus in the list when a panel was asked for is where the focus returns to. */
  private rememberOpener(): void {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationStart),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        if (!this.panelOpen()) {
          const active = this.document.activeElement;
          this.opener = active instanceof HTMLElement && this.listing().nativeElement.contains(active) ? active : null;
        }
      });
  }

  /**
   * Esc closes the panel. It is heard before anything on the page handles it (the capturing phase), so what
   * is open over the panel is still as it was: an open select keeps the key and closes itself.
   */
  private closeOnEscape(): void {
    fromEvent<KeyboardEvent>(this.document, 'keydown', { capture: true })
      .pipe(takeUntilDestroyed())
      .subscribe((event) => this.onKey(event));
  }

  /** A row to focus that the list did not hold yet is looked for when the list has been read. */
  private focusWhenRead(): void {
    effect(() => {
      const wish = this.focusWish();
      if (wish === null || this.store.loading()) {
        return;
      }
      untracked(() => {
        this.focusWish.set(null);
        afterNextRender(() => this.focusRow(wish), { injector: this.injector });
      });
    });
  }

  /** Changes the address; the view and the list follow it. A change of what is shown goes back to page 1. */
  protected go(change: Partial<ListView>): void {
    const next: ListView = { ...this.view(), ...('page' in change ? {} : { page: 1 }), ...change };
    void this.router.navigate(['/'], { queryParams: queryOf(next), replaceUrl: 'search' in change });
  }

  /** A column's name was pressed: ascending by it, and descending on the next press. */
  protected sortBy(column: ControlsSort): void {
    const view = this.view();
    this.go({ sort: column, dir: view.sort === column && view.dir === 'asc' ? 'desc' : 'asc' });
  }

  /** An order chosen in the select, as `<column>:<direction>`. */
  protected sortTo(value: string): void {
    const [column, direction] = value.split(':');
    const sort = LIST_SORTS.find((candidate) => candidate === column) ?? DEFAULT_VIEW.sort;
    const dir: SortDirection = direction === 'desc' ? 'desc' : 'asc';
    this.go({ sort, dir });
  }

  /** The two tabs are one stop of the keyboard: an arrow, Home or End moves between them and chooses. */
  protected onTabKey(event: KeyboardEvent): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const other = event.key === 'Home' ? LIST_STATES[0] : event.key === 'End' ? LIST_STATES[1] : this.view().state === 'active' ? 'archived' : 'active';
    this.go({ state: other });
    this.listing().nativeElement.querySelector<HTMLElement>(`#tab-${other}`)?.focus();
  }

  // ---------------------------------------------------------------- the panel

  /** Closes the panel: the address is the list's again, with the view the list kept. A changed draft asks first. */
  protected closePanel(): void {
    void this.router.navigate(['/'], { queryParams: queryOf(this.view()) });
  }

  private onKey(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !this.panelOpen()) {
      return;
    }
    // a select says it is open by its state in ARIA: its Esc closes its list, not the panel
    if (!this.sheet()?.nativeElement.querySelector('[role="combobox"][aria-expanded="true"]')) {
      this.closePanel();
    }
  }

  /** A screen came into the panel: the keyboard starts from the panel itself. */
  protected entered(): void {
    afterNextRender(() => this.sheet()?.nativeElement.focus(), { injector: this.injector });
  }

  protected left(screen: unknown): void {
    this.leftControl = isPanelScreen(screen) ? screen.panelControl() : null;
  }

  /**
   * The focus after a panel closed: the element that opened it, if the list still holds it; else the row of
   * the control the panel was about, once the list has been read again; else the list's title.
   */
  private returnFocus(): void {
    const opener = this.opener;
    this.opener = null;
    if (opener?.isConnected) {
      // after the render: the list is inert until the panel is out of the page
      afterNextRender(() => opener.focus(), { injector: this.injector });
    } else {
      this.focusWish.set({ control: this.leftControl });
    }
  }

  /** A row is found by the name of its control, which carries the control's id (`control-<id>`). */
  private focusRow(wish: FocusWish): void {
    const list = this.listing().nativeElement;
    const names = [...list.querySelectorAll<HTMLElement>('a[id^="control-"]')];
    const row =
      'control' in wish
        ? names.find((name) => name.id === `control-${wish.control}`)
        : names[Math.min(wish.rowAt, names.length - 1)];
    (row ?? list.querySelector<HTMLElement>('h1'))?.focus();
  }

  // ---------------------------------------------------------------- actions of a row

  protected async run(control: ControlSummary): Promise<void> {
    if (this.store.running().has(control.id)) {
      return;
    }
    const name = control.name;
    this.announcement.set(this.translate.instant('list.announce.started', { name }) as string);
    const run = await this.store.run(control);
    const result = resultOf(run);
    if (result === 'violations' || result === 'none') {
      const found =
        result === 'none'
          ? (this.translate.instant('list.result.none') as string)
          : this.counted.text('results.violations', run?.totalCount ?? 0);
      this.announcement.set(this.translate.instant('list.announce.finished', { name, result: found }) as string);
    } else if (result === 'stopped') {
      this.announcement.set(this.translate.instant('list.announce.stopped', { name }) as string);
    } else {
      this.announcement.set('');
    }
  }

  /** Archives a control once the user confirmed: the control leaves for the archive tab, its runs are kept. */
  protected archive(control: ControlSummary): void {
    const text = (key: string, params: object = {}) => this.translate.instant(key, params) as string;
    const index = this.store.page()?.items.findIndex((item) => item.id === control.id) ?? 0;
    confirm(this.dialog, {
      title: text('list.archive.title'),
      body: text('list.archive.body', { name: control.name }),
      confirmLabel: text('list.archive.confirm'),
    }).subscribe((confirmed) => {
      if (confirmed) {
        void this.archiveConfirmed(control, index);
      }
    });
  }

  private async archiveConfirmed(control: ControlSummary, index: number): Promise<void> {
    if (await this.store.archive(control)) {
      this.toast.show('list.toast.archived');
      // the row is gone and its button with it: the keyboard goes on from the row that took its place
      this.focusWish.set({ rowAt: Math.max(index, 0) });
    }
  }

  /** Reviews the engine's suggestions: created controls join the list, a draft may go on to the editor. */
  protected async suggest(): Promise<void> {
    const outcome = await this.openSuggestions();
    if (outcome.kind === 'created') {
      this.toast.showCounted('suggestions.toast.created', outcome.count);
      this.store.reload();
    } else if (outcome.kind === 'edit') {
      await this.router.navigate(['/controls', 'new'], { state: { suggestion: outcome.item } });
    }
  }
}
