"""What the routes work with, built once per application, and the startup sequence of architecture §9."""

from __future__ import annotations

import logging
import threading
import time
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any

from app.compiler import CATALOG_COLUMN, CATALOG_SCHEMA, CATALOG_TABLE, CATALOG_TYPE, catalog_query, ping_query
from app.errors import DatabaseUnavailable, GlossaryMismatch
from app.executor import Executor
from app.glossary import CatalogColumn, Glossary, Mismatch, find_mismatches, load_glossary, public_view
from app.settings import DriverNotFound, Settings

logger = logging.getLogger(__name__)

GLOSSARY_FILE = "glossary.json"
HEALTH_RECHECK_SECONDS = 60.0
STARTUP_RETRY_SECONDS = 1.0
_DRIVER_MISSING_STATE = "IM002"


class GlossaryGuard:
    """The glossary-against-database check: run at startup, repeated by `/health` at most once a minute."""

    def __init__(self, glossary: Glossary, executor: Executor, clock: Callable[[], float] = time.monotonic) -> None:
        self._glossary = glossary
        self._executor = executor
        self._clock = clock
        self._lock = threading.Lock()
        self._checked_at: float | None = None
        self._mismatch: Mismatch | None = None

    def verify(self) -> None:
        """Read the catalog and compare. Raises `DatabaseUnavailable` or `GlossaryMismatch`."""
        schemas = {entity.schema for entity in self._glossary.entities.values()}
        rows = self._executor.fetch_all(catalog_query(schemas))
        catalog = [
            CatalogColumn(row[CATALOG_SCHEMA], row[CATALOG_TABLE], row[CATALOG_COLUMN], row[CATALOG_TYPE])
            for row in rows
        ]
        mismatches = find_mismatches(self._glossary, catalog)
        for mismatch in mismatches:
            logger.error(
                "the glossary does not fit the database",
                extra={"table": mismatch.table, "column": mismatch.column},
            )
        first = mismatches[0] if mismatches else None
        with self._lock:
            self._checked_at = self._clock()
            self._mismatch = first
        if first is not None:
            raise GlossaryMismatch(first.table, first.column)

    def check_health(self) -> None:
        """The database answers and the glossary still fits; the catalog is read again when the last read is old."""
        with self._lock:
            due = self._checked_at is None or self._clock() - self._checked_at >= HEALTH_RECHECK_SECONDS
            mismatch = self._mismatch
        if due:
            self.verify()
            return
        self._executor.fetch_all(ping_query())
        if mismatch is not None:
            # A new exception per answer: an instance shared between threads would share its traceback too.
            raise GlossaryMismatch(mismatch.table, mismatch.column)


@dataclass(frozen=True, slots=True)
class Services:
    settings: Settings
    glossary: Glossary
    public_glossary: Mapping[str, Any]
    executor: Executor
    glossary_guard: GlossaryGuard


def build_services(settings: Settings) -> Services:
    """Everything that needs no database: the glossary is read here, connections open in `start_services`."""
    glossary = load_glossary(settings.contracts_dir / GLOSSARY_FILE)
    executor = Executor(settings)
    return Services(
        settings=settings,
        glossary=glossary,
        public_glossary=public_view(glossary),
        executor=executor,
        glossary_guard=GlossaryGuard(glossary, executor),
    )


def start_services(services: Services, sleep: Callable[[float], None] = time.sleep) -> None:
    """Wait for the database, then check the glossary against it; any failure ends the start.

    A missing driver and a glossary mismatch end it at once: waiting repairs neither.
    """
    try:
        services.executor.start()
    except DriverNotFound as error:
        logger.critical(
            "startup failed: no usable ODBC driver is installed",
            extra={"asked": error.asked, "installed": error.installed},
        )
        raise
    deadline = time.monotonic() + services.settings.startup_db_wait_seconds
    while True:
        try:
            services.glossary_guard.verify()
            return
        except GlossaryMismatch:
            logger.critical("startup failed: the glossary does not fit the database")
            raise
        except DatabaseUnavailable as error:
            if error.sqlstate == _DRIVER_MISSING_STATE:
                # One line with what a wrong ENGINE_DB_DRIVER needs: the name asked for and the names installed.
                logger.critical(
                    "startup failed: the ODBC driver is not installed",
                    extra={
                        "asked": services.settings.db_driver,
                        "driver": services.executor.driver,
                        "installed": services.executor.installed_drivers(),
                    },
                )
                raise
            if time.monotonic() >= deadline:
                logger.critical(
                    "startup failed: the database did not answer",
                    extra={"waited_seconds": services.settings.startup_db_wait_seconds},
                )
                raise
            sleep(STARTUP_RETRY_SECONDS)
