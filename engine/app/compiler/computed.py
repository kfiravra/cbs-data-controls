"""The closed list of computed functions. `age_years` is the only one (contracts/errors.md, Age).

An age is never computed in SQL. A condition on it becomes a range on the birth-date column, relative to the run
date: `age < 18` is `birth_date > run date minus 18 years`. The column stays bare, so its index serves, and
`DATEDIFF(year, ...)`, which counts year boundaries and not birthdays, is not involved.
"""

from __future__ import annotations

import math
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from types import MappingProxyType
from typing import Any

from sqlalchemy import ColumnElement, and_, or_

# Gives a bind that holds "the run date minus this many years"; the value is filled in per run.
YearsBeforeRunDate = Callable[[int], ColumnElement[Any]]
Operand = Any


def years_before(run_date: date, years: int) -> date:
    """The run date `years` years earlier: the latest birth date of somebody who is `years` old on the run date.

    29 February becomes 28 February in a year that has none, and the result is clamped to the range of DATE.
    """
    year = run_date.year - years
    if year < date.min.year:
        return date.min
    if year > date.max.year:
        return date.max
    try:
        return run_date.replace(year=year)
    except ValueError:
        return run_date.replace(year=year, day=28)


def age_years(born: date | None, run_date: date) -> int | None:
    """Whole years from the birth date to the run date, as the contract words it."""
    if born is None:
        return None
    before_birthday = (run_date.month, run_date.day) < (born.month, born.day)
    return run_date.year - born.year - (1 if before_birthday else 0)


def _is_whole(value: int | Decimal) -> bool:
    return value == math.floor(value)


def _at_least(column: ColumnElement[Any], years: int, bind: YearsBeforeRunDate) -> ColumnElement[bool]:
    """age >= years."""
    return column <= bind(years)


def _below(column: ColumnElement[Any], years: int, bind: YearsBeforeRunDate) -> ColumnElement[bool]:
    """age < years."""
    return column > bind(years)


def _never(column: ColumnElement[Any]) -> ColumnElement[bool]:
    """False for every row, written without a literal (SQL Server has no boolean constant)."""
    return and_(column.is_(None), column.is_not(None))


def _equals(column: ColumnElement[Any], value: int | Decimal, bind: YearsBeforeRunDate) -> ColumnElement[bool]:
    if not _is_whole(value):
        return _never(column)  # an age is whole
    return and_(_at_least(column, int(value), bind), _below(column, int(value) + 1, bind))


def _differs(column: ColumnElement[Any], value: int | Decimal, bind: YearsBeforeRunDate) -> ColumnElement[bool]:
    if not _is_whole(value):
        return column.is_not(None)  # every known age differs from a fraction
    return or_(_below(column, int(value), bind), _at_least(column, int(value) + 1, bind))


Predicate = Callable[[ColumnElement[Any], Operand, YearsBeforeRunDate], ColumnElement[bool]]

# The table of plan.md Design D. An age is whole, so a fraction is rounded the way each comparison needs.
_AGE_PREDICATES: Mapping[str, Predicate] = MappingProxyType(
    {
        "lt": lambda column, value, bind: _below(column, math.ceil(value), bind),
        "lte": lambda column, value, bind: _below(column, math.floor(value) + 1, bind),
        "gt": lambda column, value, bind: _at_least(column, math.floor(value) + 1, bind),
        "gte": lambda column, value, bind: _at_least(column, math.ceil(value), bind),
        "eq": _equals,
        "ne": _differs,
        "between": lambda column, values, bind: and_(
            _at_least(column, math.ceil(values[0]), bind), _below(column, math.floor(values[1]) + 1, bind)
        ),
        "not_between": lambda column, values, bind: or_(
            _below(column, math.ceil(values[0]), bind), _at_least(column, math.floor(values[1]) + 1, bind)
        ),
        "in": lambda column, values, bind: or_(*[_equals(column, value, bind) for value in values]),
        "not_in": lambda column, values, bind: and_(*[_differs(column, value, bind) for value in values]),
        "is_null": lambda column, _value, _bind: column.is_(None),
        "is_not_null": lambda column, _value, _bind: column.is_not(None),
    }
)


@dataclass(frozen=True, slots=True)
class ComputedFunction:
    """How a computed field is filtered (a predicate on its source column, per operator) and how its value is shown."""

    predicates: Mapping[str, Predicate]
    value: Callable[[Any, date], Any]


COMPUTED: Mapping[str, ComputedFunction] = MappingProxyType(
    {
        "age_years": ComputedFunction(predicates=_AGE_PREDICATES, value=age_years),
    }
)
