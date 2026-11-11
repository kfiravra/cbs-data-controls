import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { TextPart } from '../../core/api/api.types';
import { groupBrackets } from '../../core/glossary/glossary.phrases';
import { GlossaryService } from '../../core/glossary/glossary.service';
import { LanguageService } from '../../core/i18n/language.service';
import { Block, Clause, splitFirstWord, toBlocks, toClauses } from '../../core/text/text-parts';
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
  readonly kind: 'clause';
  readonly nodeId?: string;
  /** The mark that opens the clause, bound to `lead` so a line never ends on a mark. */
  readonly mark?: string;
  readonly lead: string;
  readonly pieces: readonly Piece[];
}

interface GroupView {
  readonly kind: 'group';
  readonly logical: boolean;
  readonly children: readonly ItemView[];
}

type ItemView = ClauseView | GroupView;

/** One line of a text whose top level joins groups: a group or a condition, led by the word that joins it to the line before. */
interface Line {
  readonly joiner: readonly ItemView[];
  readonly items: readonly ItemView[];
}

/** A stretch of the engine's text for the copy that is read aloud, with the name of the condition it opens. */
interface Spoken {
  readonly mark?: string;
  readonly text: string;
}

const NO_MARKS: ReadonlyMap<string, string> = new Map();
const NONE: ReadonlySet<string> = new Set();
const isJoiner = (item: ItemView) => item.kind === 'clause' && item.nodeId === undefined;

/**
 * Draws text the engine rendered, from its parts: a rule sentence, a condition's clause or a reason. The
 * consecutive parts of one node are one clause; with `marks`, the mark of each node stands at the start
 * corner of its first clause, over the line, and takes no room in it; with `markValues`, the record's actual
 * values are drawn as values. Nothing is rendered here: no template, no variant, no value format.
 *
 * The brackets of a rule are drawn, not written (a reason, `markValues`, keeps its own): what stands between a pair is one soft block,
 * and where the top level joins groups each of them stands on a line of its own, led by the word that joins
 * it to the line before. Only the engine's own group marks are read (the glossary's, in its connecting
 * text): a bracket in a value or a label is data and is written as it is. The text itself stays the
 * engine's, brackets included, for assistive technology: beside a drawing that has blocks the plain
 * sentence is given to be read, each condition named by its mark, and the drawing is hidden from it.
 */
@Component({
  selector: 'app-text-parts',
  imports: [MarkComponent, NgTemplateOutlet, TranslatePipe, ValueComponent],
  // one line per block: white space between elements would add spaces the engine did not write
  template: `@if (grouped()) {<span class="sr-only plain-copy" data-testid="plain-text">@for (stretch of spoken(); track $index) {@if (stretch.mark; as mark) {{{ 'common.condition' | translate: { mark } }} }{{ stretch.text }}}</span>}<span data-testid="drawn-text" [attr.aria-hidden]="grouped() ? 'true' : null">@if (lines(); as rows) {@for (row of rows; track $index) {<span class="rule-line">@if (row.joiner.length > 0) {<span class="rule-joiner"><ng-container *ngTemplateOutlet="draw; context: { $implicit: row.joiner }" /></span>}<ng-container *ngTemplateOutlet="draw; context: { $implicit: row.items }" /></span>}} @else {<ng-container *ngTemplateOutlet="draw; context: { $implicit: items() }" />}</span><ng-template #draw let-list>@for (item of list; track $index) {@if (item.kind === 'group') {<span class="rule-group" data-testid="rule-group"><ng-container *ngTemplateOutlet="draw; context: { $implicit: item.children }" /></span>} @else if (item.nodeId; as id) {<span class="clause" data-testid="clause" [attr.data-node]="id">@if (item.mark; as mark) {<span class="nb marked"><app-mark [label]="mark" [state]="stateOf(id)" [changed]="changed().has(id)" [name]="'common.condition' | translate: { mark }" />{{ item.lead }}</span>}@for (piece of item.pieces; track $index) {@if (piece.value) {<app-value [text]="piece.text" />} @else if (piece.whole) {<span class="nb">{{ piece.text }}</span>} @else {{{ piece.text }}}}</span>} @else {@for (piece of item.pieces; track $index) {{{ piece.text }}}}}</ng-template>`,
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
  /** Node id to mark. Leave it out for a text that carries its mark elsewhere (a reason, a chip of the count by condition). */
  readonly marks = input<ReadonlyMap<string, string>>(NO_MARKS);
  readonly markValues = input(false);
  readonly open = input<ReadonlySet<string>>(NONE);
  readonly changed = input<ReadonlySet<string>>(NONE);

  /**
   * The engine's text as it wrote it, brackets and all, for the copy that is read aloud beside a drawing
   * with blocks: each condition is named by its mark where its text begins, as its drawn mark names it.
   */
  protected readonly spoken = computed<Spoken[]>(() =>
    toClauses(this.parts()).map((clause) => ({
      mark: clause.nodeId && clause.opensNode ? this.marks().get(clause.nodeId) : undefined,
      text: clause.parts.map((part) => part.text).join(''),
    })),
  );

  /**
   * A rule is drawn with its groups as blocks. A reason is not a rule: its brackets are the engine's own
   * punctuation round a value ("16 (under 18)") and are written as they came.
   */
  protected readonly items = computed<ItemView[]>(() =>
    this.markValues()
      ? toClauses(this.parts()).map((clause) => this.clause(clause))
      : toBlocks(this.parts(), groupBrackets(this.glossary(), this.language.lang)).map((block) => this.view(block)),
  );

  /** The drawing has a block in it: the plain text is then what assistive technology reads. */
  protected readonly grouped = computed(() => this.items().some((item) => item.kind === 'group'));

  /**
   * The top level as lines, when it joins groups of conditions: what stands between two joining words is
   * one line (a group, or a condition with whatever follows it), led by the word that joins it to the line
   * before. Null for a text whose top level holds no such group: it runs on as one sentence.
   */
  protected readonly lines = computed<Line[] | null>(() => {
    const items = this.items();
    if (!items.some((item) => item.kind === 'group' && item.logical)) {
      return null;
    }
    const lines: { joiner: ItemView[]; items: ItemView[] }[] = [];
    for (const item of items) {
      const last = lines.at(-1);
      if (isJoiner(item)) {
        lines.push({ joiner: [item], items: [] });
      } else if (!last) {
        lines.push({ joiner: [], items: [item] });
      } else {
        last.items.push(item);
      }
    }
    return lines;
  });

  protected stateOf(id: string): MarkState {
    return this.open().has(id) ? 'open' : 'resting';
  }

  private view(block: Block): ItemView {
    return block.kind === 'group'
      ? { kind: 'group', logical: block.logical, children: block.children.map((child) => this.view(child)) }
      : this.clause(block.clause);
  }

  private clause(clause: Clause): ClauseView {
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
      return { kind: 'clause', nodeId: clause.nodeId, mark, lead: '', pieces };
    }
    // the engine's text as written: the mark only takes the first word beside it
    const [lead, rest] = splitFirstWord(pieces[0].text);
    const tail = rest === '' ? [] : [{ text: rest, value: false, whole: false }];
    return { kind: 'clause', nodeId: clause.nodeId, mark, lead, pieces: [...tail, ...pieces.slice(1)] };
  }
}
