import { TextPart } from '../api/api.types';
import { Block, changedNodes, plainText, splitFirstWord, toBlocks, toClauses } from './text-parts';

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

  describe('as a tree of clauses and groups', () => {
    /** A tree written out: a clause as its text, a group as an array (a scope of a related node starts with `~`). */
    type Shape = string | Shape[];
    const shape = (blocks: readonly Block[]): Shape[] =>
      blocks.map((block) =>
        block.kind === 'clause'
          ? block.clause.parts.map((part) => part.text).join('')
          : [...(block.logical ? [] : ['~']), ...shape(block.children)],
      );
    const text = (value: string, nodeId?: string): TextPart => ({ text: value, nodeId });
    const ROUND = { open: '(', close: ')' };

    it('is the run of clauses itself for a text without brackets', () => {
      expect(shape(toBlocks([text('a', 'c1'), text(' and '), text('b', 'c2')], ROUND))).toEqual(['a', ' and ', 'b']);
    });

    it('makes a group of what a pair of brackets holds, to any depth, and leaves the bracket characters out', () => {
      const parts = [text('('), text('a', 'c1'), text(' and '), text('('), text('b', 'c2'), text(' or '), text('c', 'c3'), text(')'), text(')'), text(' or '), text('('), text('d', 'c4'), text(')')];

      expect(shape(toBlocks(parts, ROUND))).toEqual([['a', ' and ', ['b', ' or ', 'c']], ' or ', ['d']]);
      expect(JSON.stringify(shape(toBlocks(parts, ROUND)))).not.toMatch(/[()]/);
    });

    it('takes a text that is one group from end to end as that group\'s content', () => {
      expect(shape(toBlocks([text('('), text('a', 'c1'), text(' and '), text('b', 'c2'), text(')')], ROUND))).toEqual(['a', ' and ', 'b']);
    });

    it('tells the scope of a related node, opened inside the node\'s own text, from a group of conditions', () => {
      const parts = [text('no ', 'r1'), text('line with (', 'r1'), text('q over 3', 'c2'), text(')', 'r1')];

      expect(shape(toBlocks(parts, ROUND))).toEqual(['no line with ', ['~', 'q over 3']]);
    });

    it('marks a node once, where its text first stands, also when a group lies between its parts', () => {
      const blocks = toBlocks([text('no ', 'r1'), text('line with (', 'r1'), text('q', 'c2'), text(') at all', 'r1')], ROUND);
      const opens = blocks.flatMap((block) => (block.kind === 'clause' ? [[block.clause.nodeId, block.clause.opensNode]] : []));

      expect(opens).toEqual([
        ['r1', true],
        ['r1', false],
      ]);
    });

    it('leaves what is data as it is: a bracket in a value, a label or a name is never a group mark', () => {
      const typed = (value: string): TextPart => ({ text: value, nodeId: 'c1', role: 'value' });
      const rule = (value: string) => [text('code is ', 'c1'), typed(value), text(' or '), { text: 'pay (gross)', nodeId: 'c2', role: 'field' as const }, text(' is missing', 'c2')];

      for (const value of ['(03)', 'x)', 'a(', '((']) {
        expect(shape(toBlocks(rule(value), ROUND))).toEqual([`code is ${value}`, ' or ', 'pay (gross) is missing']);
      }
    });

    it('reads the marks the glossary gives, and takes any other bracket as text', () => {
      const square = { open: '[', close: ']' };
      const parts = [text('['), text('a', 'c1'), text(' and '), text('b (net)', 'c2'), text(']'), text(' or '), text('['), text('c', 'c3'), text(']')];

      expect(shape(toBlocks(parts, square))).toEqual([['a', ' and ', 'b (net)'], ' or ', ['c']]);
      expect(shape(toBlocks(parts, ROUND))).toEqual(['[', 'a', ' and ', 'b ', ['~', 'net'], '] or [', 'c', ']']);
    });

    it('closes at the end of the text a bracket that never closes, and ignores one that closes nothing', () => {
      expect(shape(toBlocks([text('a', 'c1'), text(' or ('), text('b', 'c2')], ROUND))).toEqual(['a', ' or ', ['b']]);
      expect(shape(toBlocks([text('a', 'c1'), text(')'), text(' or b')], ROUND))).toEqual(['a', ' or b']);
    });
  });
});
