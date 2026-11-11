"""The aggregate SELECT behind the suggestions: one statement per entity, counts only, never a row value.

The suggestions module says what to measure (which fields count as missing by which operator, which pairs of
fields to compare); the SQL is built here, from the glossary's tables and the closed operator map.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from sqlalchemy import ColumnElement, Integer, Unicode, and_, bindparam, case, func, select

from app.compiler.operators import OPERATORS
from app.compiler.queries import ReadQuery
from app.glossary import Entity, Glossary

_EMPTY = "empty"


@dataclass(frozen=True, slots=True)
class PairLabels:
    """The three counts of a pair of fields: rows that hold both, rows with the first below the second, and above."""

    both: str
    below: str
    above: str


@dataclass(frozen=True, slots=True)
class ProfileQuery:
    """The statement and where each count comes back in its one row."""

    query: ReadQuery
    rows: str
    missing: Mapping[str, str]
    pairs: Mapping[tuple[str, str], PairLabels]


def profile_query(
    entity: Entity,
    glossary: Glossary,
    missing: Mapping[str, str],
    pairs: Sequence[tuple[str, str]],
) -> ProfileQuery:
    """Count the entity's rows, the rows in which each field of `missing` fails its test, and each pair's order.

    `missing` maps a field key to the operator that finds it missing (`is_null` or `is_empty`); `pairs` holds
    pairs of field keys of stored fields of one type.
    """
    table = glossary.tables[entity.key].alias("e0")
    # Constants of the engine, written into the text by SQLAlchemy as in the run statements; never a caller's.
    one: ColumnElement[Any] = bindparam("one", 1, type_=Integer(), literal_execute=True)
    zero: ColumnElement[Any] = bindparam("zero", 0, type_=Integer(), literal_execute=True)
    empty: ColumnElement[Any] = bindparam(_EMPTY, type_=Unicode())

    def counted(predicate: ColumnElement[bool], label: str) -> ColumnElement[Any]:
        return func.sum(case((predicate, one), else_=zero)).label(label)

    def column(field_key: str) -> ColumnElement[Any]:
        return table.c[entity.fields[field_key].source_column]

    columns: list[ColumnElement[Any]] = [func.count().label("n")]
    missing_labels: dict[str, str] = {}
    for index, (field_key, operator_key) in enumerate(missing.items()):
        operator = OPERATORS[operator_key]
        operands = (empty,) if operator.operand == "empty" else ()
        missing_labels[field_key] = f"x{index}"
        columns.append(counted(operator.build(column(field_key), operands), missing_labels[field_key]))

    pair_labels: dict[tuple[str, str], PairLabels] = {}
    for index, (first, second) in enumerate(pairs):
        left, right = column(first), column(second)
        labels = PairLabels(both=f"b{index}", below=f"l{index}", above=f"g{index}")
        pair_labels[(first, second)] = labels
        columns.append(counted(and_(left.is_not(None), right.is_not(None)), labels.both))
        columns.append(counted(left < right, labels.below))
        columns.append(counted(left > right, labels.above))

    uses_empty = any(OPERATORS[key].operand == "empty" for key in missing.values())
    statement = select(*columns).select_from(table)
    return ProfileQuery(ReadQuery(statement, {_EMPTY: ""} if uses_empty else {}), "n", missing_labels, pair_labels)
