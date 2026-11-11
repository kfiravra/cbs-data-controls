"""`age_years`: the value, the birth-date ranges a condition on it compiles to, and that the two agree.

The table of plan.md Design D is written out row by row. Its meaning is then checked on real rows: the range
predicates run in an in-memory SQLite (they are plain date comparisons, the same in every SQL) and must select
exactly the people whose age, by the contract's formula, satisfies the operator.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

import pytest
from sqlalchemy import Column, Date, Integer, MetaData, Table, create_engine, literal, select

from app.compiler import age_years, compile_definition, render_statement, years_before
from app.compiler.computed import COMPUTED
from app.glossary import Glossary
from app.validator import DefinitionSchema, validate_definition
from tests.builders import all_of, cond, definition

RUN_DATE = date(2026, 11, 1)
S18, S19, S21, S30, S31 = "2008-11-01", "2007-11-01", "2005-11-01", "1996-11-01", "1995-11-01"
C = "e0.opened_on"


# --- the value ------------------------------------------------------------------------------------------------


def test_age_is_the_contract_example() -> None:
    # contracts/errors.md, Age: born 2008-11-01 is 18 on 2026-11-01 and 17 the day before.
    assert age_years(date(2008, 11, 1), date(2026, 11, 1)) == 18
    assert age_years(date(2008, 11, 1), date(2026, 10, 31)) == 17


@pytest.mark.parametrize(
    ("born", "run_date", "expected"),
    [
        (date(2008, 11, 2), date(2026, 11, 1), 17),
        (date(2008, 10, 31), date(2026, 11, 1), 18),
        (date(2026, 11, 1), date(2026, 11, 1), 0),
        (date(2008, 2, 29), date(2026, 2, 28), 17),  # a leap-day birthday has not come on 28 February
        (date(2008, 2, 29), date(2026, 3, 1), 18),
        (date(2008, 2, 29), date(2028, 2, 29), 20),
        (date(2027, 1, 1), date(2026, 11, 1), -1),
    ],
)
def test_age_counts_birthdays_not_year_boundaries(born: date, run_date: date, expected: int) -> None:
    assert age_years(born, run_date) == expected


def test_age_of_nobody_is_nothing() -> None:
    assert age_years(None, RUN_DATE) is None


# --- the run date minus n years -------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("run_date", "years", "expected"),
    [
        (date(2026, 11, 1), 18, date(2008, 11, 1)),
        (date(2026, 11, 1), 0, date(2026, 11, 1)),
        (date(2028, 2, 29), 1, date(2027, 2, 28)),  # 29 February becomes 28 in a year that has none
        (date(2028, 2, 29), 4, date(2024, 2, 29)),  # and stays where the year has one
        (date(2026, 11, 1), -5, date(2031, 11, 1)),
        (date(2026, 11, 1), 5000, date.min),  # clamped to the range of DATE
        (date(2026, 11, 1), -9000, date.max),
    ],
)
def test_run_date_minus_years(run_date: date, years: int, expected: date) -> None:
    assert years_before(run_date, years) == expected


# --- the table, row by row ------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("node", "expected", "dates"),
    [
        (cond("c1", "days_open", "lt", 18), f"{C} > :p0", [S18]),
        (cond("c1", "days_open", "lt", 17.5), f"{C} > :p0", [S18]),
        (cond("c1", "days_open", "lte", 17), f"{C} > :p0", [S18]),
        (cond("c1", "days_open", "lte", 17.5), f"{C} > :p0", [S18]),
        (cond("c1", "days_open", "gt", 17), f"{C} <= :p0", [S18]),
        (cond("c1", "days_open", "gt", 17.5), f"{C} <= :p0", [S18]),
        (cond("c1", "days_open", "gte", 18), f"{C} <= :p0", [S18]),
        (cond("c1", "days_open", "gte", 17.5), f"{C} <= :p0", [S18]),
        (cond("c1", "days_open", "eq", 18), f"{C} <= :p0 AND {C} > :p1", [S18, S19]),
        (cond("c1", "days_open", "eq", 17.5), f"{C} IS NULL AND {C} IS NOT NULL", []),
        (cond("c1", "days_open", "ne", 18), f"{C} > :p0 OR {C} <= :p1", [S18, S19]),
        (cond("c1", "days_open", "ne", 17.5), f"{C} IS NOT NULL", []),
        (cond("c1", "days_open", "between", values=[18, 20]), f"{C} <= :p0 AND {C} > :p1", [S18, S21]),
        (cond("c1", "days_open", "between", values=[17.5, 20.5]), f"{C} <= :p0 AND {C} > :p1", [S18, S21]),
        (cond("c1", "days_open", "not_between", values=[18, 20]), f"{C} > :p0 OR {C} <= :p1", [S18, S21]),
        (
            cond("c1", "days_open", "in", values=[18, 30]),
            f"{C} <= :p0 AND {C} > :p1 OR {C} <= :p2 AND {C} > :p3",
            [S18, S19, S30, S31],
        ),
        (
            cond("c1", "days_open", "not_in", values=[18, 30]),
            f"({C} > :p0 OR {C} <= :p1) AND ({C} > :p2 OR {C} <= :p3)",
            [S18, S19, S30, S31],
        ),
    ],
)
def test_condition_on_an_age_becomes_a_range_on_the_date_column(
    node: dict[str, Any], expected: str, dates: list[str], synthetic_glossary: Glossary, schema: DefinitionSchema
) -> None:
    document = definition("ticket", all_of(node))
    plan = compile_definition(validate_definition(document, synthetic_glossary, schema), synthetic_glossary)
    rendered = render_statement(plan.page_statement(5000), plan.parameters(RUN_DATE))
    where = rendered.sql.rsplit("\nWHERE ", 1)[1].rsplit(") AS q", 1)[0]
    assert where == expected
    bound = {item.name: (item.type, item.value) for item in rendered.parameters}
    assert [bound[f"p{n}"] for n in range(len(dates))] == [("Date", value) for value in dates]
    # The column is never wrapped in a function, so its index can serve the range.
    assert "DATEDIFF" not in rendered.sql.upper()


# --- the ranges mean what the formula means -------------------------------------------------------------------

BIRTH_DATES = [
    date(2008, 10, 31),
    date(2008, 11, 1),
    date(2008, 11, 2),
    date(2007, 11, 1),
    date(2007, 11, 2),
    date(2004, 2, 29),
    date(2008, 2, 28),
    date(2008, 2, 29),
    date(2008, 3, 1),
    date(2026, 11, 1),
    date(1950, 6, 15),
    None,
]
RUN_DATES = [date(2026, 11, 1), date(2026, 10, 31), date(2026, 2, 28), date(2026, 3, 1), date(2028, 2, 29)]
OPERANDS: list[tuple[str, Any]] = [
    *[(op, value) for op in ("lt", "lte", "gt", "gte", "eq", "ne") for value in (18, 17, 0, 22, Decimal("17.5"))],
    ("between", (18, 20)),
    ("between", (Decimal("17.5"), Decimal("18.5"))),
    ("between", (20, 20)),
    ("not_between", (18, 20)),
    ("not_between", (Decimal("17.5"), Decimal("18.5"))),
    ("in", (18, 22, 76)),
    ("in", (Decimal("17.5"),)),
    ("not_in", (18, 22)),
    ("not_in", (Decimal("17.5"), 18)),
    ("is_null", None),
    ("is_not_null", None),
]


def satisfies(age: int | None, operator: str, operand: Any) -> bool:
    """The operator on an age, as contracts/errors.md words each one; NULL satisfies only `is_null`."""
    if age is None:
        return operator == "is_null"
    return {
        "lt": lambda: age < operand,
        "lte": lambda: age <= operand,
        "gt": lambda: age > operand,
        "gte": lambda: age >= operand,
        "eq": lambda: age == operand,
        "ne": lambda: age != operand,
        "between": lambda: operand[0] <= age <= operand[1],
        "not_between": lambda: age < operand[0] or age > operand[1],
        "in": lambda: age in operand,
        "not_in": lambda: age not in operand,
        "is_null": lambda: False,
        "is_not_null": lambda: True,
    }[operator]()


@pytest.mark.parametrize("run_date", RUN_DATES, ids=str)
def test_ranges_select_exactly_the_people_whose_age_satisfies_the_operator(run_date: date) -> None:
    people = Table("people", MetaData(), Column("id", Integer, primary_key=True), Column("born", Date))
    engine = create_engine("sqlite://")
    people.create(engine)
    with engine.begin() as connection:
        connection.execute(people.insert(), [{"id": n, "born": born} for n, born in enumerate(BIRTH_DATES)])

    def years_ago(years: int) -> Any:
        return literal(years_before(run_date, years), Date())

    predicates = COMPUTED["age_years"].predicates
    with engine.connect() as connection:
        for operator, operand in OPERANDS:
            statement = select(people.c.id).where(predicates[operator](people.c.born, operand, years_ago))
            selected = {row.id for row in connection.execute(statement)}
            expected = {
                n for n, born in enumerate(BIRTH_DATES) if satisfies(age_years(born, run_date), operator, operand)
            }
            assert selected == expected, (operator, operand, run_date)
