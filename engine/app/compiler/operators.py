"""The closed map of the eighteen operators: operator key to SQLAlchemy expression. It is never extended from data.

SQL's three-valued logic gives the contract's NULL rule with no extra code: a comparison with NULL is unknown, so
it matches nothing, the negative operators included (contracts/errors.md, NULL).
"""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from types import MappingProxyType
from typing import Any, Literal, cast

from sqlalchemy import BindParameter, ColumnElement, and_, or_

LIKE_ESCAPE = "/"

Operands = Sequence[ColumnElement[Any]]
# What the builder must hand to `build`: nothing; one bind or the right column; two binds; one expanding bind;
# one bind holding the LIKE-escaped operand; one bind holding the empty string.
OperandKind = Literal["none", "one", "pair", "list", "pattern", "empty"]


@dataclass(frozen=True, slots=True)
class OperatorSql:
    operand: OperandKind
    build: Callable[[ColumnElement[Any], Operands], ColumnElement[bool]]


def escape_like(operand: str) -> str:
    """Make a LIKE operand literal: `%`, `_` and `[` are wildcards in T-SQL, and `/` is the escape character.

    SQLAlchemy's `autoescape=True` is not used: it leaves `[` alone, which opens a character class in T-SQL.
    """
    return (
        operand.replace(LIKE_ESCAPE, LIKE_ESCAPE * 2)
        .replace("%", LIKE_ESCAPE + "%")
        .replace("_", LIKE_ESCAPE + "_")
        .replace("[", LIKE_ESCAPE + "[")
    )


def _expanding(operands: Operands) -> BindParameter[Any]:
    """The one operand of a list operator: an expanding bind, which SQLAlchemy opens into one bind per value."""
    return cast(BindParameter[Any], operands[0])


OPERATORS: Mapping[str, OperatorSql] = MappingProxyType(
    {
        "eq": OperatorSql("one", lambda column, operands: column == operands[0]),
        "ne": OperatorSql("one", lambda column, operands: column != operands[0]),
        "lt": OperatorSql("one", lambda column, operands: column < operands[0]),
        "lte": OperatorSql("one", lambda column, operands: column <= operands[0]),
        "gt": OperatorSql("one", lambda column, operands: column > operands[0]),
        "gte": OperatorSql("one", lambda column, operands: column >= operands[0]),
        "between": OperatorSql("pair", lambda column, operands: column.between(operands[0], operands[1])),
        "not_between": OperatorSql("pair", lambda column, operands: ~column.between(operands[0], operands[1])),
        "in": OperatorSql("list", lambda column, operands: column.in_(_expanding(operands))),
        "not_in": OperatorSql("list", lambda column, operands: column.not_in(_expanding(operands))),
        "contains": OperatorSql("pattern", lambda column, operands: column.contains(operands[0], escape=LIKE_ESCAPE)),
        "not_contains": OperatorSql(
            "pattern", lambda column, operands: ~column.contains(operands[0], escape=LIKE_ESCAPE)
        ),
        "starts_with": OperatorSql(
            "pattern", lambda column, operands: column.startswith(operands[0], escape=LIKE_ESCAPE)
        ),
        "ends_with": OperatorSql("pattern", lambda column, operands: column.endswith(operands[0], escape=LIKE_ESCAPE)),
        "is_null": OperatorSql("none", lambda column, operands: column.is_(None)),
        "is_not_null": OperatorSql("none", lambda column, operands: column.is_not(None)),
        # SQL Server ignores trailing spaces when it compares, so `= ''` is also true for spaces only.
        "is_empty": OperatorSql("empty", lambda column, operands: or_(column.is_(None), column == operands[0])),
        "is_not_empty": OperatorSql("empty", lambda column, operands: and_(column.is_not(None), column != operands[0])),
    }
)
