import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

import { IconName } from '../../core/icons/icons';

/**
 * A Material Symbol in the colour of the text beside it. Decorative: the name of an action comes from its
 * button. `mirrored` is for icons that point (arrows, chevrons), which follow the reading direction.
 */
@Component({
  selector: 'app-icon',
  imports: [MatIcon],
  template: `<mat-icon [svgIcon]="name()" aria-hidden="true" />`,
  styles: `
    mat-icon {
      inline-size: 100%;
      block-size: 100%;
    }
  `,
  host: {
    class: 'icon',
    '[class.icon--sm]': 'size() === "sm"',
    '[class.icon--lg]': 'size() === "lg"',
    '[class.icon--dir]': 'mirrored()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly mirrored = input(false);
}
