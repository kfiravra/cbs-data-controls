"""Startup and health against the seeded database. These fail, and never skip, when the database is down."""

from __future__ import annotations

import copy
import json
import socket
from pathlib import Path
from typing import Any

import pytest
from starlette.testclient import TestClient

from app import ENGINE_VERSION
from app.errors import GlossaryMismatch
from app.main import create_app
from app.settings import Settings
from tests.conftest import CONTRACTS_DIR

pytestmark = pytest.mark.integration


def closed_port() -> int:
    """A local port nothing listens on: bound once to learn a free number, then released."""
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


def test_engine_starts_and_reports_health(live_client: TestClient, glossary_document: dict[str, Any]) -> None:
    response = live_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "database": "ok",
        "glossaryVersion": glossary_document["glossaryVersion"],
        "engineVersion": ENGINE_VERSION,
    }


def test_engine_refuses_to_start_on_a_glossary_that_names_a_missing_column(
    live_settings: Settings, glossary_document: dict[str, Any], tmp_path: Path
) -> None:
    doctored = copy.deepcopy(glossary_document)
    entity = doctored["entities"][0]
    field = next(field for field in entity["fields"] if "column" in field and field["column"] != entity["keyColumn"])
    field["column"] = "renamed_by_the_test"
    (tmp_path / "glossary.json").write_text(json.dumps(doctored, ensure_ascii=False), encoding="utf-8", newline="\n")
    (tmp_path / "control-definition.schema.json").write_text(
        (CONTRACTS_DIR / "control-definition.schema.json").read_text(encoding="utf-8"), encoding="utf-8", newline="\n"
    )

    app = create_app(live_settings.model_copy(update={"contracts_dir": tmp_path}))
    with pytest.raises(GlossaryMismatch) as raised, TestClient(app):
        pass
    assert raised.value.params == {
        "table": f"{entity['table']['schema']}.{entity['table']['name']}",
        "column": "renamed_by_the_test",
    }


def test_health_is_database_unavailable_when_the_port_is_closed(live_settings: Settings) -> None:
    settings = live_settings.model_copy(update={"db_host": "127.0.0.1", "db_port": closed_port()})
    app = create_app(settings)
    app.state.services.executor.start()
    try:
        response = TestClient(app).get("/health")
    finally:
        app.state.services.executor.dispose()
    assert response.status_code == 503
    assert response.json()["code"] == "DATABASE_UNAVAILABLE"
    assert response.json()["params"] == {}
