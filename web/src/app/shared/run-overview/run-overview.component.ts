import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { ConditionSummary } from '../../core/api/api.types';
import { CountedService } from '../../core/i18n/counted.service';
import { FormatService } from '../../core/i18n/format.service';
import { MarkComponent } from '../mark/mark.component';
import { TextPartsComponent } from '../text-parts/text-parts.component';

/** The earlier run an overview compares with: a label that dates it, its count in words, and where it lives. */
export interface PreviousRunFact {
  readonly label: string;
  readonly text: string;
  readonly link: readonly (string | number)[];
}

/** A term and its value in the overview. */
export interface RunFact {
  readonly label: string;
  readonly text: string;
}

interface Meter {
  readonly id: string;
  readonly parts: ConditionSummary['sentenceParts'];
  readonly count: string;
  /** The count with its noun, for assistive technology: a bare number at the end of a button says nothing. */
  readonly counted: string;
}

/**
 * What a run found, in one block: the count with its noun and a few facts about the run, and beside them
 * the same count by condition, as a row of chips where each is a button that filters the records. The count
 * is said once: the chip for all violations carries no number of its own. The count is red and a clean run is
 * green, as everywhere. The marks are badges and answer to nothing. Counts are over all violations, also
 * above the row cap. Texts arrive translated and formatted.
 */
@Component({
  selector: 'app-run-overview',
  imports: [MarkComponent, RouterLink, TextPartsComponent, TranslatePipe],
  template: `
    <div class="overview" data-testid="run-summary">
      <div class="overview__info">
        <p class="overview__figure" [class.overview__figure--clean]="total() === 0">
          <strong class="num" data-testid="run-total">{{ figure() }}</strong> {{ noun() }}
        </p>
        <dl class="facts">
          @for (fact of facts(); track fact.label) {
            <div>
              <dt>{{ fact.label }}</dt>
              <dd>{{ fact.text }}</dd>
            </div>
          }
          @if (previous(); as earlier) {
            <div>
              <dt>{{ earlier.label }}</dt>
              <dd>
                <a class="link" data-testid="previous-run" [routerLink]="earlier.link">{{ earlier.text }}</a>
              </dd>
            </div>
          }
        </dl>
      </div>
      @if (meters().length > 0) {
        <div class="overview__filter" role="group" aria-labelledby="overview-by">
          <div class="overview__by">
            <h3 class="t-label" id="overview-by">{{ 'results.breakdown.title' | translate }}</h3>
            <p class="muted t-small">{{ 'results.breakdown.hint' | translate }}</p>
          </div>
          <div class="meters" data-testid="breakdown">
            <button
              class="meter meter--all"
              type="button"
              data-testid="breakdown-all"
              [attr.aria-pressed]="active() === null"
              (click)="filter.emit(null)"
            >
              {{ 'results.breakdown.all' | translate }}
            </button>
            @for (meter of meters(); track meter.id) {
              <button
                class="meter"
                type="button"
                data-testid="breakdown-row"
                [attr.data-node]="meter.id"
                [attr.aria-pressed]="active() === meter.id"
                (click)="filter.emit(active() === meter.id ? null : meter.id)"
              >
                @if (marks().get(meter.id); as mark) {
                  <app-mark [label]="mark" [name]="'common.condition' | translate: { mark }" />
                }
                <span class="meter__clause"><app-text-parts [parts]="meter.parts" /></span>
                <span class="meter__count" aria-hidden="true" data-testid="breakdown-count">{{ meter.count }}</span>
                <span class="sr-only">{{ meter.counted }}</span>
              </button>
            }
          </div>
        </div>
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
export class RunOverviewComponent {
  private readonly format = inject(FormatService);
  private readonly countedText = inject(CountedService);

  /** The number of violations, formatted, and its noun. */
  readonly figure = input.required<string>();
  readonly noun = input.required<string>();
  /** The number of violations; a run that found none has no count by condition. */
  readonly total = input.required<number>();
  readonly facts = input.required<readonly RunFact[]>();
  readonly previous = input<PreviousRunFact | null>(null);
  /** The run's conditions: the nodes a run can match. An entry without a count is not drawn. */
  readonly conditions = input<readonly ConditionSummary[]>([]);
  readonly marks = input.required<ReadonlyMap<string, string>>();
  /** The condition the table is filtered by; null for all violations. */
  readonly active = input<string | null>(null);
  readonly filter = output<string | null>();

  protected readonly meters = computed<Meter[]>(() =>
    this.total() === 0
      ? []
      : this.conditions().flatMap((condition) =>
          typeof condition.count === 'number'
            ? [
                {
                  id: condition.id,
                  parts: condition.sentenceParts,
                  count: this.format.number(condition.count),
                  counted: this.countedText.text('results.violations', condition.count),
                },
              ]
            : [],
        ),
  );
}
