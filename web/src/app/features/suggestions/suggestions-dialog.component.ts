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
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { SuggestionRowComponent } from './suggestion-row.component';

/**
 * The suggestions dialog: the engine's drafts, to review and to choose from. Opening it saves and runs
 * nothing: a draft becomes a control only when it is ticked and created, or opened in the editor and saved.
 */
@Component({
  selector: 'app-suggestions-dialog',
  imports: [
    ErrorBannerComponent,
    IconComponent,
    MatTooltip,
    PluralPipe,
    SkeletonComponent,
    SuggestionRowComponent,
    TranslatePipe,
  ],
  templateUrl: './suggestions-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuggestionsDialogComponent implements OnInit {
  private readonly api = inject(SuggestionsApi);
  private readonly ref = inject<MatDialogRef<SuggestionsDialogComponent, SuggestionsOutcome>>(MatDialogRef);

  protected readonly items = signal<readonly SuggestionItem[] | null>(null);
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

  protected async load(): Promise<void> {
    this.failure.set(null);
    this.items.set(null);
    try {
      this.items.set((await firstValueFrom(this.api.request())).items);
    } catch (error) {
      this.failure.set(toApiError(error));
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
    }
  }

  protected edit(item: SuggestionItem): void {
    this.ref.close({ kind: 'edit', item });
  }

  protected close(): void {
    this.ref.close({ kind: 'closed' });
  }
}

/** Opens the dialog and answers how the review ended; closing it any other way ends it with nothing. */
export async function openSuggestions(dialog: MatDialog): Promise<SuggestionsOutcome> {
  const closed = dialog
    .open<SuggestionsDialogComponent, void, SuggestionsOutcome>(SuggestionsDialogComponent, {
      panelClass: 'app-dialog',
      backdropClass: 'app-scrim',
      ariaLabelledBy: 'suggestions-title',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    })
    .afterClosed();
  return (await firstValueFrom(closed)) ?? { kind: 'closed' };
}
