"""The connection settings as a function: variables and installed drivers in, the ODBC connection string out.

No database and no driver is needed: the string is what SQLAlchemy's dialect hands to pyodbc.
"""

from __future__ import annotations

import logging
import tomllib
from pathlib import Path

import pytest
from pydantic import ValidationError
from sqlalchemy.dialects.mssql import pyodbc as mssql_pyodbc

from app import ENGINE_VERSION
from app.settings import DriverNotFound, Settings, choose_driver, connection_url, load_settings

DRIVER_18 = "ODBC Driver 18 for SQL Server"
DRIVER_17 = "ODBC Driver 17 for SQL Server"
PASSWORD = "test-password-1"  # noqa: S105


def settings_from(monkeypatch: pytest.MonkeyPatch, variables: dict[str, str], env_file: Path | None = None) -> Settings:
    monkeypatch.setenv("DQ_ENGINE_RO_PASSWORD", PASSWORD)
    for name, value in variables.items():
        monkeypatch.setenv(name, value)
    return load_settings(env_file)


def odbc_string(settings: Settings, driver: str = DRIVER_18) -> str:
    arguments, _options = mssql_pyodbc.dialect().create_connect_args(connection_url(settings, driver))
    return arguments[0]


def odbc_parts(settings: Settings, driver: str = DRIVER_18) -> dict[str, str]:
    return dict(part.split("=", 1) for part in odbc_string(settings, driver).split(";") if part)


