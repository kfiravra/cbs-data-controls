import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { SkeletonComponent } from '../skeleton/skeleton.component';

/**
 * The head of the list and of a panel: the title, one meta line (or what is projected as `[meta]`, such as a
 * panel's run picker), and the actions (projected). The title may be user data, so it is isolated from the
 * direction of the text around it, and it can take the focus: a panel that closes with nowhere to go back to
 * puts it there. While the meta line is on its way a bar holds its place, so what stands under the head
 * does not move when it arrives.
 */
@Component({
  selector: 'app-page-head',
  imports: [SkeletonComponent],
  template: `
    <div class="page-head">
      <div class="page-head__text">
        <h1 class="t-page" tabindex="-1" [id]="titleId()" [attr.data-testid]="titleId() ?? 'page-title'">
          <bdi>{{ title() }}</bdi>
        </h1>
        <ng-content select="[meta]" />
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
  /** The id of the title, and its test id: a panel is named by it (`aria-labelledby`). The list's title has none. */
  readonly titleId = input<string>();
  readonly meta = input<string>();
  /** Whether a meta line is on its way: its place is held until it arrives. */
  readonly metaPending = input(false);
}
