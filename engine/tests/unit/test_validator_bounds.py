"""The validator against documents far beyond any limit: one request must not crash it or buy seconds of work.

These came out of the phase 2 review (a recursion crash) and of the security audit (quadratic work in the schema
library). Everything runs against the synthetic glossary.
"""

from __future__ import annotations

from typing import Any

import pytest

from app.glossary import Glossary
from app.validator import DefinitionSchema
from tests.builders import all_of, any_of, cond, definition, related
from tests.unit.validation import C0, codes_and_paths, nested, rejected

# --- documents nested far beyond any limit --------------------------------------------------------------------


@pytest.mark.parametrize("depth", [33, 170, 400, 5000])
def test_groups_nested_far_beyond_the_limit_are_too_deep_and_not_a_crash(
    depth: int, synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    assert rejected(definition("ticket", nested(depth)), synthetic_glossary, schema) == [
        {
            "code": "TOO_DEEP",
            "path": "/where",
            "params": {"max": synthetic_glossary.limits.max_depth, "actual": depth},
        }
    ]


def test_related_nodes_nested_far_beyond_the_limit_are_too_deep(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    node = all_of(cond("c1", "title", "eq", "x"))
    for level in range(300):
        node = all_of(related(f"r{level}", "queue.tickets", "any", node))
    errors = rejected(definition("queue", node), synthetic_glossary, schema)
    # 301 groups on the chain (the innermost one, and one around each of the 300 related nodes) and 301 nodes:
    # both limits are passed many times over, and both are named.
    assert codes_and_paths(errors) == [("TOO_DEEP", "/where"), ("TOO_MANY_CONDITIONS", "/where")]
    assert (errors[0]["params"]["actual"], errors[1]["params"]["actual"]) == (301, 301)


def test_schema_errors_still_come_first_for_a_tree_that_is_merely_too_deep(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    document = definition("ticket", nested(synthetic_glossary.limits.max_depth + 3))
    document["extra"] = True
    assert codes_and_paths(rejected(document, synthetic_glossary, schema)) == [("SCHEMA_VIOLATION", "")]


@pytest.mark.parametrize("depth", [100, 900, 5000])
def test_junk_nested_thousands_of_levels_deep_is_a_schema_violation_and_not_a_crash(
    depth: int, synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    def deep_list() -> Any:
        value: Any = 1
        for _ in range(depth):
            value = [value]
        return value

    in_values = definition("ticket", all_of(cond("c1", "priority", "in", values=[deep_list(), deep_list()])))
    assert ("SCHEMA_VIOLATION", f"{C0}/values/0") in codes_and_paths(rejected(in_values, synthetic_glossary, schema))

    in_a_reference = definition("ticket", all_of(cond("c1", "priority", "is_null")))
    in_a_reference["where"]["children"][0]["left"]["extra"] = deep_list()
    assert codes_and_paths(rejected(in_a_reference, synthetic_glossary, schema)) == [("SCHEMA_VIOLATION", f"{C0}/left")]


# --- a single request must not be able to buy seconds of work ------------------------------------------------


def test_list_of_any_length_costs_no_more_than_the_longest_valid_one(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    """The schema library compares every pair of a list it cannot sort; a string among 150,000 numbers took hours."""
    document = definition("ticket", all_of(cond("c1", "priority", "in", values=["x", *range(150_000)])))
    assert rejected(document, synthetic_glossary, schema) == [
        {"code": "TOO_MANY_VALUES", "path": "/where", "params": {"limit": "total", "max": 500, "actual": 150_001}}
    ]
    # Below the point where a tree is answered by its limits alone, the schema is asked, and answers at once.
    document = definition("ticket", all_of(cond("c1", "priority", "in", values=["x", *range(3_000)])))
    assert rejected(document, synthetic_glossary, schema) == [
        {"code": "SCHEMA_VIOLATION", "path": f"{C0}/values", "nodeId": "c1", "params": {}}
    ]


def test_group_with_too_many_children_reports_no_more_than_the_longest_valid_list_could(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    def with_children(count: int) -> dict[str, Any]:
        return definition("ticket", {"type": "group", "op": "and", "children": [{"type": "group"}] * count})

    errors = rejected(with_children(200), synthetic_glossary, schema)
    assert errors[0] == {"code": "SCHEMA_VIOLATION", "path": "/where/children", "params": {}}
    assert len(errors) == 102  # the list itself, and one per child up to one past the schema's longest list
    # Thousands of them pass the node limit many times over and are answered by the limit alone.
    assert codes_and_paths(rejected(with_children(10_000), synthetic_glossary, schema)) == [
        ("TOO_MANY_CONDITIONS", "/where")
    ]


def test_tree_many_times_past_the_count_limits_is_answered_with_the_limits_alone(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    limits = synthetic_glossary.limits
    lists = [cond(f"c{n}", "priority", "in", values=["x", *range(100)]) for n in range(2400)]
    groups = [any_of(*lists[start : start + 30]) for start in range(0, len(lists), 30)]
    document = definition("ticket", any_of(*[any_of(*groups[start : start + 30]) for start in range(0, 80, 30)]))
    assert rejected(document, synthetic_glossary, schema) == [
        {"code": "TOO_MANY_CONDITIONS", "path": "/where", "params": {"max": limits.max_conditions, "actual": 2400}},
        {
            "code": "TOO_MANY_VALUES",
            "path": "/where",
            "params": {"limit": "total", "max": limits.max_total_values, "actual": 2400 * 101},
        },
    ]


def test_tree_a_few_times_past_a_limit_still_gets_its_schema_errors_first(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    many = [cond(f"c{n}", "priority", "gt", n) for n in range(3 * synthetic_glossary.limits.max_conditions)]
    document = definition("ticket", any_of(*[any_of(*many[start : start + 30]) for start in range(0, len(many), 30)]))
    document["where"]["children"][0]["children"][0]["operator"] = "sounds_like"
    assert codes_and_paths(rejected(document, synthetic_glossary, schema)) == [
        ("SCHEMA_VIOLATION", "/where/children/0/children/0/operator")
    ]
