import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { ControlSummary, ControlsSort, Glossary, SortDirection } from '../../core/api/api.types';
import { findEntity } from '../../core/glossary/glossary.lookups';
import { FormatService } from '../../core/i18n/format.service';
import { LanguageService } from '../../core/i18n/language.service';
import { PluralPipe } from '../../core/i18n/plural.pipe';
import { IconComponent } from '../../shared/icon/icon.component';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { SortHeaderComponent, ariaSort } from '../../shared/sort-header/sort-header.component';
import { RunResult, StatusTone, resultOf, toneOf } from './run-result';

interface Row {
  readonly control: ControlSummary;
  /** Where the row leads: the results of the last run, or the control's panel before a first run. */
  readonly results: readonly (string | number)[];
  readonly entity: string;
  readonly lastRun: string | null;
  readonly result: RunResult;
  /** The colour of the result's chip; null for the muted grey of what never ran or is archived. */
  readonly tone: StatusTone | null;
  readonly running: boolean;
}

/** The columns of a row's details, each of which the server can sort by. */
export const LIST_COLUMNS: readonly { readonly key: ControlsSort; readonly label: string; readonly width: string }[] = [
  { key: 'name', label: 'list.columns.control', width: 'col-40' },
  { key: 'rootEntity', label: 'list.columns.checked', width: 'col-16' },
  { key: 'lastRun', label: 'list.columns.lastRun', width: 'col-18' },
  { key: 'violations', label: 'list.columns.result', width: 'col-16' },
];

const SKELETON_ROWS = ['62%', '48%', '70%', '54%'];

/**
 * The controls of the list, active or archived: a table from 640px, card rows below. A row is a bubble of
 * three parts: its details (the name over the description, what it checks, the last run and what it found),
 * its run button, and its actions (edit, duplicate, archive). The whole of the details opens the results of
 * the last run. An archived control has no run button and no edit, and is drawn in grey. Every column of the
 * details sorts on a click of its name; the order itself is the server's.
 */
@Component({
  selector: 'app-controls-table',
  imports: [IconComponent, MatTooltip, PluralPipe, RouterLink, SkeletonComponent, SortHeaderComponent, TranslatePipe],
  templateUrl: './controls-table.component.html',
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlsTableComponent {
  private readonly format = inject(FormatService);
  private readonly language = inject(LanguageService);

  readonly controls = input.required<readonly ControlSummary[]>();
  /** The glossary, for the label of what each control checks; null while it cannot be read. */
  readonly glossary = input<Glossary | null>(null);
  readonly running = input<ReadonlySet<number>>(new Set());
  readonly loading = input(false);
  /** The archive is shown: its rows have no run button, so the table has no column for one. */
  readonly archived = input(false);
  readonly sort = input<ControlsSort>('name');
  readonly dir = input<SortDirection>('asc');
  readonly run = output<ControlSummary>();
  readonly archive = output<ControlSummary>();
  /** A column's name was pressed. */
  readonly sortChange = output<ControlsSort>();

  protected readonly skeletons = SKELETON_ROWS;
  protected readonly columns = LIST_COLUMNS;
  protected readonly ariaSort = ariaSort;

  protected readonly rows = computed<Row[]>(() => {
    const glossary = this.glossary();
    return this.controls().map((control) => {
      const result = resultOf(control.lastRun);
      return {
        control,
        results: control.lastRun ? ['/runs', control.lastRun.id] : ['/controls', control.id, 'runs'],
        entity: this.language.text(glossary ? findEntity(glossary, control.rootEntity)?.label.plural : undefined),
        lastRun: control.lastRun ? this.format.when(control.lastRun.startedAt) : null,
        result,
        tone: control.isActive ? toneOf(result) : null,
        running: this.running().has(control.id),
      };
    });
  });

  protected sortedBy(column: ControlsSort): SortDirection | null {
    return this.sort() === column ? this.dir() : null;
  }
}
