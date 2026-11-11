"""The compiler as a function: a definition and a glossary in, SQL text and parameters out. No database.

The invariants run on the contract's examples and on definitions generated from the real and from the synthetic
glossary, so they hold for entities the engine has never heard of.
"""

from __future__ import annotations

import re
from datetime import date
from decimal import Decimal
from typing import Any

import pytest
from sqlalchemy import Select

from app.compiler import (
    MAX_PARAMETERS,
    CompiledPlan,
    compile_definition,
    escape_like,
    parameter_count,
    render_statement,
    unsupported,
)
from app.compiler.computed import COMPUTED
from app.compiler.operators import OPERATORS
from app.errors import DefinitionInvalid
from app.glossary import COMPUTED_FUNCTIONS, OPERATOR_KEYS, Glossary, parse_glossary
from app.validator import DefinitionSchema, validate_definition
from tests.builders import all_of, any_of, cond, definition, ref, related
from tests.conftest import example_files, read_json
from tests.generated import NODE_ID, generated_definitions
from tests.synthetic import synthetic_document

RUN_DATE = date(2026, 11, 1)
ROW_CAP = 5000
INJECTIONS = [
    "'; DROP TABLE hr.Employee; --",
    "' OR '1'='1",
    "x'); DELETE FROM hr.Employee WHERE ('1'='1",
    "%' UNION SELECT name FROM sys.tables --",
    "]; EXEC xp_cmdshell 'dir' --",
]

TABLE = re.compile(r"([A-Za-z_]\w*)\.(\[[^\]]+\]|\w+) AS (e\d+)")
ALIAS_COLUMN = re.compile(r"\b(e\d+)\.(\[[^\]]+\]|\w+)")
SUBQUERY_COLUMN = re.compile(r"\bq\.(\w+)")
STRING_LITERAL = re.compile(r"'[^']*'")
NUMBER = re.compile(r"(?<![\w:.\[])\d+(?![\w\]])")


def compiled(document: dict[str, Any], glossary: Glossary, schema: DefinitionSchema) -> CompiledPlan:
    return compile_definition(validate_definition(document, glossary, schema), glossary)


def texts(plan: CompiledPlan, run_date: date = RUN_DATE, cap: int = ROW_CAP) -> tuple[str, str, dict[str, Any]]:
    parameters = plan.parameters(run_date)
    page = render_statement(plan.page_statement(cap), parameters)
    count = render_statement(plan.count, parameters)
    values = {item.name: item.value for item in (*page.parameters, *count.parameters)}
    return page.sql, count.sql, values


def where_clause(sql: str) -> str:
    """The WHERE of the inner select: what decides that a record is a violation."""
    root_from = sql.rindex(" AS e0")  # the FROM of the inner select; subqueries read later aliases
    start = sql.index("\nWHERE ", root_from) + len("\nWHERE ")
    return sql[start:].rsplit(") AS q", 1)[0]


def unquoted(name: str) -> str:
    return name.strip("[]")


def assert_invariants(plan: CompiledPlan, glossary: Glossary, caller_strings: list[str]) -> None:
    """Design I, Invariants: a single SELECT, no literal, no caller string, only identifiers of the glossary."""
    known_tables = {(table.schema, table.name): set(table.c.keys()) for table in glossary.tables.values()}
    assert isinstance(plan.page, Select)
    assert isinstance(plan.count, Select)
    page, count, _ = texts(plan)
    for sql in (page, count):
        assert ";" not in sql
        assert "--" not in sql
        assert (
            sql.count("SELECT") >= 2
        )  # the outer select and the inner one; EXISTS adds more, never a second statement
        for caller_string in caller_strings:
            assert caller_string not in sql
        # The only literals, all written by SQLAlchemy and none a caller's: the LIKE wildcard and the escape
        # character, the 1 and 0 of the flags, and the row cap.
        assert set(STRING_LITERAL.findall(sql)) <= {"'%'", "'/'"}
        assert set(NUMBER.findall(sql)) <= {"0", "1", str(ROW_CAP)}
        aliases: dict[str, set[str]] = {}
        for schema_name, table_name, alias in TABLE.findall(sql):
            assert (schema_name, unquoted(table_name)) in known_tables, (
                f"{schema_name}.{table_name} is not in the glossary"
            )
            aliases[alias] = known_tables[(schema_name, unquoted(table_name))]
        for alias, column in ALIAS_COLUMN.findall(sql):
            assert unquoted(column) in aliases[alias], f"{alias}.{column} is not a column the glossary names"
        assert all(re.fullmatch(r"k|[datm]\d+", label) for label in SUBQUERY_COLUMN.findall(sql))


