import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { SortDirection } from '../../core/api/api.types';
import { IconName } from '../../core/icons/icons';
import { IconComponent } from '../icon/icon.component';

/**
 * The name of a column as the button that sorts by it. A press asks for ascending, the next one for
 * descending; what a press means is the table's to say (`sorted` is its answer). The header cell around it
 * carries `aria-sort`: the button only names the column and shows the arrow.
 */
@Component({
  selector: 'app-sort-header',
  imports: [IconComponent],
  template: `
    <button class="th-sort" type="button" data-testid="sort-header" [attr.data-sort]="sorted()" (click)="sort.emit()">
      {{ label() }}<app-icon size="sm" [name]="icon()" />
    </button>
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SortHeaderComponent {
  readonly label = input.required<string>();
  /** How the table is sorted by this column now; null when it is sorted by another, or by none. */
  readonly sorted = input<SortDirection | null>(null);
  readonly sort = output<void>();

  protected readonly icon = computed<IconName>(() => {
    const sorted = this.sorted();
    return sorted === 'asc' ? 'arrow_upward' : sorted === 'desc' ? 'arrow_downward' : 'unfold_more';
  });
}

/** The value of `aria-sort` for a header cell. */
export function ariaSort(sorted: SortDirection | null): 'ascending' | 'descending' | 'none' {
  return sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none';
}
