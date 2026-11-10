import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { ControlSummary, Glossary } from '../../core/api/api.types';
import { findEntity } from '../../core/glossary/glossary.lookups';
import { FormatService } from '../../core/i18n/format.service';
import { LanguageService } from '../../core/i18n/language.service';
import { PluralPipe } from '../../core/i18n/plural.pipe';
import { IconComponent } from '../../shared/icon/icon.component';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';

/** What a row says of its control's last run. */
type Result = 'never' | 'violations' | 'none' | 'stopped' | 'running';

interface Row {
  readonly control: ControlSummary;
  readonly entity: string;
  readonly lastRun: string | null;
  readonly result: Result;
  readonly running: boolean;
}

const SKELETON_ROWS = ['62%', '48%', '70%', '54%'];

/**
 * The controls of the list: a table from 640px, card rows below. A row has the name (a link to the editor)
 * over the description, the root entity, the last run, its result, and the actions. A number of violations
 * is a finding, set as a link to its results and never in red; red is for a run that stopped.
 */
@Component({
  selector: 'app-controls-table',
  imports: [IconComponent, MatTooltip, PluralPipe, RouterLink, SkeletonComponent, TranslatePipe],
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
  /** The glossary, for the label of each root entity; null while it cannot be read. */
  readonly glossary = input<Glossary | null>(null);
  readonly running = input<ReadonlySet<number>>(new Set());
  readonly loading = input(false);
  readonly run = output<ControlSummary>();

  protected readonly skeletons = SKELETON_ROWS;

  protected readonly rows = computed<Row[]>(() => {
    const glossary = this.glossary();
    return this.controls().map((control) => ({
      control,
      entity: this.language.text(glossary ? findEntity(glossary, control.rootEntity)?.label.plural : undefined),
      lastRun: control.lastRun ? this.format.when(control.lastRun.startedAt) : null,
      result: this.resultOf(control),
      running: this.running().has(control.id),
    }));
  });

  private resultOf(control: ControlSummary): Result {
    const run = control.lastRun;
    if (!run) {
      return 'never';
    }
    if (run.status === 'running') {
      return 'running';
    }
    if (run.status !== 'succeeded') {
      return 'stopped';
    }
    return run.totalCount === 0 ? 'none' : 'violations';
  }
}