def test_server_is_host_comma_port_when_a_port_is_set(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = settings_from(monkeypatch, {"ENGINE_DB_HOST": "db", "ENGINE_DB_PORT": "1433"})
    assert odbc_parts(settings)["Server"] == "db,1433"


def test_server_is_the_host_alone_when_no_port_is_set(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = settings_from(monkeypatch, {"ENGINE_DB_HOST": "sql.example.internal"})
    assert odbc_parts(settings)["Server"] == "sql.example.internal"


@pytest.mark.parametrize("host", [".\\SQLEXPRESS", "lpc:(local)\\SQLEXPRESS"])
def test_named_instance_reaches_the_driver_unchanged(monkeypatch: pytest.MonkeyPatch, host: str) -> None:
    settings = settings_from(monkeypatch, {"ENGINE_DB_HOST": host})
    assert odbc_parts(settings)["Server"] == host


def test_empty_port_means_the_same_as_an_unset_port(monkeypatch: pytest.MonkeyPatch) -> None:
    unset = settings_from(monkeypatch, {"ENGINE_DB_HOST": "db"})
    empty = settings_from(monkeypatch, {"ENGINE_DB_HOST": "db", "ENGINE_DB_PORT": ""})
    assert unset.db_port is None
    assert empty.db_port is None
    assert odbc_string(unset) == odbc_string(empty)


def test_empty_port_in_the_environment_wins_over_a_port_in_the_env_file(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text("ENGINE_DB_PORT=1433\n", encoding="utf-8", newline="\n")
    settings = settings_from(monkeypatch, {"ENGINE_DB_PORT": ""}, env_file)
    assert settings.db_port is None


@pytest.mark.parametrize("port", ["abc", "0", "65536", "-1", "14.33"])
def test_bad_port_stops_the_start_and_names_the_variable(monkeypatch: pytest.MonkeyPatch, port: str) -> None:
    with pytest.raises(ValidationError) as raised:
        settings_from(monkeypatch, {"ENGINE_DB_PORT": port})
    assert "ENGINE_DB_PORT" in str(raised.value)


def test_configured_driver_is_used_as_written(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = settings_from(monkeypatch, {"ENGINE_DB_DRIVER": "SQL Server Native Client 11.0"})
    assert choose_driver(settings.db_driver, [DRIVER_18]) == "SQL Server Native Client 11.0"


def test_empty_driver_means_the_same_as_an_unset_driver(monkeypatch: pytest.MonkeyPatch) -> None:
    assert settings_from(monkeypatch, {"ENGINE_DB_DRIVER": ""}).db_driver is None


def test_unset_driver_picks_18_before_17() -> None:
    assert choose_driver(None, ["SQLite3", DRIVER_17, DRIVER_18]) == DRIVER_18


def test_unset_driver_picks_17_when_it_is_alone() -> None:
    assert choose_driver(None, ["SQLite3", DRIVER_17]) == DRIVER_17


def test_no_known_driver_fails_with_the_installed_names() -> None:
    with pytest.raises(DriverNotFound) as raised:
        choose_driver(None, ["SQLite3", "PostgreSQL Unicode"])
    assert raised.value.installed == ("SQLite3", "PostgreSQL Unicode")
    assert "SQLite3" in str(raised.value)
    assert "PostgreSQL Unicode" in str(raised.value)


def test_connection_always_asks_for_encryption_and_uses_the_read_only_login(monkeypatch: pytest.MonkeyPatch) -> None:
    for driver in (DRIVER_17, DRIVER_18):
        parts = odbc_parts(settings_from(monkeypatch, {}), driver)
        assert parts["DRIVER"] == "{" + driver + "}"
        assert parts["Encrypt"] == "yes"
        assert parts["TrustServerCertificate"] == "yes"
        assert parts["UID"] == "dq_engine_ro"
        assert parts["Database"] == "DataControls"


def test_password_with_odbc_delimiters_arrives_whole(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DQ_ENGINE_RO_PASSWORD", "pa;ss}wo{rd")
    settings = load_settings(None)
    # ODBC quoting: the value in braces, a closing brace doubled.
    assert "PWD={pa;ss}}wo{rd}" in odbc_string(settings)


def test_password_is_in_no_repr_and_no_log_line(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    secret = "s3cret;Value}"  # noqa: S105
    monkeypatch.setenv("DQ_ENGINE_RO_PASSWORD", secret)
    settings = load_settings(None)
    url = connection_url(settings, DRIVER_18)
    with caplog.at_level(logging.DEBUG):
        logging.getLogger("app.tests").info("settings %r url %r", settings, url)
        logging.getLogger("app.tests").info("settings %s url %s", settings, url)
    assert secret not in repr(settings)
    assert secret not in str(settings)
    assert secret not in repr(url)
    assert secret not in str(url)
    assert secret not in caplog.text


def test_env_file_is_read_as_utf8(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    name = "בקרות"  # a Hebrew database name, written as escapes: the source stays English
    env_file = tmp_path / ".env"
    env_file.write_bytes(f"ENGINE_DB_NAME={name}\nDQ_ENGINE_RO_PASSWORD={PASSWORD}\n".encode())
    settings = load_settings(env_file)
    assert settings.db_name == name


def test_defaults_are_the_documented_ones(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = settings_from(monkeypatch, {})
    assert (settings.db_host, settings.db_name, settings.db_port, settings.db_driver) == (
        "localhost",
        "DataControls",
        None,
        None,
    )
    assert (settings.row_cap, settings.query_timeout_seconds, settings.startup_db_wait_seconds) == (5000, 30, 30)
    assert (settings.time_zone, settings.debug_compile, settings.log_level, settings.suggest_max) == (
        "Asia/Jerusalem",
        False,
        "INFO",
        10,
    )
    assert settings.contracts_dir == Path(__file__).resolve().parents[3] / "contracts"


def test_unknown_time_zone_stops_the_start_and_names_the_variable(monkeypatch: pytest.MonkeyPatch) -> None:
    with pytest.raises(ValidationError) as raised:
        settings_from(monkeypatch, {"ENGINE_TIME_ZONE": "Mars/Olympus"})
    assert "ENGINE_TIME_ZONE" in str(raised.value)


def test_engine_version_matches_the_project_file() -> None:
    project_file = Path(__file__).resolve().parents[2] / "pyproject.toml"
    with project_file.open("rb") as handle:
        project = tomllib.load(handle)
    assert project["project"]["version"] == ENGINE_VERSION
