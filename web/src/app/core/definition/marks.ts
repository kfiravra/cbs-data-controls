/**
 * Marks: the letter a condition carries wherever it is spoken of. Order is document order over every
 * condition and every related node, a related node before the conditions inside it. One function serves the
 * editor's draft, the definition of the version that ran and a suggestion's definition; a mark is derived
 * and never stored or sent.
 */
interface MarkedNode {
  readonly type: 'group' | 'condition' | 'related';
  readonly id?: string;
  readonly children?: readonly MarkedNode[];
  readonly where?: MarkedNode;
}

/** The ids of every condition and related node, in the order their marks are given. */
export function orderedNodeIds(node: MarkedNode): string[] {
  switch (node.type) {
    case 'group':
      return (node.children ?? []).flatMap(orderedNodeIds);
    case 'related':
      return [node.id ?? '', ...(node.where ? orderedNodeIds(node.where) : [])];
    case 'condition':
      return [node.id ?? ''];
  }
}

/** How many colours the fixed set of condition colours holds (`--color-tone-1` and on, in tokens.scss). */
export const TONE_COUNT = 8;

/**
 * The place of every node's colour in the set, from 1: the nodes take the colours in the order of their
 * marks, and start the set again when it ends. A node that has no mark has no place.
 */
export function tonesOf(marks: ReadonlyMap<string, string>): Map<string, number> {
  return new Map([...marks.keys()].map((id, place) => [id, (place % TONE_COUNT) + 1]));
}

/** The place of one node's colour in the set; null for a node that has no mark. */
export function toneOf(marks: ReadonlyMap<string, string>, nodeId: string): number | null {
  return tonesOf(marks).get(nodeId) ?? null;
}

/**
 * The mark of each node. `letters` is the numbering of the interface language (from the translation file);
 * past its end a mark is the plain number, so no node is ever left without one.
 */
export function marksOf(where: MarkedNode, letters: readonly string[]): Map<string, string> {
  return new Map(orderedNodeIds(where).map((id, index) => [id, letters[index] ?? String(index + 1)]));
}
