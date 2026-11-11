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

import { ControlSummary } from '../../core/api/api.types';
import { rootEntities } from '../../core/glossary/glossary.lookups';
import { CountedService } from '../../core/i18n/counted.service';
import { FormatService } from '../../core/i18n/format.service';
import { LanguageService } from '../../core/i18n/language.service';
import { SUGGESTIONS_OPENER } from '../../core/suggestions/suggestions-opener';
import { ErrorBannerComponent } from '../../shared/banner/error-banner.component';
import { confirm } from '../../shared/confirm-dialog/confirm-dialog.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { PageHeadComponent } from '../../shared/page-head/page-head.component';
import { StatePanelComponent } from '../../shared/state-panel/state-panel.component';
import { TableFootComponent } from '../../shared/table-foot/table-foot.component';
import { ToastService } from '../../shared/toast/toast.service';
import { ToolbarComponent } from '../../shared/toolbar/toolbar.component';
import { ControlsTableComponent } from './controls-table.component';
import { ListState, ListStore, ListView } from './list.store';
import { resultOf } from './run-result';

const STATES: readonly ListState[] = ['active', 'archived'];
const ALL = '';
const DEFAULT_VIEW: ListView = { search: '', entity: null, state: 'active', page: 1 };

/** What the address shows: the list alone with its view, or a panel over it. */
interface Address {
  /** The path of the open panel (`runs/12`, `controls/new`); null when the list stands alone. */
  readonly panel: string | null;
  /** The list's view as the address describes it; null under a panel, whose query is its own. */
  readonly own: ListView | null;
}

/** A screen shown in the panel says which control it is about, so a closing panel can find that control's row. */
interface PanelScreen {
  panelControl(): number | null;
}

function isPanelScreen(screen: unknown): screen is PanelScreen {
  return typeof (screen as Partial<PanelScreen> | null)?.panelControl === 'function';
}

/** Where the focus goes once the list has been read again. */
type FocusWish = { readonly row: number } | { readonly rowAt: number };

const sameView = (a: ListView, b: ListView) =>
  a.search === b.search && a.entity === b.entity && a.state === b.state && a.page === b.page;

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
  /** Holds the page still behind an open panel, as it is held behind a dialog: the scrollbar keeps its place. */
  private readonly scrollBlock = inject(Overlay).scrollStrategies.block();

  private readonly listing = viewChild.required<ElementRef<HTMLElement>>('listing');
  private readonly sheet = viewChild<ElementRef<HTMLElement>>('sheet');

  protected readonly states = STATES;
  protected readonly all = ALL;

  private readonly address = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.readAddress()),
    ),
    { initialValue: this.readAddress() },
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

  constructor() {
    // the list follows its view
    effect(() => {
      const view = this.view();
      untracked(() => this.store.show(view));
    });

    // a panel that opens, changes its address (a save, a run) or closes leaves the list behind it out of
    // date: it is read again, and a closing panel gives the focus back
    let shown: string | null | undefined;
    effect(() => {
      const panel = this.address().panel;
      untracked(() => {
        if (shown !== undefined && shown !== panel) {
          this.store.reload();
          if (panel === null) {
            this.returnFocus();
          }
        }
        shown = panel;
      });
    });

    // the page behind an open panel does not scroll
    effect(() => (this.panelOpen() ? this.scrollBlock.enable() : this.scrollBlock.disable()));
    inject(DestroyRef).onDestroy(() => this.scrollBlock.disable());

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

    // Esc closes the panel. It is heard before anything on the page handles it (the capturing phase), so
    // what is open over the panel is still as it was: an open select keeps the key and closes itself
    fromEvent<KeyboardEvent>(this.document, 'keydown', { capture: true })
      .pipe(takeUntilDestroyed())
      .subscribe((event) => this.onKey(event));

    // a row to focus that the list did not hold yet: it is looked for when the list has been read
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

  private readAddress(): Address {
    const snapshot = this.route.snapshot;
    const child = snapshot.firstChild;
    if (child) {
      return { panel: child.url.map((segment) => segment.path).join('/'), own: null };
    }
    const query = snapshot.queryParamMap;
    const state = query.get('state');
    const page = query.get('page');
    return {
      panel: null,
      own: {
        search: query.get('search') ?? '',
        entity: query.get('entity') || null,
        state: STATES.find((candidate) => candidate === state) ?? 'active',
        page: page && /^[1-9]\d*$/.test(page) ? Number(page) : 1,
      },
    };
  }

  /** The query parameters of a view: what is the default is left out of the address. */
  private queryOf(view: ListView): Record<string, string | number | null> {
    const entries = Object.entries(view) as [keyof ListView, string | number | null][];
    return Object.fromEntries(entries.map(([name, value]) => [name, value === DEFAULT_VIEW[name] ? null : value]));
  }

  /** Changes the address; the view and the list follow it. A change of what is shown goes back to page 1. */
  protected go(change: Partial<ListView>): void {
    const next: ListView = { ...this.view(), ...('page' in change ? {} : { page: 1 }), ...change };
    void this.router.navigate(['/'], { queryParams: this.queryOf(next), replaceUrl: 'search' in change });
  }

  /** The two tabs are one stop of the keyboard: an arrow, Home or End moves between them and chooses. */
  protected onTabKey(event: KeyboardEvent): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const other = event.key === 'Home' ? STATES[0] : event.key === 'End' ? STATES[1] : this.view().state === 'active' ? 'archived' : 'active';
    this.go({ state: other });
    this.listing().nativeElement.querySelector<HTMLElement>(`#tab-${other}`)?.focus();
  }

  // ---------------------------------------------------------------- the panel

  /** Closes the panel: the address is the list's again, with the view the list kept. A changed draft asks first. */
  protected closePanel(): void {
    void this.router.navigate(['/'], { queryParams: this.queryOf(this.view()) });
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
      this.focusWish.set({ row: this.leftControl ?? 0 });
    }
  }

  private focusRow(wish: FocusWish): void {
    const list = this.listing().nativeElement;
    const names = [...list.querySelectorAll<HTMLElement>('[data-testid="control-link"]')];
    const row =
      'row' in wish
        ? names.find((name) => name.id === `control-${wish.row}`)
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
