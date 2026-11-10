"""The business glossary as typed, immutable values (architecture §4.3, contracts/glossary.json)."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Literal

from sqlalchemy import Table

# One text per language of the glossary's `languages`.
Text = Mapping[str, str]
# The variants of an operator text: `<type>.field`, `field`, `<type>`, `default`.
Variants = Mapping[str, Text]

FieldType = Literal["number", "text", "date", "bool", "enum"]
Arity = Literal[0, 1, 2, "list"]

FIELD_TYPES: frozenset[str] = frozenset({"number", "text", "date", "bool", "enum"})
# Closed lists implemented in code (the compiler holds one expression per key); the glossary may only name these.
OPERATOR_KEYS: frozenset[str] = frozenset({
    "eq", "ne", "lt", "lte", "gt", "gte", "between", "not_between", "in", "not_in",
    "contains", "not_contains", "starts_with", "ends_with",
    "is_null", "is_not_null", "is_empty", "is_not_empty",
})  # fmt: skip
COMPUTED_FUNCTIONS: frozenset[str] = frozenset({"age_years"})
TRAVERSABLE_CARDINALITIES: frozenset[str] = frozenset({"many_to_one", "one_to_one"})
QUANTIFIABLE_CARDINALITY = "one_to_many"
PARENT_CARDINALITY = "many_to_one"
REQUIRED_STATES: frozenset[str] = frozenset({"always", "active", "inactive"})


class GlossaryInvalid(Exception):
    """The glossary file cannot be used: a missing member, a dangling reference, a key outside a closed list."""


@dataclass(frozen=True, slots=True)
class Limits:
    max_depth: int
    max_conditions: int
    max_list_values: int
    max_path_hops: int
    max_total_values: int


@dataclass(frozen=True, slots=True)
class Formats:
    date: str
    group_separator: str
    decimal_separator: str


@dataclass(frozen=True, slots=True)
class RelatedPhrase:
    sentence: Text
    reason: Text


@dataclass(frozen=True, slots=True)
class Phrases:
    and_: Text
    or_: Text
    group_open: Text
    group_close: Text
    list_separator: Text
    reason_separator: Text
    field_on_path: Text
    related_any: RelatedPhrase
    related_none: RelatedPhrase


@dataclass(frozen=True, slots=True)
class Operator:
    key: str
    arity: Arity
    types: frozenset[str]
    field_comparable: bool
    label: Variants
    sentence: Variants
    reason: Variants


@dataclass(frozen=True, slots=True)
class EnumValue:
    value: str
    label: Text


@dataclass(frozen=True, slots=True)
class Computed:
    function: str
    over: str


@dataclass(frozen=True, slots=True)
class Field:
    key: str
    label: Text
    type: FieldType
    column: str | None
    computed: Computed | None
    nullable: bool
    visible: bool
    # Resolved: the field's own list, else every operator of its type, in glossary order.
    operators: tuple[str, ...]
    unit: Text | None
    enum_values: tuple[EnumValue, ...]
    value_labels: Mapping[bool, Text] | None
    required: str | None
    comparable: bool
    identifier: bool

    @property
    def source_column(self) -> str:
        """The physical column a value of this field is read from."""
        if self.column is not None:
            return self.column
        if self.computed is not None:
            return self.computed.over
        raise GlossaryInvalid(f"field {self.key} has neither a column nor a computed function")


@dataclass(frozen=True, slots=True)
class Lifecycle:
    field: str
    active: str | bool


@dataclass(frozen=True, slots=True)
class Entity:
    key: str
    label_singular: Text
    label_plural: Text
    schema: str
    table: str
    key_column: str
    rootable: bool
    visible: bool
    identifying_fields: tuple[str, ...]
    lifecycle: Lifecycle | None
    fields: Mapping[str, Field]

    @property
    def qualified_table(self) -> str:
        return f"{self.schema}.{self.table}"

    def visible_field(self, key: str) -> Field | None:
        found = self.fields.get(key)
        return found if found is not None and found.visible else None


@dataclass(frozen=True, slots=True)
class Relationship:
    key: str
    from_entity: str
    to_entity: str
    cardinality: str
    from_column: str
    to_column: str
    label: Text


@dataclass(frozen=True, slots=True)
class SuggestionKind:
    name: Text
    description: Text
    rationale: Text


@dataclass(frozen=True, slots=True)
class SuggestionTexts:
    kinds: Mapping[str, SuggestionKind]
    evidence: Mapping[str, Text]


@dataclass(frozen=True, slots=True)
class Glossary:
    version: str
    languages: tuple[str, ...]
    default_language: str
    limits: Limits
    formats: Mapping[str, Formats]
    phrases: Phrases
    operators: Mapping[str, Operator]
    entities: Mapping[str, Entity]
    relationships: Mapping[str, Relationship]
    suggestions: SuggestionTexts
    # One table per entity, holding only the columns the glossary names: the only source of an identifier in SQL.
    tables: Mapping[str, Table]
    # The file as read, for the public view (`GET /glossary`).
    document: Mapping[str, Any]

    def visible_entity(self, key: str) -> Entity | None:
        found = self.entities.get(key)
        return found if found is not None and found.visible else None

    def usable_relationship(self, key: str) -> Relationship | None:
        """A relationship whose two ends are visible; one that touches a hidden entity does not exist for a caller."""
        found = self.relationships.get(key)
        if found is None:
            return None
        if self.visible_entity(found.from_entity) is None or self.visible_entity(found.to_entity) is None:
            return None
        return found
