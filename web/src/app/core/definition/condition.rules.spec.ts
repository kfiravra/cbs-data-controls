import { SYNTHETIC_GLOSSARY } from '../../../testing/synthetic-glossary';
import { changeField, changeMode, changeOperator } from './condition.rules';
import { DraftCondition } from './draft';

const glossary = SYNTHETIC_GLOSSARY;

function row(rest: Partial<DraftCondition> = {}): DraftCondition {
  return { type: 'condition', id: 'c1', mode: 'value', ...rest };
}

describe('condition rules', () => {
  it('keeps the operator and the value when the new field allows the operator and has the same type', () => {
    const before = row({ left: { field: 'total' }, operator: 'above', value: '100' });

    expect(changeField(before, { field: 'paid' }, glossary, 'order')).toEqual({
      ...before,
      left: { field: 'paid' },
    });
  });

  it('clears the operator when the new field does not allow it', () => {
    const before = row({ left: { field: 'total' }, operator: 'above', value: '100' });

    const after = changeField(before, { field: 'reference' }, glossary, 'order');

    expect(after.operator).toBeUndefined();
    expect(after.value).toBeUndefined();
  });

  it('keeps the operator and clears the value when the type of the field changes', () => {
    const before = row({ left: { field: 'total' }, operator: 'same', value: '100' });

    const after = changeField(before, { field: 'reference' }, glossary, 'order');

    expect(after.operator).toBe('same');
    expect(after.value).toBeUndefined();
  });

  it('clears the value when one enum field replaces another, because their values differ', () => {
    const before = row({ left: { field: 'state' }, operator: 'same', value: 'open' });

    expect(changeField(before, { field: 'state' }, glossary, 'order').value).toBe('open');
    expect(changeField({ ...before, left: { field: 'other_enum' } }, { field: 'state' }, glossary, 'order').value).toBeUndefined();
  });

  it('goes back to a literal value when the new field cannot be compared with another field', () => {
    const before = row({ left: { field: 'total' }, operator: 'above', mode: 'field', right: { field: 'paid' } });

    const after = changeField(before, { field: 'score' }, glossary, 'order');

    expect(after.mode).toBe('value');
    expect(after.right).toBeUndefined();
  });

  it('keeps the compared field when the new field has the same type and may be compared', () => {
    const before = row({ left: { field: 'total' }, operator: 'above', mode: 'field', right: { field: 'paid' } });

    const after = changeField(before, { field: 'order_number' }, glossary, 'order');

    expect(after).toMatchObject({ mode: 'field', right: { field: 'paid' } });
  });

  it('keeps the operand when the new operator has the same arity', () => {
    const before = row({ left: { field: 'total' }, operator: 'same', value: '100' });

    expect(changeOperator(before, 'above', glossary)).toEqual({ ...before, operator: 'above' });
  });

  it('clears the operand when the arity of the operator changes', () => {
    const single = row({ left: { field: 'total' }, operator: 'above', value: '100' });
    const list = row({ left: { field: 'total' }, operator: 'among', values: ['1', '2'] });

    expect(changeOperator(single, 'within', glossary)).toEqual(row({ left: { field: 'total' }, operator: 'within' }));
    expect(changeOperator(list, 'above', glossary).values).toBeUndefined();
    expect(changeOperator(single, 'absent', glossary).value).toBeUndefined();
  });

  it('drops a field comparison when the new operator takes one operand and cannot compare two fields', () => {
    const before = row({
      left: { field: 'name' },
      operator: 'same',
      mode: 'field',
      right: { path: ['customer.region'], field: 'code' },
    });

    const after = changeOperator(before, 'holds', glossary);

    expect(after).toEqual(row({ left: { field: 'name' }, operator: 'holds' }));
  });

  it('keeps a literal value when the new operator of the same arity cannot compare two fields', () => {
    const before = row({ left: { field: 'name' }, operator: 'same', value: 'north' });

    expect(changeOperator(before, 'holds', glossary)).toEqual({ ...before, operator: 'holds' });
  });

  it('swaps the operand kind with the comparison toggle and forgets the other kind', () => {
    const literal = row({ left: { field: 'total' }, operator: 'above', value: '100' });

    const comparing = changeMode(literal, 'field');
    expect(comparing).toMatchObject({ mode: 'field' });
    expect(comparing.value).toBeUndefined();

    const back = changeMode({ ...comparing, right: { field: 'paid' } }, 'value');
    expect(back.mode).toBe('value');
    expect(back.right).toBeUndefined();
  });
});
