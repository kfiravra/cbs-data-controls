import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatTooltip } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import { ApiError, toApiError } from '../../core/api/api-error';
import { SuggestionItem } from '../../core/api/api.types';
import { SuggestionsApi } from '../../core/api/suggestions.api';
import { PluralPipe } from '../../core/i18n/plural.pipe';
import { SuggestionsOutcome } from '../../core/suggestions/suggestions-opener';
import { ErrorBannerComponent } from '../../shared/banner/error-banner.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { PageHeadComponent } from '../../shared/page-head/page-head.component';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { SuggestionCardComponent } from './suggestion-card.component';

const SKELETON_CARDS = ['46%', '38%', '52%', '42%'];

/**
 * The suggestions panel: the engine's drafts as cards, to review and to choose from. They are computed from
 * the data as they are when the panel opens, and again on every refresh. Opening it saves and runs nothing:
 * a draft becomes a control only when it is ticked and created, or opened in the editor and saved.
 */
@Component({
  selector: 'app-suggestions-dialog',
  imports: [
    ErrorBannerComponent,
    IconComponent,
    MatTooltip,
    PageHeadComponent,
    PluralPipe,
    SkeletonComponent,
    SuggestionCardComponent,
    TranslatePipe,
  ],
  templateUrl: './suggestions-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuggestionsDialogComponent implements OnInit {
  private readonly api = inject(SuggestionsApi);
  private readonly ref = inject<MatDialogRef<SuggestionsDialogComponent, SuggestionsOutcome>>(MatDialogRef);

  protected readonly skeletons = SKELETON_CARDS;

  protected readonly items = signal<readonly SuggestionItem[] | null>(null);
  /** The suggestions are being computed: on opening, and on a refresh. */
  protected readonly loading = signal(false);
  protected readonly failure = signal<ApiError | null>(null);
  /** The places, in `items`, of the drafts that are ticked. None is at first. */
  protected readonly selected = signal<ReadonlySet<number>>(new Set());
  protected readonly creating = signal(false);
  /** The place of the draft the server refused, when the selection was not created. */
  protected readonly refused = signal<number | null>(null);

  protected readonly count = computed(() => this.selected().size);

  ngOnInit(): void {
    void this.load();
  }

  /**
   * Asks the engine for its suggestions as the data are now. A refresh keeps the cards on the screen until
   * the new ones arrive, and drops the ticks: they named places in a list that is no longer there.
   */
  protected async load(): Promise<void> {
    if (this.loading() || this.creating()) {
      return;
    }
    this.loading.set(true);
    this.failure.set(null);
    this.refused.set(null);
    try {
      const { items } = await firstValueFrom(this.api.request());
      this.items.set(items);
      this.selected.set(new Set());
    } catch (error) {
      this.failure.set(toApiError(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected toggle(index: number, checked: boolean): void {
    this.refused.set(null);
    this.selected.update((selected) => {
      const next = new Set(selected);
      if (checked) {
        next.add(index);
      } else {
        next.delete(index);
      }
      return next;
    });
  }

  /** Creates the ticked drafts as controls: all of them or none. */
  protected async create(): Promise<void> {
    const chosen = [...this.selected()].sort((a, b) => a - b);
    const items = this.items();
    if (!items || chosen.length === 0 || this.creating()) {
      return;
    }
    this.creating.set(true);
    // closed now, the controls would be created with no word of it and no reload of the list
    this.ref.disableClose = true;
    this.failure.set(null);
    this.refused.set(null);
    try {
      const body = chosen.map((index) => {
        const { name, description, definition } = items[index];
        return { name, description, definition };
      });
      const created = await firstValueFrom(this.api.accept(body));
      this.ref.close({ kind: 'created', count: created.items.length });
    } catch (error) {
      const failure = toApiError(error);
      const index = failure.params['index'];
      if (failure.code === 'DEFINITION_INVALID' && typeof index === 'number' && chosen[index] !== undefined) {
        // the index counts the drafts that were sent: it names one of the ticked ones
        this.refused.set(chosen[index]);
      } else {
        this.failure.set(failure);
      }
    } finally {
      this.creating.set(false);
      this.ref.disableClose = false;
    }
  }

  protected edit(item: SuggestionItem): void {
    this.ref.close({ kind: 'edit', item });
  }

  protected close(): void {
    this.ref.close({ kind: 'closed' });
  }
}

/**
 * Opens the panel and answers how the review ended; closing it any other way ends it with nothing. It is
 * the same sheet as the panel of a control or a run: at the inline end, as tall as the window.
 */
export async function openSuggestions(dialog: MatDialog, dir: 'rtl' | 'ltr'): Promise<SuggestionsOutcome> {
  const closed = dialog
    .open<SuggestionsDialogComponent, void, SuggestionsOutcome>(SuggestionsDialogComponent, {
      panelClass: 'app-sheet',
      backdropClass: 'app-scrim',
      // the inline end, said as a side: the dialog's position has no logical word for it
      position: dir === 'rtl' ? { top: '0', left: '0' } : { top: '0', right: '0' },
      maxWidth: '100vw',
      ariaLabelledBy: 'suggestions-title',
      autoFocus: 'dialog',
      restoreFocus: true,
    })
    .afterClosed();
  return (await firstValueFrom(closed)) ?? { kind: 'closed' };
}
