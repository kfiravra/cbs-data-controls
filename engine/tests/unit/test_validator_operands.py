"""The validator on operands, field comparisons, limits and node ids, and the tree it hands on.

Everything here runs against the synthetic glossary; see `test_validator.py` for the contract's own fixtures.
"""

from __future__ import annotations

import copy
from datetime import date
from decimal import Decimal
from typing import Any

import pytest

from app.glossary import Glossary
from app.validator import DefinitionSchema, VCondition, VGroup, validate_definition
from tests.builders import all_of, any_of, cond, definition, ref, related
from tests.unit.validation import C0, C1, codes_and_paths, doctored, nested, rejected

# --- operators and operands -----------------------------------------------------------------------------------


def test_operator_outside_the_field_own_list(synthetic_glossary: Glossary, schema: DefinitionSchema) -> None:
    document = definition("ticket", all_of(cond("c1", "owner_link", "eq", 7)))
    assert rejected(document, synthetic_glossary, schema) == [
        {
            "code": "OPERATOR_NOT_ALLOWED",
            "path": f"{C0}/operator",
            "nodeId": "c1",
            "params": {"operator": "eq", "field": "owner_link", "type": "number"},
        }
    ]


def test_null_test_on_a_field_that_cannot_be_null(synthetic_glossary: Glossary, schema: DefinitionSchema) -> None:
    document = definition("ticket", all_of(cond("c1", "title", "is_null")))
    assert codes_and_paths(rejected(document, synthetic_glossary, schema)) == [
        ("OPERATOR_NOT_ALLOWED", f"{C0}/operator")
    ]


def test_operand_that_does_not_fit_the_arity_of_the_glossary(
    glossary_document: dict[str, Any], schema: DefinitionSchema
) -> None:
    def make_eq_a_range(document: dict[str, Any]) -> None:
        next(op for op in document["operators"] if op["key"] == "eq")["arity"] = 2

    disagreeing = doctored(glossary_document, make_eq_a_range)
    document = definition("ticket", all_of(cond("c1", "title", "eq", "x")))
    assert rejected(document, disagreeing, schema) == [
        {"code": "OPERAND_MISMATCH", "path": C0, "nodeId": "c1", "params": {"operator": "eq", "arity": 2}}
    ]


