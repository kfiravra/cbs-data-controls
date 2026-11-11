import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MatFormField } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatTooltip } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';

import { LanguageService } from '../../core/i18n/language.service';
import { IconComponent } from '../icon/icon.component';

/**
 * The foot of a paged table: the range in words (a word, not a dash, so its two ends cannot swap sides in
 * right-to-left text), the page size, and previous and next, which are drawn when there is more than one page.
 */
@Component({
  selector: 'app-table-foot',
  imports: [IconComponent, MatFormField, MatOption, MatSelect, MatTooltip, TranslatePipe],
  template: `
    <div class="table-foot">
      <!-- a status: after a search, a filter, a sort or another page, assistive technology hears what is shown -->
      <span class="num" role="status" data-testid="table-range">{{ rangeKey() | translate: range() }}</span>
      <div class="pager">
        @if (pageSizes().length > 0) {
          <mat-form-field class="field--sm pager__size" appearance="outline" subscriptSizing="dynamic">
            <mat-select
              data-testid="page-size"
              [aria-label]="'common.pageSize' | translate"
              [value]="pageSize()"
              (selectionChange)="pageSizeChange.emit($event.value)"
            >
              @for (size of pageSizes(); track size) {
                <mat-option [value]="size">{{ 'common.perPage' | translate: { count: size } }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }
        <!-- with one page there is nowhere to go: the two buttons are not drawn -->
        @if (lastPage() > 1) {
          <button
            class="icon-btn"
            type="button"
            data-testid="page-previous"
            [attr.aria-label]="'common.previousPage' | translate"
            [matTooltip]="'common.previousPage' | translate"
            [attr.aria-disabled]="page() <= 1 ? 'true' : null"
            (click)="go(page() - 1)"
          >
            <app-icon name="chevron_left" [mirrored]="true" />
          </button>
          <button
            class="icon-btn"
            type="button"
            data-testid="page-next"
            [attr.aria-label]="'common.nextPage' | translate"
            [matTooltip]="'common.nextPage' | translate"
            [attr.aria-disabled]="page() >= lastPage() ? 'true' : null"
            (click)="go(page() + 1)"
          >
            <app-icon name="chevron_right" [mirrored]="true" />
          </button>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .pager__size {
      inline-size: calc(2 * var(--space-8));
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableFootComponent {
  private readonly language = inject(LanguageService);

  readonly total = input.required<number>();
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  /** A translation key that takes `from`, `to` and `total`. */
  readonly rangeKey = input.required<string>();
  readonly pageSizes = input<readonly number[]>([]);
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  protected readonly lastPage = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));

  protected readonly range = computed(() => {
    const format = new Intl.NumberFormat(this.language.locale);
    const from = (this.page() - 1) * this.pageSize() + 1;
    const to = Math.min(this.page() * this.pageSize(), this.total());
    return { from: format.format(from), to: format.format(to), total: format.format(this.total()) };
  });

  /**
   * The two buttons stay focusable at the ends (`aria-disabled`): a press on "next" that lands on the last
   * page must not drop the focus from the button. A press past an end asks for nothing.
   */
  protected go(page: number): void {
    if (page >= 1 && page <= this.lastPage()) {
      this.pageChange.emit(page);
    }
  }
}
