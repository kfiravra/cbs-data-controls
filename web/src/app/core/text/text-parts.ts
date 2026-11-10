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
  const clauses: { nodeId?: string; parts: TextPart[]; opensNode: boolean }[] = [];
  const opened = new Set<string>();
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

/** The first word of a text and the rest: a mark is bound to the first word, so no line ends on a mark. */
export function splitFirstWord(text: string): [string, string] {
  const end = text.search(/\s/);
  return end === -1 ? [text, ''] : [text.slice(0, end), text.slice(end)];
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
