"""A compiled definition: the two statements, how to fill their parameters, and where each value comes back.

A plan holds no result and no run date, so one plan serves every run of its definition.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import Select
from sqlalchemy.dialects import mssql

from app.compiler.computed import COMPUTED, years_before
from app.validator import ValidatedDefinition

# SQL Server refuses a statement with more than 2,100 parameters. Only caller values are parameters, each sent
# twice (its flag and the WHERE), and a value of a list on an age is two dates: four parameters at the worst.
# `unsupported` refuses a glossary whose `maxTotalValues` would let a statement pass the limit.
MAX_PARAMETERS = 2000
WORST_PARAMETERS_PER_VALUE = 4

# Statement text for people (goldens, /debug/compile): named placeholders. For counting: one mark per value sent.
_NAMED = mssql.dialect()
_POSITIONAL = mssql.dialect(paramstyle="qmark")
_RENDER = {"render_postcompile": True}


@dataclass(frozen=True, slots=True)
class Constant:
    """A parameter whose value is the same in every run."""

    value: Any


@dataclass(frozen=True, slots=True)
class RunDateMinusYears:
    """A parameter that follows the run date: the date that many years before it."""

    years: int


Recipe = Constant | RunDateMinusYears


@dataclass(frozen=True, slots=True)
class ValueColumn:
    """Where a field's value comes back in a page row, and the function to apply when the field is computed."""

    label: str
    computed: str | None

    def read(self, row: Mapping[str, Any], run_date: date) -> Any:
        raw = row[self.label]
        return raw if self.computed is None else COMPUTED[self.computed].value(raw, run_date)


@dataclass(frozen=True, slots=True)
class NodeColumns:
    """The columns of one node that can be matched: its flag, and for a condition the values of its fields."""

    node_id: str
    matched: str
    actual: ValueColumn | None
    right_actual: ValueColumn | None


@dataclass(frozen=True, slots=True)
class StatementParameter:
    name: str
    type: str
    value: Any


@dataclass(frozen=True, slots=True)
class RenderedStatement:
    """A statement as text with named placeholders, and its parameters in placeholder order; no value in the text."""

    sql: str
    parameters: tuple[StatementParameter, ...]


@dataclass(frozen=True, slots=True)
class CompiledPlan:
    definition: ValidatedDefinition
    # The page: one row per violating record, ordered by its key; the row cap is applied per run.
    page: Select[Any]
    # One row: the number of violating records and, per node, in how many of them it is matched.
    count: Select[Any]
    recipes: Mapping[str, Recipe]
    key: str
    total: str
    display: tuple[tuple[str, ValueColumn], ...]
    nodes: tuple[NodeColumns, ...]

    def parameters(self, run_date: date) -> dict[str, Any]:
        """The value of every parameter for one run date."""
        return {
            name: recipe.value if isinstance(recipe, Constant) else years_before(run_date, recipe.years)
            for name, recipe in self.recipes.items()
        }

    def page_statement(self, cap: int) -> Select[Any]:
        """The page with its row cap. SQLAlchemy renders the integer as `TOP n`; engine code never does."""
        return self.page.limit(int(cap))


def parameter_count(statement: Select[Any], parameters: Mapping[str, Any]) -> int:
    """How many values the statement sends to the server: a list counts each item, a repeated bind each use."""
    compiled = statement.params(**parameters).compile(dialect=_POSITIONAL, compile_kwargs=_RENDER)
    return len(compiled.positiontup or ())


def render_statement(statement: Select[Any], parameters: Mapping[str, Any]) -> RenderedStatement:
    """The statement as the server gets it, with named placeholders in place of the driver's marks."""
    bound = statement.params(**parameters)
    named = bound.compile(dialect=_NAMED, compile_kwargs=_RENDER)
    positional = bound.compile(dialect=_POSITIONAL, compile_kwargs=_RENDER)
    values: Mapping[str, Any] = named.params
    in_order = dict.fromkeys(positional.positiontup or ())
    rendered = tuple(
        StatementParameter(name, _type_name(named.binds, name), _as_json(values[name])) for name in in_order
    )
    return RenderedStatement(str(named), rendered)


def _type_name(binds: Mapping[str, Any], name: str) -> str:
    """The bound type of a parameter; an item of an expanded list (`p3_2`) has the type of its list (`p3`)."""
    bind = binds.get(name)
    if bind is None:
        bind = binds[name.rsplit("_", 1)[0]]
    return type(bind.type).__name__


def _as_json(value: Any) -> Any:
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    return value
