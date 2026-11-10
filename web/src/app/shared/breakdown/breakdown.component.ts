import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { ConditionSummary } from '../../core/api/api.types';
import { LanguageService } from '../../core/i18n/language.service';
import { MarkComponent, MarkState } from '../mark/mark.component';
import { TextPartsComponent } from '../text-parts/text-parts.component';

interface Meter {
  readonly id: string;
  readonly parts: ConditionSummary['sentenceParts'];
  readonly count: string;
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
        <span class="meter__count">{{ totalText() }}</span>
      </button>
      @for (meter of meters(); track meter.id) {
        <button
          class="meter"
          type="button"
          data-testid="breakdown-row"
          [attr.data-node]="meter.id"
          [attr.aria-pressed]="active() === meter.id"
          [style.--share]="meter.share"
          (click)="filter.emit(active() === meter.id ? null : meter.id)"
          (focus)="trace.emit(meter.id)"
          (blur)="trace.emit(null)"
          (pointerenter)="trace.emit(meter.id)"
          (pointerleave)="trace.emit(null)"
        >
          <app-mark
            [label]="marks().get(meter.id) ?? ''"
            [state]="stateOf(meter.id)"
            [name]="'common.condition' | translate: { mark: marks().get(meter.id) ?? '' }"
          />
          <span><app-text-parts [parts]="meter.parts" /></span>
          <span class="meter__count">{{ meter.count }}</span>
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
  private readonly language = inject(LanguageService);

  /** The run's conditions: the nodes a run can match. An entry without a count is not drawn. */
  readonly conditions = input.required<readonly ConditionSummary[]>();
  readonly total = input.required<number>();
  readonly marks = input.required<ReadonlyMap<string, string>>();
  /** The condition the table is filtered by; null for all violations. */
  readonly active = input<string | null>(null);
  readonly traced = input<string | null>(null);
  readonly filter = output<string | null>();
  readonly trace = output<string | null>();

  private readonly number = computed(() => new Intl.NumberFormat(this.language.locale));
  protected readonly totalText = computed(() => this.number().format(this.total()));

  protected readonly meters = computed<Meter[]>(() =>
    this.conditions().flatMap((condition) =>
      typeof condition.count === 'number'
        ? [
            {
              id: condition.id,
              parts: condition.sentenceParts,
              count: this.number().format(condition.count),
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
