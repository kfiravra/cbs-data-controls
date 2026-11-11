import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** The earlier run a summary compares with: a label that dates it, its count in words, and where it lives. */
export interface PreviousRunFact {
  readonly label: string;
  readonly text: string;
  readonly link: readonly (string | number)[];
}

/** A term and its value in the summary. */
export interface RunFact {
  readonly label: string;
  readonly text: string;
}

/**
 * The result of a run as a statement, not a row of tiles: the figure with its noun, then a short list of
 * terms and values. The count is a finding and is set in Ink: red is for what went wrong with the system.
 * Texts arrive translated and formatted.
 */
@Component({
  selector: 'app-run-summary',
  imports: [RouterLink],
  template: `
    <div class="summary" data-testid="run-summary">
      <p class="summary__figure">
        <strong data-testid="run-total">{{ figure() }}</strong> {{ noun() }}
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
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RunSummaryComponent {
  /** The number of violations, formatted. */
  readonly figure = input.required<string>();
  readonly noun = input.required<string>();
  readonly facts = input.required<readonly RunFact[]>();
  readonly previous = input<PreviousRunFact | null>(null);
}
