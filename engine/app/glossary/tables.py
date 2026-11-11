"""One `sqlalchemy.Table` per glossary entity, built from the glossary alone (no database is needed)."""

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType
from typing import Any

from sqlalchemy import Boolean, Column, Date, MetaData, Numeric, Table, Unicode
from sqlalchemy.types import TypeEngine

from app.glossary.model import Entity, GlossaryInvalid, Relationship

# Text is Unicode (NVARCHAR): SQLAlchemy binds a String as VARCHAR, which runs Hebrew through the code page.
SQL_TYPES: Mapping[str, type[TypeEngine[Any]]] = MappingProxyType(
    {
        "number": Numeric,
        "text": Unicode,
        "enum": Unicode,
        "date": Date,
        "bool": Boolean,
    }
)
# The field type of the column each computed function reads.
COMPUTED_SOURCE_TYPES: Mapping[str, str] = MappingProxyType({"age_years": "date"})


def physical_columns(entity: Entity, relationships: Mapping[str, Relationship]) -> Mapping[str, str | None]:
    """Every column of the entity's table that the glossary names, with the field type it must fit.

    The key column and join columns that no field reads have no type to fit: `None`.
    """
    columns: dict[str, str | None] = {entity.key_column: None}
    for field in entity.fields.values():
        column_type = field.type if field.computed is None else COMPUTED_SOURCE_TYPES[field.computed.function]
        known = columns.get(field.source_column)
        if known is not None and SQL_TYPES[known] is not SQL_TYPES[column_type]:
            raise GlossaryInvalid(
                f"{entity.qualified_table}.{field.source_column} is read as {known} and as {column_type}"
            )
        columns[field.source_column] = column_type
    for relationship in relationships.values():
        if relationship.from_entity == entity.key:
            columns.setdefault(relationship.from_column, None)
        if relationship.to_entity == entity.key:
            columns.setdefault(relationship.to_column, None)
    return columns


def build_tables(entities: Mapping[str, Entity], relationships: Mapping[str, Relationship]) -> Mapping[str, Table]:
    metadata = MetaData()
    tables: dict[str, Table] = {}
    for entity in entities.values():
        columns: list[Column[Any]] = [
            Column(name) if column_type is None else Column(name, SQL_TYPES[column_type]())
            for name, column_type in physical_columns(entity, relationships).items()
        ]
        tables[entity.key] = Table(entity.table, metadata, *columns, schema=entity.schema)
    return MappingProxyType(tables)
