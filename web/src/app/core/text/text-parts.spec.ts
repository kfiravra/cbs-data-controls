import { TextPart } from '../api/api.types';
import { changedNodes, plainText, splitFirstWord, toClauses } from './text-parts';

// the sentence of contracts/api.md §5, as shapes: two clauses and their joining word
const SENTENCE: TextPart[] = [
  { text: 'age', nodeId: 'c1', role: 'field' },
  { text: ' under ', nodeId: 'c1' },
  { text: '18', nodeId: 'c1', role: 'value' },
  { text: ' and ' },
  { text: 'salary', nodeId: 'c2', role: 'field' },
  { text: ' over ', nodeId: 'c2' },
  { text: '15,000', nodeId: 'c2', role: 'value' },
];

describe('text parts', () => {
  it('joins the parts into the plain string exactly', () => {
    expect(plainText(SENTENCE)).toBe('age under 18 and salary over 15,000');
  });

  it('makes one clause of the consecutive parts of a node and leaves joining words between them', () => {
    const clauses = toClauses(SENTENCE);

    expect(clauses.map((clause) => [clause.nodeId, plainText(clause.parts), clause.opensNode])).toEqual([
      ['c1', 'age under 18', true],
      [undefined, ' and ', false],
      ['c2', 'salary over 15,000', true],
    ]);
  });

  it('opens a node once when its clause is split around the clauses inside it', () => {
    const related: TextPart[] = [
      { text: 'no ', nodeId: 'r1' },
      { text: 'line', nodeId: 'r1', role: 'relationship' },
      { text: ' with (', nodeId: 'r1' },
      { text: 'quantity', nodeId: 'c2', role: 'field' },
      { text: ' over 3', nodeId: 'c2' },
      { text: ')', nodeId: 'r1' },
    ];

    expect(toClauses(related).map((clause) => [clause.nodeId, clause.opensNode])).toEqual([
      ['r1', true],
      ['c2', true],
      ['r1', false],
    ]);
  });

  it('splits a text after its first word, keeping the space with the rest', () => {
    expect(splitFirstWord('salary over')).toEqual(['salary', ' over']);
    expect(splitFirstWord('salary')).toEqual(['salary', '']);
    expect(splitFirstWord('')).toEqual(['', '']);
  });

  it('names the nodes whose clause text changed between two sentences, new nodes included', () => {
    const edited = SENTENCE.map((part) => (part.text === '15,000' ? { ...part, text: '20,000' } : part));
    const added: TextPart[] = [...edited, { text: ' and ' }, { text: 'x', nodeId: 'c3' }];

    expect([...changedNodes(SENTENCE, SENTENCE)]).toEqual([]);
    expect([...changedNodes(SENTENCE, edited)]).toEqual(['c2']);
    expect([...changedNodes(SENTENCE, added)]).toEqual(['c2', 'c3']);
    expect([...changedNodes(null, SENTENCE)]).toEqual([]);
  });
});
