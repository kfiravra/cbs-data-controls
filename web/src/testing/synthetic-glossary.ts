import { Glossary, GlossaryField } from '../app/core/api/api.types';

const text = (value: string) => ({ he: value });

function field(key: string, type: GlossaryField['type'], operators: string[], extra: Partial<GlossaryField> = {}) {
  return { key, label: text(`${key} label`), type, nullable: true, visible: true, operators, ...extra };
}

/**
 * A glossary with other entities than the sample model: orders, their customer, the customer's region, and
 * order lines. Its shape differs on purpose (four entities, one of them not rootable, a branch and not a
 * chain), so a spec that passes on it assumes nothing about ministries, departments and employees.
 */
export const SYNTHETIC_GLOSSARY: Glossary = {
  glossaryVersion: 'test',
  languages: ['he'],
  defaultLanguage: 'he',
  limits: { maxDepth: 3, maxConditions: 5, maxListValues: 3, maxPathHops: 2, maxTotalValues: 6 },
  formats: { he: { date: 'dd.MM.yyyy', groupSeparator: ',', decimalSeparator: '.' } },
  phrases: {},
  operators: [
    {
      key: 'same',
      arity: 1,
      types: ['number', 'text', 'date', 'bool', 'enum'],
      fieldComparable: true,
      label: { default: text('same as'), 'date.field': text('same day as'), date: text('on') },
      sentence: {},
      reason: {},
    },
    {
      key: 'above',
      arity: 1,
      types: ['number', 'date'],
      fieldComparable: true,
      label: { default: text('above'), field: text('above the field') },
      sentence: {},
      reason: {},
    },
    {
      key: 'within',
      arity: 2,
      types: ['number', 'date'],
      fieldComparable: false,
      label: { default: text('within') },
      sentence: {},
      reason: {},
    },
    {
      key: 'among',
      arity: 'list',
      types: ['number', 'text', 'enum'],
      fieldComparable: false,
      label: { default: text('among') },
      sentence: {},
      reason: {},
    },
    {
      key: 'absent',
      arity: 0,
      types: ['number', 'text', 'date', 'bool', 'enum'],
      fieldComparable: false,
      label: { default: text('absent') },
      sentence: {},
      reason: {},
    },
  ],
  entities: [
    {
      key: 'order',
      label: { singular: text('order'), plural: text('orders') },
      rootable: true,
      visible: true,
      identifyingFields: ['reference', 'order_number'],
      fields: [
        field('order_number', 'number', ['same', 'above', 'within', 'among'], { nullable: false, identifier: true }),
        field('reference', 'text', ['same', 'among', 'absent']),
        field('total', 'number', ['same', 'above', 'within', 'among', 'absent'], { unit: text('units') }),
        field('paid', 'number', ['same', 'above', 'within', 'among', 'absent']),
        field('score', 'number', ['same', 'above'], { comparable: false }),
        field('placed_on', 'date', ['same', 'above', 'within', 'absent']),
        field('shipped_on', 'date', ['same', 'above', 'within', 'absent']),
        field('state', 'enum', ['same', 'among'], {
          enumValues: [
            { value: 'open', label: text('open label') },
            { value: 'closed', label: text('closed label') },
          ],
        }),
        field('urgent', 'bool', ['same'], {
          valueLabels: { true: text('urgent yes'), false: text('urgent no') },
        }),
      ],
    },
    {
      key: 'customer',
      label: { singular: text('customer'), plural: text('customers') },
      rootable: true,
      visible: true,
      identifyingFields: ['name'],
      fields: [field('name', 'text', ['same', 'among', 'absent']), field('credit', 'number', ['same', 'above'])],
    },
    {
      key: 'region',
      label: { singular: text('region'), plural: text('regions') },
      rootable: false,
      visible: true,
      identifyingFields: ['code'],
      fields: [field('code', 'text', ['same', 'among']), field('founded_on', 'date', ['same', 'above'])],
    },
    {
      key: 'line',
      label: { singular: text('line'), plural: text('lines') },
      rootable: true,
      visible: true,
      identifyingFields: ['sku'],
      fields: [field('sku', 'text', ['same', 'among']), field('quantity', 'number', ['same', 'above', 'within'])],
    },
  ],
  relationships: [
    { key: 'order.customer', from: 'order', to: 'customer', cardinality: 'many_to_one', label: text('the customer') },
    { key: 'customer.region', from: 'customer', to: 'region', cardinality: 'one_to_one', label: text('the region') },
    { key: 'order.lines', from: 'order', to: 'line', cardinality: 'one_to_many', label: text('order line') },
    { key: 'customer.orders', from: 'customer', to: 'order', cardinality: 'one_to_many', label: text('customer order') },
    { key: 'line.order', from: 'line', to: 'order', cardinality: 'many_to_one', label: text('the order') },
  ],
  suggestions: {},
};
