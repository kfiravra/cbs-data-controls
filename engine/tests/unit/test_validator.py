"""The validator as a function: a definition in, the resolved tree or codes and paths out.

Hand-written definitions run against the synthetic glossary (tickets and queues), so nothing here leans on a key
of the real one; the real glossary is used with the contract's own examples and fixtures.
"""

from __future__ import annotations

import copy
import re
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from app.errors import DefinitionInvalid
from app.glossary import Glossary, parse_glossary
from app.validator import (
    DEFINITION_ERROR_CODES,
    DefinitionSchema,
    VCondition,
    VGroup,
    VRelated,
    validate_definition,
)
from tests.builders import all_of, any_of, cond, definition, ref, related
from tests.conftest import CONTRACTS_DIR, example_files, invalid_files, read_json
from tests.synthetic import synthetic_document

C0 = "/where/children/0"
C1 = "/where/children/1"


def rejected(document: dict[str, Any], glossary: Glossary, schema: DefinitionSchema) -> list[dict[str, Any]]:
    with pytest.raises(DefinitionInvalid) as raised:
        validate_definition(document, glossary, schema)
    return [error.to_json() for error in raised.value.errors]


def codes_and_paths(errors: list[dict[str, Any]]) -> list[tuple[str, str]]:
    return [(error["code"], error["path"]) for error in errors]


def doctored(glossary_document: dict[str, Any], change: Any) -> Glossary:
    document = synthetic_document(glossary_document)
    change(document)
    return parse_glossary(document)


def nested(depth: int) -> dict[str, Any]:
    """A chain of `depth` groups with one condition at the bottom."""
    node = all_of(cond("c1", "title", "eq", "x"))
    for _ in range(depth - 1):
        node = all_of(node)
    return node


# --- the contract's own examples and fixtures -----------------------------------------------------------------


@pytest.mark.parametrize("path", example_files(), ids=lambda path: path.stem)
def test_every_example_of_the_contract_is_valid(path: Path, glossary: Glossary, schema: DefinitionSchema) -> None:
    example = read_json(path)
    validated = validate_definition(example["definition"], glossary, schema)
    assert validated.root.key == example["definition"]["rootEntity"]
    matched_somewhere = {node_id for violation in example["expected"]["violations"] for node_id in violation["matched"]}
    assert matched_somewhere <= {node.id for node in validated.matchable()}


@pytest.mark.parametrize("path", invalid_files(), ids=lambda path: path.stem)
def test_every_invalid_fixture_is_rejected_where_it_says(
    path: Path, glossary: Glossary, schema: DefinitionSchema
) -> None:
    fixture = read_json(path)
    errors = rejected(fixture["definition"], glossary, schema)
    assert codes_and_paths(errors) == [(fixture["expected"]["code"], fixture["expected"]["path"])]
    assert (errors[0]["code"] == "SCHEMA_VIOLATION") == (fixture["layer"] == "schema")


def test_code_order_is_the_order_of_the_error_catalogue() -> None:
    text = (CONTRACTS_DIR / "errors.md").read_text(encoding="utf-8")
    section = text.split("## Definition error codes", 1)[1].split("\n## ", 1)[0]
    catalogue = re.findall(r"^\| `([A-Za-z_]+)` \|", section, flags=re.MULTILINE)
    assert list(DEFINITION_ERROR_CODES) == catalogue


# --- order of checks ------------------------------------------------------------------------------------------


