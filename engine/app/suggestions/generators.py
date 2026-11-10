"""The closed list of generators. Each proposes definitions from properties of the glossary and from counts:
`lifecycle`, `required`, cardinality and type. None is keyed on an entity, a field or a relationship.

The numbers below tune when a generator speaks. They never end up inside a definition: no generator invents a
threshold of a rule.
"""

from __future__ import annotations

from collections.abc import Callable, Iterator, Mapping
from dataclasses import dataclass, field, replace
from types import MappingProxyType
from typing import Any

from app.glossary import PARENT_CARDINALITY, QUANTIFIABLE_CARDINALITY, Entity, Field, Glossary, Relationship
from app.suggestions import shape
from app.suggestions.profile import DatePair, EntityProfile, date_fields, optional_fields

# date_order: enough rows hold both dates, and the usual order holds in most of them.
MIN_ROWS_WITH_BOTH_DATES = 5
USUAL_ORDER_SHARE = 0.8
# missing_optional: the field is filled in almost every row.
MAX_MISSING_SHARE = 0.10

MAX_PARENT_HOPS = 2


def _nothing() -> dict[str, str]:
    return {}


@dataclass(frozen=True, slots=True)
class Candidate:
    """A proposed definition, with what its texts and its evidence need."""

    root: Entity
    definition: dict[str, Any]
    # The kind of `suggestions.kinds` its texts come from; set by `candidates` from the generator's place below.
    kind: str = ""
    # Placeholders of the kind's texts that name a field of the root entity (`field`, `earlier`, `later`).
    fields: Mapping[str, str] = field(default_factory=_nothing)
    # The relationship the rule goes through, when it does.
    relationship: Relationship | None = None
    # missing_required: field key to the id of the node that finds it missing.
    missing_nodes: Mapping[str, str] = field(default_factory=_nothing)
    # date_order: the pair the proposal rests on.
    date_pair: DatePair | None = None


Profiles = Mapping[str, EntityProfile]
Generator = Callable[[Glossary, Entity, Profiles], Iterator[Candidate]]


def _missing_required(_glossary: Glossary, entity: Entity, _profiles: Profiles) -> Iterator[Candidate]:
    """OR(each `always` field missing, AND(active, OR(the `active` ones)), AND(inactive, OR(the `inactive` ones))).

    A required field that cannot be missing at all (the glossary gives it no test for that) asks for nothing.
    """
    missing: dict[str, list[shape.Node]] = {"always": [], "active": [], "inactive": []}
    for required in entity.fields.values():
        test = shape.is_missing(required) if required.visible and required.required is not None else None
        if test is not None and required.required is not None:
            missing[required.required].append(test)
    branches = list(missing["always"])
    for state, guard in (("active", shape.is_active(entity)), ("inactive", shape.is_inactive(entity))):
        if missing[state] and guard is not None:
            branches.append(shape.all_of(guard, shape.any_of(missing[state])))
    if not branches:
        return
    definition = shape.definition(entity, shape.any_of(branches))
    tested = [test for tests in missing.values() for test in tests]
    yield Candidate(entity, definition, missing_nodes={test["left"]["field"]: test["id"] for test in tested})


def _date_order(_glossary: Glossary, entity: Entity, profiles: Profiles) -> Iterator[Candidate]:
    """Two dates that are almost always in one order, and a few rows in the other: propose the rows in the other.

    "Almost always" counts the rows that are strictly in the usual order, so two dates that are mostly equal
    have no usual order and nothing is proposed for them.
    """
    comparable = {item.key for item in date_fields(entity)}
    for pair in profiles[entity.key].date_pairs:
        if pair.both < MIN_ROWS_WITH_BOTH_DATES or not {pair.first, pair.second} <= comparable:
            continue
        for later, earlier, usual_rows, reversed_rows in (
            (pair.first, pair.second, pair.second_earlier, pair.first_earlier),
            (pair.second, pair.first, pair.first_earlier, pair.second_earlier),
        ):
            if reversed_rows >= 1 and usual_rows >= USUAL_ORDER_SHARE * pair.both:
                where = shape.all_of(shape.condition(later, "lt", right={"field": earlier}))
                yield Candidate(
                    entity,
                    shape.definition(entity, where),
                    fields={"later": later, "earlier": earlier},
                    date_pair=pair,
                )


def _parent_paths(glossary: Glossary, entity: Entity) -> Iterator[list[Relationship]]:
    """Paths of many-to-one relationships from the entity outward: every one hop first, then the two hops."""

    def hops(start: str) -> list[Relationship]:
        return [
            relationship
            for relationship in glossary.relationships.values()
            if relationship.from_entity == start
            and relationship.cardinality == PARENT_CARDINALITY
            and glossary.usable_relationship(relationship.key) is not None
        ]

    first_hops = hops(entity.key)
    yield from ([hop] for hop in first_hops)
    if glossary.limits.max_path_hops >= MAX_PARENT_HOPS:
        for first in first_hops:
            yield from ([first, second] for second in hops(first.to_entity))


def _active_under_inactive(glossary: Glossary, entity: Entity, _profiles: Profiles) -> Iterator[Candidate]:
    """AND(active, the parent at the end of the path inactive)."""
    for path in _parent_paths(glossary, entity):
        active = shape.is_active(entity)
        inactive = shape.is_inactive(glossary.entities[path[-1].to_entity], [hop.key for hop in path])
        if active is None or inactive is None:
            continue
        where = shape.all_of(active, inactive)
        yield Candidate(entity, shape.definition(entity, where), relationship=path[-1])


def _active_without_active_children(glossary: Glossary, entity: Entity, _profiles: Profiles) -> Iterator[Candidate]:
    """AND(active, none of the related records is active)."""
    for relationship in glossary.relationships.values():
        if relationship.from_entity != entity.key or relationship.cardinality != QUANTIFIABLE_CARDINALITY:
            continue
        if glossary.usable_relationship(relationship.key) is None:
            continue
        active = shape.is_active(entity)
        child_active = shape.is_active(glossary.entities[relationship.to_entity])
        if active is None or child_active is None:
            continue
        where = shape.all_of(active, shape.related(relationship.key, "none", shape.all_of(child_active)))
        yield Candidate(entity, shape.definition(entity, where), relationship=relationship)


def _missing_optional(_glossary: Glossary, entity: Entity, profiles: Profiles) -> Iterator[Candidate]:
    """A field nobody marked as required, filled in almost every row: propose the few rows without it."""
    profile = profiles[entity.key]
    optional: Field
    for optional in optional_fields(entity):
        missing = profile.missing.get(optional.key, 0)
        test = shape.is_missing(optional)
        if test is not None and 1 <= missing <= profile.rows * MAX_MISSING_SHARE:
            yield Candidate(entity, shape.definition(entity, shape.all_of(test)), fields={"field": optional.key})


# Kind to generator, in the order of the table of plan.md Design H: it is the order of the answer. The keys are
# the kinds of `suggestions.kinds` in the glossary.
GENERATORS: Mapping[str, Generator] = MappingProxyType(
    {
        "missing_required": _missing_required,
        "date_order": _date_order,
        "active_under_inactive": _active_under_inactive,
        "active_without_active_children": _active_without_active_children,
        "missing_optional": _missing_optional,
    }
)
KINDS = tuple(GENERATORS)


def candidates(glossary: Glossary, roots: list[Entity], profiles: Profiles) -> Iterator[Candidate]:
    """Every proposal for the given root entities: by generator, then in glossary order."""
    for kind, generator in GENERATORS.items():
        for entity in roots:
            for candidate in generator(glossary, entity, profiles):
                yield replace(candidate, kind=kind)
