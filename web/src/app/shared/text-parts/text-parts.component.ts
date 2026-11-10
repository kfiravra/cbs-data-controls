import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { TextPart } from '../../core/api/api.types';
import { splitFirstWord, toClauses } from '../../core/text/text-parts';
import { MarkComponent, MarkState } from '../mark/mark.component';
import { ValueComponent } from '../value/value.component';

interface Piece {
  readonly text: string;
  /** Drawn as the marked value of a reason. */
  readonly value: boolean;
  /** A value with its unit: never broken between the number and the unit. */
  readonly whole: boolean;
}

interface ClauseView {
  readonly nodeId?: string;
  /** The mark that opens the clause, bound to `lead` so a line never ends on a mark. */
  readonly mark?: string;
  readonly lead: string;
  readonly pieces: readonly Piece[];
}

const NO_MARKS: ReadonlyMap<string, string> = new Map();
const NONE: ReadonlySet<string> = new Set();

/**
 * Draws text the engine rendered, from its parts: a rule sentence, a condition's clause or a reason. The
 * consecutive parts of one node are one clause; with `marks`, a mark stands before the first clause of each
 * node; with `markValues`, the record's actual values are drawn as values. Nothing is rendered here: no
 * template, no variant, no value format.
 */
@Component({
  selector: 'app-text-parts',
  imports: [MarkComponent, TranslatePipe, ValueComponent],
  // one line per block: white space between elements would add spaces the engine did not write
  template: `@for (clause of clauses(); track $index) {@if (clause.nodeId; as id) {<span class="clause" [attr.data-node]="id" (pointerenter)="trace.emit(id)" (pointerleave)="trace.emit(null)">@if (clause.mark; as mark) {<span class="nb"><app-mark [label]="mark" [state]="stateOf(id)" [changed]="changed().has(id)" [name]="'common.condition' | translate: { mark }" /> {{ clause.lead }}</span>}@for (piece of clause.pieces; track $index) {@if (piece.value) {<app-value [text]="piece.text" />} @else if (piece.whole) {<span class="nb">{{ piece.text }}</span>} @else {{{ piece.text }}}}</span>} @else {@for (piece of clause.pieces; track $index) {{{ piece.text }}}}}`,
  styles: `
    :host {
      display: inline;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextPartsComponent {
  readonly parts = input.required<readonly TextPart[]>();
  /** Node id to mark. Leave it out for a text that carries its mark elsewhere (a reason, a breakdown row). */
  readonly marks = input<ReadonlyMap<string, string>>(NO_MARKS);
  readonly markValues = input(false);
  readonly traced = input<string | null>(null);
  readonly active = input<string | null>(null);
  readonly open = input<ReadonlySet<string>>(NONE);
  readonly changed = input<ReadonlySet<string>>(NONE);
  /** The node under the pointer, or null when the pointer leaves a clause. */
  readonly trace = output<string | null>();

  protected readonly clauses = computed<ClauseView[]>(() =>
    toClauses(this.parts()).map((clause) => {
      const pieces: Piece[] = clause.parts.map((part) => {
        const actual = part.role === 'actual' || part.role === 'otherActual';
        return {
          text: part.text,
          value: actual && this.markValues(),
          whole: part.role === 'value' || (actual && !this.markValues()),
        };
      });
      const mark = clause.nodeId && clause.opensNode ? this.marks().get(clause.nodeId) : undefined;
      if (mark === undefined || pieces[0].value || pieces[0].whole) {
        return { nodeId: clause.nodeId, mark, lead: '', pieces };
      }
      // the engine's text as written: the mark only takes the first word beside it
      const [lead, rest] = splitFirstWord(pieces[0].text);
      const tail = rest === '' ? [] : [{ text: rest, value: false, whole: false }];
      return { nodeId: clause.nodeId, mark, lead, pieces: [...tail, ...pieces.slice(1)] };
    }),
  );

  protected stateOf(id: string): MarkState {
    if (this.open().has(id)) {
      return 'open';
    }
    if (this.active() === id) {
      return 'active';
    }
    return this.traced() === id ? 'traced' : 'resting';
  }
}
