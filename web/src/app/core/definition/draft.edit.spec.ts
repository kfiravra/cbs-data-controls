import { SYNTHETIC_GLOSSARY } from '../../../testing/synthetic-glossary';
import { DraftCondition, DraftGroup, DraftRelated, IdSource, emptyCondition } from './draft';
import { EditContext, applyEdit, newDraft } from './draft.edit';
import { findCondition, findGroup } from './draft.operations';

function context(ids = new IdSource(100)): EditContext {
  return { glossary: SYNTHETIC_GLOSSARY, rootEntity: 'order', ids };
}

function start(): { draft: DraftGroup; first: DraftCondition; context: EditContext } {
  const ids = new IdSource();
  const draft = newDraft(ids);
  return { draft, first: draft.children[0] as DraftCondition, context: { ...context(), ids } };
}

describe('applyEdit', () => {
  it('starts a new control with one empty condition in a group of all conditions', () => {
    const { draft } = start();

    expect(draft.op).toBe('and');
    expect(draft.children).toHaveLength(1);
    expect(draft.children[0]).toMatchObject({ type: 'condition', mode: 'value' });
  });

  it('adds a condition to the group that asked and points the focus at the new row', () => {
    const { draft, context } = start();

    const result = applyEdit(draft, { kind: 'addCondition', group: draft.key }, context);

    expect(result.draft.children).toHaveLength(2);
    expect(result.focus).toEqual({ node: (result.draft.children[1] as DraftCondition).id });
  });

  it('adds a nested group and a related node, each with one empty condition to fill', () => {
    const { draft, context } = start();

    const withGroup = applyEdit(draft, { kind: 'addGroup', group: draft.key }, context);
    const withRelated = applyEdit(withGroup.draft, { kind: 'addRelated', group: draft.key }, context);
    const [, group, related] = withRelated.draft.children as [DraftCondition, DraftGroup, DraftRelated];

    expect(group.children).toHaveLength(1);
    expect(related.where.children).toHaveLength(1);
    expect(withGroup.focus).toEqual({ node: (group.children[0] as DraftCondition).id });
    expect(withRelated.focus).toEqual({ node: related.id });
  });

  it('points the focus at the row before a removed row, or at the group when it was the first', () => {
    const { draft, first, context } = start();
    const two = applyEdit(draft, { kind: 'addCondition', group: draft.key }, context).draft;
    const second = two.children[1] as DraftCondition;

    expect(applyEdit(two, { kind: 'remove', target: second.id }, context).focus).toEqual({ node: first.id });
    expect(applyEdit(two, { kind: 'remove', target: first.id }, context).focus).toEqual({ group: draft.key });
  });

  it('points the focus at the group above when a removal takes its whole group with it', () => {
    const { draft, context } = start();
    const nested = applyEdit(draft, { kind: 'addGroup', group: draft.key }, context).draft;
    const inner = (nested.children[1] as DraftGroup).children[0] as DraftCondition;

    const result = applyEdit(nested, { kind: 'remove', target: inner.id }, context);

    expect(result.draft.children).toHaveLength(1);
    expect(result.focus).toEqual({ node: (nested.children[0] as DraftCondition).id });
  });

  it('applies the field, operator and comparison rules of a row', () => {
    const { draft, first, context } = start();
    const step = (from: DraftGroup, edit: Parameters<typeof applyEdit>[1]) => applyEdit(from, edit, context).draft;

    let next = step(draft, { kind: 'field', id: first.id, left: { field: 'total' }, scope: 'order' });
    next = step(next, { kind: 'operator', id: first.id, operator: 'above' });
    next = step(next, { kind: 'value', id: first.id, value: '100' });
    expect(findCondition(next, first.id)).toMatchObject({ left: { field: 'total' }, operator: 'above', value: '100' });

    next = step(next, { kind: 'mode', id: first.id, mode: 'field' });
    next = step(next, { kind: 'right', id: first.id, right: { field: 'paid' } });
    expect(findCondition(next, first.id)).toMatchObject({ mode: 'field', right: { field: 'paid' } });
    expect(findCondition(next, first.id)!.value).toBeUndefined();

    next = step(next, { kind: 'operator', id: first.id, operator: 'among' });
    next = step(next, { kind: 'values', id: first.id, values: ['1', '2'] });
    expect(findCondition(next, first.id)).toMatchObject({ mode: 'value', values: ['1', '2'] });
  });

  it('gives a related node new conditions when its relationship leads to another entity', () => {
    const { draft, context } = start();
    const withRelated = applyEdit(draft, { kind: 'addRelated', group: draft.key }, context).draft;
    const related = withRelated.children[1] as DraftRelated;
    const inner = related.where.children[0] as DraftCondition;
    const filled = applyEdit(
      applyEdit(withRelated, { kind: 'relationship', id: related.id, relationship: 'order.lines' }, context).draft,
      { kind: 'field', id: inner.id, left: { field: 'sku' }, scope: 'line' },
      context,
    ).draft;

    const same = applyEdit(filled, { kind: 'relationship', id: related.id, relationship: 'order.lines' }, context).draft;
    expect(findCondition(same, inner.id)?.left).toEqual({ field: 'sku' });

    const other = applyEdit(filled, { kind: 'relationship', id: related.id, relationship: 'customer.orders' }, context).draft;
    const rows = (other.children[1] as DraftRelated).where.children as DraftCondition[];
    expect(rows).toHaveLength(1);
    expect(rows[0].left).toBeUndefined();
    expect(rows[0].id).not.toBe(inner.id);
  });

  it('sets the quantity of a related node and the joining word of a group', () => {
    const { draft, context } = start();
    const withRelated = applyEdit(draft, { kind: 'addRelated', group: draft.key }, context).draft;
    const related = withRelated.children[1] as DraftRelated;

    const any = applyEdit(withRelated, { kind: 'quantifier', id: related.id, quantifier: 'any' }, context).draft;
    const or = applyEdit(any, { kind: 'op', group: related.where.key, op: 'or' }, context).draft;

    expect(or.children[1]).toMatchObject({ quantifier: 'any' });
    expect(findGroup(or, related.where.key)!.op).toBe('or');
    expect(or.op).toBe('and');
  });

  it('never reuses the id of a removed row for a new one', () => {
    const ids = new IdSource();
    const draft = newDraft(ids);
    const ctx = { ...context(), ids };
    const first = draft.children[0] as DraftCondition;

    const emptied = applyEdit(draft, { kind: 'remove', target: first.id }, ctx).draft;
    const added = applyEdit(emptied, { kind: 'addCondition', group: draft.key }, ctx).draft;

    const made = added.children.map((child) => (child as DraftCondition).id);
    expect(made).not.toContain(first.id);
    expect(new Set(made).size).toBe(2);
    expect(emptyCondition(ids).id).not.toBe(first.id);
  });
});
