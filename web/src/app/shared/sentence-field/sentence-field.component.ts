import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { TextPart } from '../../core/api/api.types';
import { IconComponent } from '../icon/icon.component';
import { TextPartsComponent } from '../text-parts/text-parts.component';

const NONE: ReadonlySet<string> = new Set();

/**
 * The control in words, in the editor: the engine's sentence with a mark per clause, one line of status
 * when something is unfinished, then the actions (projected). While the draft is unfinished or invalid the
 * last valid sentence stays, dimmed (`stale`); before any valid sentence there is a one-line hint.
 * Changes are announced politely.
 */
@Component({
  selector: 'app-sentence-field',
  imports: [IconComponent, TextPartsComponent, TranslatePipe],
  template: `
    <div class="sentence-field" data-testid="sentence-field">
      <h2 class="sentence-field__title" id="sentence-title">{{ 'editor.sentence.title' | translate }}</h2>
      <div aria-live="polite">
        @if (parts(); as sentence) {
          <p class="sentence" data-testid="sentence" [class.sentence--stale]="stale()" [attr.data-stale]="stale()">
            <app-text-parts
              [parts]="sentence"
              [marks]="marks()"
              [traced]="traced()"
              [open]="open()"
              [changed]="changed()"
              (trace)="trace.emit($event)"
            />
          </p>
        } @else {
          <p class="sentence-field__hint" data-testid="sentence-hint">{{ 'editor.sentence.hint' | translate }}</p>
        }
      </div>
      <div aria-live="polite">
        @if (status(); as line) {
          <p class="sentence-field__status" data-testid="sentence-status">
            <app-icon name="warning" size="sm" />{{ line }}
          </p>
        }
      </div>
      <div class="sentence-field__actions">
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SentenceFieldComponent {
  /** The parts of the last valid sentence; null until the engine has answered once. */
  readonly parts = input.required<readonly TextPart[] | null>();
  readonly stale = input(false);
  /** Marks of the current draft: ids are stable, and a clause whose node is gone has no mark. */
  readonly marks = input.required<ReadonlyMap<string, string>>();
  readonly traced = input<string | null>(null);
  readonly open = input<ReadonlySet<string>>(NONE);
  /** The nodes whose clause was just rewritten: their marks play the settle once. */
  readonly changed = input<ReadonlySet<string>>(NONE);
  /** One translated line that names what is unfinished; absent when nothing is. */
  readonly status = input<string | null>(null);
  readonly trace = output<string | null>();
}
