import {
  FieldRef,
  FieldType,
  Glossary,
  GlossaryEntity,
  GlossaryField,
  GlossaryOperator,
  GlossaryRelationship,
} from '../api/api.types';
import { Scalar } from '../definition/definition.types';
import { LocalizedText } from '../i18n/language';

/**
 * Pure lookups over the glossary the api serves. Everything the client knows about entities, fields,
 * relationships and operators comes through these: no key of the sample model is named anywhere.
 */

/** A field found from a scope entity: the field, the entity that owns it and the relationships on the way. */
export interface ResolvedField {
  readonly field: GlossaryField;
  readonly entity: GlossaryEntity;
  readonly path: readonly GlossaryRelationship[];
}

/** The fields one picker group offers: those of the scope itself (an empty path) or of an entity on a path. */
export interface FieldGroup {
  readonly path: readonly string[];
  readonly relationships: readonly GlossaryRelationship[];
  readonly entity: GlossaryEntity;
  readonly fields: readonly GlossaryField[];
}

/** How two neighbours of the chain connect: each `one` has many `many`. */
export interface ChainLink {
  readonly one: GlossaryEntity;
  readonly many: GlossaryEntity;
}

/** The entities a control may check, in glossary order, and how each connects to the next. */
export interface EntityChain {
  readonly entities: readonly { readonly entity: GlossaryEntity; readonly selected: boolean }[];
  /**
   * `links[i]` joins `entities[i]` and `entities[i + 1]`; null where no relationship joins them, or where
   * the one that does has no many side.
   */
  readonly links: readonly (ChainLink | null)[];
}

export function findEntity(glossary: Glossary, key: string): GlossaryEntity | undefined {
  return glossary.entities.find((entity) => entity.key === key);
}

export function findOperator(glossary: Glossary, key: string): GlossaryOperator | undefined {
  return glossary.operators.find((operator) => operator.key === key);
}

export function findRelationship(glossary: Glossary, key: string): GlossaryRelationship | undefined {
  return glossary.relationships.find((relationship) => relationship.key === key);
}

export function rootEntities(glossary: Glossary): GlossaryEntity[] {
  return glossary.entities.filter((entity) => entity.rootable);
}

function isTraversable(relationship: GlossaryRelationship): boolean {
  return relationship.cardinality !== 'one_to_many';
}

/** The field a reference names from a scope entity, or undefined when any key on the way is not there. */
export function resolveField(glossary: Glossary, scopeKey: string, ref: FieldRef): ResolvedField | undefined {
  let entity = findEntity(glossary, scopeKey);
  const path: GlossaryRelationship[] = [];
  for (const key of ref.path ?? []) {
    const relationship = findRelationship(glossary, key);
    if (!entity || !relationship || relationship.from !== entity.key || !isTraversable(relationship)) {
      return undefined;
    }
    path.push(relationship);
    entity = findEntity(glossary, relationship.to);
  }
  const field = entity?.fields.find((candidate) => candidate.key === ref.field);
  return entity && field ? { field, entity, path } : undefined;
}

/**
 * The scope's own fields, then one group per path of many-to-one (or one-to-one) relationships of at most
 * `limits.maxPathHops` hops, nearer entities first.
 */
export function fieldGroups(glossary: Glossary, scopeKey: string): FieldGroup[] {
  const scope = findEntity(glossary, scopeKey);
  if (!scope) {
    return [];
  }
  const groups: FieldGroup[] = [{ path: [], relationships: [], entity: scope, fields: scope.fields }];
  // breadth first: the loop also visits the groups it adds
  for (const group of groups) {
    if (group.relationships.length >= glossary.limits.maxPathHops) {
      continue;
    }
    for (const relationship of glossary.relationships) {
      const target = findEntity(glossary, relationship.to);
      if (relationship.from === group.entity.key && isTraversable(relationship) && target) {
        groups.push({
          path: [...group.path, relationship.key],
          relationships: [...group.relationships, relationship],
          entity: target,
          fields: target.fields,
        });
      }
    }
  }
  return groups;
}

