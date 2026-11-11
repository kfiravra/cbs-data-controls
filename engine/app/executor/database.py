"""Connections, the guards in front of every statement, and the mapping of driver errors to domain errors."""

from __future__ import annotations

import logging
from collections.abc import Callable, Generator, Mapping, Sequence
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import date
from typing import Any

import pyodbc
from sqlalchemy import Connection, Dialect, Engine, Select, create_engine, event
from sqlalchemy.exc import DBAPIError

from app.compiler import CompiledPlan, ReadQuery
from app.errors import DatabaseUnavailable, EngineError, InternalError, QueryTimeout
from app.settings import Settings, choose_driver, connection_url

logger = logging.getLogger(__name__)

LOGIN_TIMEOUT_SECONDS = 5
_TIMEOUT_STATES = frozenset({"HYT00", "HYT01"})
_UNAVAILABLE_STATES = frozenset({"28000", "IM002"})
_CONNECTION_STATE_CLASS = "08"

Row = Mapping[str, Any]


@dataclass(frozen=True, slots=True)
class Counts:
    """What the count statement says: all violations, and per node in how many of them it is matched."""

    total: int
    matched: Mapping[str, int]


@dataclass(frozen=True, slots=True)
class RunRows:
    """The outcome of one run: the exact counts, and the first rows by key up to the cap."""

    counts: Counts
    rows: tuple[Row, ...]


def _sqlstate(error: DBAPIError) -> str | None:
    args = getattr(error.orig, "args", ())
    return args[0] if args and isinstance(args[0], str) else None


def translate_driver_error(error: DBAPIError, timeout_seconds: int, *, connecting: bool) -> EngineError:
    """SQLSTATE to domain error. While connecting, a timeout is a login timeout: the database is unavailable."""
    state = _sqlstate(error)
    if connecting:
        return DatabaseUnavailable(state)
    if state in _TIMEOUT_STATES:
        return QueryTimeout(timeout_seconds)
    if state is not None and (state.startswith(_CONNECTION_STATE_CLASS) or state in _UNAVAILABLE_STATES):
        return DatabaseUnavailable(state)
    return InternalError()


class Executor:
    """Owns the SQLAlchemy engine. Nothing is sent before `start`, and only what the compiler built is sent."""

    def __init__(self, settings: Settings, list_drivers: Callable[[], Sequence[str]] = pyodbc.drivers) -> None:
        self._settings = settings
        self._list_drivers = list_drivers
        self._engine: Engine | None = None
        self._driver: str | None = None

    @property
    def driver(self) -> str | None:
        """The ODBC driver in use, once `start` has chosen one."""
        return self._driver

    def installed_drivers(self) -> tuple[str, ...]:
        return tuple(self._list_drivers())

    def start(self) -> None:
        """Choose the driver and build the engine; no connection is opened yet. `DriverNotFound` ends the start."""
        driver = choose_driver(self._settings.db_driver, self._list_drivers())
        engine = create_engine(
            connection_url(self._settings, driver),
            pool_pre_ping=True,
            # Error messages and DEBUG logs never carry parameter values: they are what a caller typed.
            hide_parameters=True,
            connect_args={"timeout": LOGIN_TIMEOUT_SECONDS},
        )
        event.listen(engine, "connect", self._set_statement_timeout)
        self._engine = engine
        self._driver = driver

    def dispose(self) -> None:
        if self._engine is not None:
            self._engine.dispose()
            self._engine = None

    def fetch_all(self, query: ReadQuery) -> list[Row]:
        """Run one of the engine's own SELECTs (catalog, ping) and return its rows."""
        with self._connection() as connection:
            return self._select(connection, query.statement, query.parameters)

    def count_compiled(self, plan: CompiledPlan, run_date: date) -> Counts:
        """How many records violate the definition on the run date, and how often each node is matched."""
        with self._connection() as connection:
            return self._count(connection, plan, plan.parameters(run_date))

    def run_compiled(self, plan: CompiledPlan, run_date: date, cap: int) -> RunRows:
        """The count, then the page, on one connection. Each statement runs under the statement timeout.

        The two run at the default isolation level: `hr` is never written by the system, so they agree.
        """
        parameters = plan.parameters(run_date)
        with self._connection() as connection:
            counts = self._count(connection, plan, parameters)
            rows = self._select(connection, plan.page_statement(cap), parameters)
        return RunRows(counts, tuple(rows))

    def _count(self, connection: Connection, plan: CompiledPlan, parameters: Mapping[str, Any]) -> Counts:
        (row,) = self._select(connection, plan.count, parameters)
        # SUM over no rows is NULL: nothing is matched when nothing is found.
        matched = {node.node_id: int(row[node.matched] or 0) for node in plan.nodes}
        return Counts(total=int(row[plan.total]), matched=matched)

    def _set_statement_timeout(self, dbapi_connection: Any, _record: Any) -> None:
        # pyodbc applies Connection.timeout (seconds) to every cursor created after it.
        dbapi_connection.timeout = self._settings.query_timeout_seconds

    @contextmanager
    def _connection(self) -> Generator[Connection]:
        if self._engine is None:
            raise DatabaseUnavailable()
        try:
            connection = self._engine.connect()
        except DBAPIError as error:
            raise self._translated(error, connecting=True) from error
        try:
            yield connection
        finally:
            connection.close()

    def _select(self, connection: Connection, statement: Select[Any], parameters: Mapping[str, Any]) -> list[Row]:
        ensure_single_select(connection.dialect, statement)
        try:
            result = connection.execute(statement, dict(parameters))
            return [dict(row) for row in result.mappings()]
        except DBAPIError as error:
            raise self._translated(error, connecting=False) from error

    def _translated(self, error: DBAPIError, *, connecting: bool) -> EngineError:
        translated = translate_driver_error(error, self._settings.query_timeout_seconds, connecting=connecting)
        # The driver's own message stays in the log, with the correlation id; the caller gets a code.
        logger.error(
            "database error",
            extra={"code": translated.code, "sqlstate": _sqlstate(error), "driver_message": str(error.orig)},
        )
        return translated


def ensure_single_select(dialect: Dialect, statement: object) -> None:
    """Layer 3 of architecture §10: exactly one SELECT is ever sent, whatever the compiler did.

    Raises `InternalError`, and nothing runs, for anything that is not a `Select` or whose text holds a `;`.
    """
    if not isinstance(statement, Select):
        logger.error("refused a statement that is not a SELECT", extra={"statement_type": type(statement).__name__})
        raise InternalError()
    text = str(statement.compile(dialect=dialect))
    if ";" in text:
        logger.error("refused a statement that holds a statement separator")
        raise InternalError()
    logger.debug("statement", extra={"sql": text})
