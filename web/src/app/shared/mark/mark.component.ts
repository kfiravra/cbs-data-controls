import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type MarkState = 'resting' | 'open';

/**
 * The letter a condition carries wherever it is spoken of. Display only: derived from the order of the
 * definition, never stored. It is a badge on a ground of its condition's colour and answers to nothing; the
 * editor outlines the mark of an unfinished condition (`open`). It stands at the start of a row (the builder,
 * the count by condition, a reason); the rule in words has no letters, only the colours. Give it a `name` where nothing else names its condition;
 * without one it is hidden from assistive technology.
 */
@Component({
  selector: 'app-mark',
  template: '{{ label() }}',
  host: {
    class: 'mark',
    'data-testid': 'mark',
    '[class.mark--open]': 'state() === "open"',
    '[attr.data-state]': 'state()',
    '[attr.data-tone]': 'tone()',
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
  /** The place of the condition's colour in the fixed set (`toneOf`); null for a mark with no colour of its own. */
  readonly tone = input<number | null>(null);
}
