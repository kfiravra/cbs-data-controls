import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { ConditionSummary } from '../../core/api/api.types';
import { CountedService } from '../../core/i18n/counted.service';
import { FormatService } from '../../core/i18n/format.service';
import { MarkComponent, MarkState } from '../mark/mark.component';
import { TextPartsComponent } from '../text-parts/text-parts.component';

interface Meter {
  readonly id: string;
  readonly parts: ConditionSummary['sentenceParts'];
  readonly count: string;
  /** The count with its noun, for assistive technology: a bare number at the end of a button says nothing. */
  readonly counted: string;
  /** The share of all violations that match the condition, 0 to 1. */
  readonly share: number;
}

/**
 * Violations by condition, as a meter list: a first row for all violations, then one row per condition a
 * run can match with its mark, its clause, how many violations match it and that share as a bar. Each row
 * is a button that filters the table; the chosen row is pressed and its mark turns active. Counts are over
 * all violations, also above the row cap.
 */
@Component({
  selector: 'app-breakdown',
  imports: [MarkComponent, TextPartsComponent, TranslatePipe],
  template: `
    <div class="meters" data-testid="breakdown">
      <button
        class="meter"
        type="button"
        data-testid="breakdown-all"
        [attr.aria-pressed]="active() === null"
        (click)="filter.emit(null)"
      >
        <span class="meter__all">{{ 'results.breakdown.all' | translate }}</span>
        <span class="meter__count" aria-hidden="true" data-testid="breakdown-count">{{ totalText() }}</span>
        <span class="sr-only">{{ totalCounted() }}</span>
      </button>
      @for (meter of meters(); track meter.id) {
        <button
          class="meter"
          type="button"
          data-testid="breakdown-row"
          [attr.data-node]="meter.id"
          [attr.aria-pressed]="active() === meter.id"
          [class.meter--unmarked]="!marks().has(meter.id)"
          [style.--share]="meter.share"
          (click)="filter.emit(active() === meter.id ? null : meter.id)"
          (focus)="trace.emit(meter.id)"
          (blur)="trace.emit(null)"
          (pointerenter)="trace.emit(meter.id)"
          (pointerleave)="trace.emit(null)"
        >
          @if (marks().get(meter.id); as mark) {
            <app-mark [label]="mark" [state]="stateOf(meter.id)" [name]="'common.condition' | translate: { mark }" />
          }
          <span class="meter__clause"><app-text-parts [parts]="meter.parts" /></span>
          <span class="meter__count" aria-hidden="true" data-testid="breakdown-count">{{ meter.count }}</span>
          <span class="sr-only">{{ meter.counted }}</span>
          <span class="meter__bar" aria-hidden="true"><span class="meter__fill"></span></span>
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BreakdownComponent {
  private readonly format = inject(FormatService);
  private readonly countedText = inject(CountedService);

  /** The run's conditions: the nodes a run can match. An entry without a count is not drawn. */
  readonly conditions = input.required<readonly ConditionSummary[]>();
  readonly total = input.required<number>();
  readonly marks = input.required<ReadonlyMap<string, string>>();
  /** The condition the table is filtered by; null for all violations. */
  readonly active = input<string | null>(null);
  readonly traced = input<string | null>(null);
  readonly filter = output<string | null>();
  readonly trace = output<string | null>();

  protected readonly totalText = computed(() => this.format.number(this.total()));
  protected readonly totalCounted = computed(() => this.countedText.text('results.violations', this.total()));

  protected readonly meters = computed<Meter[]>(() =>
    this.conditions().flatMap((condition) =>
      typeof condition.count === 'number'
        ? [
            {
              id: condition.id,
              parts: condition.sentenceParts,
              count: this.format.number(condition.count),
              counted: this.countedText.text('results.violations', condition.count),
              share: this.total() > 0 ? Math.min(1, condition.count / this.total()) : 0,
            },
          ]
        : [],
    ),
  );

  protected stateOf(id: string): MarkState {
    if (this.active() === id) {
      return 'active';
    }
    return this.traced() === id ? 'traced' : 'resting';
  }
}
