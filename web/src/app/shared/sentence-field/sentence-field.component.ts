import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { TextPart } from '../../core/api/api.types';
import { IconComponent } from '../icon/icon.component';
import { TextPartsComponent } from '../text-parts/text-parts.component';

const NONE: ReadonlySet<string> = new Set();

/**
 * The control in words, as the bar at the foot of the editor's panel: the engine's sentence with each
 * condition's words underlined in its colour, one line of status when something is unfinished, and the actions beside them (projected). The bar
 * never changes its height: the sentence has a fixed room and scrolls inside it when it is longer, and the
 * status line keeps its place while it is empty, so nothing above the bar moves when the text changes.
 * While the draft is unfinished or invalid the last valid sentence stays, dimmed (`stale`); before any valid
 * sentence there is a one-line hint that says why there is none yet. Changes are announced politely.
 */
@Component({
  selector: 'app-sentence-field',
  imports: [IconComponent, TextPartsComponent, TranslatePipe],
  template: `
    <div class="rulebar" data-testid="sentence-field">
      <div class="rulebar__text">
        <h2 class="rulebar__title" id="sentence-title">{{ 'editor.sentence.title' | translate }}</h2>
        <div class="rulebar__sentence" aria-live="polite">
          @if (parts(); as sentence) {
            <p class="sentence" data-testid="sentence" [class.sentence--stale]="stale()" [attr.data-stale]="stale()">
              <app-text-parts
                [parts]="sentence"
                [marks]="marks()"
                [changed]="changed()"
              />
            </p>
          } @else {
            <p class="rulebar__hint" data-testid="sentence-hint">{{ hintKey() | translate }}</p>
          }
        </div>
        <div class="rulebar__status" aria-live="polite">
          @if (status(); as line) {
            <p data-testid="sentence-status"><app-icon name="warning" size="sm" />{{ line }}</p>
          }
        </div>
      </div>
      <div class="rulebar__actions">
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
  /** The nodes whose clause was just rewritten: the line under their words plays the settle once. */
  readonly changed = input<ReadonlySet<string>>(NONE);
  /** The key of the line shown while there is no sentence: it differs by why there is none. */
  readonly hintKey = input('editor.sentence.hint');
  /** One translated line that names what is unfinished; absent when nothing is. */
  readonly status = input<string | null>(null);
}
