import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** A bar in the shape of the text to come; loading never blanks a screen. */
@Component({
  selector: 'app-skeleton',
  template: '',
  host: { class: 'skeleton', '[style.inline-size]': 'width()', 'aria-hidden': 'true' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkeletonComponent {
  /** A CSS length or percentage. */
  readonly width = input('100%');
}
