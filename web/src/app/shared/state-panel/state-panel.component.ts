import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { IconName } from '../../core/icons/icons';
import { IconComponent } from '../icon/icon.component';

export type StateTone = 'neutral' | 'warning' | 'danger' | 'success';

/**
 * A message that stands where content would be: an icon, a title, a short paragraph (the default slot) and
 * the next steps (`[actions]`). Start aligned, never centred with an illustration.
 */
@Component({
  selector: 'app-state-panel',
  imports: [IconComponent],
  template: `
    <div class="state" [class]="'state--' + tone()">
      @if (icon(); as name) {
        <app-icon [name]="name" size="lg" />
      }
      <h2 class="t-title num">{{ title() }}</h2>
      <ng-content />
      <div class="state__actions">
        <ng-content select="[actions]" />
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
export class StatePanelComponent {
  readonly tone = input<StateTone>('neutral');
  readonly icon = input<IconName>();
  readonly title = input.required<string>();
}
