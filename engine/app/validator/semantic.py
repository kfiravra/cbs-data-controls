"""The semantic layer: a schema-valid definition against the glossary (contracts/errors.md, Definition error codes).

It reports everything it finds. A check that needs a key the walk could not resolve is skipped; every other check
runs. The resolved tree is returned only when nothing was found.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from datetime import date
from decimal import Decimal
from typing import Any

from app.errors import DefinitionError, InternalError
from app.glossary import (
    QUANTIFIABLE_CARDINALITY,
    TRAVERSABLE_CARDINALITIES,
    Entity,
    Field,
    Glossary,
    Operator,
    Relationship,
)
from app.validator.model import ResolvedField, ValidatedDefinition, Value, VCondition, VGroup, VNode, VRelated

Node = Mapping[str, Any]

_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
# A number literal must stay below this in absolute value (errors.md, VALUE_TYPE_MISMATCH).
_NUMBER_BOUND = 10**15
_WHERE = "/where"


class SemanticWalk:
    """One walk over one definition: it collects the errors and builds the resolved tree beside them."""

    def __init__(self, glossary: Glossary) -> None:
        self._glossary = glossary
        self._limits = glossary.limits
        self._errors: list[DefinitionError] = []
        self._ids: list[tuple[str, str]] = []
        self._deepest = 0
        self._conditions = 0
        self._values = 0

    def run(self, document: Mapping[str, Any]) -> ValidatedDefinition | list[DefinitionError]:
        """The resolved definition, or every error found (never an empty list)."""
        root = self._root_entity(document["rootEntity"])
        where = self._group(document["where"], _WHERE, root, depth=1)
        self._whole_tree()
        if self._errors:
            return self._errors
        if root is None or where is None:
            # Every key the walk cannot resolve records an error, so this is a fault of the walk itself.
            raise InternalError()
        return ValidatedDefinition(root=root, where=where, document=document)

    # --- recording ------------------------------------------------------------------------------------------

    def _error(self, code: str, path: str, params: Mapping[str, Any], node_id: str | None = None) -> None:
        self._errors.append(DefinitionError(code, path, params, node_id))

    # --- the root and the whole tree ------------------------------------------------------------------------

    def _root_entity(self, key: str) -> Entity | None:
        entity = self._glossary.visible_entity(key)
        if entity is None:
            self._error("UNKNOWN_ENTITY", "/rootEntity", {"entity": key})
        elif not entity.rootable:
            self._error("ENTITY_NOT_ROOTABLE", "/rootEntity", {"entity": key})
        return entity

    def _whole_tree(self) -> None:
        limits = self._limits
        if self._deepest > limits.max_depth:
            self._error("TOO_DEEP", _WHERE, {"max": limits.max_depth, "actual": self._deepest})
        if self._conditions > limits.max_conditions:
            self._error("TOO_MANY_CONDITIONS", _WHERE, {"max": limits.max_conditions, "actual": self._conditions})
        if self._values > limits.max_total_values:
            self._error(
                "TOO_MANY_VALUES", _WHERE, {"limit": "total", "max": limits.max_total_values, "actual": self._values}
            )
        first_seen: set[str] = set()
        for node_id, pointer in self._ids:
            if node_id in first_seen:
                # No nodeId on purpose: the id names two nodes.
                self._error("DUPLICATE_NODE_ID", f"{pointer}/id", {"id": node_id})
            first_seen.add(node_id)

    # --- nodes ----------------------------------------------------------------------------------------------

    def _group(self, node: Node, pointer: str, scope: Entity | None, depth: int) -> VGroup | None:
        self._deepest = max(self._deepest, depth)
        children: list[VNode | None] = []
        for index, child in enumerate(node["children"]):
            child_pointer = f"{pointer}/children/{index}"
            if child["type"] == "group":
                children.append(self._group(child, child_pointer, scope, depth + 1))
            elif child["type"] == "condition":
                children.append(self._condition(child, child_pointer, scope))
            else:
                children.append(self._related(child, child_pointer, scope, depth))
        resolved = [child for child in children if child is not None]
        if len(resolved) != len(children):
            return None
        return VGroup(op=node["op"], children=tuple(resolved))

    def _related(self, node: Node, pointer: str, scope: Entity | None, depth: int) -> VRelated | None:
        node_id: str = node["id"]
        self._ids.append((node_id, pointer))
        self._conditions += 1
        key: str = node["relationship"]
        at = f"{pointer}/relationship"
        relationship = self._glossary.usable_relationship(key)
        target: Entity | None = None
        if relationship is None:
            self._error("UNKNOWN_RELATIONSHIP", at, {"relationship": key}, node_id)
        else:
            if scope is not None and relationship.from_entity != scope.key:
                self._error("PATH_NOT_REACHABLE", at, {"relationship": key, "entity": scope.key}, node_id)
            if relationship.cardinality != QUANTIFIABLE_CARDINALITY:
                self._error(
                    "RELATIONSHIP_NOT_QUANTIFIABLE",
                    at,
                    {"relationship": key, "cardinality": relationship.cardinality},
                    node_id,
                )
            target = self._glossary.entities[relationship.to_entity]
        # The `where` group of a related node counts one level, like any group.
        where = self._group(node["where"], f"{pointer}/where", target, depth + 1)
        if relationship is None or target is None or where is None:
            return None
        return VRelated(node_id, relationship, node["quantifier"], target, where)

    def _condition(self, node: Node, pointer: str, scope: Entity | None) -> VCondition | None:
        node_id: str = node["id"]
        self._ids.append((node_id, pointer))
        self._conditions += 1
        self._values += ("value" in node) + len(node.get("values", ()))

        listed = len(node.get("values", ()))
        if listed > self._limits.max_list_values:
            self._error(
                "TOO_MANY_VALUES",
                f"{pointer}/values",
                {"limit": "list", "max": self._limits.max_list_values, "actual": listed},
                node_id,
            )

        operator = self._glossary.operators.get(node["operator"])
        left = self._field_ref(node["left"], f"{pointer}/left", scope, node_id)
        right = self._field_ref(node["right"], f"{pointer}/right", scope, node_id) if "right" in node else None

        if left is not None and node["operator"] not in left.field.operators:
            self._error(
                "OPERATOR_NOT_ALLOWED",
                f"{pointer}/operator",
                {"operator": node["operator"], "field": left.field.key, "type": left.field.type},
                node_id,
            )
        fits = operator is not None and _operand_fits(node, operator)
        if operator is not None and not fits:
            self._error("OPERAND_MISMATCH", pointer, {"operator": operator.key, "arity": operator.arity}, node_id)

        operand = self._literals(node, pointer, left.field, node_id) if left is not None else None
        if "right" in node and operator is not None:
            self._field_comparison(operator, left, right, pointer, node_id)
            operand = right
        if left is None or operator is None or not fits:
            return None
        return VCondition(id=node_id, left=left, operator=operator, operand=operand, node=node)

    # --- field references -----------------------------------------------------------------------------------

    def _field_ref(self, ref: Node, pointer: str, scope: Entity | None, node_id: str) -> ResolvedField | None:
        """Follow the path hop by hop, then find the field. Every fault is reported at the reference itself."""
        if scope is None:
            return None
        path: list[str] = list(ref.get("path", ()))
        if len(path) > self._limits.max_path_hops:
            self._error("PATH_TOO_LONG", pointer, {"max": self._limits.max_path_hops, "actual": len(path)}, node_id)
        entity = scope
        hops: list[Relationship] = []
        for key in path:
            relationship = self._glossary.usable_relationship(key)
            if relationship is None:
                self._error("UNKNOWN_RELATIONSHIP", pointer, {"relationship": key}, node_id)
                return None
            if relationship.from_entity != entity.key:
                # The hop is refused, yet the entity it reaches is known: the rest is checked against that one.
                self._error("PATH_NOT_REACHABLE", pointer, {"relationship": key, "entity": entity.key}, node_id)
            if relationship.cardinality not in TRAVERSABLE_CARDINALITIES:
                self._error("PATH_NOT_TRAVERSABLE", pointer, {"relationship": key}, node_id)
            hops.append(relationship)
            entity = self._glossary.entities[relationship.to_entity]
        field = entity.visible_field(ref["field"])
        if field is None:
            # A hidden field is unknown: its existence is not confirmed to a caller.
            self._error("UNKNOWN_FIELD", pointer, {"entity": entity.key, "field": ref["field"]}, node_id)
            return None
        return ResolvedField(path=tuple(hops), entity=entity, field=field, ref=ref)

    def _field_comparison(
        self,
        operator: Operator,
        left: ResolvedField | None,
        right: ResolvedField | None,
        pointer: str,
        node_id: str,
    ) -> None:
        """Rules, Field comparisons: the operator first; then each field; then the two types."""
        if not operator.field_comparable:
            self._error("FIELD_COMPARISON_NOT_ALLOWED", f"{pointer}/right", {"operator": operator.key}, node_id)
            return
        for side, name in ((left, "left"), (right, "right")):
            if side is not None and not side.field.comparable:
                self._error("FIELD_COMPARISON_NOT_ALLOWED", f"{pointer}/{name}", {"field": side.field.key}, node_id)
        if left is not None and right is not None and left.field.type != right.field.type:
            self._error(
                "FIELD_TYPE_MISMATCH",
                f"{pointer}/right",
                {"leftType": left.field.type, "rightType": right.field.type},
                node_id,
            )

    # --- literals -------------------------------------------------------------------------------------------

    def _literals(self, node: Node, pointer: str, field: Field, node_id: str) -> None | Value | tuple[Value, ...]:
        """Type every literal of the condition against the left field; the result is used only when all fit."""
        if "value" in node:
            return self._literal(node["value"], field, f"{pointer}/value", None, node_id)
        if "values" not in node:
            return None
        raw: list[Any] = node["values"]
        at = f"{pointer}/values"
        typed = [self._literal(item, field, at, index, node_id) for index, item in enumerate(raw)]
        values = tuple(value for value in typed if value is not None)
        if len(values) != len(raw):
            return None
        if node["operator"] in ("between", "not_between") and len(values) == 2 and _above(values[0], values[1]):
            self._error("RANGE_INVALID", at, {"low": raw[0], "high": raw[1]}, node_id)
        return values

    def _literal(self, raw: Any, field: Field, path: str, index: int | None, node_id: str) -> Value | None:
        position = {} if index is None else {"index": index}
        typed = _typed(raw, field.type)
        if typed is None:
            self._error("VALUE_TYPE_MISMATCH", path, {"field": field.key, "type": field.type, **position}, node_id)
            return None
        if field.type == "enum" and typed not in {item.value for item in field.enum_values}:
            self._error("UNKNOWN_ENUM_VALUE", path, {"field": field.key, "value": raw, **position}, node_id)
            return None
        return typed


def _operand_fits(node: Node, operator: Operator) -> bool:
    """The operand shape against the operator's arity in the glossary (the schema says the same per operator)."""
    has_value, has_right = "value" in node, "right" in node
    values = node.get("values")
    if operator.arity == 0:
        return not has_value and not has_right and values is None
    if operator.arity == 1:
        return has_value != has_right and values is None
    if has_value or has_right or values is None:
        return False
    return len(values) == 2 if operator.arity == 2 else len(values) >= 1


def _typed(raw: Any, field_type: str) -> Value | None:
    """The literal as a value of the field's type, or None when it is not one."""
    if field_type == "number":
        # A JSON boolean is not a number, though Python says `True == 1`; the bound also turns NaN away.
        if isinstance(raw, bool) or not isinstance(raw, (int, float)) or not abs(raw) < _NUMBER_BOUND:
            return None
        if isinstance(raw, int) or raw.is_integer():
            return int(raw)
        return Decimal(repr(raw))
    if field_type == "bool":
        return raw if isinstance(raw, bool) else None
    if not isinstance(raw, str):
        return None
    if field_type == "date":
        if not _ISO_DATE.fullmatch(raw):
            return None
        try:
            return date.fromisoformat(raw)
        except ValueError:
            return None
    return raw


def _above(low: Value, high: Value) -> bool:
    """Whether a range is upside down. Both values have the type of one field, so they compare."""
    if isinstance(low, (int, Decimal)) and isinstance(high, (int, Decimal)):
        return low > high
    if isinstance(low, date) and isinstance(high, date):
        return low > high
    return False
