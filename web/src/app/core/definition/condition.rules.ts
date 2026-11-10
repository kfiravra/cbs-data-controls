import { Glossary } from '../api/api.types';
import { comparableFields, findOperator, resolveField } from '../glossary/glossary.lookups';
import { FieldRef } from './definition.types';
import { DraftCondition, OperandMode } from './draft';

/**
 * What an edit of one input does to the rest of its row (plan, Design G): the operator is kept when the
 * new field allows it, and the operand is cleared when it no longer fits the field or the operator.
 */

function withoutOperand(condition: DraftCondition): DraftCondition {
  const { value: _value, values: _values, right: _right, ...rest } = condition;
  return { ...rest, mode: 'value' };
}

function offers(glossary: Glossary, scopeKey: string, left: FieldRef, operator: string, right: FieldRef): boolean {
  return comparableFields(glossary, scopeKey, left, operator).some(
    (group) =>
      group.path.join('\n') === (right.path ?? []).join('\n') &&
      group.fields.some((field) => field.key === right.field),
  );
}

export function changeField(
  condition: DraftCondition,
  left: FieldRef,
  glossary: Glossary,
  scopeKey: string,
): DraftCondition {
  const next = resolveField(glossary, scopeKey, left)?.field;
  const previous = condition.left ? resolveField(glossary, scopeKey, condition.left)?.field : undefined;
  const operator = condition.operator && next?.operators.includes(condition.operator) ? condition.operator : undefined;
  const sameValues = previous !== undefined && previous.type === next?.type && (next.type !== 'enum' || previous === next);
  const moved: DraftCondition = { ...condition, left, operator };
  if (!operator || !sameValues) {
    const { operator: _operator, ...bare } = withoutOperand(moved);
    return operator ? { ...bare, operator } : bare;
  }
  if (moved.mode === 'field' && moved.right && !offers(glossary, scopeKey, left, operator, moved.right)) {
    return withoutOperand(moved);
  }
  return moved;
}

export function changeOperator(condition: DraftCondition, operator: string, glossary: Glossary): DraftCondition {
  const next = findOperator(glossary, operator);
  const previous = condition.operator ? findOperator(glossary, condition.operator) : undefined;
  const moved: DraftCondition = { ...condition, operator };
  if (!next || next.arity !== previous?.arity) {
    return withoutOperand(moved);
  }
  return moved.mode === 'field' && !next.fieldComparable ? withoutOperand(moved) : moved;
}

/** The comparison toggle: a literal value or another field, never both. */
export function changeMode(condition: DraftCondition, mode: OperandMode): DraftCondition {
  return { ...withoutOperand(condition), mode };
}
