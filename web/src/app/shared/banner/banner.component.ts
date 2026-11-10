import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { IconName } from '../../core/icons/icons';
import { IconComponent } from '../icon/icon.component';

export type BannerTone = 'neutral' | 'warning' | 'danger' | 'success';

const TONE_ICON: Record<BannerTone, IconName> = {
  neutral: 'info',
  warning: 'warning',
  danger: 'error',
  success: 'check_circle',
};

/**
 * A message that belongs to the whole screen and leaves the content in place: an icon in the state colour,
 * a title, one or two sentences and at most one text button. Texts arrive translated.
 */
@Component({
  selector: 'app-banner',
  imports: [IconComponent],
  template: `
    <div class="banner" [class]="'banner--' + tone()" [attr.role]="urgent() ? 'alert' : 'status'">
      <app-icon [name]="shownIcon()" />
      <div>
        <p class="banner__title num">{{ title() }}</p>
        @if (body(); as text) {
          <p class="banner__body">{{ text }}</p>
        }
      </div>
      @if (actionLabel(); as label) {
        <div class="banner__actions">
          <button class="btn btn--text btn--sm" type="button" (click)="action.emit()">{{ label }}</button>
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
export class BannerComponent {
  readonly tone = input<BannerTone>('neutral');
  readonly icon = input<IconName>();
  readonly title = input.required<string>();
  readonly body = input<string>();
  readonly actionLabel = input<string>();
  /** An urgent banner interrupts assistive technology (`alert`); the others are announced politely. */
  readonly urgent = input(false);
  readonly action = output<void>();

  protected readonly shownIcon = computed(() => this.icon() ?? TONE_ICON[this.tone()]);
}