@pytest.mark.parametrize("version", [2, 0, "1", True, None, 1.5])
def test_other_schema_version_is_the_only_error(
    version: Any, synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    document = {"schemaVersion": version, "rootEntity": "no_such_entity", "where": {"type": "nonsense"}}
    assert rejected(document, synthetic_glossary, schema) == [
        {"code": "UNSUPPORTED_SCHEMA_VERSION", "path": "/schemaVersion", "params": {}}
    ]


def test_missing_schema_version_goes_to_the_schema(synthetic_glossary: Glossary, schema: DefinitionSchema) -> None:
    document = {"rootEntity": "ticket", "where": all_of(cond("c1", "title", "eq", "x"))}
    assert rejected(document, synthetic_glossary, schema) == [{"code": "SCHEMA_VIOLATION", "path": "", "params": {}}]


def test_schema_errors_end_validation_before_the_glossary_is_asked(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    document = definition("no_such_entity", all_of(cond("c1", "no_such_field", "between", values=[1])))
    errors = rejected(document, synthetic_glossary, schema)
    assert codes_and_paths(errors) == [("SCHEMA_VIOLATION", f"{C0}/values")]


def test_schema_errors_come_once_per_path_in_document_order(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    document = definition(
        "ticket",
        all_of(
            {"type": "condition", "id": "c1", "left": {"field": "title", "extra": 1}, "operator": "sounds_like"},
            {"type": "condition", "id": "BAD ID", "left": {"field": "title"}, "operator": "is_empty", "value": 1},
            {"type": "rule"},
        ),
    )
    errors = rejected(document, synthetic_glossary, schema)
    assert codes_and_paths(errors) == [
        ("SCHEMA_VIOLATION", f"{C0}/left"),
        ("SCHEMA_VIOLATION", f"{C0}/operator"),
        ("SCHEMA_VIOLATION", C1),
        ("SCHEMA_VIOLATION", f"{C1}/id"),
        ("SCHEMA_VIOLATION", "/where/children/2/type"),
    ]
    assert [error.get("nodeId") for error in errors] == ["c1", "c1", "BAD ID", "BAD ID", None]
    assert all(error["params"] == {} for error in errors)


def test_semantic_errors_come_together_in_document_order(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    document = definition(
        "ticket",
        all_of(
            cond("c1", "no_such_field", "eq", "x"),
            any_of(cond("c2", "priority", "contains", "high"), cond("c3", "state", "eq", "archived")),
            cond("c4", "name", "eq", "x", path=["ticket.queue", "no.such.relationship"]),
        ),
    )
    assert rejected(document, synthetic_glossary, schema) == [
        {
            "code": "UNKNOWN_FIELD",
            "path": f"{C0}/left",
            "nodeId": "c1",
            "params": {"entity": "ticket", "field": "no_such_field"},
        },
        {
            "code": "OPERATOR_NOT_ALLOWED",
            "path": f"{C1}/children/0/operator",
            "nodeId": "c2",
            "params": {"operator": "contains", "field": "priority", "type": "number"},
        },
        {
            "code": "VALUE_TYPE_MISMATCH",
            "path": f"{C1}/children/0/value",
            "nodeId": "c2",
            "params": {"field": "priority", "type": "number"},
        },
        {
            "code": "UNKNOWN_ENUM_VALUE",
            "path": f"{C1}/children/1/value",
            "nodeId": "c3",
            "params": {"field": "state", "value": "archived"},
        },
        {
            "code": "UNKNOWN_RELATIONSHIP",
            "path": "/where/children/2/left",
            "nodeId": "c4",
            "params": {"relationship": "no.such.relationship"},
        },
    ]


def test_document_order_follows_the_json_text_not_the_schema(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    where_first = {
        "schemaVersion": 1,
        "where": all_of(cond("c1", "no_such_field", "eq", "x")),
        "rootEntity": "site",
    }
    assert codes_and_paths(rejected(where_first, synthetic_glossary, schema)) == [
        ("UNKNOWN_FIELD", f"{C0}/left"),
        ("ENTITY_NOT_ROOTABLE", "/rootEntity"),
    ]


def test_errors_of_one_path_follow_the_catalogue_then_the_index(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    document = definition("ticket", all_of(cond("c1", "state", "in", values=["open", 7, "archived", 9])))
    assert rejected(document, synthetic_glossary, schema) == [
        {
            "code": "VALUE_TYPE_MISMATCH",
            "path": f"{C0}/values",
            "nodeId": "c1",
            "params": {"field": "state", "type": "enum", "index": 1},
        },
        {
            "code": "VALUE_TYPE_MISMATCH",
            "path": f"{C0}/values",
            "nodeId": "c1",
            "params": {"field": "state", "type": "enum", "index": 3},
        },
        {
            "code": "UNKNOWN_ENUM_VALUE",
            "path": f"{C0}/values",
            "nodeId": "c1",
            "params": {"field": "state", "value": "archived", "index": 2},
        },
    ]


# --- the root entity ------------------------------------------------------------------------------------------


def test_unknown_root_entity(synthetic_glossary: Glossary, schema: DefinitionSchema) -> None:
    document = definition("invoice", all_of(cond("c1", "title", "eq", "x")))
    assert rejected(document, synthetic_glossary, schema) == [
        {"code": "UNKNOWN_ENTITY", "path": "/rootEntity", "params": {"entity": "invoice"}}
    ]


def test_hidden_root_entity_is_unknown(synthetic_glossary: Glossary, schema: DefinitionSchema) -> None:
    document = definition("audit", all_of(cond("c1", "note", "eq", "x")))
    assert codes_and_paths(rejected(document, synthetic_glossary, schema)) == [("UNKNOWN_ENTITY", "/rootEntity")]


def test_entity_that_may_not_be_a_root(synthetic_glossary: Glossary, schema: DefinitionSchema) -> None:
    document = definition("site", all_of(cond("c1", "name", "eq", "x")))
    assert rejected(document, synthetic_glossary, schema) == [
        {"code": "ENTITY_NOT_ROOTABLE", "path": "/rootEntity", "params": {"entity": "site"}}
    ]


def test_whole_tree_checks_still_run_under_an_unknown_root(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    document = definition("invoice", all_of(cond("c1", "a", "eq", 1), cond("c1", "b", "eq", 2)))
    assert codes_and_paths(rejected(document, synthetic_glossary, schema)) == [
        ("UNKNOWN_ENTITY", "/rootEntity"),
        ("DUPLICATE_NODE_ID", f"{C1}/id"),
    ]


# --- field references -----------------------------------------------------------------------------------------


def test_field_on_a_two_hop_path_resolves(synthetic_glossary: Glossary, schema: DefinitionSchema) -> None:
    document = definition("ticket", all_of(cond("c1", "enabled", "eq", False, path=["ticket.queue", "queue.site"])))
    condition = validate_definition(document, synthetic_glossary, schema).where.children[0]
    assert isinstance(condition, VCondition)
    assert [hop.key for hop in condition.left.path] == ["ticket.queue", "queue.site"]
    assert (condition.left.entity.key, condition.left.field.key) == ("site", "enabled")
    assert condition.left.ref == {"path": ["ticket.queue", "queue.site"], "field": "enabled"}


def test_one_to_one_relationship_can_be_traversed(synthetic_glossary: Glossary, schema: DefinitionSchema) -> None:
    document = definition("queue", all_of(cond("c1", "name", "eq", "x", path=["queue.twin"])))
    validate_definition(document, synthetic_glossary, schema)


def test_hidden_field_is_unknown(synthetic_glossary: Glossary, schema: DefinitionSchema) -> None:
    document = definition("ticket", all_of(cond("c1", "internal_code", "eq", "x")))
    assert rejected(document, synthetic_glossary, schema) == [
        {
            "code": "UNKNOWN_FIELD",
            "path": f"{C0}/left",
            "nodeId": "c1",
            "params": {"entity": "ticket", "field": "internal_code"},
        }
    ]


def test_field_hidden_by_the_glossary_stops_being_usable(
    glossary_document: dict[str, Any], schema: DefinitionSchema
) -> None:
    document = definition("ticket", all_of(cond("c1", "title", "eq", "x")))
    hidden = doctored(glossary_document, lambda d: d["entities"][0]["fields"][0].update(visible=False))
    assert codes_and_paths(rejected(document, hidden, schema)) == [("UNKNOWN_FIELD", f"{C0}/left")]


def test_field_is_looked_up_on_the_entity_the_path_reaches(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    document = definition("ticket", all_of(cond("c1", "title", "eq", "x", path=["ticket.queue"])))
    assert rejected(document, synthetic_glossary, schema)[0]["params"] == {"entity": "queue", "field": "title"}


def test_relationship_that_does_not_start_where_the_path_stands(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    document = definition("ticket", all_of(cond("c1", "name", "eq", "x", path=["queue.site"])))
    assert rejected(document, synthetic_glossary, schema) == [
        {
            "code": "PATH_NOT_REACHABLE",
            "path": f"{C0}/left",
            "nodeId": "c1",
            "params": {"relationship": "queue.site", "entity": "ticket"},
        }
    ]


def test_second_hop_must_start_at_the_entity_the_first_reaches(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    document = definition("ticket", all_of(cond("c1", "name", "eq", "x", path=["ticket.queue", "ticket.queue"])))
    assert rejected(document, synthetic_glossary, schema)[0]["params"] == {
        "relationship": "ticket.queue",
        "entity": "queue",
    }


def test_one_to_many_relationship_in_a_path(synthetic_glossary: Glossary, schema: DefinitionSchema) -> None:
    document = definition("queue", all_of(cond("c1", "title", "eq", "x", path=["queue.tickets"])))
    assert rejected(document, synthetic_glossary, schema) == [
        {
            "code": "PATH_NOT_TRAVERSABLE",
            "path": f"{C0}/left",
            "nodeId": "c1",
            "params": {"relationship": "queue.tickets"},
        }
    ]


def test_relationship_to_a_hidden_entity_is_unknown(synthetic_glossary: Glossary, schema: DefinitionSchema) -> None:
    document = definition("ticket", all_of(cond("c1", "note", "eq", "x", path=["ticket.audit"])))
    assert codes_and_paths(rejected(document, synthetic_glossary, schema)) == [("UNKNOWN_RELATIONSHIP", f"{C0}/left")]


def test_path_longer_than_the_glossary_allows(glossary_document: dict[str, Any], schema: DefinitionSchema) -> None:
    one_hop = doctored(glossary_document, lambda d: d["limits"].update(maxPathHops=1))
    document = definition("ticket", all_of(cond("c1", "name", "eq", "x", path=["ticket.queue", "queue.site"])))
    assert rejected(document, one_hop, schema) == [
        {"code": "PATH_TOO_LONG", "path": f"{C0}/left", "nodeId": "c1", "params": {"max": 1, "actual": 2}}
    ]


def test_right_field_reference_is_resolved_like_the_left(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    document = definition("ticket", all_of(cond("c1", "closed_on", "lt", right=ref("no_such_field"))))
    assert rejected(document, synthetic_glossary, schema) == [
        {
            "code": "UNKNOWN_FIELD",
            "path": f"{C0}/right",
            "nodeId": "c1",
            "params": {"entity": "ticket", "field": "no_such_field"},
        }
    ]


# --- related nodes --------------------------------------------------------------------------------------------


def test_related_node_validates_its_conditions_in_the_related_entity(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    document = definition(
        "queue",
        all_of(
            cond("c1", "enabled", "eq", True),
            related("r1", "queue.tickets", "none", all_of(cond("c2", "state", "eq", "open"))),
        ),
    )
    validated = validate_definition(document, synthetic_glossary, schema)
    node = validated.where.children[1]
    assert isinstance(node, VRelated)
    assert (node.relationship.key, node.quantifier, node.entity.key) == ("queue.tickets", "none", "ticket")
    assert [matchable.id for matchable in validated.matchable()] == ["c1", "r1"]


def test_field_of_the_outer_entity_is_unknown_inside_a_related_node(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    document = definition(
        "queue", all_of(related("r1", "queue.tickets", "any", all_of(cond("c1", "capacity", "gt", 1))))
    )
    assert rejected(document, synthetic_glossary, schema) == [
        {
            "code": "UNKNOWN_FIELD",
            "path": f"{C0}/where/children/0/left",
            "nodeId": "c1",
            "params": {"entity": "ticket", "field": "capacity"},
        }
    ]


def test_related_node_with_an_unknown_relationship(synthetic_glossary: Glossary, schema: DefinitionSchema) -> None:
    document = definition("queue", all_of(related("r1", "queue.widgets", "any", all_of(cond("c1", "x", "eq", 1)))))
    assert rejected(document, synthetic_glossary, schema) == [
        {
            "code": "UNKNOWN_RELATIONSHIP",
            "path": f"{C0}/relationship",
            "nodeId": "r1",
            "params": {"relationship": "queue.widgets"},
        }
    ]


def test_related_node_whose_relationship_starts_elsewhere(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    document = definition("ticket", all_of(related("r1", "site.queues", "any", all_of(cond("c1", "name", "eq", "x")))))
    assert rejected(document, synthetic_glossary, schema) == [
        {
            "code": "PATH_NOT_REACHABLE",
            "path": f"{C0}/relationship",
            "nodeId": "r1",
            "params": {"relationship": "site.queues", "entity": "ticket"},
        }
    ]


def test_related_node_on_a_relationship_that_is_not_one_to_many(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    document = definition("ticket", all_of(related("r1", "ticket.queue", "any", all_of(cond("c1", "name", "eq", "x")))))
    assert rejected(document, synthetic_glossary, schema) == [
        {
            "code": "RELATIONSHIP_NOT_QUANTIFIABLE",
            "path": f"{C0}/relationship",
            "nodeId": "r1",
            "params": {"relationship": "ticket.queue", "cardinality": "many_to_one"},
        }
    ]


def test_relationship_that_starts_elsewhere_and_is_not_one_to_many_gives_both(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    document = definition("ticket", all_of(related("r1", "queue.site", "any", all_of(cond("c1", "name", "eq", "x")))))
    assert codes_and_paths(rejected(document, synthetic_glossary, schema)) == [
        ("PATH_NOT_REACHABLE", f"{C0}/relationship"),
        ("RELATIONSHIP_NOT_QUANTIFIABLE", f"{C0}/relationship"),
    ]


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