@pytest.mark.parametrize(
    ("field", "operator", "value", "field_type"),
    [
        ("priority", "gt", "15000", "number"),
        ("priority", "gt", True, "number"),
        ("priority", "gt", 10**15, "number"),
        ("priority", "gt", -(10**15), "number"),
        ("priority", "gt", 1e15, "number"),
        ("title", "eq", 5, "text"),
        ("title", "contains", False, "text"),
        ("state", "eq", 1, "enum"),
        ("opened_on", "lt", "2026-02-30", "date"),
        ("opened_on", "lt", "2026-2-3", "date"),
        ("opened_on", "lt", "20260203", "date"),
        ("opened_on", "lt", "2026-W01-1", "date"),
        ("opened_on", "lt", 20260203, "date"),
    ],
)
def test_literal_that_is_not_of_the_field_type(
    field: str, operator: str, value: Any, field_type: str, synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    document = definition("ticket", all_of(cond("c1", field, operator, value)))
    assert rejected(document, synthetic_glossary, schema) == [
        {
            "code": "VALUE_TYPE_MISMATCH",
            "path": f"{C0}/value",
            "nodeId": "c1",
            "params": {"field": field, "type": field_type},
        }
    ]


def test_boolean_field_takes_only_a_boolean(synthetic_glossary: Glossary, schema: DefinitionSchema) -> None:
    document = definition("queue", all_of(cond("c1", "enabled", "eq", "true")))
    assert codes_and_paths(rejected(document, synthetic_glossary, schema)) == [("VALUE_TYPE_MISMATCH", f"{C0}/value")]


def test_literals_are_typed_for_the_compiler(synthetic_glossary: Glossary, schema: DefinitionSchema) -> None:
    document = definition(
        "ticket",
        all_of(
            cond("c1", "priority", "gt", 18),
            cond("c2", "priority", "gt", 18.0),
            cond("c3", "priority", "gt", 15000.5),
            cond("c4", "priority", "lt", 10**15 - 1),
            cond("c5", "opened_on", "between", values=["2024-02-29", "2026-11-01"]),
            cond("c6", "state", "in", values=["open", "closed"]),
            cond("c7", "title", "contains", "50%"),
            cond("c8", "summary", "is_empty"),
            cond("c9", "closed_on", "lt", right=ref("opened_on")),
        ),
    )
    conditions = validate_definition(document, synthetic_glossary, schema).where.children
    operands = [node.operand for node in conditions if isinstance(node, VCondition)]
    assert operands[:8] == [
        18,
        18,
        Decimal("15000.5"),
        999_999_999_999_999,
        (date(2024, 2, 29), date(2026, 11, 1)),
        ("open", "closed"),
        "50%",
        None,
    ]
    assert [type(operand) for operand in operands[:3]] == [int, int, Decimal]
    last = conditions[8]
    assert isinstance(last, VCondition)
    assert last.right is not None
    assert last.right.field.key == "opened_on"
    assert last.node["right"] == {"field": "opened_on"}


def test_range_whose_low_end_is_above_the_high_end(synthetic_glossary: Glossary, schema: DefinitionSchema) -> None:
    document = definition(
        "ticket",
        all_of(
            cond("c1", "priority", "between", values=[5, 3]),
            cond("c2", "opened_on", "not_between", values=["2026-11-02", "2026-11-01"]),
            cond("c3", "priority", "between", values=[4, 4]),
        ),
    )
    assert rejected(document, synthetic_glossary, schema) == [
        {"code": "RANGE_INVALID", "path": f"{C0}/values", "nodeId": "c1", "params": {"low": 5, "high": 3}},
        {
            "code": "RANGE_INVALID",
            "path": f"{C1}/values",
            "nodeId": "c2",
            "params": {"low": "2026-11-02", "high": "2026-11-01"},
        },
    ]


# --- field comparisons ----------------------------------------------------------------------------------------


def test_operator_that_cannot_compare_two_fields(synthetic_glossary: Glossary, schema: DefinitionSchema) -> None:
    document = definition("ticket", all_of(cond("c1", "title", "contains", right=ref("days_open"))))
    assert rejected(document, synthetic_glossary, schema) == [
        {
            "code": "FIELD_COMPARISON_NOT_ALLOWED",
            "path": f"{C0}/right",
            "nodeId": "c1",
            "params": {"operator": "contains"},
        }
    ]


def test_each_field_that_may_not_be_compared_is_named_at_its_own_reference(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    document = definition("ticket", all_of(cond("c1", "days_open", "gt", right=ref("days_open"))))
    assert rejected(document, synthetic_glossary, schema) == [
        {
            "code": "FIELD_COMPARISON_NOT_ALLOWED",
            "path": f"{C0}/left",
            "nodeId": "c1",
            "params": {"field": "days_open"},
        },
        {
            "code": "FIELD_COMPARISON_NOT_ALLOWED",
            "path": f"{C0}/right",
            "nodeId": "c1",
            "params": {"field": "days_open"},
        },
    ]


def test_two_fields_of_different_types(synthetic_glossary: Glossary, schema: DefinitionSchema) -> None:
    document = definition("ticket", all_of(cond("c1", "priority", "lt", right=ref("opened_on"))))
    assert rejected(document, synthetic_glossary, schema) == [
        {
            "code": "FIELD_TYPE_MISMATCH",
            "path": f"{C0}/right",
            "nodeId": "c1",
            "params": {"leftType": "number", "rightType": "date"},
        }
    ]


def test_field_can_be_compared_with_a_field_on_a_path(synthetic_glossary: Glossary, schema: DefinitionSchema) -> None:
    document = definition("ticket", all_of(cond("c1", "priority", "gt", right=ref("capacity", ["ticket.queue"]))))
    condition = validate_definition(document, synthetic_glossary, schema).where.children[0]
    assert isinstance(condition, VCondition)
    assert condition.right is not None
    assert condition.right.entity.key == "queue"


# --- limits, each read from the glossary and exceeded by one -------------------------------------------------


def test_depth_at_the_limit_is_valid_and_one_more_is_too_deep(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    limit = synthetic_glossary.limits.max_depth
    validate_definition(definition("ticket", nested(limit)), synthetic_glossary, schema)
    assert rejected(definition("ticket", nested(limit + 1)), synthetic_glossary, schema) == [
        {"code": "TOO_DEEP", "path": "/where", "params": {"max": limit, "actual": limit + 1}}
    ]


def test_where_group_of_a_related_node_counts_one_level(synthetic_glossary: Glossary, schema: DefinitionSchema) -> None:
    limit = synthetic_glossary.limits.max_depth

    def under_related(depth_inside: int) -> dict[str, Any]:
        return definition("queue", all_of(related("r1", "queue.tickets", "any", nested(depth_inside))))

    validate_definition(under_related(limit - 1), synthetic_glossary, schema)
    assert rejected(under_related(limit), synthetic_glossary, schema)[0]["params"] == {
        "max": limit,
        "actual": limit + 1,
    }


def test_condition_count_at_the_limit_is_valid_and_one_more_is_too_many(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    limit = synthetic_glossary.limits.max_conditions

    def with_nodes(count: int) -> dict[str, Any]:
        # Related nodes count like conditions, and so do the conditions inside them.
        inner = related("r1", "queue.tickets", "any", all_of(cond("c1", "title", "eq", "x")))
        rest = [cond(f"c{n}", "name", "eq", "x") for n in range(2, count)]
        return definition("queue", all_of(inner, any_of(*rest[:20]), *rest[20:]))

    validate_definition(with_nodes(limit), synthetic_glossary, schema)
    assert rejected(with_nodes(limit + 1), synthetic_glossary, schema) == [
        {"code": "TOO_MANY_CONDITIONS", "path": "/where", "params": {"max": limit, "actual": limit + 1}}
    ]


def test_list_longer_than_the_glossary_allows(glossary_document: dict[str, Any], schema: DefinitionSchema) -> None:
    short_lists = doctored(glossary_document, lambda d: d["limits"].update(maxListValues=3))
    validate_definition(
        definition("ticket", all_of(cond("c1", "priority", "in", values=[1, 2, 3]))), short_lists, schema
    )
    document = definition("ticket", all_of(cond("c1", "priority", "in", values=[1, 2, 3, 4])))
    assert rejected(document, short_lists, schema) == [
        {
            "code": "TOO_MANY_VALUES",
            "path": f"{C0}/values",
            "nodeId": "c1",
            "params": {"limit": "list", "max": 3, "actual": 4},
        }
    ]


def test_total_of_values_at_the_limit_is_valid_and_one_more_is_too_many(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    limit = synthetic_glossary.limits.max_total_values
    per_list = synthetic_glossary.limits.max_list_values

    def with_values(total: int) -> dict[str, Any]:
        """`total` literals: full lists inside a related node (sub-trees count), single values for the rest."""
        lists, singles = divmod(total, per_list)
        inside = [cond(f"l{n}", "priority", "in", values=list(range(per_list))) for n in range(lists)]
        nodes = [related("r1", "queue.tickets", "any", all_of(*inside))]
        nodes += [cond(f"s{n}", "capacity", "gt", n) for n in range(singles)]
        # A field on the right counts nothing.
        nodes.append(cond("f1", "capacity", "gt", right=ref("capacity", ["queue.twin"])))
        return definition("queue", all_of(*nodes))

    validate_definition(with_values(limit), synthetic_glossary, schema)
    assert rejected(with_values(limit + 1), synthetic_glossary, schema) == [
        {"code": "TOO_MANY_VALUES", "path": "/where", "params": {"limit": "total", "max": limit, "actual": limit + 1}}
    ]


# --- node ids -------------------------------------------------------------------------------------------------


def test_every_node_after_the_first_that_carries_an_id_is_reported(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    document = definition(
        "queue",
        all_of(
            cond("x1", "name", "eq", "a"),
            related("x1", "queue.tickets", "any", all_of(cond("x1", "title", "eq", "b"))),
            cond("c9", "name", "eq", "c"),
        ),
    )
    assert rejected(document, synthetic_glossary, schema) == [
        {"code": "DUPLICATE_NODE_ID", "path": f"{C1}/id", "params": {"id": "x1"}},
        {"code": "DUPLICATE_NODE_ID", "path": f"{C1}/where/children/0/id", "params": {"id": "x1"}},
    ]


# --- the resolved tree ----------------------------------------------------------------------------------------


def test_resolved_tree_keeps_the_shape_and_the_document(synthetic_glossary: Glossary, schema: DefinitionSchema) -> None:
    document = definition(
        "ticket",
        any_of(
            all_of(cond("c1", "state", "eq", "open"), cond("c2", "summary", "is_empty")),
            cond("c3", "priority", "is_null"),
        ),
    )
    untouched = copy.deepcopy(document)
    validated = validate_definition(document, synthetic_glossary, schema)
    assert validated.root.key == "ticket"
    assert validated.where.op == "or"
    first, second = validated.where.children
    assert isinstance(first, VGroup)
    assert first.op == "and"
    assert isinstance(second, VCondition)
    assert (second.id, second.operator.key, second.operand) == ("c3", "is_null", None)
    assert [node.id for node in validated.matchable()] == ["c1", "c2", "c3"]
    assert validated.document == untouched


def test_list_limit_is_checked_even_when_the_field_is_unknown(
    glossary_document: dict[str, Any], schema: DefinitionSchema
) -> None:
    short_lists = doctored(glossary_document, lambda d: d["limits"].update(maxListValues=3))
    document = definition("ticket", all_of(cond("c1", "no_such_field", "in", values=[1, 2, 3, 4])))
    assert codes_and_paths(rejected(document, short_lists, schema)) == [
        ("UNKNOWN_FIELD", f"{C0}/left"),
        ("TOO_MANY_VALUES", f"{C0}/values"),
    ]


@pytest.mark.parametrize("values", [[1, 2, 1], [1, 1.0], ["a", "b", "a"]], ids=str)
def test_list_that_holds_an_item_twice_is_a_schema_violation(
    values: list[Any], synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    document = definition("ticket", all_of(cond("c1", "priority", "in", values=values)))
    assert rejected(document, synthetic_glossary, schema) == [
        {"code": "SCHEMA_VIOLATION", "path": f"{C0}/values", "nodeId": "c1", "params": {}}
    ]


def test_number_and_its_spelling_as_text_are_two_items(synthetic_glossary: Glossary, schema: DefinitionSchema) -> None:
    document = definition("ticket", all_of(cond("c1", "priority", "in", values=[1, "1"])))
    # Unique for the schema; the text is then refused as a value of a number field.
    assert codes_and_paths(rejected(document, synthetic_glossary, schema)) == [("VALUE_TYPE_MISMATCH", f"{C0}/values")]


@pytest.mark.parametrize("field", ["title", "state", "opened_on"])
def test_string_that_is_not_text_is_not_a_value(
    field: str, synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    """JSON can carry half of a surrogate pair. It is refused as a value: it could be neither bound nor shown."""
    half_a_pair = "x" + chr(0xD800)
    document = definition("ticket", all_of(cond("c1", field, "eq", half_a_pair)))
    errors = rejected(document, synthetic_glossary, schema)
    assert codes_and_paths(errors) == [("VALUE_TYPE_MISMATCH", f"{C0}/value")]
    assert set(errors[0]["params"]) == {"field", "type"}  # the value is not echoed
