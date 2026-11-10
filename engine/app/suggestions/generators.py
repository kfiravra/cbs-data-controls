"""The closed list of generators. Each proposes definitions from properties of the glossary and from counts:
`lifecycle`, `required`, cardinality and type. None is keyed on an entity, a field or a relationship.

The numbers below tune when a generator speaks. They never end up inside a definition: no generator invents a
threshold of a rule.
"""

from __future__ import annotations

from collections.abc import Callable, Iterator, Mapping
from dataclasses import dataclass, field
from typing import Any

from app.glossary import QUANTIFIABLE_CARDINALITY, Entity, Glossary, Relationship
from app.suggestions import shape
from app.suggestions.profile import DatePair, EntityProfile, date_fields, optional_fields

# date_order: enough rows hold both dates, and the usual order holds in most of them.
MIN_ROWS_WITH_BOTH_DATES = 5
USUAL_ORDER_SHARE = 0.8
# missing_optional: the field is filled in almost every row.
MAX_MISSING_SHARE = 0.10

# The kinds of contracts/glossary.json `suggestions.kinds`, in the order of the answer.
KINDS = (
    "missing_required",
    "date_order",
    "active_under_inactive",
    "active_without_active_children",
    "missing_optional",
)

PARENT_CARDINALITY = "many_to_one"
MAX_PARENT_HOPS = 2


def _nothing() -> dict[str, str]:
    return {}


@dataclass(frozen=True, slots=True)
class Candidate:
    """A proposed definition, with what its texts and its evidence need."""

    kind: str
    root: Entity
    definition: dict[str, Any]
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


def _missing_required(glossary: Glossary, entity: Entity, _profiles: Profiles) -> Iterator[Candidate]:
    """OR(each `always` field missing, AND(active, OR(the `active` ones)), AND(inactive, OR(the `inactive` ones)))."""
    by_state: dict[str, list[Any]] = {"always": [], "active": [], "inactive": []}
    for required in entity.fields.values():
        if required.visible and required.required is not None:
            by_state[required.required].append(required)
    branches = [shape.is_missing(required) for required in by_state["always"]]
    for state, guard in (("active", shape.is_active(entity)), ("inactive", shape.is_inactive(entity))):
        if by_state[state] and guard is not None:
            branches.append(shape.all_of(guard, shape.any_of([shape.is_missing(item) for item in by_state[state]])))
    if not branches:
        return
    definition = shape.definition(entity, shape.any_of(branches))
    yield Candidate("missing_required", entity, definition, missing_nodes=_missing_nodes(definition["where"]))


def _missing_nodes(where: dict[str, Any]) -> dict[str, str]:
    """Field key to node id, for every condition of the tree that tests a field for being missing."""
    found: dict[str, str] = {}

    def visit(node: dict[str, Any]) -> None:
        if node["type"] == "condition" and node["operator"] in ("is_null", "is_empty"):
            found[node["left"]["field"]] = node["id"]
        for child in node.get("children", ()):
            visit(child)

    visit(where)
    return found


def _date_order(_glossary: Glossary, entity: Entity, profiles: Profiles) -> Iterator[Candidate]:
    """Two dates that are almost always in one order, and a few rows in the other: propose the rows in the other."""
    stored = {item.key for item in date_fields(entity)}
    for pair in profiles[entity.key].date_pairs:
        if pair.both < MIN_ROWS_WITH_BOTH_DATES or not {pair.first, pair.second} <= stored:
            continue
        for later, earlier, reversed_rows in (
            (pair.first, pair.second, pair.first_earlier),
            (pair.second, pair.first, pair.second_earlier),
        ):
            usual = (pair.both - reversed_rows) / pair.both
            if reversed_rows >= 1 and usual >= USUAL_ORDER_SHARE:
                where = shape.all_of(shape.condition(later, "lt", right={"field": earlier}))
                yield Candidate(
                    "date_order",
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
        yield Candidate("active_under_inactive", entity, shape.definition(entity, where), relationship=path[-1])


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
        yield Candidate(
            "active_without_active_children", entity, shape.definition(entity, where), relationship=relationship
        )


def _missing_optional(_glossary: Glossary, entity: Entity, profiles: Profiles) -> Iterator[Candidate]:
    """A field nobody marked as required, filled in almost every row: propose the few rows without it."""
    profile = profiles[entity.key]
    for optional in optional_fields(entity):
        missing = profile.missing.get(optional.key, 0)
        if profile.rows and 1 <= missing <= profile.rows * MAX_MISSING_SHARE:
            where = shape.all_of(shape.is_missing(optional))
            yield Candidate("missing_optional", entity, shape.definition(entity, where), fields={"field": optional.key})


# The order of the table of plan.md Design H: it is the order of the answer.
GENERATORS: tuple[Generator, ...] = (
    _missing_required,
    _date_order,
    _active_under_inactive,
    _active_without_active_children,
    _missing_optional,
)


def candidates(glossary: Glossary, roots: list[Entity], profiles: Profiles) -> Iterator[Candidate]:
    """Every proposal for the given root entities: by generator, then in glossary order."""
    for generator in GENERATORS:
        for entity in roots:
            yield from generator(glossary, entity, profiles)
