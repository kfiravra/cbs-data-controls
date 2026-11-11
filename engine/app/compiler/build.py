"""From a validated definition to its two statements.

```
inner   SELECT e0.<key> AS k, <identifying columns> AS d0.., <actual columns> AS a0..,
               CASE WHEN <predicate of node i> THEN 1 ELSE 0 END AS t0..
        FROM <root> AS e0 LEFT OUTER JOIN <parent> AS e1 ON ..       one alias per distinct path prefix
        WHERE <predicate of the root group>
page    SELECT TOP (cap) q.k, q.d*, q.a*, CASE WHEN <matched(i) over q.t*> THEN 1 ELSE 0 END AS m0..
        FROM (inner) AS q ORDER BY q.k
count   SELECT COUNT(*) AS total, SUM(CASE WHEN <matched(i) over q.t*> THEN 1 ELSE 0 END) AS m0..
        FROM (inner, without d* and a*) AS q
```

Nothing a caller typed reaches the SQL text. Tables and columns come from the glossary's tables, every value is a
bound parameter, and every alias and label is generated here (a node id is never a label).
"""

from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    ColumnElement,
    Date,
    FromClause,
    Integer,
    Numeric,
    Select,
    Subquery,
    Unicode,
    and_,
    bindparam,
    case,
    exists,
    func,
    or_,
    select,
)
from sqlalchemy.types import TypeEngine

from app.compiler.computed import COMPUTED
from app.compiler.operators import OPERATORS, OperatorSql, escape_like
from app.compiler.plan import (
    MAX_PARAMETERS,
    CompiledPlan,
    Constant,
    NodeColumns,
    Recipe,
    RunDateMinusYears,
    ValueColumn,
    parameter_count,
)
from app.errors import InternalError
from app.glossary import Entity, Field, Glossary, Relationship
from app.validator import ResolvedField, ValidatedDefinition, Value, VCondition, VGroup, VNode, VRelated

logger = logging.getLogger(__name__)

_KEY = "k"
_TOTAL = "total"
_ONE = "one"
_ZERO = "zero"
# Any date serves to count parameters: the number of values a plan sends does not depend on the run date.
_ANY_DATE = date(2000, 1, 1)

Matchable = VCondition | VRelated


def compile_definition(definition: ValidatedDefinition, glossary: Glossary) -> CompiledPlan:
    """The plan of a validated definition. It trusts the validator and checks nothing again."""
    return _Builder(definition, glossary).build()


def _bind_type(value: Value) -> TypeEngine[Any]:
    """The SQL type a literal is bound as. A bool is asked first: in Python it is also an int."""
    if isinstance(value, bool):
        return Boolean()
    if isinstance(value, int):
        return Integer()
    if isinstance(value, Decimal):
        return Numeric()
    if isinstance(value, date):
        return Date()
    # Unicode, never String: a String is bound as VARCHAR and Hebrew would pass through the code page.
    return Unicode()


class _Binder:
    """Names every parameter and remembers how its value is found for a run."""

    def __init__(self) -> None:
        self.recipes: dict[str, Recipe] = {}
        # The 1 and 0 of every flag are constants of the engine, not values of a caller. SQLAlchemy writes them
        # into the text itself (`literal_execute`, as it does for `TOP n`): as parameters they would be sent once
        # per use, and the matched expressions use them once per node and per group above it.
        self.one: ColumnElement[Any] = bindparam(_ONE, 1, type_=Integer(), literal_execute=True)
        self.zero: ColumnElement[Any] = bindparam(_ZERO, 0, type_=Integer(), literal_execute=True)

    def _name(self, recipe: Recipe) -> str:
        name = f"p{len(self.recipes)}"
        self.recipes[name] = recipe
        return name

    def value(self, value: Value) -> ColumnElement[Any]:
        return bindparam(self._name(Constant(value)), type_=_bind_type(value))

    def values(self, values: tuple[Value, ...]) -> ColumnElement[Any]:
        """One expanding bind: SQLAlchemy opens it into one parameter per value when the statement runs."""
        fractional = any(isinstance(value, Decimal) for value in values)
        bind_type = Numeric() if fractional else _bind_type(values[0])
        return bindparam(self._name(Constant(list(values))), type_=bind_type, expanding=True)

    def years_before_run_date(self, years: int) -> ColumnElement[Any]:
        return bindparam(self._name(RunDateMinusYears(years)), type_=Date())

    def flag(self, predicate: ColumnElement[bool]) -> ColumnElement[Any]:
        return case((predicate, self.one), else_=self.zero)


