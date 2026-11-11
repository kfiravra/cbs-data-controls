"""The compiler: the only place that builds SQL, always as SQLAlchemy Core expressions."""

from __future__ import annotations

from app.compiler.build import compile_definition
from app.compiler.computed import age_years, years_before
from app.compiler.operators import escape_like
from app.compiler.plan import (
    MAX_PARAMETERS,
    CompiledPlan,
    NodeColumns,
    RenderedStatement,
    StatementParameter,
    ValueColumn,
    parameter_count,
    render_statement,
)
from app.compiler.profile import PairLabels, ProfileQuery, profile_query
from app.compiler.queries import (
    CATALOG_COLUMN,
    CATALOG_SCHEMA,
    CATALOG_TABLE,
    CATALOG_TYPE,
    ReadQuery,
    catalog_query,
    ping_query,
)
from app.compiler.support import unsupported

__all__ = [
    "CATALOG_COLUMN",
    "CATALOG_SCHEMA",
    "CATALOG_TABLE",
    "CATALOG_TYPE",
    "MAX_PARAMETERS",
    "CompiledPlan",
    "NodeColumns",
    "PairLabels",
    "ProfileQuery",
    "ReadQuery",
    "RenderedStatement",
    "StatementParameter",
    "ValueColumn",
    "age_years",
    "catalog_query",
    "compile_definition",
    "escape_like",
    "parameter_count",
    "ping_query",
    "profile_query",
    "render_statement",
    "unsupported",
    "years_before",
]
