import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { GlossaryField, ResultItem, SortDirection } from '../../core/api/api.types';
import { FormatService } from '../../core/i18n/format.service';
import { MarkComponent } from '../mark/mark.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';
import { SortHeaderComponent, ariaSort } from '../sort-header/sort-header.component';
import { TextPartsComponent } from '../text-parts/text-parts.component';

/** One identifying field of the record: its key in `display`, its label, and how its values are written. */
export interface ResultColumn {
  readonly key: string;
  readonly label: string;
  /** The glossary field; undefined when the glossary could not be read. */
  readonly field: GlossaryField | undefined;
}

/** How the rows are ordered: by one column (an identifying field's key, or `reasons`), or as the run returned them (null). */
export type DisplaySort = { readonly column: string; readonly dir: SortDirection } | null;

/**
 * The name of the reasons column, in a sort and in the address. A field's key starts with a letter, so no
 * field of any glossary can have this name.
 */
export const REASONS_COLUMN = '_reasons';

const SKELETON_ROWS = ['70%', '52%', '64%'];
const SKELETON_REASONS = ['62%', '84%', '46%'];

/**
 * The violations of a run: a column per identifying field of the record, then the reasons, one line for
 * each condition the record matched: its mark (a badge, the same letter the condition has everywhere), then
 * the engine's text with the actual value marked. A table from 640px and card rows below, from one template,
 * in the one design of the product's tables: a bubble per row. Every column's name sorts by it, the reasons'
 * too (by how many there are, then by their text); the order itself is the server's.
 */
@Component({
  selector: 'app-results-table',
  imports: [MarkComponent, SkeletonComponent, SortHeaderComponent, TextPartsComponent, TranslatePipe],
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

  protected readonly ariaSort = ariaSort;

  /** A number reads as the record's reference, set small beside its name; text reads as part of the name. */
  protected isNumber(column: ResultColumn): boolean {
    return column.field?.type === 'number';
  }

  protected value(row: ResultItem, column: ResultColumn): string {
    return this.format.value(row.display[column.key] ?? null, column.field);
  }

  protected readonly reasons = REASONS_COLUMN;

  protected sortedBy(column: string): SortDirection | null {
    const sort = this.sort();
    return sort?.column === column ? sort.dir : null;
  }

  /** A column's name was pressed: ascending by it, then descending, then back to the order of the run. */
  protected cycleSort(column: string): void {
    const sorted = this.sortedBy(column);
    this.sortChange.emit(sorted === null ? { column, dir: 'asc' } : sorted === 'asc' ? { column, dir: 'desc' } : null);
  }
}
