import { TextPart } from '../api/api.types';

/**
 * Rendered text arrives from the engine as parts (contracts/errors.md, Rendering). The client only draws:
 * these helpers group parts for drawing and compare them. No template, variant or value format is applied.
 */

/** The consecutive parts of one node, or a run of joining words and brackets that belongs to none. */
export interface Clause {
  readonly nodeId?: string;
  readonly parts: readonly TextPart[];
  /** True on the first clause of its node in this text: where the node's mark stands. */
  readonly opensNode: boolean;
}

export function plainText(parts: readonly TextPart[]): string {
  return parts.map((part) => part.text).join('');
}

export function toClauses(parts: readonly TextPart[]): Clause[] {
  return clausesOf(parts, new Set());
}

function clausesOf(parts: readonly TextPart[], opened: Set<string>): Clause[] {
  const clauses: { nodeId?: string; parts: TextPart[]; opensNode: boolean }[] = [];
  for (const part of parts) {
    const last = clauses.at(-1);
    if (last && last.nodeId === part.nodeId) {
      last.parts.push(part);
      continue;
    }
    const opensNode = part.nodeId !== undefined && !opened.has(part.nodeId);
    if (part.nodeId !== undefined) {
      opened.add(part.nodeId);
    }
    clauses.push({ nodeId: part.nodeId, parts: [part], opensNode });
  }
  return clauses;
}

/** A run of parts the engine wrote in brackets, without the brackets. */
export interface Group {
  readonly kind: 'group';
  /** True for a group of conditions; false for the scope of a related-records node, which opens inside the node's own text. */
  readonly logical: boolean;
  readonly children: readonly Block[];
}

export interface ClauseBlock {
  readonly kind: 'clause';
  readonly clause: Clause;
}

/** What a rendered text is drawn from: clauses, and the groups the engine's brackets mark. */
export type Block = Group | ClauseBlock;

interface Frame {
  readonly logical: boolean;
  readonly items: (TextPart | Frame)[];
}

const isFrame = (item: TextPart | Frame): item is Frame => 'items' in item;
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The two marks the engine opens and closes a group with: the glossary's `groupOpen` and `groupClose`. */
export interface Brackets {
  readonly open: string;
  readonly close: string;
}

/**
 * The parts of a text as a tree: every pair of group marks the engine wrote becomes a group, and the marks
 * themselves are left out, so a group can be drawn as a block. Only the engine's own connecting text is
 * read for them (a part with no role): a value the user typed, a field's label or the name of a
 * relationship is data and is never taken apart, whatever characters it holds. Nothing else of the text is
 * touched: the words, their order and the nodes they belong to are the engine's. A text that is one group
 * from end to end is that group's content. A group that never closes closes at the end of the text.
 */
export function toBlocks(parts: readonly TextPart[], brackets: Brackets): Block[] {
  const root: Frame = { logical: true, items: [] };
  const open: Frame[] = [root];
  const marks = new RegExp(`(${escaped(brackets.open)}|${escaped(brackets.close)})`);
  for (const part of parts) {
    if (part.role !== undefined) {
      open.at(-1)!.items.push(part);
      continue;
    }
    for (const piece of part.text.split(marks)) {
      if (piece === brackets.open) {
        const frame: Frame = { logical: part.nodeId === undefined, items: [] };
        open.at(-1)!.items.push(frame);
        open.push(frame);
      } else if (piece === brackets.close) {
        if (open.length > 1) {
          open.pop();
        }
      } else if (piece !== '') {
        open.at(-1)!.items.push({ ...part, text: piece });
      }
    }
  }
  let top = root;
  while (top.items.length === 1 && isFrame(top.items[0]) && top.items[0].logical) {
    top = top.items[0];
  }
  return blocksOf(top, new Set());
}

/** A frame's items as blocks, in the order of the text: `opened` remembers the nodes that already have their mark. */
function blocksOf(frame: Frame, opened: Set<string>): Block[] {
  const blocks: Block[] = [];
  let run: TextPart[] = [];
  const flush = () => {
    for (const clause of clausesOf(run, opened)) {
      blocks.push({ kind: 'clause', clause });
    }
    run = [];
  };
  for (const item of frame.items) {
    if (isFrame(item)) {
      flush();
      blocks.push({ kind: 'group', logical: item.logical, children: blocksOf(item, opened) });
    } else {
      run.push(item);
    }
  }
  flush();
  return blocks;
}

function textByNode(parts: readonly TextPart[]): Map<string, string> {
  const texts = new Map<string, string>();
  for (const part of parts) {
    if (part.nodeId !== undefined) {
      texts.set(part.nodeId, (texts.get(part.nodeId) ?? '') + part.text);
    }
  }
  return texts;
}

/**
 * The nodes whose clause reads differently in `next` than in `previous`: the ones the settle points at.
 * Nothing settles on the first sentence.
 */
export function changedNodes(previous: readonly TextPart[] | null, next: readonly TextPart[]): Set<string> {
  if (!previous) {
    return new Set();
  }
  const before = textByNode(previous);
  return new Set([...textByNode(next)].filter(([id, text]) => before.get(id) !== text).map(([id]) => id));
}
