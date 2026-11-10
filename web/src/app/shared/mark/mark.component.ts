import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type MarkState = 'resting' | 'traced' | 'active' | 'open';

/**
 * The letter a condition carries wherever it is spoken of. Display only: derived from the order of the
 * definition, never stored. Give it a `name` where nothing else names its condition; without one it is
 * hidden from assistive technology.
 */
@Component({
  selector: 'app-mark',
  template: '{{ label() }}',
  host: {
    class: 'mark',
    'data-testid': 'mark',
    '[class.mark--traced]': 'state() === "traced"',
    '[class.mark--active]': 'state() === "active"',
    '[class.mark--open]': 'state() === "open"',
    '[class.mark--changed]': 'changed()',
    '[attr.data-state]': 'state()',
    '[attr.role]': 'name() ? "img" : null',
    '[attr.aria-label]': 'name() ?? null',
    '[attr.aria-hidden]': 'name() ? null : "true"',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarkComponent {
  readonly label = input.required<string>();
  readonly state = input<MarkState>('resting');
  readonly name = input<string>();
  /** Plays the settle once: the mark of a clause that was just rewritten fills and eases back. */
  readonly changed = input(false);
}
