"""Configuration from the environment, then from the repository's `.env`, and the database connection URL."""

from __future__ import annotations

import logging
from collections.abc import Sequence
from pathlib import Path
from typing import Annotated, Any, cast
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BeforeValidator, Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL

# Resolved from this file, never from the working directory: engine/app/settings.py -> the repository root.
REPOSITORY_ROOT = Path(__file__).resolve().parents[2]

# The engine has one login. A deployment chooses the server, never the identity.
DB_LOGIN = "dq_engine_ro"
KNOWN_DRIVERS = ("ODBC Driver 18 for SQL Server", "ODBC Driver 17 for SQL Server")
SUGGEST_MAX_CEILING = 20
_LOG_LEVELS = frozenset({"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"})


class DriverNotFound(Exception):
    """No usable ODBC driver: waiting cannot repair it, so the start ends at once."""

    def __init__(self, asked: str | None, installed: Sequence[str]) -> None:
        self.asked = asked
        self.installed = tuple(installed)
        wanted = asked if asked is not None else " or ".join(KNOWN_DRIVERS)
        super().__init__(f"ODBC driver not found: asked for {wanted}; installed: {', '.join(self.installed) or 'none'}")


def _port(value: Any) -> int | None:
    if value is None:
        return None
    try:
        port = int(str(value).strip())
    except ValueError:
        port = 0
    if not 1 <= port <= 65535:
        raise ValueError("ENGINE_DB_PORT must be empty or an integer from 1 to 65535")
    return port


class Settings(BaseSettings):
    """Every variable of the engine block of `.env.example`. A process variable wins over `.env`, an empty one too."""

    model_config = SettingsConfigDict(
        env_prefix="ENGINE_",
        env_file=REPOSITORY_ROOT / ".env",
        env_file_encoding="utf-8",
        # Off on purpose: with it on, a port in `.env` would win over an empty ENGINE_DB_PORT in the environment.
        env_ignore_empty=False,
        extra="ignore",
        frozen=True,
        populate_by_name=True,
    )

    db_host: str = "localhost"
    db_name: str = "DataControls"
    db_port: Annotated[int | None, BeforeValidator(_port)] = None
    db_driver: str | None = None
    db_password: SecretStr = Field(validation_alias="DQ_ENGINE_RO_PASSWORD")
    row_cap: int = Field(default=5000, ge=1)
    query_timeout_seconds: int = Field(default=30, ge=1)
    startup_db_wait_seconds: int = Field(default=30, ge=0)
    time_zone: str = "Asia/Jerusalem"
    debug_compile: bool = False
    contracts_dir: Path = REPOSITORY_ROOT / "contracts"
    log_level: str = "INFO"
    suggest_max: int = Field(default=10, ge=1, le=SUGGEST_MAX_CEILING)

    @model_validator(mode="before")
    @classmethod
    def _blank_means_unset(cls, values: Any) -> Any:
        """An empty variable is an unset one: cmd and Windows PowerShell delete a variable that is set to nothing.

        It runs after the environment and `.env` are merged, so an empty ENGINE_DB_PORT in the environment still
        hides a port written in `.env`.
        """
        if not isinstance(values, dict):
            return values
        given = cast(dict[str, Any], values)
        return {name: value for name, value in given.items() if not (isinstance(value, str) and not value.strip())}

    @field_validator("time_zone")
    @classmethod
    def _known_time_zone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("ENGINE_TIME_ZONE must be an IANA time zone name such as Asia/Jerusalem") from None
        return value

    @field_validator("log_level")
    @classmethod
    def _known_log_level(cls, value: str) -> str:
        level = value.strip().upper()
        if level not in _LOG_LEVELS:
            raise ValueError(f"ENGINE_LOG_LEVEL must be one of {', '.join(sorted(_LOG_LEVELS))}")
        return level

    @property
    def log_level_number(self) -> int:
        return logging.getLevelNamesMapping()[self.log_level]


def load_settings(env_file: Path | None = REPOSITORY_ROOT / ".env") -> Settings:
    """The settings from the environment and then from `env_file`; `None` reads the environment alone."""
    # pydantic-settings fills the fields from its sources, which the type checker cannot see.
    return Settings(_env_file=env_file)  # pyright: ignore[reportCallIssue]


def choose_driver(configured: str | None, installed: Sequence[str]) -> str:
    """The configured driver as written, else the newest known driver that is installed."""
    if configured is not None:
        return configured
    for name in KNOWN_DRIVERS:
        if name in installed:
            return name
    raise DriverNotFound(None, installed)


def connection_url(settings: Settings, driver: str) -> URL:
    """Built from parts by SQLAlchemy, which escapes the password; never by formatting a string.

    `Encrypt` is written out so drivers 17 and 18 behave alike: 17 does not encrypt unless told to.
    """
    return URL.create(
        "mssql+pyodbc",
        username=DB_LOGIN,
        password=settings.db_password.get_secret_value(),
        host=settings.db_host,
        port=settings.db_port,
        database=settings.db_name,
        query={"driver": driver, "Encrypt": "yes", "TrustServerCertificate": "yes"},
    )
