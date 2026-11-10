"""The explainer on an English glossary with formats of its own, so every expected sentence is spelled out here.

Rows are fabricated: the explainer reads what the executor would hand it and needs no database.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

import pytest

from app.compiler import CompiledPlan, compile_definition
from app.explainer import Explainer, TextPart, describe, format_number, format_value
from app.explainer.parts import fill, rendered
from app.glossary import Glossary
from app.validator import DefinitionSchema, validate_definition
from tests.builders import all_of, any_of, cond, definition, ref, related

RUN_DATE = date(2026, 11, 1)
LANGUAGE = "en"


def plan_of(document: dict[str, Any], glossary: Glossary, schema: DefinitionSchema) -> CompiledPlan:
    return compile_definition(validate_definition(document, glossary, schema), glossary)


def row_of(
    plan: CompiledPlan,
    key: Any,
    display: dict[str, Any],
    matched: list[str],
    actual: dict[str, Any] | None = None,
    right: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """A page row as the executor returns it: the key, the display values, the field values, the flags."""
    row: dict[str, Any] = {plan.key: key}
    for field_key, column in plan.display:
        row[column.label] = display[field_key]
    for node in plan.nodes:
        row[node.matched] = 1 if node.node_id in matched else 0
        if node.actual is not None and actual is not None and node.node_id in actual:
            row[node.actual.label] = actual[node.node_id]
        if node.right_actual is not None and right is not None and node.node_id in right:
            row[node.right_actual.label] = right[node.node_id]
    return row


def texts(parts: list[dict[str, Any]]) -> list[str]:
    return [part["text"] for part in parts]


# --- sentences ------------------------------------------------------------------------------------------------


def test_rule_sentence_joins_clauses_and_brackets_a_child_group(
    english_glossary: Glossary, schema: DefinitionSchema
) -> None:
    document = definition(
        "ticket",
        all_of(
            cond("c1", "state", "eq", "open"),
            any_of(cond("c2", "priority", "gt", 15000), cond("c3", "summary", "is_empty")),
        ),
    )
    plan = plan_of(document, english_glossary, schema)
    described = describe(Explainer(english_glossary, LANGUAGE), plan.definition)

    assert described["sentence"] == "state is Open and (priority above 15 000 pt or summary is empty)"
    assert described["sentenceParts"] == [
        {"text": "state", "nodeId": "c1", "role": "field"},
        {"text": " is ", "nodeId": "c1"},
        {"text": "Open", "nodeId": "c1", "role": "value"},
        {"text": " and "},
        {"text": "("},
        {"text": "priority", "nodeId": "c2", "role": "field"},
        {"text": " above ", "nodeId": "c2"},
        {"text": "15 000 pt", "nodeId": "c2", "role": "value"},
        {"text": " or "},
        {"text": "summary", "nodeId": "c3", "role": "field"},
        {"text": " is empty", "nodeId": "c3"},
        {"text": ")"},
    ]
    assert "".join(texts(described["sentenceParts"])) == described["sentence"]


def test_each_node_that_can_be_matched_gets_its_clause_alone_in_document_order(
    english_glossary: Glossary, schema: DefinitionSchema
) -> None:
    document = definition(
        "queue",
        all_of(
            cond("c1", "enabled", "eq", True),
            related("r1", "queue.tickets", "none", all_of(cond("c2", "state", "eq", "open"))),
        ),
    )
    plan = plan_of(document, english_glossary, schema)
    described = describe(Explainer(english_glossary, LANGUAGE), plan.definition, {"c1": 7, "r1": 3})

    assert described["sentence"] == "enabled is Enabled and has no the tickets with (state is Open)"
    assert [(item["id"], item["sentence"], item["count"]) for item in described["conditions"]] == [
        ("c1", "enabled is Enabled", 7),
        ("r1", "has no the tickets with (state is Open)", 3),
    ]
    assert described["conditions"][1]["sentenceParts"] == [
        {"text": "has no ", "nodeId": "r1"},
        {"text": "the tickets", "nodeId": "r1", "role": "relationship"},
        {"text": " with (", "nodeId": "r1"},
        {"text": "state", "nodeId": "c2", "role": "field"},
        {"text": " is ", "nodeId": "c2"},
        {"text": "Open", "nodeId": "c2", "role": "value"},
        {"text": ")", "nodeId": "r1"},
    ]
    assert "count" not in describe(Explainer(english_glossary, LANGUAGE), plan.definition)["conditions"][0]


@pytest.mark.parametrize(
    ("node", "sentence"),
    [
        (cond("c1", "priority", "lt", 7), "priority below 7 pt"),
        (cond("c1", "opened_on", "lt", "2026-03-09"), "opened on before 03/09/2026"),
        (cond("c1", "closed_on", "lt", right=ref("opened_on")), "closed on before opened on"),
        (cond("c1", "priority", "lt", right=ref("capacity", ["ticket.queue"])), "priority below capacity of the queue"),
        (cond("c1", "title", "ne", "x"), 'title is not "x"'),
        (cond("c1", "state", "ne", "closed"), "state is not Closed"),
        (cond("c1", "title", "ne", right=ref("summary")), "title differs from summary"),
        (cond("c1", "priority", "between", values=[1000, 2500.5]), "priority between 1 000 pt and 2 500,5 pt"),
        (cond("c1", "priority", "not_between", values=[1, 2]), "priority outside 1 pt to 2 pt"),
        (cond("c1", "state", "in", values=["open", "closed"]), "state one of: Open, Closed"),
        (cond("c1", "title", "contains", "50%"), 'title contains "50%"'),
        (cond("c1", "name", "eq", "x", path=["ticket.queue", "queue.site"]), "name of the site is x"),
        (cond("c1", "days_open", "gte", 18), "days open at least 18"),
        (cond("c1", "owner_link", "is_null"), "owner link is missing"),
        (cond("c1", "number", "eq", 1234567), "number is 1234567"),
    ],
)
def test_condition_sentence_follows_its_variant_and_its_formats(
    node: dict[str, Any], sentence: str, english_glossary: Glossary, schema: DefinitionSchema
) -> None:
    plan = plan_of(definition("ticket", all_of(node)), english_glossary, schema)
    assert describe(Explainer(english_glossary, LANGUAGE), plan.definition)["sentence"] == sentence


def test_list_is_one_part_per_value_with_the_separator_between(
    english_glossary: Glossary, schema: DefinitionSchema
) -> None:
    plan = plan_of(
        definition("ticket", all_of(cond("c1", "priority", "in", values=[1, 2000]))), english_glossary, schema
    )
    assert describe(Explainer(english_glossary, LANGUAGE), plan.definition)["sentenceParts"] == [
        {"text": "priority", "nodeId": "c1", "role": "field"},
        {"text": " one of: ", "nodeId": "c1"},
        {"text": "1 pt", "nodeId": "c1", "role": "value"},
        {"text": ", ", "nodeId": "c1"},
        {"text": "2 000 pt", "nodeId": "c1", "role": "value"},
    ]


# --- values ---------------------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (0, "0"),
        (999, "999"),
        (1000, "1 000"),
        (15000, "15 000"),
        (1234567, "1 234 567"),
        (Decimal("15000.50"), "15 000,5"),
        (Decimal("16500.00"), "16 500"),
        (Decimal("0.125"), "0,125"),
        (-2500, "-2 500"),
        (Decimal("-1234.5"), "-1 234,5"),
        (15000.5, "15 000,5"),
        (Decimal("1E+3"), "1 000"),
    ],
)
def test_number_is_grouped_and_its_trailing_zeros_dropped(
    value: Any, expected: str, english_glossary: Glossary
) -> None:
    assert format_number(value, english_glossary.formats[LANGUAGE]) == expected


def test_values_are_written_as_their_field_asks(english_glossary: Glossary) -> None:
    ticket, queue = english_glossary.entities["ticket"].fields, english_glossary.entities["queue"].fields
    formats = english_glossary.formats[LANGUAGE]

    def written(value: Any, field: Any) -> str:
        return format_value(value, field, formats, LANGUAGE)

    assert written(Decimal("15000.00"), ticket["priority"]) == "15 000 pt"  # the unit after one space
    assert written(1234567, ticket["number"]) == "1234567"  # a number that names a record: digit for digit
    assert written(date(2026, 3, 9), ticket["opened_on"]) == "03/09/2026"
    assert written("pending", ticket["state"]) == "Pending"
    assert written("PENDING", ticket["state"]) == "Pending"  # found without regard to case
    assert written("archived", ticket["state"]) == "archived"  # no entry: shown as stored
    assert written(True, queue["enabled"]) == "Enabled"
    assert written(False, queue["enabled"]) == "Disabled"
    assert written("  spaced  ", ticket["title"]) == "  spaced  "  # text as stored
    assert written(None, ticket["priority"]) == ""  # NULL is nothing, and no unit stands alone


def test_empty_text_gives_no_part() -> None:
    parts = fill("{field}: {actual}{unit}", {"field": [TextPart("salary", "c1", "field")], "actual": []}, "c1")
    assert [(part.text, part.role) for part in parts] == [("salary", "field"), (": ", None)]
    assert rendered([TextPart(""), TextPart("x"), TextPart("")]).parts == (TextPart("x"),)


def test_template_is_used_exactly_as_written() -> None:
    parts = fill("  {a}--{b}  ", {"a": [TextPart("A", "n", "field")], "b": [TextPart("B", "n", "value")]}, "n")
    assert "".join(part.text for part in parts) == "  A--B  "


# --- reasons and violations -----------------------------------------------------------------------------------


def test_violation_carries_its_key_display_matched_nodes_and_a_reason_for_each(
    english_glossary: Glossary, schema: DefinitionSchema
) -> None:
    document = definition(
        "ticket",
        any_of(
            all_of(cond("c1", "days_open", "lt", 18), cond("c2", "priority", "gt", 15000.0)),
            cond("c3", "closed_on", "lt", right=ref("opened_on")),
        ),
    )
    plan = plan_of(document, english_glossary, schema)
    row = row_of(
        plan,
        key=1051,
        display={"title": "Printer on fire", "number": 1051},
        matched=["c1", "c2"],
        # c1 is computed over `opened_on`, which is also the right field of c3: one column serves both.
        actual={"c1": date(2010, 3, 9), "c2": Decimal("16500.00"), "c3": date(2009, 1, 1)},
        right={"c3": date(2010, 3, 9)},
    )
    violation = Explainer(english_glossary, LANGUAGE).violation(plan, row, RUN_DATE)

    assert violation["key"] == "1051"
    assert violation["display"] == {"title": "Printer on fire", "number": 1051}
    assert violation["matched"] == ["c1", "c2"]
    assert [reason["conditionId"] for reason in violation["reasons"]] == ["c1", "c2"]
    assert violation["reasonText"] == "days open is 16 (below 18); priority is 16 500 pt (above 15 000 pt)"

    first, second = violation["reasons"]
    assert first["reasonKey"] == "lt"
    assert first["params"] == {"left": {"field": "days_open"}, "actual": 16, "value": 18}
    assert first["textParts"] == [
        {"text": "days open", "nodeId": "c1", "role": "field"},
        {"text": " is ", "nodeId": "c1"},
        {"text": "16", "nodeId": "c1", "role": "actual"},
        {"text": " (below ", "nodeId": "c1"},
        {"text": "18", "nodeId": "c1", "role": "value"},
        {"text": ")", "nodeId": "c1"},
    ]
    # Raw values: the number as JSON carries it, the operand as the definition has it.
    assert second["params"] == {"left": {"field": "priority"}, "actual": 16500, "value": 15000.0}
    assert "".join(texts(second["textParts"])) == second["text"]


def test_field_comparison_reason_shows_both_values(english_glossary: Glossary, schema: DefinitionSchema) -> None:
    document = definition("ticket", all_of(cond("c1", "closed_on", "lt", right=ref("opened_on"))))
    plan = plan_of(document, english_glossary, schema)
    row = row_of(
        plan,
        key=7,
        display={"title": "t", "number": 7},
        matched=["c1"],
        actual={"c1": date(2026, 1, 5)},
        right={"c1": date(2026, 2, 1)},
    )
    (reason,) = Explainer(english_glossary, LANGUAGE).violation(plan, row, RUN_DATE)["reasons"]
    assert reason["text"] == "closed on is 01/05/2026 (before opened on: 02/01/2026)"
    assert reason["params"] == {
        "left": {"field": "closed_on"},
        "actual": "2026-01-05",
        "right": {"field": "opened_on"},
        "rightActual": "2026-02-01",
    }
    assert [part.get("role") for part in reason["textParts"]] == [
        "field",
        None,
        "actual",
        None,
        "other",
        None,
        "otherActual",
        None,
    ]


def test_reason_of_a_list_carries_the_values_and_of_a_missing_value_a_null(
    english_glossary: Glossary, schema: DefinitionSchema
) -> None:
    document = definition(
        "ticket", any_of(cond("c1", "state", "in", values=["open", "pending"]), cond("c2", "priority", "is_null"))
    )
    plan = plan_of(document, english_glossary, schema)
    row = row_of(
        plan, key=3, display={"title": "t", "number": 3}, matched=["c1", "c2"], actual={"c1": "pending", "c2": None}
    )
    listed, missing = Explainer(english_glossary, LANGUAGE).violation(plan, row, RUN_DATE)["reasons"]
    assert listed["text"] == "state is Pending (in the list)"
    assert listed["params"] == {"left": {"field": "state"}, "actual": "pending", "values": ["open", "pending"]}
    assert missing["text"] == "priority is missing"
    assert missing["params"] == {"left": {"field": "priority"}, "actual": None}


def test_reason_of_a_field_on_a_path_names_the_path(english_glossary: Glossary, schema: DefinitionSchema) -> None:
    document = definition("ticket", all_of(cond("c1", "enabled", "eq", False, path=["ticket.queue"])))
    plan = plan_of(document, english_glossary, schema)
    row = row_of(plan, key=3, display={"title": "t", "number": 3}, matched=["c1"], actual={"c1": False})
    (reason,) = Explainer(english_glossary, LANGUAGE).violation(plan, row, RUN_DATE)["reasons"]
    assert reason["text"] == "enabled of the queue is Disabled"
    assert reason["params"] == {"left": {"path": ["ticket.queue"], "field": "enabled"}, "actual": False, "value": False}
    assert reason["textParts"][0] == {"text": "enabled of the queue", "nodeId": "c1", "role": "field"}


def test_related_node_reason_names_the_relationship_and_keeps_the_inner_ids(
    english_glossary: Glossary, schema: DefinitionSchema
) -> None:
    inner = all_of(cond("c2", "state", "eq", "open"), cond("c3", "priority", "gt", 3))
    for quantifier, key, text in (
        ("any", "related_any", "has the tickets with state is Open and priority above 3 pt"),
        ("none", "related_none", "has no the tickets with state is Open and priority above 3 pt"),
    ):
        plan = plan_of(
            definition("queue", all_of(related("r1", "queue.tickets", quantifier, inner))), english_glossary, schema
        )
        row = row_of(plan, key=104, display={"name": "Support"}, matched=["r1"])
        violation = Explainer(english_glossary, LANGUAGE).violation(plan, row, RUN_DATE)
        (reason,) = violation["reasons"]
        assert (reason["conditionId"], reason["reasonKey"], reason["text"]) == ("r1", key, text)
        assert reason["params"] == {"relationship": "queue.tickets"}
        assert [part.get("nodeId") for part in reason["textParts"]] == [
            "r1", "r1", "r1", "c2", "c2", "c2", None, "c3", "c3", "c3",
        ]  # fmt: skip
        assert violation["matched"] == ["r1"]
        assert violation["display"] == {"name": "Support"}


def test_node_that_is_not_matched_gets_no_reason(english_glossary: Glossary, schema: DefinitionSchema) -> None:
    document = definition("ticket", any_of(cond("c1", "priority", "gt", 5), cond("c2", "summary", "is_empty")))
    plan = plan_of(document, english_glossary, schema)
    row = row_of(
        plan, key=9, display={"title": "t", "number": 9}, matched=["c2"], actual={"c1": Decimal("2"), "c2": "   "}
    )
    violation = Explainer(english_glossary, LANGUAGE).violation(plan, row, RUN_DATE)
    assert violation["matched"] == ["c2"]
    assert violation["reasonText"] == "summary is empty"
    assert violation["reasons"][0]["params"] == {"left": {"field": "summary"}, "actual": "   "}
