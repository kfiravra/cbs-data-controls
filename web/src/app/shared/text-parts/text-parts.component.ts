import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { TextPart } from '../../core/api/api.types';
import { tonesOf } from '../../core/definition/marks';
import { groupBrackets } from '../../core/glossary/glossary.phrases';
import { GlossaryService } from '../../core/glossary/glossary.service';
import { LanguageService } from '../../core/i18n/language.service';
import { Block, Clause, plainText, toBlocks, toClauses } from '../../core/text/text-parts';
import { ValueComponent } from '../value/value.component';

interface Piece {
  readonly text: string;
  /** Drawn as the marked value of a reason. */
  readonly value: boolean;
  /** A value with its unit: never broken between the number and the unit. */
  readonly whole: boolean;
}

/** The consecutive parts of one node, or a run of joining words that belongs to none. */
interface ClauseView {
  readonly nodeId?: string;
  /** The place of the node's colour in the fixed set; null for joining words and for a node without a mark. */
  readonly tone: number | null;
  readonly pieces: readonly Piece[];
}

/** The joining word before a condition: it stands with the condition, so no line ends on it. */
interface Lead {
  readonly text: string;
  /** The space between the word and the condition, as the engine wrote it: the line is not broken at it. */
  readonly glue: string;
}

/** A condition with the joining word before it: one piece of the sentence, kept whole while it fits on a line. */
interface Unit {
  readonly kind: 'unit';
  readonly lead: Lead | null;
  readonly clause: ClauseView;
}

/** The engine's own space between two pieces (where a line may be broken), or words that no condition follows. */
interface Gap {
  readonly kind: 'gap';
  readonly text: string;
}

type FlowItem = Unit | Gap;

/** What is drawn: a rule as a flow of pieces, any other text as its clauses in a row. */
interface Drawing {
  readonly flow: readonly FlowItem[] | null;
  readonly clauses: readonly ClauseView[];
  /** Something of the engine's text is said by the drawing alone: a colour, or a group whose brackets are not written. */
  readonly drawn: boolean;
}

/** A stretch of the engine's text for the copy that is read aloud, with the name of the condition it opens. */
interface Spoken {
  readonly mark?: string;
  readonly text: string;
}

const NO_MARKS: ReadonlyMap<string, string> = new Map();
const NONE: ReadonlySet<string> = new Set();
/** The white space at the two ends of a text, and what stands between them. */
const ENDS = /^(\s*)([\s\S]*?)(\s*)$/;

/**
 * Draws text the engine rendered, from its parts: a rule sentence, a condition's clause or a reason. It is
 * plain text with the engine's own words and spacing: no letter stands in it and no ground under any word.
 * The consecutive parts of one node are one clause; with `marks`, the words of each condition are underlined
 * in that condition's colour, the colour its letter has wherever the letter stands; with `markValues`, the
 * record's actual values are drawn as values. Nothing is rendered here: no template, no variant, no value
 * format.
 *
 * A rule (a text with `marks`) is one flowing sentence that wraps as text does: no line is forced and nothing
 * is set in. A condition and the joining word before it are one piece, kept whole while it fits on a line, so
 * a line never ends on a joining word and a condition's words stay together. Only a condition's own words
 * are underlined: a joining word, and the space beside it, carries no line, in a group as at the top level.
 * The group marks of a rule are not written (a reason, `markValues`, keeps its own brackets), and nothing
 * else is drawn in their place. Only the engine's own marks are read (the glossary's, in its connecting
 * text): a bracket in a value or a label is data and is written as it is. The text itself stays the
 * engine's, brackets included, for assistive technology: beside a drawing that says something by a colour,
 * or leaves a group mark out, the plain sentence is given to be read, each condition named by its mark, and
 * the drawing is hidden from it.
 */
