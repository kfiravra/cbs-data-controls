import { Glossary } from '../api/api.types';
import { findRelationship } from '../glossary/glossary.lookups';
import { changeField, changeMode, changeOperator } from './condition.rules';
import { NodeInput } from './draft.check';
import { FieldRef, GroupOp, ListValue, Quantifier, Scalar } from './definition.types';
import {
  DraftGroup,
  DraftNode,
  DraftRelated,
  IdSource,
  OperandMode,
  emptyCondition,
  emptyGroup,
  emptyRelated,
  nodeName,
} from './draft';
import {
  appendChild,
  findCondition,
  patchCondition,
  patchRelated,
  removeNode,
  replaceCondition,
  replaceRelatedWhere,
  setGroupOp,
} from './draft.operations';

/** Everything the condition builder can ask of the draft. A group is named by its key, a row by its id. */
export type DraftEdit =
  | { readonly kind: 'addCondition' | 'addGroup' | 'addRelated'; readonly group: string }
  | { readonly kind: 'remove'; readonly target: string }
  | { readonly kind: 'op'; readonly group: string; readonly op: GroupOp }
  | { readonly kind: 'field'; readonly id: string; readonly left: FieldRef; readonly scope: string }
  | { readonly kind: 'operator'; readonly id: string; readonly operator: string }
  | { readonly kind: 'mode'; readonly id: string; readonly mode: OperandMode }
  | { readonly kind: 'value'; readonly id: string; readonly value: Scalar | undefined }
  | { readonly kind: 'values'; readonly id: string; readonly values: readonly ListValue[] }
  | { readonly kind: 'right'; readonly id: string; readonly right: FieldRef }
  | { readonly kind: 'relationship'; readonly id: string; readonly relationship: string }
  | { readonly kind: 'quantifier'; readonly id: string; readonly quantifier: Quantifier };

export interface EditContext {
  readonly glossary: Glossary;
  readonly rootEntity: string;
  readonly ids: IdSource;
}

/** Where the keyboard focus belongs after an edit: a row (or one input of it), or the adders of a group. */
export interface FocusTarget {
  readonly node?: string;
  readonly group?: string;
  /** The input of the row to focus; the row's first control when left out. */
  readonly input?: NodeInput;
}

export interface EditResult {
  readonly draft: DraftGroup;
  readonly focus?: FocusTarget;
}

/** A new control: one group of all conditions with one empty row. */
export function newDraft(ids: IdSource): DraftGroup {
  return emptyGroup(ids);
}

/** The first row of a node: itself, or the first row inside a group. */
function firstRow(node: DraftNode): string {
  return node.type === 'group' ? firstRow(node.children[0]) : node.id;
}

/** The last row a node draws: itself, or the last row inside a group or a related node. */
function lastRow(node: DraftNode): string {
  if (node.type === 'condition') {
    return node.id;
  }
  return lastRow(node.type === 'group' ? node.children.at(-1)! : node.where);
}

/** The names of the groups and nodes from the root down to the target, the target last. */
function trail(node: DraftNode, target: string): DraftNode[] | null {
  if (nodeName(node) === target) {
    return [node];
  }
  const children = node.type === 'group' ? node.children : node.type === 'related' ? [node.where] : [];
  for (const child of children) {
    const below = trail(child, target);
    if (below) {
      return [node, ...below];
    }
  }
  return null;
}

/**
 * The row to focus once `target` is gone: the row just above it, else the row that takes its place, else
 * the adders of its group. A removal that empties its group takes the group with it, so the search starts
 * from the highest node that disappears.
 */
function focusAfterRemoval(root: DraftGroup, target: string): FocusTarget | undefined {
  const path = trail(root, target);
  if (!path || path.length < 2) {
    return undefined;
  }
  let index = path.length - 1;
  while (index > 1) {
    const parent = path[index - 1];
    const onlyChild = parent.type === 'group' ? parent.children.length === 1 : parent.type === 'related';
    if (!onlyChild) {
      break;
    }
    index -= 1;
  }
  const parent = path[index - 1];
  if (parent.type !== 'group') {
    return undefined;
  }
  const position = parent.children.indexOf(path[index]);
  if (position > 0) {
    return { node: lastRow(parent.children[position - 1]) };
  }
  const next = parent.children[1];
  return next ? { node: firstRow(next) } : { group: parent.key };
}

function changeRelationship(root: DraftGroup, related: DraftRelated | undefined, key: string, context: EditContext) {
  const before = related?.relationship ? findRelationship(context.glossary, related.relationship)?.to : undefined;
  const after = findRelationship(context.glossary, key)?.to;
  const moved = patchRelated(root, related?.id ?? '', { relationship: key });
  // conditions about another entity mean nothing here, also when the old relationship has left the
  // glossary: the node starts over with one empty row
  return related?.relationship !== undefined && before !== after
    ? replaceRelatedWhere(moved, related.id, emptyGroup(context.ids))
    : moved;
}

function findRelated(node: DraftNode, id: string): DraftRelated | undefined {
  if (node.type === 'condition') {
    return undefined;
  }
  if (node.type === 'related') {
    return node.id === id ? node : findRelated(node.where, id);
  }
  return node.children.map((child) => findRelated(child, id)).find(Boolean);
}

/** Applies one edit of the builder to the draft and says where the focus goes. Pure: the draft is not changed. */
export function applyEdit(root: DraftGroup, edit: DraftEdit, context: EditContext): EditResult {
  switch (edit.kind) {
    case 'addCondition': {
      const row = emptyCondition(context.ids);
      return { draft: appendChild(root, edit.group, row), focus: { node: row.id } };
    }
    case 'addGroup': {
      const group = emptyGroup(context.ids);
      return { draft: appendChild(root, edit.group, group), focus: { node: firstRow(group) } };
    }
    case 'addRelated': {
      const related = emptyRelated(context.ids);
      return { draft: appendChild(root, edit.group, related), focus: { node: related.id } };
    }
    case 'remove':
      return {
        draft: removeNode(root, edit.target, () => emptyCondition(context.ids)),
        focus: focusAfterRemoval(root, edit.target),
      };
    case 'op':
      return { draft: setGroupOp(root, edit.group, edit.op) };
    case 'value':
      return { draft: patchCondition(root, edit.id, { value: edit.value }) };
    case 'values':
      return { draft: patchCondition(root, edit.id, { values: edit.values }) };
    case 'right':
      return { draft: patchCondition(root, edit.id, { right: edit.right }) };
    case 'quantifier':
      return { draft: patchRelated(root, edit.id, { quantifier: edit.quantifier }) };
    case 'relationship':
      return { draft: changeRelationship(root, findRelated(root, edit.id), edit.relationship, context) };
    default:
      return { draft: editRow(root, edit, context) };
  }
}

type RowEdit = Extract<DraftEdit, { kind: 'field' | 'operator' | 'mode' }>;

function editRow(root: DraftGroup, edit: RowEdit, context: EditContext): DraftGroup {
  const row = findCondition(root, edit.id);
  if (!row) {
    return root;
  }
  switch (edit.kind) {
    case 'field':
      return replaceCondition(root, changeField(row, edit.left, context.glossary, edit.scope));
    case 'operator':
      return replaceCondition(root, changeOperator(row, edit.operator, context.glossary));
    case 'mode':
      return replaceCondition(root, changeMode(row, edit.mode));
  }
}