class _Scope:
    """An entity under an alias, and the parents joined to it for the field paths used so far."""

    def __init__(self, entity: Entity, builder: _Builder) -> None:
        self._builder = builder
        self.alias = builder.new_alias(entity)
        self._joined: dict[tuple[str, ...], FromClause] = {}
        self._joins: list[tuple[FromClause, ColumnElement[bool]]] = []

    def column(self, field: ResolvedField) -> ColumnElement[Any]:
        """The physical column a field is read from, under the alias its path leads to."""
        return self._alias_for(field.path).c[field.field.source_column]

    def _alias_for(self, path: tuple[Relationship, ...]) -> FromClause:
        current = self.alias
        prefix: tuple[str, ...] = ()
        for relationship in path:
            prefix = (*prefix, relationship.key)
            joined = self._joined.get(prefix)
            if joined is None:
                joined = self._builder.new_alias(self._builder.glossary.entities[relationship.to_entity])
                self._joined[prefix] = joined
                self._joins.append((joined, current.c[relationship.from_column] == joined.c[relationship.to_column]))
            current = joined
        return current

    def from_clause(self) -> FromClause:
        """LEFT OUTER joins: a record with no parent stays, and a field of the missing parent is NULL."""
        clause: FromClause = self.alias
        for joined, on in self._joins:
            clause = clause.outerjoin(joined, on)
        return clause


