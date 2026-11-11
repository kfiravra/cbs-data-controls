"""The SELECTs the engine writes for itself: the catalog read of the startup check and the health ping."""

from __future__ import annotations

from collections.abc import Collection, Mapping
from dataclasses import dataclass
from typing import Any

from sqlalchemy import Column, Integer, MetaData, Select, Table, Unicode, bindparam, select

# The catalog view, described like any other table: its name reaches the SQL text through SQLAlchemy only.
_CATALOG_COLUMNS = Table(
    "COLUMNS",
    MetaData(),
    Column("TABLE_SCHEMA", Unicode),
    Column("TABLE_NAME", Unicode),
    Column("COLUMN_NAME", Unicode),
    Column("DATA_TYPE", Unicode),
    schema="INFORMATION_SCHEMA",
)


# The labels of the catalog read; whoever reads its rows uses these names.
CATALOG_SCHEMA = "table_schema"
CATALOG_TABLE = "table_name"
CATALOG_COLUMN = "column_name"
CATALOG_TYPE = "data_type"


@dataclass(frozen=True, slots=True)
class ReadQuery:
    """One SELECT with its parameters, built here and run by the executor."""

    statement: Select[Any]
    parameters: Mapping[str, Any]


def catalog_query(schemas: Collection[str]) -> ReadQuery:
    """Every column of the given schemas with its type name; the schema names are bound."""
    catalog = _CATALOG_COLUMNS.c
    statement = select(
        catalog.TABLE_SCHEMA.label(CATALOG_SCHEMA),
        catalog.TABLE_NAME.label(CATALOG_TABLE),
        catalog.COLUMN_NAME.label(CATALOG_COLUMN),
        catalog.DATA_TYPE.label(CATALOG_TYPE),
    ).where(catalog.TABLE_SCHEMA.in_(bindparam("schemas", expanding=True, type_=Unicode())))
    return ReadQuery(statement, {"schemas": sorted(set(schemas))})


def ping_query() -> ReadQuery:
    """The cheapest SELECT there is: proves that the database answers."""
    return ReadQuery(select(bindparam("one", type_=Integer()).label("ok")), {"one": 1})
