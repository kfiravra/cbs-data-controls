import { contractExamples, contractGlossary } from '../../../testing/contracts';
import { SYNTHETIC_GLOSSARY } from '../../../testing/synthetic-glossary';
import { Glossary } from '../api/api.types';
import {
  chainFor,
  comparableFields,
  fieldGroups,
  findEntity,
  findOperator,
  operatorLabel,
  operatorsOf,
  relatedOptions,
  resolveField,
  rootEntities,
  valueLabel,
} from './glossary.lookups';

describe('glossary lookups over the contract glossary', () => {
  const glossary = contractGlossary();
  const byKey = (key: string) => glossary.entities.find((entity) => entity.key === key)!;

  it('offers every rootable entity as a root, in glossary order', () => {
    const expected = glossary.entities.filter((entity) => entity.rootable).map((entity) => entity.key);
    expect(rootEntities(glossary).map((entity) => entity.key)).toEqual(expected);
    expect(expected.length).toBeGreaterThan(0);
  });

  it('resolves every field reference of every example from its scope entity', () => {
    for (const example of contractExamples()) {
      const refs: { scope: string; path?: readonly string[]; field: string }[] = [];
      const walk = (node: unknown, scope: string): void => {
        const n = node as Record<string, never>;
        if (n['type'] === 'group') {
          (n['children'] as unknown[]).forEach((child) => walk(child, scope));
        } else if (n['type'] === 'related') {
          const to = glossary.relationships.find((r) => r.key === n['relationship'])!.to;
          walk(n['where'], to);
        } else {
          refs.push({ scope, ...(n['left'] as { field: string }) });
          if (n['right']) {
            refs.push({ scope, ...(n['right'] as { field: string }) });
          }
        }
      };
      walk(example.definition.where, example.definition.rootEntity);

      for (const ref of refs) {
        const resolved = resolveField(glossary, ref.scope, ref);
        expect(resolved?.field.key, `${example.id}: ${ref.field}`).toBe(ref.field);
        expect(resolved?.path.map((relationship) => relationship.key)).toEqual(ref.path ?? []);
      }
    }
  });

  it('groups the fields of a scope as its own, then one group per path of many-to-one relationships', () => {
    const scope = glossary.relationships.find((r) => r.cardinality === 'many_to_one')!.from;
    const groups = fieldGroups(glossary, scope);

    expect(groups[0].path).toEqual([]);
    expect(groups[0].fields.map((field) => field.key)).toEqual(byKey(scope).fields.map((field) => field.key));
    for (const group of groups.slice(1)) {
      expect(group.path.length).toBeGreaterThan(0);
      expect(group.path.length).toBeLessThanOrEqual(glossary.limits.maxPathHops);
      expect(group.relationships.every((r) => r.cardinality !== 'one_to_many')).toBe(true);
      expect(group.entity.key).toBe(group.relationships.at(-1)!.to);
    }
    // every example path is one of the offered groups of its scope
    const offered = groups.map((group) => group.path.join('>'));
    const used = contractExamples()
      .filter((example) => example.definition.rootEntity === scope)
      .flatMap((example) => JSON.stringify(example.definition).match(/"path":\[[^\]]*\]/g) ?? [])
      .map((match) => (JSON.parse(`{${match}}`) as { path: string[] }).path.join('>'));
    expect(used.length).toBeGreaterThan(0);
    expect(used.every((path) => offered.includes(path))).toBe(true);
  });

  it('offers one-to-many relationships of the scope as related records, and only those', () => {
    for (const entity of glossary.entities) {
      const expected = glossary.relationships
        .filter((r) => r.from === entity.key && r.cardinality === 'one_to_many')
        .map((r) => r.key);
      expect(relatedOptions(glossary, entity.key).map((r) => r.key)).toEqual(expected);
    }
  });

  it('lists the operators of a field as the glossary resolved them', () => {
    for (const entity of glossary.entities) {
      for (const field of entity.fields) {
        expect(operatorsOf(glossary, field).map((operator) => operator.key)).toEqual(field.operators);
      }
    }
  });

  it('labels an enum and a boolean value with the glossary label and leaves other values unlabelled', () => {
    const fields = glossary.entities.flatMap((entity) => entity.fields);
    const enumField = fields.find((field) => field.type === 'enum')!;
    const boolField = fields.find((field) => field.type === 'bool')!;
    const textField = fields.find((field) => field.type === 'text')!;

    expect(valueLabel(enumField, enumField.enumValues![0].value)).toEqual(enumField.enumValues![0].label);
    // found without regard to case, as the database compares a stored value
    expect(valueLabel(enumField, enumField.enumValues![0].value.toUpperCase())).toEqual(enumField.enumValues![0].label);
    expect(valueLabel(boolField, true)).toEqual(boolField.valueLabels!.true);
    expect(valueLabel(boolField, false)).toEqual(boolField.valueLabels!.false);
    expect(valueLabel(textField, 'anything')).toBeUndefined();
  });

  it('draws the chain with every rootable entity, and between two neighbours which holds many of the other', () => {
    for (const root of [...rootEntities(glossary).map((entity) => entity.key), null]) {
      const chain = chainFor(glossary, root);
      expect(chain.entities.map((entry) => entry.entity.key)).toEqual(rootEntities(glossary).map((e) => e.key));
      expect(chain.entities.filter((entry) => entry.selected).map((entry) => entry.entity.key)).toEqual(root ? [root] : []);
      expect(chain.links).toHaveLength(chain.entities.length - 1);
      chain.links.forEach((link, index) => {
        const pair = [chain.entities[index].entity.key, chain.entities[index + 1].entity.key];
        const joining = glossary.relationships.filter(
          (r) => pair.includes(r.from) && pair.includes(r.to) && r.from !== r.to && r.cardinality !== 'one_to_one',
        );
        expect(link !== null).toBe(joining.length > 0);
        if (link) {
          // the glossary says it from either side: many of `many` point at one `one`
          expect(joining.map((r) => (r.cardinality === 'many_to_one' ? [r.to, r.from] : [r.from, r.to]))).toContainEqual([
            link.one.key,
            link.many.key,
          ]);
        }
      });
    }
  });
});

