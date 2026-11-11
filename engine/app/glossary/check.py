"""The startup check: every table and column the glossary names must exist in the database and fit its field."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from types import MappingProxyType

from app.glossary.model import Glossary
from app.glossary.tables import physical_columns

# The database type names (INFORMATION_SCHEMA.COLUMNS.DATA_TYPE) each field type may sit on.
TYPE_FAMILIES: Mapping[str, frozenset[str]] = MappingProxyType(
    {
        "number": frozenset({"tinyint", "smallint", "int", "bigint", "decimal", "numeric"}),
        "text": frozenset({"char", "varchar", "nchar", "nvarchar"}),
        "enum": frozenset({"char", "varchar", "nchar", "nvarchar"}),
        "date": frozenset({"date", "datetime2"}),
        "bool": frozenset({"bit"}),
    }
)


@dataclass(frozen=True, slots=True)
class CatalogColumn:
    """One row of the database catalog, as the engine's login sees it."""

    schema: str
    table: str
    column: str
    data_type: str


@dataclass(frozen=True, slots=True)
class Mismatch:
    """`table` is `schema.name`; `column` is None when the whole table is missing."""

    table: str
    column: str | None


def find_mismatches(glossary: Glossary, catalog: Iterable[CatalogColumn]) -> list[Mismatch]:
    """Every glossary table or column the catalog lacks, and every column whose type does not fit its field."""
    found: dict[tuple[str, str], dict[str, str]] = {}
    for row in catalog:
        found.setdefault((row.schema, row.table), {})[row.column] = row.data_type.lower()

    mismatches: list[Mismatch] = []
    for entity in glossary.entities.values():
        columns = found.get((entity.schema, entity.table))
        if columns is None:
            mismatches.append(Mismatch(entity.qualified_table, None))
            continue
        for name, field_type in physical_columns(entity, glossary.relationships).items():
            data_type = columns.get(name)
            fits = data_type is not None and (field_type is None or data_type in TYPE_FAMILIES[field_type])
            if not fits:
                mismatches.append(Mismatch(entity.qualified_table, name))
    return mismatches
