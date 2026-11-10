/**
 * A control definition as `contracts/control-definition.schema.json` defines it (schemaVersion 1). Entity,
 * field, relationship and operator keys are glossary keys: plain strings here, never named in the client.
 */
export type Scalar = number | string | boolean;
export type ListValue = number | string;
export type GroupOp = 'and' | 'or';
export type Quantifier = 'any' | 'none';

export interface FieldRef {
  /** Relationship keys from the scope entity outward; absent for a field of the scope entity. */
  readonly path?: readonly string[];
  readonly field: string;
}

export interface GroupNode {
  readonly type: 'group';
  readonly op: GroupOp;
  readonly children: readonly DefinitionNode[];
}

export interface ConditionNode {
  readonly type: 'condition';
  readonly id: string;
  readonly left: FieldRef;
  readonly operator: string;
  readonly value?: Scalar;
  readonly right?: FieldRef;
  readonly values?: readonly ListValue[];
}

export interface RelatedNode {
  readonly type: 'related';
  readonly id: string;
  readonly relationship: string;
  readonly quantifier: Quantifier;
  readonly where: GroupNode;
}

export type DefinitionNode = GroupNode | ConditionNode | RelatedNode;

export interface Definition {
  readonly schemaVersion: 1;
  readonly rootEntity: string;
  readonly where: GroupNode;
}
