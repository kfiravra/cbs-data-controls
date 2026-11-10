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

/**
 * The mark of each node. `letters` is the numbering of the interface language (from the translation file);
 * past its end a mark is the plain number, so no node is ever left without one.
 */
export function marksOf(where: MarkedNode, letters: readonly string[]): Map<string, string> {
  return new Map(orderedNodeIds(where).map((id, index) => [id, letters[index] ?? String(index + 1)]));
}
