import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { GlossaryField, ResultItem, SortDirection } from '../../core/api/api.types';
import { FormatService } from '../../core/i18n/format.service';
import { IconName } from '../../core/icons/icons';
import { IconComponent } from '../icon/icon.component';
import { MarkComponent } from '../mark/mark.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';
import { TextPartsComponent } from '../text-parts/text-parts.component';

/** One identifying field of the record: its key in `display`, its label, and how its values are written. */
export interface ResultColumn {
  readonly key: string;
  readonly label: string;
  /** The glossary field; undefined when the glossary could not be read. */
  readonly field: GlossaryField | undefined;
}

/** How the rows are ordered: by the record's identifying text, or as the engine returned them (null). */
export type DisplaySort = SortDirection | null;

const SKELETON_ROWS = ['70%', '52%', '64%'];
const SKELETON_REASONS = ['62%', '84%', '46%'];

/**
 * The violations of a run: a column per identifying field of the record, then the reasons, one line for
 * each condition the record matched: its mark (a badge, the same letter the condition has everywhere), then
 * the engine's text with the actual value marked. A table from 640px and card rows below, from one template.
 * The first column's header sorts by the record.
 */
@Component({
  selector: 'app-results-table',
  imports: [IconComponent, MarkComponent, SkeletonComponent, TextPartsComponent, TranslatePipe],
  templateUrl: './results-table.component.html',
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultsTableComponent {
  private readonly format = inject(FormatService);

  readonly rows = input.required<readonly ResultItem[]>();
  readonly columns = input.required<readonly ResultColumn[]>();
  readonly marks = input.required<ReadonlyMap<string, string>>();
  readonly sort = input<DisplaySort>(null);
  /** Rows are on their way: skeleton bars stand in their shape. */
  readonly loading = input(false);
  readonly sortChange = output<DisplaySort>();

  protected readonly skeletons = SKELETON_ROWS.map((name, index) => ({ name, reasons: SKELETON_REASONS[index] }));

  protected readonly sortIcon = computed<IconName>(() => {
    const sort = this.sort();
    return sort === 'asc' ? 'arrow_upward' : sort === 'desc' ? 'arrow_downward' : 'unfold_more';
  });

  protected readonly ariaSort = computed(() => {
    const sort = this.sort();
    return sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : 'none';
  });

  /** A number reads as the record's reference, set small beside its name; text reads as part of the name. */
  protected isNumber(column: ResultColumn): boolean {
    return column.field?.type === 'number';
  }

  protected value(row: ResultItem, column: ResultColumn): string {
    return this.format.value(row.display[column.key] ?? null, column.field);
  }

  /** Ascending, then descending, then back to the order of the run. */
  protected cycleSort(): void {
    const sort = this.sort();
    this.sortChange.emit(sort === null ? 'asc' : sort === 'asc' ? 'desc' : null);
  }
}