# --- invariants -----------------------------------------------------------------------------------------------


@pytest.mark.parametrize("path", example_files(), ids=lambda path: path.stem)
def test_invariants_hold_for_every_example(path: Any, glossary: Glossary, schema: DefinitionSchema) -> None:
    example = read_json(path)
    plan = compiled(example["definition"], glossary, schema)
    node_ids = [node.node_id for node in plan.nodes]
    assert_invariants(plan, glossary, [])
    # The ids of the examples are short (`c1`), so they are looked for as whole words.
    page, count, _ = texts(plan)
    for node_id in node_ids:
        assert not re.search(rf"\b{re.escape(node_id)}\b", page + count)


def test_invariants_hold_for_definitions_generated_from_the_real_glossary(
    glossary: Glossary, schema: DefinitionSchema
) -> None:
    generated = list(generated_definitions(glossary))
    assert len(generated) > 36, "a few dozen at least"
    for _label, document in generated:
        assert_invariants(compiled(document, glossary, schema), glossary, [NODE_ID])


def test_invariants_hold_for_a_glossary_the_engine_has_never_seen(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    generated = list(generated_definitions(synthetic_glossary))
    assert len(generated) > 36
    kinds = " ".join(label for label, _ in generated)
    assert " via " in kinds and " any " in kinds and " none " in kinds
    for _label, document in generated:
        assert_invariants(compiled(document, synthetic_glossary, schema), synthetic_glossary, [NODE_ID])


def test_compiler_implements_exactly_the_closed_lists_of_the_glossary_module(glossary: Glossary) -> None:
    assert set(OPERATORS) == OPERATOR_KEYS
    assert set(COMPUTED) == COMPUTED_FUNCTIONS
    assert unsupported(glossary) == []


def test_glossary_that_asks_for_more_than_the_compiler_has_is_reported(glossary_document: dict[str, Any]) -> None:
    document = synthetic_document(glossary_document)
    computed = next(field for field in document["entities"][0]["fields"] if "computed" in field)
    computed["operators"] = ["eq", "contains"]
    computed["comparable"] = True
    gaps = unsupported(parse_glossary(document))
    assert gaps == [
        f"field ticket.{computed['key']}: operator contains",
        f"field ticket.{computed['key']}: a computed field must be marked comparable: false",
    ]


# --- injection: a caller's text is bound, never written -------------------------------------------------------


@pytest.mark.parametrize("attack", INJECTIONS)
def test_injection_text_appears_only_in_the_parameters(
    attack: str, synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    document = definition(
        "queue",
        all_of(
            cond("c1", "name", "eq", attack),
            cond("c2", "name", "in", values=[attack, "plain"]),
            cond("c3", "name", "contains", attack),
            cond("c4", "name", "not_contains", attack),
            cond("c5", "name", "starts_with", attack),
            cond("c6", "name", "ends_with", attack),
            cond("c7", "name", "eq", attack, path=["queue.site"]),
            related("r1", "queue.tickets", "any", all_of(cond("c8", "title", "ne", attack))),
        ),
    )
    plan = compiled(document, synthetic_glossary, schema)
    assert_invariants(plan, synthetic_glossary, [attack, "DROP", "UNION", "DELETE", "xp_cmdshell"])
    _, _, values = texts(plan)
    held = [value for name, value in values.items() if name not in ("one", "zero")]
    # Eight operand positions and one harmless list item: each a parameter, the LIKE ones escaped.
    assert sorted(held) == sorted([attack] * 4 + [escape_like(attack)] * 4 + ["plain"])


def test_node_id_or_key_that_carries_sql_never_reaches_the_compiler(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    for document in (
        definition("queue", all_of(cond("c1; DROP TABLE x", "name", "eq", "x"))),
        definition("queue; DROP TABLE x", all_of(cond("c1", "name", "eq", "x"))),
        definition("queue", all_of(cond("c1", "name; DROP TABLE x", "eq", "x"))),
        definition("queue", all_of(cond("c1", "name", "eq", "x", path=["queue.site; DROP TABLE x"]))),
    ):
        with pytest.raises(DefinitionInvalid) as raised:
            compiled(document, synthetic_glossary, schema)
        assert {error.code for error in raised.value.errors} == {"SCHEMA_VIOLATION"}


# --- LIKE -----------------------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("operand", "escaped"),
    [
        ("50%", "50/%"),
        ("a_b", "a/_b"),
        ("[a-z]", "/[a-z]"),
        ("1/2", "1//2"),
        ("%_[/", "/%/_/[//"),
        ("plain", "plain"),
        ("", ""),
    ],
)
def test_like_operand_is_made_literal(operand: str, escaped: str) -> None:
    assert escape_like(operand) == escaped


@pytest.mark.parametrize(
    ("operator", "expected"),
    [
        ("contains", "(e0.title LIKE '%' + :p0 + '%' ESCAPE '/')"),
        ("not_contains", "(e0.title NOT LIKE '%' + :p0 + '%' ESCAPE '/')"),
        ("starts_with", "(e0.title LIKE :p0 + '%' ESCAPE '/')"),
        ("ends_with", "(e0.title LIKE '%' + :p0 ESCAPE '/')"),
    ],
)
def test_like_operators_bind_the_escaped_operand(
    operator: str, expected: str, synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    plan = compiled(definition("ticket", all_of(cond("c1", "title", operator, "50%_[x]"))), synthetic_glossary, schema)
    page, _, values = texts(plan)
    assert where_clause(page) == expected
    assert values["p0"] == "50/%/_/[x]"


# --- operators ------------------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("node", "expected", "parameters"),
    [
        (cond("c1", "priority", "eq", 7), "e0.priority = :p0", {"p0": 7}),
        (cond("c1", "priority", "ne", 7.5), "e0.priority != :p0", {"p0": 7.5}),
        (cond("c1", "priority", "lt", 7), "e0.priority < :p0", {"p0": 7}),
        (cond("c1", "priority", "lte", 7), "e0.priority <= :p0", {"p0": 7}),
        (cond("c1", "priority", "gt", 7), "e0.priority > :p0", {"p0": 7}),
        (cond("c1", "priority", "gte", 7), "e0.priority >= :p0", {"p0": 7}),
        (cond("c1", "priority", "between", values=[1, 9]), "e0.priority BETWEEN :p0 AND :p1", {"p0": 1, "p1": 9}),
        (
            cond("c1", "opened_on", "not_between", values=["2026-01-01", "2026-12-31"]),
            "e0.opened_on NOT BETWEEN :p0 AND :p1",
            {"p0": "2026-01-01", "p1": "2026-12-31"},
        ),
        (
            cond("c1", "state", "in", values=["open", "closed"]),
            "e0.state IN (:p0_1, :p0_2)",
            {"p0_1": "open", "p0_2": "closed"},
        ),
        (
            cond("c1", "priority", "not_in", values=[1, 2.5]),
            "(e0.priority NOT IN (:p0_1, :p0_2))",
            {"p0_1": 1, "p0_2": 2.5},
        ),
        (cond("c1", "priority", "is_null"), "e0.priority IS NULL", {}),
        (cond("c1", "priority", "is_not_null"), "e0.priority IS NOT NULL", {}),
        (cond("c1", "summary", "is_empty"), "e0.summary IS NULL OR e0.summary = :p0", {"p0": ""}),
        (cond("c1", "summary", "is_not_empty"), "e0.summary IS NOT NULL AND e0.summary != :p0", {"p0": ""}),
        (cond("c1", "closed_on", "lt", right=ref("opened_on")), "e0.closed_on < e0.opened_on", {}),
    ],
)
def test_each_operator_compiles_to_its_expression(
    node: dict[str, Any],
    expected: str,
    parameters: dict[str, Any],
    synthetic_glossary: Glossary,
    schema: DefinitionSchema,
) -> None:
    plan = compiled(definition("ticket", all_of(node)), synthetic_glossary, schema)
    page, _, values = texts(plan)
    assert where_clause(page) == expected
    assert {name: value for name, value in values.items() if name not in ("one", "zero")} == parameters


def test_literals_are_bound_with_the_type_of_their_value(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    document = definition(
        "ticket",
        all_of(
            cond("c1", "priority", "gt", 7),
            cond("c2", "priority", "gt", 7.5),
            cond("c3", "title", "eq", "x"),
            cond("c4", "state", "eq", "open"),
            cond("c5", "opened_on", "lt", "2026-01-01"),
            cond("c6", "enabled", "eq", False, path=["ticket.queue"]),
            cond("c7", "priority", "in", values=[1, 2.5]),
        ),
    )
    plan = compiled(document, synthetic_glossary, schema)
    rendered = render_statement(plan.page_statement(ROW_CAP), plan.parameters(RUN_DATE))
    types = {item.name: item.type for item in rendered.parameters}
    assert [types[f"p{n}"] for n in range(6)] == ["Integer", "Numeric", "Unicode", "Unicode", "Date", "Boolean"]
    assert (types["p6_1"], types["p6_2"]) == ("Numeric", "Numeric")
    assert plan.parameters(RUN_DATE)["p1"] == Decimal("7.5")


def test_boolean_is_compared_through_a_parameter_never_inline(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    plan = compiled(definition("queue", all_of(cond("c1", "enabled", "eq", False))), synthetic_glossary, schema)
    page, _, values = texts(plan)
    assert where_clause(page) == "e0.enabled = :p0"
    assert values["p0"] is False


# --- joins and related nodes ----------------------------------------------------------------------------------


def test_parent_is_joined_with_a_left_outer_join_once_per_path(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    document = definition(
        "ticket",
        any_of(
            cond("c1", "name", "eq", "a", path=["ticket.queue"]),
            cond("c2", "capacity", "gt", 3, path=["ticket.queue"]),
            cond("c3", "enabled", "eq", False, path=["ticket.queue", "queue.site"]),
            cond("c4", "summary", "is_empty"),
        ),
    )
    page, count, _ = texts(compiled(document, synthetic_glossary, schema))
    joins = (
        "FROM ops.[Ticket] AS e0 LEFT OUTER JOIN ops.[Queue] AS e1 ON e0.queue_id = e1.queue_id "
        "LEFT OUTER JOIN ops.[Site] AS e2 ON e1.site_id = e2.site_id"
    )
    assert joins in page and joins in count
    assert " JOIN " not in page.replace("LEFT OUTER JOIN", "")
    assert (
        where_clause(page)
        == "e1.name = :p0 OR e1.capacity > :p1 OR e2.enabled = :p2 OR e0.summary IS NULL OR e0.summary = :p3"
    )


def test_related_node_is_a_correlated_exists_and_never_a_join(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    inner = all_of(cond("c2", "state", "eq", "open"), cond("c3", "name", "eq", "x", path=["ticket.queue"]))
    for quantifier, opening in (("any", "EXISTS (SELECT *"), ("none", "NOT (EXISTS (SELECT *")):
        document = definition("queue", all_of(related("r1", "queue.tickets", quantifier, inner)))
        plan = compiled(document, synthetic_glossary, schema)
        page, _, _ = texts(plan)
        assert where_clause(page).startswith(opening)
        assert (
            "FROM ops.[Ticket] AS e1 LEFT OUTER JOIN ops.[Queue] AS e2 ON e1.queue_id = e2.queue_id \n"
            "WHERE e1.queue_id = e0.queue_id AND e1.state = :p0 AND e2.name = :p1" in page
        )
        assert "FROM ops.[Queue] AS e0 \nWHERE" in page
        # Only the related node itself can be matched; the conditions inside it get no column.
        assert [node.node_id for node in plan.nodes] == ["r1"]
        assert plan.nodes[0].actual is None


def test_related_node_inside_a_related_node_correlates_to_the_one_around_it(
    glossary_document: dict[str, Any], schema: DefinitionSchema
) -> None:
    document = synthetic_document(glossary_document)
    next(entity for entity in document["entities"] if entity["key"] == "site")["rootable"] = True
    sites_as_roots = parse_glossary(document)
    nested = definition(
        "site",
        all_of(
            related(
                "r1",
                "site.queues",
                "any",
                all_of(
                    cond("c1", "enabled", "eq", True),
                    related("r2", "queue.tickets", "none", all_of(cond("c2", "state", "eq", "open"))),
                ),
            )
        ),
    )
    plan = compiled(nested, sites_as_roots, schema)
    page, _, _ = texts(plan)
    assert where_clause(page) == (
        "EXISTS (SELECT * \nFROM ops.[Queue] AS e1 \n"
        "WHERE e1.site_id = e0.site_id AND e1.enabled = :p0 AND NOT (EXISTS (SELECT * \nFROM ops.[Ticket] AS e2 \n"
        "WHERE e2.queue_id = e1.queue_id AND e2.state = :p1)))"
    )
    assert [node.node_id for node in plan.nodes] == ["r1"]
    assert_invariants(plan, sites_as_roots, [])


# --- matched --------------------------------------------------------------------------------------------------


def test_matched_flag_holds_the_node_and_every_group_above_it_but_the_root(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    document = definition(
        "ticket",
        any_of(
            all_of(cond("c1", "state", "eq", "open"), cond("c2", "summary", "is_empty")),
            cond("c3", "priority", "is_null"),
        ),
    )
    plan = compiled(document, synthetic_glossary, schema)
    page, count, _ = texts(plan)
    assert [(node.node_id, node.matched) for node in plan.nodes] == [("c1", "m0"), ("c2", "m1"), ("c3", "m2")]
    assert "CASE WHEN (q.t0 = 1 AND q.t0 = 1 AND q.t1 = 1) THEN 1 ELSE 0 END AS m0" in page
    assert "CASE WHEN (q.t1 = 1 AND q.t0 = 1 AND q.t1 = 1) THEN 1 ELSE 0 END AS m1" in page
    assert "CASE WHEN (q.t2 = 1) THEN 1 ELSE 0 END AS m2" in page
    assert "sum(CASE WHEN (q.t2 = 1) THEN 1 ELSE 0 END) AS m2" in count
    assert count.startswith("SELECT count(*) AS total, sum(")
    assert page.rstrip().endswith("AS q ORDER BY q.k")


def test_conditions_on_one_field_share_one_actual_column(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    document = definition(
        "ticket",
        all_of(
            cond("c1", "priority", "gt", 1),
            cond("c2", "priority", "lt", 9),
            cond("c3", "closed_on", "lt", right=ref("opened_on")),
            cond("c4", "days_open", "gte", 2),
        ),
    )
    plan = compiled(document, synthetic_glossary, schema)
    by_id = {node.node_id: node for node in plan.nodes}
    assert by_id["c1"].actual == by_id["c2"].actual
    assert by_id["c3"].actual is not None and by_id["c3"].right_actual is not None
    # The computed field reads its source column, the same one `c3` compares with, and says how to turn it.
    assert by_id["c4"].actual is not None
    assert by_id["c4"].actual.label == by_id["c3"].right_actual.label
    assert (by_id["c4"].actual.computed, by_id["c3"].right_actual.computed) == ("age_years", None)
    assert [key for key, _ in plan.display] == ["title", "number"]


# --- one plan, many runs --------------------------------------------------------------------------------------


def test_one_plan_serves_two_run_dates_and_two_caps(synthetic_glossary: Glossary, schema: DefinitionSchema) -> None:
    document = definition("ticket", all_of(cond("c1", "days_open", "lt", 18), cond("c2", "priority", "gt", 3)))
    plan = compiled(document, synthetic_glossary, schema)
    first, second = plan.parameters(date(2026, 11, 1)), plan.parameters(date(2026, 10, 31))
    assert (first["p0"], second["p0"]) == (date(2008, 11, 1), date(2008, 10, 31))
    assert {name for name in first if first[name] != second[name]} == {"p0"}

    one_row = render_statement(plan.page_statement(1), first).sql
    capped = render_statement(plan.page_statement(5000), first).sql
    assert one_row.startswith("SELECT TOP 1 q.k")
    assert capped.startswith("SELECT TOP 5000 q.k")
    assert one_row.replace("TOP 1 ", "TOP 5000 ") == capped
    assert "TOP" not in render_statement(plan.page, first).sql, "the plan itself holds no cap"


def sent_by(plan: CompiledPlan) -> set[int]:
    parameters = plan.parameters(RUN_DATE)
    return {parameter_count(statement, parameters) for statement in (plan.page_statement(ROW_CAP), plan.count)}


def test_only_caller_values_are_parameters_each_sent_twice(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    document = definition("ticket", all_of(cond("c1", "priority", "gt", 3), cond("c2", "state", "in", values=["open"])))
    assert sent_by(compiled(document, synthetic_glossary, schema)) == {4}


def test_parameter_count_does_not_grow_with_depth_or_with_the_number_of_conditions(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    limits = synthetic_glossary.limits
    node = any_of(*[cond(f"c{n}", "priority", "gt", n) for n in range(limits.max_conditions)])
    for _ in range(limits.max_depth - 1):
        node = all_of(node)
    # The deepest and widest tree the limits allow: thirty values, each in its flag and in the WHERE.
    assert sent_by(compiled(definition("ticket", node), synthetic_glossary, schema)) == {2 * limits.max_conditions}


def test_definition_at_the_total_values_limit_stays_under_the_parameter_cap(
    synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    per_list = synthetic_glossary.limits.max_list_values
    lists = synthetic_glossary.limits.max_total_values // per_list
    for field, per_value in (("priority", 2), ("days_open", 4)):
        # A list on the computed field is the worst case there is: every value is two dates.
        conditions = [cond(f"c{n}", field, "in", values=list(range(per_list))) for n in range(lists)]
        plan = compiled(definition("ticket", any_of(*conditions)), synthetic_glossary, schema)
        assert sent_by(plan) == {per_value * per_list * lists}
        assert max(sent_by(plan)) <= MAX_PARAMETERS < 2100


def test_glossary_whose_limits_could_pass_the_parameter_cap_is_reported(glossary_document: dict[str, Any]) -> None:
    document = synthetic_document(glossary_document)
    document["limits"]["maxTotalValues"] = MAX_PARAMETERS // 4 + 1
    assert unsupported(parse_glossary(document)) == [
        f"limits.maxTotalValues above {MAX_PARAMETERS // 4}: a statement could pass {MAX_PARAMETERS} parameters"
    ]
