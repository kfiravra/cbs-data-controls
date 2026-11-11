import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** The actual value that matched, marked inside its reason. It may be user data in another script. */
@Component({
  selector: 'app-value',
  template: '<bdi>{{ text() }}</bdi>',
  host: { class: 'value', 'data-testid': 'value' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ValueComponent {
  readonly text = input.required<string>();
}
