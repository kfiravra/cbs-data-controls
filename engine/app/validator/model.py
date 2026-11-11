"""A definition after validation: every key resolved against the glossary, every literal typed.

The compiler and the explainer take this and nothing else, and validate nothing again.
"""

from __future__ import annotations

from collections.abc import Iterator, Mapping
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any, Literal

from app.glossary import Entity, Field, Operator, Relationship

# A typed literal: a whole number, a fraction, a date, a boolean, or text (an enum value is text).
Value = int | Decimal | date | bool | str


@dataclass(frozen=True, slots=True)
class ResolvedField:
    """A field reference: the relationships from the scope entity outward, and the field they reach."""

    path: tuple[Relationship, ...]
    entity: Entity
    field: Field
    # The reference as the definition has it, for reason params.
    ref: Mapping[str, Any]


@dataclass(frozen=True, slots=True)
class VCondition:
    id: str
    left: ResolvedField
    operator: Operator
    # Nothing (arity 0), one value, the values of a range or a list, or another field.
    operand: None | Value | tuple[Value, ...] | ResolvedField
    # The node as the definition has it: reasons carry `value` and `values` untouched.
    node: Mapping[str, Any]

    @property
    def right(self) -> ResolvedField | None:
        return self.operand if isinstance(self.operand, ResolvedField) else None


@dataclass(frozen=True, slots=True)
class VRelated:
    id: str
    relationship: Relationship
    quantifier: Literal["any", "none"]
    # The entity the relationship reaches: the scope of `where`.
    entity: Entity
    where: VGroup


@dataclass(frozen=True, slots=True)
class VGroup:
    op: Literal["and", "or"]
    children: tuple[VNode, ...]


VNode = VGroup | VCondition | VRelated


@dataclass(frozen=True, slots=True)
class ValidatedDefinition:
    root: Entity
    where: VGroup
    # The definition as it was received.
    document: Mapping[str, Any]

    def matchable(self) -> tuple[VCondition | VRelated, ...]:
        """The nodes that can be matched, in document order: everything outside a related node's `where`."""
        return tuple(_matchable(self.where))


def _matchable(group: VGroup) -> Iterator[VCondition | VRelated]:
    for child in group.children:
        if isinstance(child, VGroup):
            yield from _matchable(child)
        else:
            yield child