class _Builder:
    def __init__(self, definition: ValidatedDefinition, glossary: Glossary) -> None:
        self.glossary = glossary
        self._definition = definition
        self._binder = _Binder()
        self._aliases = 0
        # The nodes that can be matched, in document order, each with its predicate and the groups above it
        # (the root group left out: the WHERE already holds it).
        self._matchable: list[tuple[Matchable, ColumnElement[bool], tuple[VGroup, ...]]] = []

    def new_alias(self, entity: Entity) -> FromClause:
        alias = self.glossary.tables[entity.key].alias(f"e{self._aliases}")
        self._aliases += 1
        return alias

    # --- predicates -----------------------------------------------------------------------------------------

    def _group(self, group: VGroup, scope: _Scope, above: tuple[VGroup, ...] | None) -> ColumnElement[bool]:
        """The predicate of a group. `above` is what its children have above them; None inside a related node."""
        parts = [self._node(child, scope, above) for child in group.children]
        return and_(*parts) if group.op == "and" else or_(*parts)

    def _node(self, node: VNode, scope: _Scope, above: tuple[VGroup, ...] | None) -> ColumnElement[bool]:
        if isinstance(node, VGroup):
            return self._group(node, scope, None if above is None else (*above, node))
        predicate = self._condition(node, scope) if isinstance(node, VCondition) else self._related(node, scope)
        if above is not None:
            self._matchable.append((node, predicate, above))
        return predicate

    def _condition(self, node: VCondition, scope: _Scope) -> ColumnElement[bool]:
        column = scope.column(node.left)
        computed = node.left.field.computed
        if computed is not None:
            predicate = COMPUTED[computed.function].predicates[node.operator.key]
            return predicate(column, node.operand, self._binder.years_before_run_date)
        operator = OPERATORS[node.operator.key]
        return operator.build(column, self._operands(node, operator, scope))

    def _operands(self, node: VCondition, operator: OperatorSql, scope: _Scope) -> tuple[ColumnElement[Any], ...]:
        operand = node.operand
        if operator.operand == "none":
            return ()
        if operator.operand == "empty":
            return (self._binder.value(""),)
        if isinstance(operand, ResolvedField):
            return (scope.column(operand),)
        if isinstance(operand, tuple):
            if operator.operand == "list":
                return (self._binder.values(operand),)
            return tuple(self._binder.value(value) for value in operand)
        if operand is None:
            raise InternalError()  # the validator fits every operand to its operator's arity
        if operator.operand == "pattern":
            return (self._binder.value(escape_like(str(operand))),)
        return (self._binder.value(operand),)

    def _related(self, node: VRelated, scope: _Scope) -> ColumnElement[bool]:
        """EXISTS or NOT EXISTS over the related table, correlated on the join columns: rows never multiply."""
        related = _Scope(node.entity, self)
        # Nothing inside a related node can be matched: its conditions hold per related record.
        inside = self._group(node.where, related, None)
        relationship = node.relationship
        correlation = related.alias.c[relationship.to_column] == scope.alias.c[relationship.from_column]
        found = exists().select_from(related.from_clause()).where(and_(correlation, inside)).correlate(scope.alias)
        return found if node.quantifier == "any" else ~found

    # --- statements -----------------------------------------------------------------------------------------

    def build(self) -> CompiledPlan:
        definition = self._definition
        root = _Scope(definition.root, self)
        # A node directly under the root group has no group above it: the WHERE already holds the root.
        where = self._group(definition.where, root, ())

        key = root.alias.c[definition.root.key_column].label(_KEY)
        display, display_columns = self._display(root)
        nodes, actual_columns = self._node_columns(root)
        flags: list[ColumnElement[Any]] = [
            self._binder.flag(predicate).label(_flag_label(index))
            for index, (_, predicate, _) in enumerate(self._matchable)
        ]
        columns: list[ColumnElement[Any]] = [key, *display_columns, *actual_columns]
        source = root.from_clause()

        page, count = self._statements(source, where, columns, flags)
        compiled = CompiledPlan(definition, page, count, dict(self._binder.recipes), _KEY, _TOTAL, display, nodes)
        sent = _parameters_sent(compiled)
        if sent > MAX_PARAMETERS:
            # Unreachable under a glossary the engine starts with: `unsupported` refuses limits that allow it.
            logger.error("a compiled statement has too many parameters", extra={"parameters": sent})
            raise InternalError()
        return compiled

    def _statements(
        self,
        source: FromClause,
        where: ColumnElement[bool],
        columns: list[ColumnElement[Any]],
        flags: list[ColumnElement[Any]],
    ) -> tuple[Select[Any], Select[Any]]:
        """The page and the count over one inner select, which carries the real WHERE (an index can serve it).

        A caller value is sent twice per statement, in its flag and in the WHERE; the outer statements read
        the flags and send nothing.
        """
        rows = select(*columns, *flags).select_from(source).where(where).subquery("q")
        tally = select(*flags).select_from(source).where(where).subquery("q")
        carried: list[ColumnElement[Any]] = [rows.c[str(column.name)] for column in columns]
        page = select(*carried, *self._matched(rows, summed=False)).order_by(rows.c[_KEY])
        count = select(func.count().label(_TOTAL), *self._matched(tally, summed=True)).select_from(tally)
        return page, count

    def _display(self, root: _Scope) -> tuple[tuple[tuple[str, ValueColumn], ...], list[ColumnElement[Any]]]:
        """The identifying fields of the root entity: what a results table shows for a record."""
        entity = self._definition.root
        display: list[tuple[str, ValueColumn]] = []
        columns: list[ColumnElement[Any]] = []
        for index, key in enumerate(entity.identifying_fields):
            field = entity.fields[key]
            label = f"d{index}"
            columns.append(root.alias.c[field.source_column].label(label))
            display.append((key, _value_column(label, field)))
        return tuple(display), columns

    def _node_columns(self, root: _Scope) -> tuple[tuple[NodeColumns, ...], list[ColumnElement[Any]]]:
        """Per node its `m` flag; per condition the value of its left field, and of its right one, as `a` columns.

        One `a` column per distinct alias and column: two conditions on one field read the same one.
        """
        labels: dict[tuple[str, str], str] = {}
        columns: list[ColumnElement[Any]] = []

        def actual(resolved: ResolvedField | None) -> ValueColumn | None:
            if resolved is None:
                return None
            column = root.column(resolved)
            identity = (str(column.table.name), column.name)
            if identity not in labels:
                labels[identity] = f"a{len(labels)}"
                columns.append(column.label(labels[identity]))
            return _value_column(labels[identity], resolved.field)

        nodes: list[NodeColumns] = []
        for index, (node, _, _) in enumerate(self._matchable):
            is_condition = isinstance(node, VCondition)
            nodes.append(
                NodeColumns(
                    node_id=node.id,
                    matched=_matched_label(index),
                    actual=actual(node.left) if is_condition else None,
                    right_actual=actual(node.right) if is_condition else None,
                )
            )
        return tuple(nodes), columns

    def _matched(self, inner: Subquery, *, summed: bool) -> list[ColumnElement[Any]]:
        """`m` per node: it holds, and so does every group above it (contracts/errors.md, Matched).

        Written over the `t` flags of the inner select, so no caller value appears a second time.
        """
        flag_of = {node.id: inner.c[_flag_label(index)] for index, (node, _, _) in enumerate(self._matchable)}

        def holds(node: VNode) -> ColumnElement[bool]:
            if isinstance(node, VGroup):
                parts = [holds(child) for child in node.children]
                return and_(*parts) if node.op == "and" else or_(*parts)
            return flag_of[node.id] == self._binder.one

        columns: list[ColumnElement[Any]] = []
        for index, (node, _, above) in enumerate(self._matchable):
            flag = self._binder.flag(and_(holds(node), *[holds(group) for group in above]))
            columns.append((func.sum(flag) if summed else flag).label(_matched_label(index)))
        return columns


def _flag_label(index: int) -> str:
    """The inner select's column that says whether node `index` holds for the row."""
    return f"t{index}"


def _matched_label(index: int) -> str:
    """The outer statements' column that says whether node `index` is matched."""
    return f"m{index}"


def _value_column(label: str, field: Field) -> ValueColumn:
    return ValueColumn(label, None if field.computed is None else field.computed.function)


def _parameters_sent(plan: CompiledPlan) -> int:
    """The larger of the two statements' parameter counts. SQL Server refuses a statement with more than 2,100."""
    parameters = plan.parameters(_ANY_DATE)
    return max(parameter_count(statement, parameters) for statement in (plan.page_statement(1), plan.count))
