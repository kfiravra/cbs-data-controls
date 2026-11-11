import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type MarkState = 'resting' | 'open';

/**
 * The letter a condition carries wherever it is spoken of. Display only: derived from the order of the
 * definition, never stored. It is a badge and answers to nothing; the editor outlines the mark of an
 * unfinished condition (`open`). At the start of a row it is a small square; in a sentence it is smaller
 * still and sits at the top corner of its clause. Give it a `name` where nothing else names its condition;
 * without one it is hidden from assistive technology.
 */
@Component({
  selector: 'app-mark',
  template: '{{ label() }}',
  host: {
    class: 'mark',
    'data-testid': 'mark',
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
