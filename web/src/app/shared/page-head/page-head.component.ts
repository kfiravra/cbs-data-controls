import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { IconComponent } from '../icon/icon.component';

/**
 * The head of a screen: the way back to the list, the title, one meta line, and the actions (projected).
 * The title may be user data, so it is isolated from the direction of the text around it.
 */
@Component({
  selector: 'app-page-head',
  imports: [IconComponent, RouterLink, TranslatePipe],
  template: `
    <div class="page-head">
      <div class="page-head__text">
        @if (back()) {
          <a class="back" routerLink="/" data-testid="back-to-list">
            <app-icon name="arrow_back" size="sm" [mirrored]="true" />{{ 'common.backToList' | translate }}
          </a>
        }
        <h1 class="t-page" data-testid="page-title">
          <bdi>{{ title() }}</bdi>
        </h1>
        @if (meta(); as text) {
          <p class="muted num" data-testid="page-meta">{{ text }}</p>
        }
      </div>
      <div class="page-head__actions">
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .page-head__actions:empty {
      display: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeadComponent {
  readonly title = input.required<string>();
  readonly meta = input<string>();
  readonly back = input(false);
}
