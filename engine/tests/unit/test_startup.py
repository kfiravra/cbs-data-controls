"""The startup sequence and the driver-error mapping, with the database replaced by a stand-in."""

from __future__ import annotations

from typing import Any

import pytest
from sqlalchemy import select, text
from sqlalchemy.dialects import mssql
from sqlalchemy.exc import DBAPIError

from app.compiler import ReadQuery, catalog_query
from app.errors import DatabaseUnavailable, GlossaryMismatch, InternalError, QueryTimeout
from app.executor import Executor, translate_driver_error
from app.executor.database import _guard  # pyright: ignore[reportPrivateUsage]
from app.glossary import Glossary, public_view
from app.glossary.tables import physical_columns
from app.services import HEALTH_RECHECK_SECONDS, GlossaryGuard, Services, start_services
from app.settings import DriverNotFound, Settings, load_settings


class FakeDriverError(Exception):
    """Shaped like a pyodbc error: `args` is (SQLSTATE, message)."""


def driver_error(sqlstate: str) -> DBAPIError:
    original = FakeDriverError(sqlstate, f"[{sqlstate}] a driver message with server names in it")
    return DBAPIError("SELECT 1", {}, original)


def catalog_rows(glossary: Glossary, skip_column: str | None = None) -> list[dict[str, Any]]:
    return [
        {"table_schema": entity.schema, "table_name": entity.table, "column_name": column, "data_type": data_type}
        for entity in glossary.entities.values()
        for column, field_type in physical_columns(entity, glossary.relationships).items()
        if column != skip_column
        for data_type in [
            {"text": "nvarchar", "enum": "nvarchar", "date": "date", "bool": "bit"}.get(field_type or "", "int")
        ]
    ]


class FakeExecutor:
    """Answers `fetch_all` from a script: each item is rows to return or an exception to raise."""

    def __init__(self, script: list[Any], start_error: Exception | None = None) -> None:
        self.script = list(script)
        self.start_error = start_error
        self.queries: list[ReadQuery] = []
        self.started = False

    def start(self) -> None:
        if self.start_error is not None:
            raise self.start_error
        self.started = True

    def fetch_all(self, query: ReadQuery) -> list[dict[str, Any]]:
        self.queries.append(query)
        answer = self.script.pop(0) if len(self.script) > 1 else self.script[0]
        if isinstance(answer, Exception):
            raise answer
        return answer


def services_with(glossary: Glossary, executor: FakeExecutor, wait_seconds: int = 30) -> Services:
    settings = load_settings(None).model_copy(update={"startup_db_wait_seconds": wait_seconds})
    real: Any = executor
    return Services(settings, glossary, public_view(glossary), real, GlossaryGuard(glossary, real))


# --- driver errors --------------------------------------------------------------------------------------------


@pytest.mark.parametrize("sqlstate", ["HYT00", "HYT01"])
def test_statement_timeout_is_query_timeout_with_the_configured_seconds(sqlstate: str) -> None:
    # A read-only login cannot run a slow statement on purpose, so the mapping is proven on a fabricated error.
    error = translate_driver_error(driver_error(sqlstate), 30, connecting=False)
    assert isinstance(error, QueryTimeout)
    assert error.params == {"timeoutSeconds": 30}
    assert error.http_status == 504


@pytest.mark.parametrize("sqlstate", ["08001", "08S01", "08004", "28000", "IM002"])
def test_connection_failure_is_database_unavailable(sqlstate: str) -> None:
    error = translate_driver_error(driver_error(sqlstate), 30, connecting=False)
    assert isinstance(error, DatabaseUnavailable)
    assert error.sqlstate == sqlstate
    assert error.params == {}


def test_timeout_while_connecting_is_a_login_timeout_not_a_query_timeout() -> None:
    assert isinstance(translate_driver_error(driver_error("HYT00"), 30, connecting=True), DatabaseUnavailable)


@pytest.mark.parametrize("sqlstate", ["42S02", "42000", "22003", "HY000"])
def test_any_other_driver_error_is_internal(sqlstate: str) -> None:
    error = translate_driver_error(driver_error(sqlstate), 30, connecting=False)
    assert type(error) is InternalError
    assert error.params == {}


def test_error_without_a_sqlstate_is_internal() -> None:
    assert type(translate_driver_error(DBAPIError("SELECT 1", {}, Exception()), 30, connecting=False)) is InternalError


# --- the guard in front of every statement --------------------------------------------------------------------


class FakeConnection:
    dialect = mssql.dialect()


def test_guard_lets_a_select_through() -> None:
    connection: Any = FakeConnection()
    _guard(connection, catalog_query(["hr"]).statement)


def test_guard_refuses_what_is_not_a_select() -> None:
    connection: Any = FakeConnection()
    with pytest.raises(InternalError):
        _guard(connection, text("DELETE FROM hr.Employee"))


