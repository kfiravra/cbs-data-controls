import { FieldType, Glossary, GlossaryFormat, GlossaryLimits } from '../api/api.types';
import { findOperator, findRelationship, resolveField } from '../glossary/glossary.lookups';
import { ListValue, Scalar } from './definition.types';
import { DraftCondition, DraftGroup, DraftNode, parseNumber } from './draft';

/**
 * The editor's own check of a draft: what is still missing on each row, and what the limits of the glossary
 * still allow. It is a convenience (architecture §5, layer 1): the server's 422 is the authority, and a key
 * the glossary does not have is left to it.
 */
export type IssueKind =
  | 'missingField'
  | 'missingOperator'
  | 'missingValue'
  | 'invalidNumber'
  | 'rangeOrder'
  | 'missingRelationship'
  | 'tooManyValues';

/** The input of a row an issue or a server error belongs to: the member the editor edits as one input. */
export type NodeInput = 'left' | 'operator' | 'value' | 'values' | 'right' | 'relationship';

export interface DraftIssue {
  readonly kind: IssueKind;
  readonly input: NodeInput;
  /** The item of a range the issue is about (0 the low end, 1 the high end). */
  readonly index?: number;
}

export interface DraftCheck {
  /** True when nothing is missing: the draft can become a definition and be sent. */
  readonly complete: boolean;
  /** By node id; a node with no issue has no entry. */
  readonly issues: ReadonlyMap<string, readonly DraftIssue[]>;
  /** Conditions and related nodes together, as the contract counts them. */
  readonly conditionCount: number;
  /** Literal values over the whole definition. */
  readonly valueCount: number;
  readonly tooManyValuesInAll: boolean;
  /** By group key: the number of groups from the root down to this one, itself included. */
  readonly groupDepth: ReadonlyMap<string, number>;
  readonly limits: GlossaryLimits;
}

interface Tally {
  readonly glossary: Glossary;
  readonly format: GlossaryFormat | undefined;
  readonly issues: Map<string, DraftIssue[]>;
  readonly groupDepth: Map<string, number>;
  conditionCount: number;
  valueCount: number;
}

function isBlank(value: Scalar | undefined): boolean {
  return value === undefined || (typeof value === 'string' && value.trim() === '');
}

function isBadNumber(value: Scalar, type: FieldType | undefined, format: GlossaryFormat | undefined): boolean {
  return type === 'number' && typeof value === 'string' && parseNumber(value, format) === null;
}

function comparable(value: ListValue, type: FieldType | undefined, format: GlossaryFormat | undefined) {
  return type === 'number' && typeof value === 'string' ? (parseNumber(value, format) ?? 0) : value;
}

function valueIssues(value: Scalar | undefined, type: FieldType | undefined, tally: Tally): DraftIssue[] {
  if (isBlank(value)) {
    return [{ kind: 'missingValue', input: 'value' }];
  }
  return isBadNumber(value!, type, tally.format) ? [{ kind: 'invalidNumber', input: 'value' }] : [];
}

function rangeIssues(values: readonly ListValue[], type: FieldType | undefined, tally: Tally): DraftIssue[] {
  const issues: DraftIssue[] = [];
  for (const index of [0, 1]) {
    if (isBlank(values[index])) {
      issues.push({ kind: 'missingValue', input: 'values', index });
    } else if (isBadNumber(values[index], type, tally.format)) {
      issues.push({ kind: 'invalidNumber', input: 'values', index });
    }
  }
  if (issues.length === 0) {
    const [low, high] = values.map((value) => comparable(value, type, tally.format));
    if (low > high) {
      issues.push({ kind: 'rangeOrder', input: 'values' });
    }
  }
  return issues;
}

function listIssues(values: readonly ListValue[], type: FieldType | undefined, tally: Tally): DraftIssue[] {
  if (values.length === 0) {
    return [{ kind: 'missingValue', input: 'values' }];
  }
  if (values.length > tally.glossary.limits.maxListValues) {
    return [{ kind: 'tooManyValues', input: 'values' }];
  }
  return values.some((value) => isBadNumber(value, type, tally.format))
    ? [{ kind: 'invalidNumber', input: 'values' }]
    : [];
}

function conditionIssues(node: DraftCondition, scope: string | undefined, tally: Tally): DraftIssue[] {
  if (!node.left) {
    return [{ kind: 'missingField', input: 'left' }];
  }
  if (!node.operator) {
    return [{ kind: 'missingOperator', input: 'operator' }];
  }
  const arity = findOperator(tally.glossary, node.operator)?.arity;
  const type = scope ? resolveField(tally.glossary, scope, node.left)?.field.type : undefined;
  if (arity === undefined || arity === 0) {
    return [];
  }
  if (arity === 1 && node.mode === 'field') {
    return node.right ? [] : [{ kind: 'missingValue', input: 'right' }];
  }
  if (arity === 1) {
    tally.valueCount += 1;
    return valueIssues(node.value, type, tally);
  }
  const values = node.values ?? [];
  tally.valueCount += values.length;
  return arity === 2 ? rangeIssues(values, type, tally) : listIssues(values, type, tally);
}

function visit(node: DraftNode, scope: string | undefined, depth: number, tally: Tally): void {
  if (node.type === 'group') {
    tally.groupDepth.set(node.key, depth);
    node.children.forEach((child) => visit(child, scope, child.type === 'group' ? depth + 1 : depth, tally));
    return;
  }
  tally.conditionCount += 1;
  if (node.type === 'related') {
    if (!node.relationship) {
      tally.issues.set(node.id, [{ kind: 'missingRelationship', input: 'relationship' }]);
    }
    const related = node.relationship ? findRelationship(tally.glossary, node.relationship)?.to : undefined;
    visit(node.where, related, depth + 1, tally);
    return;
  }
  const issues = conditionIssues(node, scope, tally);
  if (issues.length > 0) {
    tally.issues.set(node.id, issues);
  }
}

export function checkDraft(root: DraftGroup, rootEntity: string, glossary: Glossary, lang: string): DraftCheck {
  const tally: Tally = {
    glossary,
    format: glossary.formats[lang],
    issues: new Map(),
    groupDepth: new Map(),
    conditionCount: 0,
    valueCount: 0,
  };
  visit(root, rootEntity, 1, tally);
  const tooManyValuesInAll = tally.valueCount > glossary.limits.maxTotalValues;
  return {
    complete: tally.issues.size === 0 && !tooManyValuesInAll,
    issues: tally.issues,
    conditionCount: tally.conditionCount,
    valueCount: tally.valueCount,
    tooManyValuesInAll,
    groupDepth: tally.groupDepth,
    limits: glossary.limits,
  };
}

/** Whether one more condition (or related node) fits under `limits.maxConditions`. */
export function canAddCondition(check: DraftCheck): boolean {
  return check.conditionCount < check.limits.maxConditions;
}

/**
 * Whether a group, or a related node (whose own group counts), may be added inside the group `groupKey`:
 * it brings one more level and at least one more condition.
 */
export function canAddNested(check: DraftCheck, groupKey: string): boolean {
  const depth = check.groupDepth.get(groupKey) ?? check.limits.maxDepth;
  return canAddCondition(check) && depth + 1 <= check.limits.maxDepth;
}
