import { contractExamples, contractGlossary } from '../../../testing/contracts';
import { SYNTHETIC_GLOSSARY } from '../../../testing/synthetic-glossary';
import { DraftCondition, DraftGroup, DraftNode, IdSource, fromDefinition } from './draft';
import { canAddCondition, canAddNested, checkDraft } from './draft.check';

const glossary = SYNTHETIC_GLOSSARY;

function rootOf(...children: DraftNode[]): DraftGroup {
  return { type: 'group', key: 'root', op: 'and', children };
}

function row(id: string, rest: Partial<DraftCondition> = {}): DraftCondition {
  return { type: 'condition', id, mode: 'value', ...rest };
}

const issuesOf = (root: DraftGroup, id: string) => checkDraft(root, 'order', glossary, 'he').issues.get(id) ?? [];

describe('checkDraft', () => {
  it('finds every contract example complete, with no issue on any row', () => {
    const contract = contractGlossary();
    for (const example of contractExamples()) {
      const draft = fromDefinition(example.definition, new IdSource());
      const check = checkDraft(draft, example.definition.rootEntity, contract, 'he');
      expect(check.complete, example.id).toBe(true);
      expect(check.issues.size, example.id).toBe(0);
    }
  });

  it('asks for a field first, then an operator, then a value', () => {
    expect(issuesOf(rootOf(row('c1')), 'c1')).toEqual([{ kind: 'missingField', input: 'left' }]);
    expect(issuesOf(rootOf(row('c1', { left: { field: 'total' } })), 'c1')).toEqual([
      { kind: 'missingOperator', input: 'operator' },
    ]);
    expect(issuesOf(rootOf(row('c1', { left: { field: 'total' }, operator: 'above' })), 'c1')).toEqual([
      { kind: 'missingValue', input: 'value' },
    ]);
    expect(issuesOf(rootOf(row('c1', { left: { field: 'reference' }, operator: 'same', value: '  ' })), 'c1')).toEqual([
      { kind: 'missingValue', input: 'value' },
    ]);
  });

  it('asks for nothing more when the operator takes no value', () => {
    const check = checkDraft(rootOf(row('c1', { left: { field: 'total' }, operator: 'absent' })), 'order', glossary, 'he');

    expect(check.complete).toBe(true);
  });

  it('rejects text that is not a number in a number field and accepts a number typed with separators', () => {
    const typed = (value: string) => rootOf(row('c1', { left: { field: 'total' }, operator: 'above', value }));

    expect(issuesOf(typed('12a'), 'c1')).toEqual([{ kind: 'invalidNumber', input: 'value' }]);
    expect(issuesOf(typed('15,000'), 'c1')).toEqual([]);
  });

  it('asks for the other field when the row compares two fields', () => {
    const comparing = row('c1', { left: { field: 'total' }, operator: 'above', mode: 'field' });

    expect(issuesOf(rootOf(comparing), 'c1')).toEqual([{ kind: 'missingValue', input: 'right' }]);
    expect(issuesOf(rootOf({ ...comparing, right: { field: 'paid' } }), 'c1')).toEqual([]);
  });

  it('asks for both ends of a range, each by its place, and for the low end first', () => {
    const range = (values: string[]) => rootOf(row('c1', { left: { field: 'total' }, operator: 'within', values }));

    expect(issuesOf(range(['', '']), 'c1')).toEqual([
      { kind: 'missingValue', input: 'values', index: 0 },
      { kind: 'missingValue', input: 'values', index: 1 },
    ]);
    expect(issuesOf(range(['5', 'x']), 'c1')).toEqual([{ kind: 'invalidNumber', input: 'values', index: 1 }]);
    expect(issuesOf(range(['20', '5']), 'c1')).toEqual([{ kind: 'rangeOrder', input: 'values' }]);
    expect(issuesOf(range(['5', '5']), 'c1')).toEqual([]);
  });

  it('compares the ends of a date range as dates', () => {
    const range = (values: string[]) => rootOf(row('c1', { left: { field: 'placed_on' }, operator: 'within', values }));

    expect(issuesOf(range(['2026-02-01', '2026-01-31']), 'c1')).toEqual([{ kind: 'rangeOrder', input: 'values' }]);
    expect(issuesOf(range(['2026-01-31', '2026-02-01']), 'c1')).toEqual([]);
  });

  it('asks for at least one value in a list and stops a list longer than the limit', () => {
    const list = (values: string[]) => rootOf(row('c1', { left: { field: 'reference' }, operator: 'among', values }));

    expect(issuesOf(list([]), 'c1')).toEqual([{ kind: 'missingValue', input: 'values' }]);
    expect(issuesOf(list(['a', 'b', 'c']), 'c1')).toEqual([]);
    expect(issuesOf(list(['a', 'b', 'c', 'd']), 'c1')).toEqual([{ kind: 'tooManyValues', input: 'values' }]);
  });

  it('asks a related node for its relationship and checks its conditions against the related entity', () => {
    const inner = row('c1', { left: { field: 'quantity' }, operator: 'above', value: 'many' });
    const related = (relationship?: string): DraftGroup =>
      rootOf({
        type: 'related',
        id: 'r1',
        relationship,
        quantifier: 'any',
        where: { type: 'group', key: 'g2', op: 'and', children: [inner] },
      });

    expect(issuesOf(related(), 'r1')).toEqual([{ kind: 'missingRelationship', input: 'relationship' }]);
    expect(issuesOf(related('order.lines'), 'r1')).toEqual([]);
    expect(issuesOf(related('order.lines'), 'c1')).toEqual([{ kind: 'invalidNumber', input: 'value' }]);
  });

  it('leaves a field the glossary no longer has to the server, with no client issue', () => {
    const gone = row('c1', { left: { field: 'gone_field' }, operator: 'above', value: 7 });

    expect(checkDraft(rootOf(gone), 'order', glossary, 'he').complete).toBe(true);
  });

  it('counts conditions and related nodes together, and stops adding at the limit', () => {
    const full = rootOf(
      row('c1'),
      row('c2'),
      row('c3'),
      {
        type: 'related',
        id: 'r1',
        quantifier: 'any',
        where: { type: 'group', key: 'g2', op: 'and', children: [row('c4')] },
      },
    );

    const check = checkDraft(full, 'order', glossary, 'he');

    expect(check.conditionCount).toBe(glossary.limits.maxConditions);
    expect(canAddCondition(check)).toBe(false);
    expect(canAddCondition(checkDraft(rootOf(row('c1')), 'order', glossary, 'he'))).toBe(true);
  });

  it('counts depth in groups, the root and the group of a related node included, and stops nesting at the limit', () => {
    const deep = rootOf({
      type: 'group',
      key: 'g2',
      op: 'or',
      children: [
        {
          type: 'related',
          id: 'r1',
          quantifier: 'any',
          where: { type: 'group', key: 'g3', op: 'and', children: [row('c1')] },
        },
      ],
    });

    const check = checkDraft(deep, 'order', glossary, 'he');

    expect([check.groupDepth.get('root'), check.groupDepth.get('g2'), check.groupDepth.get('g3')]).toEqual([1, 2, 3]);
    expect(canAddNested(check, 'root')).toBe(true);
    expect(canAddNested(check, 'g2')).toBe(true);
    expect(canAddNested(check, 'g3')).toBe(false);
  });

  it('finds the draft incomplete when all its values together pass the limit of the definition', () => {
    const list = (id: string) => row(id, { left: { field: 'reference' }, operator: 'among', values: ['a', 'b', 'c'] });
    const within = checkDraft(rootOf(list('c1'), list('c2')), 'order', glossary, 'he');
    const over = checkDraft(
      rootOf(list('c1'), list('c2'), row('c3', { left: { field: 'total' }, operator: 'above', value: '1' })),
      'order',
      glossary,
      'he',
    );

    expect(within.valueCount).toBe(6);
    expect(within.complete).toBe(true);
    expect(over.valueCount).toBe(7);
    expect(over.tooManyValuesInAll).toBe(true);
    expect(over.complete).toBe(false);
  });
});