/** The relationships a related-records node may name from a scope: its one-to-many relationships. */
export function relatedOptions(glossary: Glossary, scopeKey: string): GlossaryRelationship[] {
  return glossary.relationships.filter(
    (relationship) => relationship.from === scopeKey && relationship.cardinality === 'one_to_many',
  );
}

export function operatorsOf(glossary: Glossary, field: GlossaryField): GlossaryOperator[] {
  return field.operators.flatMap((key) => findOperator(glossary, key) ?? []);
}

/**
 * The label of an operator in a picker: the first variant present in the order `<type>.field`, `field`,
 * `<type>`, `default`, the two field variants only when the row compares with another field. Choosing a
 * picker label is the only use of variants in the client.
 */
export function operatorLabel(
  operator: GlossaryOperator,
  type: FieldType,
  rightIsField: boolean,
): LocalizedText | undefined {
  const order = rightIsField ? [`${type}.field`, 'field', type, 'default'] : [type, 'default'];
  return order.map((variant) => operator.label[variant]).find((label) => label !== undefined);
}

function sameRef(a: FieldRef, path: readonly string[], field: string): boolean {
  return a.field === field && (a.path ?? []).join('\n') === path.join('\n');
}

/**
 * What the comparison toggle offers: fields of the left field's type that the glossary lets take part in a
 * field-to-field comparison. Empty when the operator is not `fieldComparable` or the left field is not
 * comparable (contracts/errors.md, Field comparisons), and then the toggle is not offered.
 */
export function comparableFields(
  glossary: Glossary,
  scopeKey: string,
  left: FieldRef,
  operatorKey: string,
): FieldGroup[] {
  const leftField = resolveField(glossary, scopeKey, left)?.field;
  if (!leftField || leftField.comparable === false || !findOperator(glossary, operatorKey)?.fieldComparable) {
    return [];
  }
  return fieldGroups(glossary, scopeKey)
    .map((group) => ({
      ...group,
      fields: group.fields.filter(
        (field) =>
          field.type === leftField.type &&
          field.comparable !== false &&
          !sameRef(left, group.path, field.key),
      ),
    }))
    .filter((group) => group.fields.length > 0);
}

/** The glossary's label of an enum or boolean value; undefined for a value that is shown as it is. */
export function valueLabel(field: GlossaryField, value: Scalar): LocalizedText | undefined {
  if (field.type === 'bool' && typeof value === 'boolean') {
    return field.valueLabels?.[value ? 'true' : 'false'];
  }
  if (field.type === 'enum') {
    const stored = String(value).toLowerCase();
    return field.enumValues?.find((entry) => entry.value.toLowerCase() === stored)?.label;
  }
  return undefined;
}

/**
 * The chain under the question of what a control checks: every rootable entity in glossary order, and
 * between two neighbours which of them holds many of the other, read from the cardinality of a relationship
 * that joins them. It assumes no number of entities. It is one row, so a glossary that is not a chain shows
 * only what joins neighbours; the sentence under it lists everything the chosen entity can reach.
 */
export function chainFor(glossary: Glossary, rootKey: string | null): EntityChain {
  const entities = rootEntities(glossary);
  const links = entities.slice(1).map((entity, index): ChainLink | null => {
    const before = entities[index];
    for (const relationship of glossary.relationships) {
      const joins =
        (relationship.from === before.key && relationship.to === entity.key) ||
        (relationship.from === entity.key && relationship.to === before.key);
      if (!joins || relationship.cardinality === 'one_to_one') {
        continue;
      }
      // many-to-one runs from the many side; one-to-many runs from the one side
      const fromIsMany = relationship.cardinality === 'many_to_one';
      const manyKey = fromIsMany ? relationship.from : relationship.to;
      return manyKey === entity.key ? { one: before, many: entity } : { one: entity, many: before };
    }
    return null;
  });
  return {
    entities: entities.map((entity) => ({ entity, selected: entity.key === rootKey })),
    links,
  };
}