def test_guard_refuses_a_select_that_holds_a_statement_separator() -> None:
    connection: Any = FakeConnection()
    with pytest.raises(InternalError):
        _guard(connection, select(text("1; DROP TABLE hr.Employee")))


def test_nothing_is_sent_before_the_executor_is_started(offline_settings: Settings) -> None:
    with pytest.raises(DatabaseUnavailable):
        Executor(offline_settings).fetch_all(catalog_query(["hr"]))


def test_executor_start_fails_when_no_known_driver_is_installed(offline_settings: Settings) -> None:
    with pytest.raises(DriverNotFound):
        Executor(offline_settings, list_drivers=lambda: ["SQLite3"]).start()


# --- startup --------------------------------------------------------------------------------------------------


def test_start_checks_the_glossary_against_the_catalog_of_its_schemas(glossary: Glossary) -> None:
    executor = FakeExecutor([catalog_rows(glossary)])
    start_services(services_with(glossary, executor), sleep=lambda _seconds: None)
    assert executor.started
    schemas = sorted({entity.schema for entity in glossary.entities.values()})
    assert executor.queries[0].parameters == {"schemas": schemas}


def test_start_refuses_a_glossary_that_names_a_missing_column(glossary: Glossary) -> None:
    entity = next(iter(glossary.entities.values()))
    missing = next(field.column for field in entity.fields.values() if field.column not in (None, entity.key_column))
    executor = FakeExecutor([catalog_rows(glossary, skip_column=missing)])
    slept: list[float] = []
    with pytest.raises(GlossaryMismatch) as raised:
        start_services(services_with(glossary, executor), sleep=slept.append)
    assert raised.value.params["column"] == missing
    assert raised.value.params["table"] == entity.qualified_table
    assert slept == [], "a mismatch ends the start at once"


def test_start_waits_for_the_database_and_then_goes_on(glossary: Glossary) -> None:
    executor = FakeExecutor([DatabaseUnavailable("08001"), DatabaseUnavailable("08001"), catalog_rows(glossary)])
    slept: list[float] = []
    start_services(services_with(glossary, executor), sleep=slept.append)
    assert len(slept) == 2


def test_start_gives_up_when_the_wait_is_over(glossary: Glossary) -> None:
    executor = FakeExecutor([DatabaseUnavailable("08001")])
    slept: list[float] = []
    with pytest.raises(DatabaseUnavailable):
        start_services(services_with(glossary, executor, wait_seconds=0), sleep=slept.append)
    assert slept == []


def test_missing_driver_ends_the_start_at_once(glossary: Glossary) -> None:
    executor = FakeExecutor([DatabaseUnavailable("IM002")])
    slept: list[float] = []
    with pytest.raises(DatabaseUnavailable):
        start_services(services_with(glossary, executor), sleep=slept.append)
    assert slept == []


def test_no_known_driver_ends_the_start_before_any_connection(glossary: Glossary) -> None:
    executor = FakeExecutor([catalog_rows(glossary)], start_error=DriverNotFound(None, ["SQLite3"]))
    with pytest.raises(DriverNotFound):
        start_services(services_with(glossary, executor), sleep=lambda _seconds: None)
    assert executor.queries == []


# --- the health check -----------------------------------------------------------------------------------------


def test_health_reads_the_catalog_again_only_after_a_minute(glossary: Glossary) -> None:
    now = [1000.0]
    executor = FakeExecutor([catalog_rows(glossary)])
    real: Any = executor
    guard = GlossaryGuard(glossary, real, clock=lambda: now[0])

    guard.verify()
    guard.check_health()
    now[0] += HEALTH_RECHECK_SECONDS - 1
    guard.check_health()
    assert ["schemas" in query.parameters for query in executor.queries] == [True, False, False]

    now[0] += 2
    guard.check_health()
    assert "schemas" in executor.queries[-1].parameters


def test_health_reports_a_mismatch_that_appears_after_startup(glossary: Glossary) -> None:
    entity = next(iter(glossary.entities.values()))
    missing = next(field.column for field in entity.fields.values() if field.column not in (None, entity.key_column))
    now = [0.0]
    executor = FakeExecutor([catalog_rows(glossary), catalog_rows(glossary, skip_column=missing)])
    real: Any = executor
    guard = GlossaryGuard(glossary, real, clock=lambda: now[0])

    guard.verify()
    now[0] += HEALTH_RECHECK_SECONDS + 1
    with pytest.raises(GlossaryMismatch):
        guard.check_health()
    # Within the minute the cheap ping still answers with the mismatch found last.
    with pytest.raises(GlossaryMismatch):
        guard.check_health()


def test_health_is_database_unavailable_when_the_ping_fails(glossary: Glossary) -> None:
    executor = FakeExecutor([catalog_rows(glossary), DatabaseUnavailable("08S01")])
    real: Any = executor
    guard = GlossaryGuard(glossary, real, clock=lambda: 0.0)
    guard.verify()
    with pytest.raises(DatabaseUnavailable):
        guard.check_health()