@Component({
  selector: 'app-text-parts',
  imports: [NgTemplateOutlet, TranslatePipe, ValueComponent],
  // one line per block: white space between elements would add spaces the engine did not write
  template: `@if (spoken(); as stretches) {<span class="sr-only plain-copy" data-testid="plain-text">@for (stretch of stretches; track $index) {@if (stretch.mark; as mark) {{{ 'common.condition' | translate: { mark } }} }{{ stretch.text }}}</span>}<span data-testid="drawn-text" [attr.aria-hidden]="spoken() ? 'true' : null">@if (drawing().flow; as flow) {@for (item of flow; track $index) {@if (item.kind === 'gap') {<span class="rule-gap" data-testid="rule-gap">{{ item.text }}</span>} @else {<span class="rule-unit" data-testid="rule-unit">@if (item.lead; as lead) {<span class="rule-lead" data-testid="rule-lead">{{ lead.text }}<span class="nb">{{ lead.glue }}</span></span>}<ng-container *ngTemplateOutlet="words; context: { $implicit: item.clause }" /></span>}}} @else {@for (item of drawing().clauses; track $index) {<ng-container *ngTemplateOutlet="words; context: { $implicit: item }" />}}</span><ng-template #words let-item>@if (item.nodeId; as id) {<span class="clause" data-testid="clause" [class.clause--changed]="changed().has(id)" [attr.data-node]="id" [attr.data-tone]="item.tone">@for (piece of item.pieces; track $index) {@if (piece.value) {<app-value [text]="piece.text" />} @else if (piece.whole) {<span class="nb">{{ piece.text }}</span>} @else {{{ piece.text }}}}</span>} @else {@for (piece of item.pieces; track $index) {{{ piece.text }}}}</ng-template>`,
  styles: `
    :host {
      display: inline;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextPartsComponent {
  private readonly glossary = inject(GlossaryService).glossary;
  private readonly language = inject(LanguageService);

  readonly parts = input.required<readonly TextPart[]>();
  /**
   * Node id to mark, in the order of the rule: it gives each condition its colour, and its name in the copy
   * that is read aloud. With it the text is drawn as a rule. Leave it out for a text that is about one
   * condition whose letter stands beside it (a reason, a chip of the count by condition).
   */
  readonly marks = input<ReadonlyMap<string, string>>(NO_MARKS);
  readonly markValues = input(false);
  /** The nodes whose clause was just rewritten: the line under their words plays the settle once. */
  readonly changed = input<ReadonlySet<string>>(NONE);
  /**
   * Whether the copy that is read aloud names each condition by its mark. True where the letters stand on the
   * screen beside the rule (the builder, the count by condition, the reasons); false where a rule is shown
   * with no letters anywhere (a suggestion): a name that points at nothing is noise.
   */
  readonly named = input(true);

  private readonly tones = computed(() => tonesOf(this.marks()));

  /**
   * What is drawn. A reason is not a rule: its brackets are the engine's own punctuation round a value
   * ("16 (under 18)"), and it is drawn as it came. Any other text loses its group marks; with marks it is
   * laid out as a rule, and without them it is its clauses in a row.
   */
  protected readonly drawing = computed<Drawing>(() => {
    if (this.markValues()) {
      return { flow: null, clauses: toClauses(this.parts()).map((clause) => this.view(clause)), drawn: false };
    }
    const blocks = toBlocks(this.parts(), groupBrackets(this.glossary(), this.language.lang));
    const grouped = blocks.some((block) => block.kind === 'group');
    if (this.marks().size === 0) {
      return { flow: null, clauses: clausesIn(blocks).map((clause) => this.view(clause)), drawn: grouped };
    }
    const flow = this.flow(blocks);
    const coloured = flow.some((item) => item.kind === 'unit' && item.clause.tone !== null);
    return { flow, clauses: [], drawn: grouped || coloured };
  });

  /**
   * The engine's text as it wrote it, brackets and all, for the copy that is read aloud: each condition is
   * named by its mark where its text begins. Null where the drawing says everything the text says.
   */
  protected readonly spoken = computed<Spoken[] | null>(() => {
    if (!this.drawing().drawn) {
      return null;
    }
    return toClauses(this.parts()).map((clause) => ({
      mark: this.named() && clause.nodeId && clause.opensNode ? this.marks().get(clause.nodeId) : undefined,
      text: clause.parts.map((part) => part.text).join(''),
    }));
  });

  /**
   * The blocks of a rule as one flow. A joining word goes with the condition after it, into one piece; the
   * space before it stays between the pieces, where a line may be broken. A group is only walked through:
   * nothing is drawn for it. Every character is the engine's, in its order: only the group marks are gone.
   */
  private flow(blocks: readonly Block[]): FlowItem[] {
    const flow: FlowItem[] = [];
    // the joining word that waits for its condition: one at the most
    const waiting: Lead[] = [];
    const gap = (text: string) => {
      if (text !== '') {
        flow.push({ kind: 'gap', text });
      }
    };
    for (const clause of clausesIn(blocks)) {
      if (clause.nodeId === undefined) {
        const [, before, words, after] = ENDS.exec(plainText(clause.parts))!;
        gap(before);
        if (words !== '') {
          waiting.push({ text: words, glue: after });
        }
        continue;
      }
      const view = this.view(clause);
      const [first, last] = [view.pieces.at(0), view.pieces.at(-1)];
      const before = first ? ENDS.exec(first.text)![1] : '';
      const after = last ? ENDS.exec(last.text)![3] : '';
      const pieces = view.pieces.map((piece, at) => ({
        ...piece,
        text: piece.text.slice(at === 0 ? before.length : 0, at === view.pieces.length - 1 ? piece.text.length - after.length : undefined),
      }));
      const lead = waiting.pop();
      if (!lead) {
        gap(before);
      }
      flow.push({ kind: 'unit', lead: lead ? { ...lead, glue: lead.glue + before } : null, clause: { ...view, pieces } });
      gap(after);
    }
    // joining words that no condition follows are written as they came
    for (const left of waiting) {
      gap(left.text + left.glue);
    }
    return flow;
  }

  private view(clause: Clause): ClauseView {
    const pieces: Piece[] = clause.parts.map((part) => {
      const actual = part.role === 'actual' || part.role === 'otherActual';
      return {
        text: part.text,
        value: actual && this.markValues(),
        whole: part.role === 'value' || (actual && !this.markValues()),
      };
    });
    return { nodeId: clause.nodeId, tone: (clause.nodeId && this.tones().get(clause.nodeId)) || null, pieces };
  }
}

/** Every clause of a tree of blocks, in the order of the text. */
function clausesIn(blocks: readonly Block[]): Clause[] {
  return blocks.flatMap((block) => (block.kind === 'clause' ? [block.clause] : clausesIn(block.children)));
}
