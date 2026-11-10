"""The one renderer of the system: rule sentences, condition sentences and reasons, from the glossary's templates.

Every word comes from the glossary in the request's language. The code names no language and no text of its own.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date
from types import MappingProxyType
from typing import Any

from app.compiler import CompiledPlan, NodeColumns
from app.explainer.parts import Rendered, TextPart, fill, fill_plain, rendered
from app.explainer.values import as_json_scalar, format_value
from app.glossary import Field, Glossary, RelatedPhrase, Text, Variants
from app.validator import ResolvedField, ValidatedDefinition, VCondition, VGroup, VNode, VRelated

Row = Mapping[str, Any]
Matchable = VCondition | VRelated

_FIELD_VARIANT = "field"
_DEFAULT_VARIANT = "default"
_RELATED_REASON_KEYS: Mapping[str, str] = MappingProxyType({"any": "related_any", "none": "related_none"})


@dataclass(frozen=True, slots=True)
class Reason:
    """Why one node is matched for one record: as data (key and raw params) and as rendered text."""

    condition_id: str
    reason_key: str
    params: Mapping[str, Any]
    text: Rendered

    def to_json(self) -> dict[str, Any]:
        return {
            "conditionId": self.condition_id,
            "reasonKey": self.reason_key,
            "params": dict(self.params),
            "text": self.text.text,
            "textParts": self.text.parts_json(),
        }


class Explainer:
    """Renders one definition in one language."""

    def __init__(self, glossary: Glossary, language: str) -> None:
        self._glossary = glossary
        self._language = language
        self._formats = glossary.formats[language]
        self._phrases = glossary.phrases

    def _in_language(self, text: Text) -> str:
        return text[self._language]

    # --- sentences ------------------------------------------------------------------------------------------

    def sentence(self, definition: ValidatedDefinition) -> Rendered:
        """The rule sentence: the root group."""
        return rendered(self._group(definition.where))

    def node_sentence(self, node: Matchable) -> Rendered:
        """The clause of one node, rendered alone."""
        return rendered(self._node(node))

    def _group(self, group: VGroup) -> list[TextPart]:
        """The children joined by the group's word; a child group in brackets. Joining words belong to no node."""
        joiner = self._in_language(self._phrases.and_ if group.op == "and" else self._phrases.or_)
        parts: list[TextPart] = []
        for index, child in enumerate(group.children):
            if index:
                parts.append(TextPart(joiner))
            if isinstance(child, VGroup):
                parts.append(TextPart(self._in_language(self._phrases.group_open)))
                parts.extend(self._group(child))
                parts.append(TextPart(self._in_language(self._phrases.group_close)))
            else:
                parts.extend(self._node(child))
        return parts

    def _node(self, node: VNode) -> list[TextPart]:
        if isinstance(node, VGroup):
            return self._group(node)
        if isinstance(node, VRelated):
            return self._related(node, self._related_phrase(node).sentence)
        template = self._variant(node.operator.sentence, node)
        return fill(template, self._condition_slots(node), node.id)

    def _related_phrase(self, node: VRelated) -> RelatedPhrase:
        return self._phrases.related_any if node.quantifier == "any" else self._phrases.related_none

    def _related(self, node: VRelated, phrase: Text) -> list[TextPart]:
        """The phrase carries the related node's id; the conditions inside keep the ids of their own nodes.

        The glossary's phrase brackets `{conditions}` itself where it wants brackets; none is added here.
        """
        slots = {
            "relationship": [TextPart(self._in_language(node.relationship.label), node.id, "relationship")],
            "conditions": self._group(node.where),
        }
        return fill(self._in_language(phrase), slots, node.id)

    # --- conditions -----------------------------------------------------------------------------------------

    def _variant(self, variants: Variants, node: VCondition) -> str:
        """The first variant present of `<type>.field`, `field`, `<type>`, `default`.

        The two `field` variants apply only when the condition compares with another field.
        """
        field_type = node.left.field.type
        names = [field_type, _DEFAULT_VARIANT]
        if node.right is not None:
            names = [f"{field_type}.{_FIELD_VARIANT}", _FIELD_VARIANT, *names]
        for name in names:
            if name in variants:
                return self._in_language(variants[name])
        return ""

    def _label(self, resolved: ResolvedField) -> str:
        """A field is its label; one reached through a path is `fieldOnPath` with the last relationship's label."""
        label = self._in_language(resolved.field.label)
        if not resolved.path:
            return label
        return fill_plain(
            self._in_language(self._phrases.field_on_path),
            {"field": label, "relationship": self._in_language(resolved.path[-1].label)},
        )

    def _value(self, value: Any, field: Field) -> str:
        return format_value(value, field, self._formats, self._language)

    def _condition_slots(self, node: VCondition) -> dict[str, Sequence[TextPart]]:
        """What the placeholders of a condition stand for; an operand is written as a value of the left field."""
        field = node.left.field
        slots: dict[str, Sequence[TextPart]] = {"field": [TextPart(self._label(node.left), node.id, "field")]}
        operand = node.operand
        if isinstance(operand, ResolvedField):
            slots["other"] = [TextPart(self._label(operand), node.id, "other")]
        elif isinstance(operand, tuple):
            values = [TextPart(self._value(value, field), node.id, "value") for value in operand]
            slots["values"] = self._listed(values, node.id)
            slots["value"], slots["value2"] = values[:1], values[1:2]
        elif operand is not None:
            slots["value"] = [TextPart(self._value(operand, field), node.id, "value")]
        return slots

    def _listed(self, values: Sequence[TextPart], node_id: str) -> list[TextPart]:
        """One part per value with the list separator between them; the separator is part of the node's clause."""
        separator = self._in_language(self._phrases.list_separator)
        parts: list[TextPart] = []
        for index, value in enumerate(values):
            if index:
                parts.append(TextPart(separator, node_id))
            parts.append(value)
        return parts

    # --- reasons --------------------------------------------------------------------------------------------

    def reason(self, node: Matchable, columns: NodeColumns, row: Row, run_date: date) -> Reason:
        """One reason for one matched node of one record."""
        if isinstance(node, VRelated):
            text = rendered(self._related(node, self._related_phrase(node).reason))
            params = {"relationship": node.relationship.key}
            return Reason(node.id, _RELATED_REASON_KEYS[node.quantifier], params, text)
        return self._condition_reason(node, columns, row, run_date)

    def _condition_reason(self, node: VCondition, columns: NodeColumns, row: Row, run_date: date) -> Reason:
        actual = None if columns.actual is None else columns.actual.read(row, run_date)
        params: dict[str, Any] = {"left": dict(node.left.ref), "actual": as_json_scalar(actual)}
        slots = self._condition_slots(node)
        slots["actual"] = [TextPart(self._value(actual, node.left.field), node.id, "actual")]
        for member in ("value", "values"):
            if member in node.node:
                params[member] = node.node[member]
        if node.right is not None:
            right_actual = None if columns.right_actual is None else columns.right_actual.read(row, run_date)
            params["right"] = dict(node.right.ref)
            params["rightActual"] = as_json_scalar(right_actual)
            slots["otherActual"] = [TextPart(self._value(right_actual, node.right.field), node.id, "otherActual")]
        template = self._variant(node.operator.reason, node)
        return Reason(node.id, node.operator.key, params, rendered(fill(template, slots, node.id)))

    # --- violations -----------------------------------------------------------------------------------------

    def violation(self, plan: CompiledPlan, row: Row, run_date: date) -> dict[str, Any]:
        """One violating record: its key, its identifying fields, the matched nodes and a reason for each."""
        matched = [
            (node, columns)
            for node, columns in zip(plan.definition.matchable(), plan.nodes, strict=True)
            if row[columns.matched] == 1
        ]
        reasons = [self.reason(node, columns, row, run_date) for node, columns in matched]
        return {
            "key": str(row[plan.key]),
            "display": {key: as_json_scalar(column.read(row, run_date)) for key, column in plan.display},
            "matched": [node.id for node, _ in matched],
            "reasons": [reason.to_json() for reason in reasons],
            "reasonText": self._in_language(self._phrases.reason_separator).join(
                reason.text.text for reason in reasons
            ),
        }
