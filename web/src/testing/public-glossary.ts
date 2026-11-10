import { Glossary, GlossaryEntity, GlossaryField, GlossaryRelationship } from '../app/core/api/api.types';

/* eslint-disable @typescript-eslint/no-explicit-any -- the glossary file is read as loose JSON here */

/**
 * `contracts/glossary.json` as `GET /glossary` serves it (contracts/api.md §3): without physical names,
 * without what is hidden, and with every field's operators resolved. Specs and Playwright fixtures feed the
 * client the same shape the engine would.
 */
export function toPublicGlossary(file: any): Glossary {
  const entities: GlossaryEntity[] = file.entities
    .filter((entity: any) => entity.visible)
    .map((entity: any) => {
      const { table: _table, keyColumn: _keyColumn, fields, ...rest } = entity;
      return {
        ...rest,
        fields: fields.filter((field: any) => field.visible).map((field: any) => publicField(field, file)),
      };
    });
  const visible = new Set(entities.map((entity) => entity.key));
  const relationships: GlossaryRelationship[] = file.relationships
    .filter((relationship: any) => visible.has(relationship.from) && visible.has(relationship.to))
    .map(({ join: _join, ...rest }: any) => rest);
  return { ...file, entities, relationships };
}

function publicField(field: any, file: any): GlossaryField {
  const { column: _column, computed: _computed, operators, ...rest } = field;
  const resolved: string[] =
    operators ??
    file.operators
      .filter((operator: any) => operator.types.includes(field.type))
      .map((operator: any) => operator.key)
      .filter((key: string) => field.nullable || (key !== 'is_null' && key !== 'is_not_null'));
  return { ...rest, operators: resolved };
}
