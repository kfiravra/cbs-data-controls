"""What the generators know about the data: counts per entity, read from one aggregate SELECT. Never a row value."""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from app.compiler import ProfileQuery, ReadQuery, profile_query
from app.glossary import Entity, Field, Glossary
from app.suggestions.shape import missing_operator


@dataclass(frozen=True, slots=True)
class DatePair:
    """Two date fields of one entity, in glossary order, and how their values are ordered in the data."""

    first: str
    second: str
    both: int
    first_earlier: int
    second_earlier: int


@dataclass(frozen=True, slots=True)
class EntityProfile:
    rows: int
    # Per field that may be missing without breaking a rule: in how many rows it is.
    missing: Mapping[str, int]
    date_pairs: tuple[DatePair, ...]


def optional_fields(entity: Entity) -> list[Field]:
    """Visible, stored, nullable fields the glossary does not mark as required and gives a test for "missing"."""
    return [
        field
        for field in entity.fields.values()
        if field.visible
        and field.column is not None
        and field.nullable
        and field.required is None
        and missing_operator(field) is not None
    ]


def date_fields(entity: Entity) -> list[Field]:
    """Visible, stored date fields that may be compared with another field (a computed one has no column)."""
    return [
        field
        for field in entity.fields.values()
        if field.visible and field.column is not None and field.type == "date" and field.comparable
    ]


def query_for(entity: Entity, glossary: Glossary) -> ProfileQuery:
    """The one SELECT that measures everything the generators ask about an entity."""
    dates = [field.key for field in date_fields(entity)]
    pairs = [(first, second) for index, first in enumerate(dates) for second in dates[index + 1 :]]
    missing = {field.key: operator for field in optional_fields(entity) if (operator := missing_operator(field))}
    return profile_query(entity, glossary, missing, pairs)


def read_profile(query: ProfileQuery, row: Mapping[str, Any]) -> EntityProfile:
    """The counts of the row; a SUM over no rows is NULL and counts as nothing."""

    def count(label: str) -> int:
        return int(row[label] or 0)

    return EntityProfile(
        rows=count(query.rows),
        missing={field: count(label) for field, label in query.missing.items()},
        date_pairs=tuple(
            DatePair(first, second, count(labels.both), count(labels.below), count(labels.above))
            for (first, second), labels in query.pairs.items()
        ),
    )


def load_profile(
    entity: Entity, glossary: Glossary, fetch: Callable[[ReadQuery], Sequence[Mapping[str, Any]]]
) -> EntityProfile:
    """Measure one entity: build its SELECT, run it through `fetch`, read the one row it returns."""
    query = query_for(entity, glossary)
    return read_profile(query, fetch(query.query)[0])
