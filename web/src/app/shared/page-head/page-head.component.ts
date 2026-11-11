import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { IconComponent } from '../icon/icon.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';

/**
 * The head of a screen: the way back to the list, the title, one meta line, and the actions (projected).
 * The title may be user data, so it is isolated from the direction of the text around it. While the meta
 * line is on its way a bar holds its place, so the screen under the head does not move when it arrives.
 */
@Component({
  selector: 'app-page-head',
  imports: [IconComponent, RouterLink, SkeletonComponent, TranslatePipe],
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
        } @else if (metaPending()) {
          <p class="page-head__pending" aria-hidden="true"><app-skeleton width="calc(2 * var(--space-8))" /></p>
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

    /* one line of the meta text, with the bar in its middle */
    .page-head__pending {
      display: grid;
      align-items: center;
      min-block-size: 1lh;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeadComponent {
  readonly title = input.required<string>();
  readonly meta = input<string>();
  /** Whether a meta line is on its way: its place is held until it arrives. */
  readonly metaPending = input(false);
  readonly back = input(false);
}
