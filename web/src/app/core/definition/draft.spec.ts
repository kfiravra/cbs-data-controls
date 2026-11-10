import { contractExamples, contractGlossary } from '../../../testing/contracts';
import { SYNTHETIC_GLOSSARY } from '../../../testing/synthetic-glossary';
import { Definition } from './definition.types';
import {
  DraftCondition,
  DraftGroup,
  IdSource,
  emptyCondition,
  emptyGroup,
  emptyRelated,
  fromDefinition,
  highestId,
  parseNumber,
  toDefinition,
} from './draft';

const HE = { date: 'dd.MM.yyyy', groupSeparator: ',', decimalSeparator: '.' };

describe('draft of a definition', () => {
  const glossary = contractGlossary();

  it('turns every contract example into a draft and back into the same definition', () => {
    const examples = contractExamples();
    expect(examples.length).toBeGreaterThan(0);
    for (const example of examples) {
      const draft = fromDefinition(example.definition, new IdSource(highestId(example.definition.where)));
      expect(toDefinition(draft, example.definition.rootEntity, glossary, 'he'), example.id).toEqual(
        example.definition,
      );
    }
  });

  it('marks a row as a field comparison when the definition compares two fields', () => {
    const example = contractExamples().find((candidate) => JSON.stringify(candidate.definition).includes('"right"'))!;
    const draft = fromDefinition(example.definition, new IdSource());
    const rows = JSON.stringify(draft);

    expect(rows).toContain('"mode":"field"');
  });

  it('keeps a key the glossary no longer has when a stored definition is loaded and sent back', () => {
    const definition: Definition = {
      schemaVersion: 1,
      rootEntity: 'order',
      where: {
        type: 'group',
        op: 'and',
        children: [{ type: 'condition', id: 'c1', left: { field: 'gone_field' }, operator: 'same', value: 7 }],
      },
    };

    const draft = fromDefinition(definition, new IdSource(1));

    expect((draft.children[0] as DraftCondition).left).toEqual({ field: 'gone_field' });
    expect(toDefinition(draft, 'order', SYNTHETIC_GLOSSARY, 'he')).toEqual(definition);
  });

  it('sends a typed number as a number when the field is a number, and text as text', () => {
    const draft: DraftGroup = {
      type: 'group',
      key: 'g1',
      op: 'or',
      children: [
        { type: 'condition', id: 'c1', left: { field: 'total' }, operator: 'above', mode: 'value', value: '15,000.5' },
        { type: 'condition', id: 'c2', left: { field: 'reference' }, operator: 'same', mode: 'value', value: '15,000' },
        { type: 'condition', id: 'c3', left: { field: 'total' }, operator: 'within', mode: 'value', values: ['1', '20'] },
      ],
    };

    const children = toDefinition(draft, 'order', SYNTHETIC_GLOSSARY, 'he').where.children;

    expect(children[0]).toMatchObject({ value: 15000.5 });
    expect(children[1]).toMatchObject({ value: '15,000' });
    expect(children[2]).toMatchObject({ values: [1, 20] });
  });

  it('sends a list once per value when two spellings of one number were typed', () => {
    const draft: DraftGroup = {
      type: 'group',
      key: 'g1',
      op: 'and',
      children: [
        { type: 'condition', id: 'c1', left: { field: 'total' }, operator: 'among', mode: 'value', values: ['1,000', '1000', '7'] },
        { type: 'condition', id: 'c2', left: { field: 'total' }, operator: 'within', mode: 'value', values: ['5', '5'] },
      ],
    };

    const children = toDefinition(draft, 'order', SYNTHETIC_GLOSSARY, 'he').where.children;

    expect(children[0]).toMatchObject({ values: [1000, 7] });
    expect(children[1]).toMatchObject({ values: [5, 5] });
  });

  it('sends no operand for an operator that takes none, even when the row still holds one', () => {
    const draft: DraftGroup = {
      type: 'group',
      key: 'g1',
      op: 'and',
      children: [
        { type: 'condition', id: 'c1', left: { field: 'total' }, operator: 'absent', mode: 'value', value: '5' },
      ],
    };

    expect(toDefinition(draft, 'order', SYNTHETIC_GLOSSARY, 'he').where.children[0]).toEqual({
      type: 'condition',
      id: 'c1',
      left: { field: 'total' },
      operator: 'absent',
    });
  });

  it('resolves the fields inside a related node from the related entity', () => {
    const draft: DraftGroup = {
      type: 'group',
      key: 'g1',
      op: 'and',
      children: [
        {
          type: 'related',
          id: 'r1',
          relationship: 'order.lines',
          quantifier: 'any',
          where: {
            type: 'group',
            key: 'g2',
            op: 'and',
            children: [
              { type: 'condition', id: 'c1', left: { field: 'quantity' }, operator: 'above', mode: 'value', value: '3' },
            ],
          },
        },
      ],
    };

    expect(JSON.stringify(toDefinition(draft, 'order', SYNTHETIC_GLOSSARY, 'he'))).toContain('"value":3');
  });
});

