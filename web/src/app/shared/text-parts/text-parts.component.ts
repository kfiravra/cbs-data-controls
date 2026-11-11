import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { TextPart } from '../../core/api/api.types';
import { toneOf } from '../../core/definition/marks';
import { groupBrackets } from '../../core/glossary/glossary.phrases';
import { GlossaryService } from '../../core/glossary/glossary.service';
import { LanguageService } from '../../core/i18n/language.service';
import { Block, Clause, toBlocks, toClauses } from '../../core/text/text-parts';
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

/** One line of a rule: what stands on it, and how many steps in it stands. */
interface RuleLine {
  readonly depth: number;
  readonly items: readonly ClauseView[];
}

/** A stretch of the engine's text for the copy that is read aloud, with the name of the condition it opens. */
interface Spoken {
  readonly mark?: string;
  readonly text: string;
}

const NO_MARKS: ReadonlyMap<string, string> = new Map();
const NONE: ReadonlySet<string> = new Set();
const isJoiner = (item: ClauseView) => item.nodeId === undefined;
const hasWords = (item: ClauseView) => item.pieces.some((piece) => piece.text.trim() !== '');

/**
 * Draws text the engine rendered, from its parts: a rule sentence, a condition's clause or a reason. It is
 * plain text with the engine's own spacing: no letter stands in it and no ground under any word. The
 * consecutive parts of one node are one clause; with `marks`, the words of each condition are underlined in
 * that condition's colour, the colour its letter has wherever the letter stands; with `markValues`, the
 * record's actual values are drawn as values. Nothing is rendered here: no template, no variant, no value
 * format.
 *
 * The group marks of a rule are drawn, not written (a reason, `markValues`, keeps its own brackets). Every
 * group of the top level stands on a line of its own, led by the word that joins it to what stands before;
 * a group inside a group, and what a condition on related records holds, stands on a line of its own one
 * step in. Only the engine's own marks are read (the glossary's, in its connecting text): a bracket in a
 * value or a label is data and is written as it is. The text itself stays the engine's, brackets included,
 * for assistive technology: beside a drawing that has lines or colours the plain sentence is given to be
 * read, each condition named by its mark, and the drawing is hidden from it.
 */
@Component({
  selector: 'app-text-parts',
  imports: [NgTemplateOutlet, TranslatePipe, ValueComponent],
  // one line per block: white space between elements would add spaces the engine did not write
  template: `@if (spoken(); as stretches) {<span class="sr-only plain-copy" data-testid="plain-text">@for (stretch of stretches; track $index) {@if (stretch.mark; as mark) {{{ 'common.condition' | translate: { mark } }} }{{ stretch.text }}}</span>}<span data-testid="drawn-text" [attr.aria-hidden]="spoken() ? 'true' : null">@if (lines().length === 1) {<ng-container *ngTemplateOutlet="draw; context: { $implicit: lines()[0].items }" />} @else {@for (line of lines(); track $index) {<span class="rule-line" data-testid="rule-line" [attr.data-depth]="line.depth" [style.--indent]="line.depth"><ng-container *ngTemplateOutlet="draw; context: { $implicit: line.items }" /></span>}}</span><ng-template #draw let-list>@for (item of list; track $index) {@if (item.nodeId; as id) {<span class="clause" data-testid="clause" [class.clause--changed]="changed().has(id)" [attr.data-node]="id" [attr.data-tone]="item.tone">@for (piece of item.pieces; track $index) {@if (piece.value) {<app-value [text]="piece.text" />} @else if (piece.whole) {<span class="nb">{{ piece.text }}</span>} @else {{{ piece.text }}}}</span>} @else {@for (piece of item.pieces; track $index) {{{ piece.text }}}}}</ng-template>`,
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
   * that is read aloud. Leave it out for a text that is about one condition whose letter stands beside it
   * (a reason, a chip of the count by condition).
   */
  readonly marks = input<ReadonlyMap<string, string>>(NO_MARKS);
  readonly markValues = input(false);
  /** The nodes whose clause was just rewritten: the line under their words plays the settle once. */
  readonly changed = input<ReadonlySet<string>>(NONE);

  /**
   * The lines of the drawing. A rule is laid out by its groups; a reason is not a rule: its brackets are
   * the engine's own punctuation round a value ("16 (under 18)"), and it is one line as it came.
   */
  protected readonly lines = computed<RuleLine[]>(() => {
    if (this.markValues()) {
      return [{ depth: 0, items: toClauses(this.parts()).map((clause) => this.clause(clause)) }];
    }
    const lines = this.layout(toBlocks(this.parts(), groupBrackets(this.glossary(), this.language.lang)));
    return lines.length > 0 ? lines : [{ depth: 0, items: [] }];
  });

  /**
   * The engine's text as it wrote it, brackets and all, for the copy that is read aloud: each condition is
   * named by its mark where its text begins. Null where the drawing says everything the text says: one
   * line, and no condition known by a colour alone.
   */
  protected readonly spoken = computed<Spoken[] | null>(() => {
    const coloured = this.lines().some((line) => line.items.some((item) => item.tone !== null));
    if (this.lines().length === 1 && !coloured) {
      return null;
    }
    return toClauses(this.parts()).map((clause) => ({
      mark: clause.nodeId && clause.opensNode ? this.marks().get(clause.nodeId) : undefined,
      text: clause.parts.map((part) => part.text).join(''),
    }));
  });

  /**
   * The blocks of a rule as lines. A group of the top level starts a line at the edge, and takes the
   * joining word before it to lead that line; any other group (one inside a group, or what a related node
   * holds) starts a line one step in, and what follows it goes on from a new line at the step it left. A
   * line that would hold no word is not made.
   */
  private layout(blocks: readonly Block[]): RuleLine[] {
    const lines: RuleLine[] = [];
    const walk = (children: readonly Block[], depth: number, top: boolean, lead: ClauseView[]): void => {
      let items = [...lead];
      const flush = () => {
        if (items.some(hasWords)) {
          lines.push({ depth, items });
        }
        items = [];
      };
      for (const child of children) {
        if (child.kind === 'clause') {
          items.push(this.clause(child.clause));
        } else if (top && child.logical) {
          const joiners: ClauseView[] = [];
          while (items.length > 0 && isJoiner(items.at(-1)!)) {
            joiners.unshift(items.pop()!);
          }
          flush();
          walk(child.children, depth, false, joiners);
        } else {
          flush();
          walk(child.children, depth + 1, false, []);
        }
      }
      flush();
    };
    walk(blocks, 0, true, []);
    return lines;
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
    return { nodeId: clause.nodeId, tone: clause.nodeId ? toneOf(this.marks(), clause.nodeId) : null, pieces };
  }
}
