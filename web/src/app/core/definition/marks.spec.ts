import { contractExamples } from '../../../testing/contracts';
import { IdSource, fromDefinition } from './draft';
import { marksOf, orderedNodeIds, toneOf, tonesOf } from './marks';

const LETTERS = ['A', 'B', 'C', 'D'];

describe('marks', () => {
  it('orders the nodes of every contract example as their ids appear in its JSON text', () => {
    for (const example of contractExamples()) {
      const inDocument = [...JSON.stringify(example.definition).matchAll(/"id":"([^"]+)"/g)].map((m) => m[1]);
      expect(orderedNodeIds(example.definition.where), example.id).toEqual(inDocument);
    }
  });

  it('gives a related node its own mark, before the conditions inside it', () => {
    const example = contractExamples().find((candidate) =>
      JSON.stringify(candidate.definition).includes('"related"'),
    )!;
    const order = orderedNodeIds(example.definition.where);
    const related = JSON.stringify(example.definition).match(/"type":"related","id":"([^"]+)"/)![1];
    const inner = JSON.stringify(example.definition).split('"related"')[1].match(/"condition","id":"([^"]+)"/)![1];

    expect(order).toContain(related);
    expect(order.indexOf(related)).toBeLessThan(order.indexOf(inner));
  });

  it('gives the same marks to a draft as to the definition it was loaded from', () => {
    for (const example of contractExamples()) {
      const draft = fromDefinition(example.definition, new IdSource());
      expect([...marksOf(draft, LETTERS)]).toEqual([...marksOf(example.definition.where, LETTERS)]);
    }
  });

  it('letters the nodes in order and falls back to the number when the letters run out', () => {
    const where = {
      type: 'group' as const,
      children: ['c1', 'c2', 'c3', 'c4', 'c5'].map((id) => ({ type: 'condition' as const, id })),
    };

    expect([...marksOf(where, LETTERS).values()]).toEqual(['A', 'B', 'C', 'D', '5']);
  });

  it('gives each node the place of its colour by the order of its mark, and starts the set again when it ends', () => {
    // eleven nodes over a set of eight colours
    const ids = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11'];
    const marks = new Map(ids.map((id, index) => [id, String(index + 1)]));

    expect(ids.map((id) => toneOf(marks, id))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3]);
    expect([...tonesOf(marks)]).toEqual([['c1', 1], ['c2', 2], ['c3', 3], ['c4', 4], ['c5', 5], ['c6', 6], ['c7', 7], ['c8', 8], ['c9', 1], ['c10', 2], ['c11', 3]]);
    // a node without a mark has no colour of its own
    expect(toneOf(marks, 'c999')).toBeNull();
    expect(toneOf(new Map(), 'c1')).toBeNull();
  });
});
