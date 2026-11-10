import { GroupOp } from './definition.types';
import { DraftCondition, DraftGroup, DraftNode, DraftRelated } from './draft';

/**
 * Edits of the draft tree. Each is pure and returns a new tree that shares its unchanged branches, so
 * `computed()` and `OnPush` see the change; an edit that finds no target returns the tree it was given.
 * A group is named by its key, a condition or a related node by its id.
 */

type Edit = (node: DraftNode) => DraftNode | null;

/** Applies `edit` to the node named `target`; null from `edit` removes it. A group left empty is removed. */
function editNode(node: DraftNode, target: string, edit: Edit): DraftNode | null {
  const name = node.type === 'group' ? node.key : node.id;
  if (name === target) {
    return edit(node);
  }
  if (node.type === 'condition') {
    return node;
  }
  if (node.type === 'related') {
    const where = editNode(node.where, target, edit) as DraftGroup | null;
    return where === node.where ? node : where && { ...node, where };
  }
  const children = editChildren(node.children, target, edit);
  if (children === node.children) {
    return node;
  }
  return children.length > 0 ? { ...node, children } : null;
}

function editChildren(children: readonly DraftNode[], target: string, edit: Edit): readonly DraftNode[] {
  let changed = false;
  const next: DraftNode[] = [];
  for (const child of children) {
    const edited = editNode(child, target, edit);
    changed ||= edited !== child;
    if (edited) {
      next.push(edited);
    }
  }
  return changed ? next : children;
}

function editRoot(root: DraftGroup, target: string, edit: Edit): DraftGroup | null {
  return editNode(root, target, edit) as DraftGroup | null;
}

export function findGroup(node: DraftNode, key: string): DraftGroup | undefined {
  switch (node.type) {
    case 'condition':
      return undefined;
    case 'related':
      return findGroup(node.where, key);
    case 'group':
      return node.key === key ? node : node.children.map((child) => findGroup(child, key)).find(Boolean);
  }
}

export function findCondition(node: DraftNode, id: string): DraftCondition | undefined {
  switch (node.type) {
    case 'condition':
      return node.id === id ? node : undefined;
    case 'related':
      return findCondition(node.where, id);
    case 'group':
      return node.children.map((child) => findCondition(child, id)).find(Boolean);
  }
}

/** Adds a condition, a group or a related node at the end of a group. */
export function appendChild(root: DraftGroup, groupKey: string, child: DraftNode): DraftGroup {
  const edited = editRoot(root, groupKey, (group) =>
    group.type === 'group' ? { ...group, children: [...group.children, child] } : group,
  );
  return edited ?? root;
}

/**
 * Removes a condition, a related node or a nested group. Removing the last row of a nested group removes
 * the group, and the last condition of a related node removes the node. The root group always keeps one
 * row: emptied, it is refilled with the condition `refill` makes.
 */
export function removeNode(root: DraftGroup, target: string, refill: () => DraftCondition): DraftGroup {
  if (target === root.key) {
    return root;
  }
  return editRoot(root, target, () => null) ?? { ...root, children: [refill()] };
}

export function setGroupOp(root: DraftGroup, groupKey: string, op: GroupOp): DraftGroup {
  return editRoot(root, groupKey, (group) => (group.type === 'group' ? { ...group, op } : group)) ?? root;
}

export function patchCondition(
  root: DraftGroup,
  id: string,
  patch: Partial<Omit<DraftCondition, 'type' | 'id'>>,
): DraftGroup {
  return editRoot(root, id, (node) => (node.type === 'condition' ? { ...node, ...patch } : node)) ?? root;
}

/** Replaces a condition with a new state of the same row (the rules of `condition.rules.ts` make one). */
export function replaceCondition(root: DraftGroup, condition: DraftCondition): DraftGroup {
  return editRoot(root, condition.id, (node) => (node.type === 'condition' ? condition : node)) ?? root;
}

export function patchRelated(
  root: DraftGroup,
  id: string,
  patch: Partial<Pick<DraftRelated, 'relationship' | 'quantifier'>>,
): DraftGroup {
  return editRoot(root, id, (node) => (node.type === 'related' ? { ...node, ...patch } : node)) ?? root;
}

/** Gives a related node new conditions: those it had were about another entity. */
export function replaceRelatedWhere(root: DraftGroup, id: string, where: DraftGroup): DraftGroup {
  return editRoot(root, id, (node) => (node.type === 'related' ? { ...node, where } : node)) ?? root;
}
