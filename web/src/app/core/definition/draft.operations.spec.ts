import { DraftCondition, DraftGroup, DraftRelated, IdSource, emptyCondition, emptyGroup, emptyRelated } from './draft';
import {
  appendChild,
  findCondition,
  findGroup,
  patchCondition,
  patchRelated,
  removeNode,
  replaceRelatedWhere,
  setGroupOp,
} from './draft.operations';

function tree(): { root: DraftGroup; ids: IdSource } {
  const ids = new IdSource();
  const inner: DraftGroup = { type: 'group', key: 'inner', op: 'or', children: [emptyCondition(ids), emptyCondition(ids)] };
  const related: DraftRelated = { ...emptyRelated(ids), id: 'rel' };
  const root: DraftGroup = { type: 'group', key: 'root', op: 'and', children: [emptyCondition(ids), inner, related] };
  return { root, ids };
}

const ids = (group: DraftGroup): string[] =>
  group.children.map((child) => (child.type === 'group' ? `[${ids(child).join(',')}]` : child.id));

describe('draft operations', () => {
  it('adds a condition at the end of the group it is added to and leaves the other branches as they were', () => {
    const { root, ids: source } = tree();
    const added = emptyCondition(source);

    const next = appendChild(root, 'inner', added);

    expect(ids(findGroup(next, 'inner')!)).toEqual([...ids(findGroup(root, 'inner')!), added.id]);
    expect(next).not.toBe(root);
    expect(next.children[0]).toBe(root.children[0]);
    expect(next.children[2]).toBe(root.children[2]);
    expect(ids(root)).toHaveLength(3);
  });

  it('adds a group and a related node as children of the group that asked', () => {
    const { root, ids: source } = tree();

    const next = appendChild(appendChild(root, 'root', emptyGroup(source)), 'root', emptyRelated(source));

    expect(next.children.map((child) => child.type)).toEqual(['condition', 'group', 'related', 'group', 'related']);
  });

  it('removes a condition by its id and keeps its siblings', () => {
    const { root, ids: source } = tree();
    const [first, second] = findGroup(root, 'inner')!.children as DraftCondition[];

    const next = removeNode(root, first.id, () => emptyCondition(source));

    expect(ids(findGroup(next, 'inner')!)).toEqual([second.id]);
  });

  it('removes a nested group when its last row is removed', () => {
    const { root, ids: source } = tree();
    const [first, second] = findGroup(root, 'inner')!.children as DraftCondition[];
    const refill = () => emptyCondition(source);

    const next = removeNode(removeNode(root, first.id, refill), second.id, refill);

    expect(findGroup(next, 'inner')).toBeUndefined();
    expect(next.children.map((child) => child.type)).toEqual(['condition', 'related']);
  });

  it('removes a related node when the last of its own conditions is removed', () => {
    const { root, ids: source } = tree();
    const related = root.children[2] as DraftRelated;
    const only = related.where.children[0] as DraftCondition;

    const next = removeNode(root, only.id, () => emptyCondition(source));

    expect(next.children.map((child) => child.type)).toEqual(['condition', 'group']);
  });

  it('removes a whole group by its key and a related node by its id', () => {
    const { root, ids: source } = tree();
    const refill = () => emptyCondition(source);

    expect(removeNode(root, 'inner', refill).children.map((child) => child.type)).toEqual(['condition', 'related']);
    expect(removeNode(root, 'rel', refill).children.map((child) => child.type)).toEqual(['condition', 'group']);
  });

  it('keeps one empty row in the root group when its last row is removed', () => {
    const source = new IdSource();
    const only = emptyCondition(source);
    const root: DraftGroup = { type: 'group', key: 'root', op: 'and', children: [only] };

    const next = removeNode(root, only.id, () => emptyCondition(source));

    expect(next.children).toHaveLength(1);
    expect((next.children[0] as DraftCondition).id).not.toBe(only.id);
    expect((next.children[0] as DraftCondition).left).toBeUndefined();
  });

  it('returns the same tree when the target is not in it', () => {
    const { root, ids: source } = tree();

    expect(removeNode(root, 'nothing', () => emptyCondition(source))).toBe(root);
    expect(patchCondition(root, 'nothing', { operator: 'x' })).toBe(root);
    expect(setGroupOp(root, 'nothing', 'or')).toBe(root);
  });

  it('sets the joining word of one group only', () => {
    const { root } = tree();

    const next = setGroupOp(root, 'inner', 'and');

    expect(findGroup(next, 'inner')!.op).toBe('and');
    expect(next.op).toBe('and');
    expect(findGroup(setGroupOp(root, 'root', 'or'), 'inner')!.op).toBe('or');
  });

  it('patches a condition wherever it sits, also inside a related node', () => {
    const { root } = tree();
    const inside = (root.children[2] as DraftRelated).where.children[0] as DraftCondition;

    const next = patchCondition(root, inside.id, { left: { field: 'f' }, operator: 'op' });

    expect(findCondition(next, inside.id)).toMatchObject({ left: { field: 'f' }, operator: 'op' });
    expect(next.children[1]).toBe(root.children[1]);
  });

  it('patches the quantity and the relationship of a related node', () => {
    const { root } = tree();

    const next = patchRelated(root, 'rel', { quantifier: 'any', relationship: 'a.b' });

    expect(next.children[2]).toMatchObject({ quantifier: 'any', relationship: 'a.b' });
  });

  it('replaces the conditions of a related node when its relationship changes entity', () => {
    const { root, ids: source } = tree();
    const fresh = emptyGroup(source);

    const next = replaceRelatedWhere(root, 'rel', fresh);

    expect((next.children[2] as DraftRelated).where).toBe(fresh);
  });
});
