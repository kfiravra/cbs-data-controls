import { ChangeDetectionStrategy, Component, computed, effect, inject, input, untracked } from '@angular/core';
import { MatFormField } from '@angular/material/form-field';
import { MatOption, MatSelect, MatSelectTrigger } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { ControlSummary } from '../../core/api/api.types';
import { rootEntities } from '../../core/glossary/glossary.lookups';
import { LanguageService } from '../../core/i18n/language.service';
import { PluralPipe } from '../../core/i18n/plural.pipe';
import { SUGGESTIONS_OPENER } from '../../core/suggestions/suggestions-opener';
import { ErrorBannerComponent } from '../../shared/banner/error-banner.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { PageHeadComponent } from '../../shared/page-head/page-head.component';
import { StatePanelComponent } from '../../shared/state-panel/state-panel.component';
import { TableFootComponent } from '../../shared/table-foot/table-foot.component';
import { ToastService } from '../../shared/toast/toast.service';
import { ToolbarComponent } from '../../shared/toolbar/toolbar.component';
import { ControlsTableComponent } from './controls-table.component';
import { ListState, ListStore, ListView } from './list.store';

const STATES: readonly ListState[] = ['active', 'archived', 'all'];
const ALL = '';

/**
 * The controls list, the home of the product: every control with its last run and its result, search and
 * filters, run, edit and duplicate. Search, filters and the page live in the address.
 */
@Component({
  selector: 'app-controls-list-page',
  imports: [
    ControlsTableComponent,
    ErrorBannerComponent,
    IconComponent,
    MatFormField,
    MatOption,
    MatSelect,
    MatSelectTrigger,
    PageHeadComponent,
    PluralPipe,
    RouterLink,
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
  private readonly toast = inject(ToastService);
  private readonly openSuggestions = inject(SUGGESTIONS_OPENER);

  protected readonly states = STATES;
  protected readonly all = ALL;

  readonly search = input<string>();
  readonly entity = input<string>();
  readonly state = input<string>();
  readonly page = input<string>();

  /** The view the address describes; anything the address does not say is the default. */
  protected readonly view = computed<ListView>(() => {
    const state = this.state();
    const page = this.page();
    return {
      search: this.search() ?? '',
      entity: this.entity() || null,
      state: STATES.find((candidate) => candidate === state) ?? 'active',
      page: page && /^[1-9]\d*$/.test(page) ? Number(page) : 1,
    };
  });

  protected readonly entities = computed(() => {
    const glossary = this.store.glossary();
    return glossary ? rootEntities(glossary) : [];
  });

  protected readonly entityLabel = computed(() => {
    const chosen = this.entities().find((entity) => entity.key === this.view().entity);
    return chosen ? this.language.text(chosen.label.plural) : null;
  });

  private readonly narrowed = computed(() => this.view().search !== '' || this.view().entity !== null);

  /** No control at all: the first-use state. A list that is empty because of the search says so instead. */
  protected readonly empty = computed<'first' | 'noMatch' | null>(() => {
    if (this.store.loading() || this.store.page()?.total !== 0) {
      return null;
    }
    return this.narrowed() || this.view().state !== 'active' ? 'noMatch' : 'first';
  });

  constructor() {
    // the list follows the address
    effect(() => {
      const view = this.view();
      untracked(() => this.store.show(view));
    });
  }

  /** Changes the address; the view and the list follow it. A change of what is shown goes back to page 1. */
  protected go(change: Partial<Record<keyof ListView, string | number | null>>): void {
    const defaults: Record<string, string | number | null> = { search: '', entity: null, state: 'active', page: 1 };
    const next: Record<string, string | number | null> = { ...this.view(), ...('page' in change ? {} : { page: 1 }), ...change };
    const queryParams = Object.fromEntries(
      Object.entries(next).map(([name, value]) => [name, value === defaults[name] ? null : value]),
    );
    void this.router.navigate([], { queryParams, replaceUrl: 'search' in change });
  }

  protected run(control: ControlSummary): void {
    void this.store.run(control);
  }

  /** Reviews the engine's suggestions: created controls join the list, a draft may go on to the editor. */
  protected async suggest(): Promise<void> {
    const outcome = await this.openSuggestions();
    if (outcome.kind === 'created') {
      this.toast.show(outcome.count === 1 ? 'suggestions.toast.createdOne' : 'suggestions.toast.created', {
        count: outcome.count,
      });
      this.store.reload();
    } else if (outcome.kind === 'edit') {
      await this.router.navigate(['/controls', 'new'], { state: { suggestion: outcome.item } });
    }
  }
}