describe('ids of a draft', () => {
  it('finds the highest numbered id of a definition, related sub-trees included', () => {
    const where: Definition['where'] = {
      type: 'group',
      op: 'and',
      children: [
        { type: 'condition', id: 'c3', left: { field: 'total' }, operator: 'absent' },
        { type: 'condition', id: 'by_hand', left: { field: 'total' }, operator: 'absent' },
        {
          type: 'related',
          id: 'r5',
          relationship: 'order.lines',
          quantifier: 'any',
          where: {
            type: 'group',
            op: 'and',
            children: [{ type: 'condition', id: 'c12', left: { field: 'sku' }, operator: 'absent' }],
          },
        },
      ],
    };

    expect(highestId(where)).toBe(12);
    expect(highestId({ type: 'group', op: 'and', children: [where.children[1]] })).toBe(0);
  });

  it('never gives an id twice, across conditions, related nodes and groups', () => {
    const ids = new IdSource(4);
    const made = [emptyCondition(ids).id, emptyRelated(ids).id, emptyGroup(ids).key, emptyCondition(ids).id];

    expect(made[0]).toBe('c5');
    expect(new Set(made).size).toBe(made.length);
    expect(made.every((id) => Number(id.slice(1)) > 4)).toBe(true);
  });

  it('starts a group and a related node with one empty condition', () => {
    const ids = new IdSource();

    expect(emptyGroup(ids).children).toHaveLength(1);
    expect(emptyRelated(ids).where.children).toHaveLength(1);
  });
});

describe('parseNumber', () => {
  it('reads a number with or without group separators', () => {
    expect(parseNumber('15000', HE)).toBe(15000);
    expect(parseNumber(' 15,000 ', HE)).toBe(15000);
    expect(parseNumber('15,000.50', HE)).toBe(15000.5);
    expect(parseNumber('-3', HE)).toBe(-3);
  });

  it('follows the separators of the format it is given', () => {
    expect(parseNumber('15.000,5', { date: '', groupSeparator: '.', decimalSeparator: ',' })).toBe(15000.5);
  });

  it('answers null for text that is not a number the contract accepts', () => {
    expect(parseNumber('', HE)).toBeNull();
    expect(parseNumber('abc', HE)).toBeNull();
    expect(parseNumber('12a', HE)).toBeNull();
    expect(parseNumber('1e3', HE)).toBeNull();
    expect(parseNumber('1000000000000000', HE)).toBeNull();
  });

  it('answers null when a separator does not group thousands, so a mistyped decimal is not read as a larger number', () => {
    expect(parseNumber('1,5', HE)).toBeNull();
    expect(parseNumber('15,00', HE)).toBeNull();
    expect(parseNumber(',500', HE)).toBeNull();
    expect(parseNumber('1,000,000.25', HE)).toBe(1000000.25);
  });
});
