"""The explainer: the rule sentence, a sentence per node and, per violation, a reason for every matched node.

It is the only renderer of the system. No row value and no rendered reason is ever logged here: they are personal data.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from app.explainer.parts import Rendered, TextPart, fill_plain
from app.explainer.render import Explainer, Reason
from app.explainer.values import as_json_scalar, format_number, format_value
from app.validator import ValidatedDefinition

__all__ = [
    "Explainer",
    "Reason",
    "Rendered",
    "TextPart",
    "as_json_scalar",
    "describe",
    "fill_plain",
    "format_number",
    "format_value",
]


def describe(
    explainer: Explainer, definition: ValidatedDefinition, counts: Mapping[str, int] | None = None
) -> dict[str, Any]:
    """The rule sentence and one sentence per node that can be matched, in document order.

    With `counts` (a run), each node also says in how many violations it is matched.
    """
    sentence = explainer.sentence(definition)
    conditions: list[dict[str, Any]] = []
    for node in definition.matchable():
        clause = explainer.node_sentence(node)
        condition: dict[str, Any] = {"id": node.id, "sentence": clause.text, "sentenceParts": clause.parts_json()}
        if counts is not None:
            condition["count"] = counts[node.id]
        conditions.append(condition)
    return {"sentence": sentence.text, "sentenceParts": sentence.parts_json(), "conditions": conditions}
