"""Connections, the guards in front of every statement, and the mapping of driver errors to domain errors."""

from __future__ import annotations

import logging
from collections.abc import Callable, Generator, Mapping, Sequence
from contextlib import contextmanager
from typing import Any

import pyodbc
from sqlalchemy import Connection, Engine, Select, create_engine, event
from sqlalchemy.exc import DBAPIError

from app.compiler import ReadQuery
from app.errors import DatabaseUnavailable, EngineError, InternalError, QueryTimeout
from app.settings import Settings, choose_driver, connection_url

logger = logging.getLogger(__name__)

LOGIN_TIMEOUT_SECONDS = 5
_TIMEOUT_STATES = frozenset({"HYT00", "HYT01"})
_UNAVAILABLE_STATES = frozenset({"28000", "IM002"})
_CONNECTION_STATE_CLASS = "08"

Row = Mapping[str, Any]


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

    def dispose(self) -> None:
        if self._engine is not None:
            self._engine.dispose()
            self._engine = None

    def fetch_all(self, query: ReadQuery) -> list[Row]:
        """Run one of the engine's own SELECTs (catalog, ping) and return its rows."""
        with self._connection() as connection:
            return self._select(connection, query.statement, query.parameters)

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
        _guard(connection, statement)
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


def _guard(connection: Connection, statement: object) -> None:
    """Layer 3 of architecture §10: exactly one SELECT is ever sent, whatever the compiler did."""
    if not isinstance(statement, Select):
        logger.error("refused a statement that is not a SELECT", extra={"statement_type": type(statement).__name__})
        raise InternalError()
    text = str(statement.compile(dialect=connection.dialect))
    if ";" in text:
        logger.error("refused a statement that holds a statement separator")
        raise InternalError()
    logger.debug("statement", extra={"sql": text})
