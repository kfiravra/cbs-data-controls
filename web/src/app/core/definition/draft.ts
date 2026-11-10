import { Glossary, GlossaryFormat } from '../api/api.types';
import { findOperator, findRelationship, resolveField } from '../glossary/glossary.lookups';
import {
  ConditionNode,
  Definition,
  DefinitionNode,
  FieldRef,
  GroupNode,
  GroupOp,
  ListValue,
  Quantifier,
  RelatedNode,
  Scalar,
} from './definition.types';

/**
 * The editor's model of a definition. Unlike the contract type a row may be unfinished: no field yet, no
 * operator, no value. A number field holds the text as typed until the draft becomes a definition. The tree
 * is immutable: an edit returns a new tree that shares its unchanged branches.
 */
export type OperandMode = 'value' | 'field';

export interface DraftCondition {
  readonly type: 'condition';
  readonly id: string;
  readonly left?: FieldRef;
  readonly operator?: string;
  /** Whether the operand is a literal or another field (the comparison toggle). */
  readonly mode: OperandMode;
  readonly value?: Scalar;
  readonly values?: readonly ListValue[];
  readonly right?: FieldRef;
}

export interface DraftRelated {
  readonly type: 'related';
  readonly id: string;
  readonly relationship?: string;
  readonly quantifier: Quantifier;
  readonly where: DraftGroup;
}

export interface DraftGroup {
  readonly type: 'group';
  /** A key of the interface only (for `track`); never sent. */
  readonly key: string;
  readonly op: GroupOp;
  readonly children: readonly DraftNode[];
}

export type DraftNode = DraftGroup | DraftCondition | DraftRelated;

const NUMBERED_ID = /^[crg](\d+)$/;

/**
 * Gives node ids (`c<n>`, `r<n>`) and group keys (`g<n>`) from one counter. Seeded above the highest id of a
 * loaded definition, so an id is created once with its node and never reused in a session.
 */
export class IdSource {
  private last: number;

  constructor(seed = 0) {
    this.last = seed;
  }

  next(prefix: 'c' | 'r' | 'g'): string {
    this.last += 1;
    return `${prefix}${this.last}`;
  }
}

/** The highest number among the ids of a definition that have the form the editor gives. */
export function highestId(node: DefinitionNode): number {
  if (node.type === 'group') {
    return Math.max(0, ...node.children.map(highestId));
  }
  const own = Number(NUMBERED_ID.exec(node.id)?.[1] ?? 0);
  return node.type === 'related' ? Math.max(own, highestId(node.where)) : own;
}

export function emptyCondition(ids: IdSource): DraftCondition {
  return { type: 'condition', id: ids.next('c'), mode: 'value' };
}

export function emptyGroup(ids: IdSource): DraftGroup {
  return { type: 'group', key: ids.next('g'), op: 'and', children: [emptyCondition(ids)] };
}

export function emptyRelated(ids: IdSource): DraftRelated {
  return { type: 'related', id: ids.next('r'), quantifier: 'none', where: emptyGroup(ids) };
}

function draftNode(node: DefinitionNode, ids: IdSource): DraftNode {
  switch (node.type) {
    case 'group':
      return draftGroup(node, ids);
    case 'related':
      return { ...node, where: draftGroup(node.where, ids) };
    case 'condition':
      return { ...node, mode: node.right ? 'field' : 'value' };
  }
}

function draftGroup(group: GroupNode, ids: IdSource): DraftGroup {
  return {
    type: 'group',
    key: ids.next('g'),
    op: group.op,
    children: group.children.map((child) => draftNode(child, ids)),
  };
}

/**
 * The draft of a stored definition. Keys the glossary no longer has are kept as they are, so the row can say
 * that its field is gone.
 */
export function fromDefinition(definition: Definition, ids: IdSource): DraftGroup {
  return draftGroup(definition.where, ids);
}

/**
 * A number as the user types it in the interface language: group separators are allowed and dropped. Null
 * when the text is not a number the contract accepts (finite, below 10^15 in absolute value).
 */
export function parseNumber(text: string, format: GlossaryFormat | undefined): number | null {
  const group = escaped(format?.groupSeparator ?? ',');
  const decimal = escaped(format?.decimalSeparator ?? '.');
  const shape = new RegExp(`^(-?)(\\d+|\\d{1,3}(?:${group}\\d{3})+)(?:${decimal}(\\d+))?$`);
  const match = shape.exec(text.trim());
  if (!match) {
    return null;
  }
  const whole = match[2].replace(new RegExp(group, 'g'), '');
  const parsed = Number(`${match[1]}${whole}${match[3] ? `.${match[3]}` : ''}`);
  return Math.abs(parsed) < 1e15 ? parsed : null;
}

function escaped(separator: string): string {
  return separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface Scope {
  readonly glossary: Glossary;
  readonly entity: string | undefined;
  readonly format: GlossaryFormat | undefined;
}

function literal<T extends Scalar>(value: T, isNumber: boolean, format: GlossaryFormat | undefined): T | number {
  return isNumber && typeof value === 'string' ? (parseNumber(value, format) ?? value) : value;
}

function fieldRef(ref: FieldRef): FieldRef {
  return ref.path && ref.path.length > 0 ? { path: ref.path, field: ref.field } : { field: ref.field };
}

function definitionCondition(node: DraftCondition, scope: Scope): ConditionNode {
  const left = fieldRef(node.left!);
  const base = { type: 'condition' as const, id: node.id, left, operator: node.operator! };
  const arity = findOperator(scope.glossary, base.operator)?.arity;
  const field = scope.entity ? resolveField(scope.glossary, scope.entity, left)?.field : undefined;
  const isNumber = field?.type === 'number';
  if (arity === 0) {
    return base;
  }
  if (node.mode === 'field' && node.right) {
    return { ...base, right: fieldRef(node.right) };
  }
  if (node.values !== undefined && arity !== 1) {
    const values = node.values.map((value) => literal(value, isNumber, scope.format));
    // the schema wants a list without repeats, and two spellings of one number are one value
    return { ...base, values: arity === 'list' ? [...new Set(values)] : values };
  }
  return node.value === undefined ? base : { ...base, value: literal(node.value, isNumber, scope.format) };
}

function definitionNode(node: DraftNode, scope: Scope): DefinitionNode {
  switch (node.type) {
    case 'group':
      return definitionGroup(node, scope);
    case 'condition':
      return definitionCondition(node, scope);
    case 'related': {
      const related: RelatedNode = {
        type: 'related',
        id: node.id,
        relationship: node.relationship!,
        quantifier: node.quantifier,
        where: definitionGroup(node.where, {
          ...scope,
          entity: findRelationship(scope.glossary, node.relationship!)?.to,
        }),
      };
      return related;
    }
  }
}

function definitionGroup(group: DraftGroup, scope: Scope): GroupNode {
  return { type: 'group', op: group.op, children: group.children.map((child) => definitionNode(child, scope)) };
}

/**
 * The definition a complete draft stands for (see `checkDraft`): group keys dropped, typed numbers turned
 * into numbers by the type of their field, the operand kept by the arity of the operator.
 */
export function toDefinition(draft: DraftGroup, rootEntity: string, glossary: Glossary, lang: string): Definition {
  const scope: Scope = { glossary, entity: rootEntity, format: glossary.formats[lang] };
  return { schemaVersion: 1, rootEntity, where: definitionGroup(draft, scope) };
}