describe('glossary lookups over a glossary with other entities', () => {
  const glossary: Glossary = SYNTHETIC_GLOSSARY;

  it('finds entities and operators by key and answers undefined for a key it does not have', () => {
    expect(findEntity(glossary, 'order')?.key).toBe('order');
    expect(findEntity(glossary, 'employee')).toBeUndefined();
    expect(findOperator(glossary, 'within')?.arity).toBe(2);
    expect(findOperator(glossary, 'eq')).toBeUndefined();
  });

  it('leaves an entity that is not rootable out of the roots', () => {
    expect(rootEntities(glossary).map((entity) => entity.key)).toEqual(['order', 'customer', 'line']);
  });

  it('follows many-to-one and one-to-one relationships up to the hop limit when it groups fields', () => {
    expect(fieldGroups(glossary, 'order').map((group) => group.path)).toEqual([
      [],
      ['order.customer'],
      ['order.customer', 'customer.region'],
    ]);
    expect(fieldGroups(glossary, 'line').map((group) => group.path)).toEqual([
      [],
      ['line.order'],
      ['line.order', 'order.customer'],
    ]);
    expect(fieldGroups(glossary, 'region').map((group) => group.path)).toEqual([[]]);
  });

  it('answers undefined when a reference names a field, a relationship or a path the scope does not have', () => {
    expect(resolveField(glossary, 'order', { field: 'nickname' })).toBeUndefined();
    expect(resolveField(glossary, 'order', { path: ['order.owner'], field: 'name' })).toBeUndefined();
    expect(resolveField(glossary, 'order', { path: ['customer.region'], field: 'code' })).toBeUndefined();
    expect(resolveField(glossary, 'order', { path: ['order.lines'], field: 'sku' })).toBeUndefined();
    expect(resolveField(glossary, 'nothing', { field: 'name' })).toBeUndefined();
  });

  it('picks an operator label variant in the order type.field, field, type, default', () => {
    const same = findOperator(glossary, 'same')!;
    const above = findOperator(glossary, 'above')!;

    expect(operatorLabel(same, 'date', true)).toEqual({ he: 'same day as' });
    expect(operatorLabel(above, 'date', true)).toEqual({ he: 'above the field' });
    expect(operatorLabel(same, 'date', false)).toEqual({ he: 'on' });
    expect(operatorLabel(same, 'number', false)).toEqual({ he: 'same as' });
    expect(operatorLabel(above, 'number', false)).toEqual({ he: 'above' });
  });

  it('offers for comparison the fields of the same type that are comparable, and never the field itself', () => {
    const offered = comparableFields(glossary, 'order', { field: 'total' }, 'above').flatMap((group) =>
      group.fields.map((field) => [...group.path, field.key].join('>')),
    );

    expect(offered).toEqual(['order_number', 'paid', 'order.customer>credit']);
  });

  it('offers no field comparison when the operator or the left field does not allow one', () => {
    expect(comparableFields(glossary, 'order', { field: 'total' }, 'within')).toEqual([]);
    expect(comparableFields(glossary, 'order', { field: 'score' }, 'above')).toEqual([]);
    expect(comparableFields(glossary, 'order', { field: 'nickname' }, 'above')).toEqual([]);
  });

  it('says which neighbour holds many of the other, whatever is chosen, and nothing where no relationship joins them', () => {
    const sides = (root: string | null) => chainFor(glossary, root).links.map((link) => link && [link.one.key, link.many.key]);

    // roots in glossary order: order, customer, line. A customer has many orders; customer and line are not joined
    expect(sides('order')).toEqual([['customer', 'order'], null]);
    expect(sides('customer')).toEqual(sides('order'));
    expect(sides(null)).toEqual(sides('order'));
  });
});
