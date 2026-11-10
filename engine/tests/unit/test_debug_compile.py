"""`POST /debug/compile`: off unless configured, and when on it shows text with placeholders and runs nothing."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from starlette.testclient import TestClient

from app.main import create_app
from app.services import today_in
from app.settings import Settings
from tests.conftest import EXAMPLES_DIR, read_json

EXAMPLE = EXAMPLES_DIR / "minor-high-salary.json"


def enabled(settings: Settings) -> TestClient:
    return TestClient(create_app(settings.model_copy(update={"debug_compile": True})))


def test_debug_compile_is_off_by_default(client: TestClient) -> None:
    for body in ({"definition": read_json(EXAMPLE)["definition"]}, {}, {"nonsense": 1}):
        response = client.post("/debug/compile", json=body)
        assert response.status_code == 404
        assert response.json()["code"] == "DEBUG_DISABLED"
        assert response.json()["params"] == {}
    assert (
        client.post("/debug/compile", content=b"not json", headers={"content-type": "application/json"}).json()["code"]
        == "DEBUG_DISABLED"
    )


def test_debug_compile_shows_both_statements_with_placeholders(offline_settings: Settings) -> None:
    example = read_json(EXAMPLE)
    response = enabled(offline_settings).post(
        "/debug/compile", json={"definition": example["definition"], "runDate": example["runDate"]}
    )
    body: dict[str, Any] = response.json()
    assert response.status_code == 200
    assert set(body) == {"sql", "params", "countSql", "countParams"}
    assert body["sql"].startswith("SELECT TOP 5000 q.k")
    assert body["countSql"].startswith("SELECT count(*) AS total")
    # The age of the example is a birth-date range on the run date; the thresholds are values beside the text.
    assert {"name": "p0", "type": "Date", "value": "2008-11-01"} in body["params"]
    assert {"name": "p1", "type": "Integer", "value": 15000} in body["params"]
    assert body["params"] == body["countParams"]
    for text in (body["sql"], body["countSql"]):
        assert "15000" not in text and "2008" not in text and ":p0" in text and ":p1" in text


def test_debug_compile_uses_today_when_no_run_date_is_given(offline_settings: Settings) -> None:
    example = read_json(EXAMPLE)
    body = enabled(offline_settings).post("/debug/compile", json={"definition": example["definition"]}).json()
    today = today_in(offline_settings.time_zone)
    assert {"name": "p0", "type": "Date", "value": today.replace(year=today.year - 18).isoformat()} in body["params"]


def test_debug_compile_rejects_an_invalid_definition(offline_settings: Settings) -> None:
    definition = read_json(EXAMPLES_DIR / "invalid" / "unknown-field.json")
    response = enabled(offline_settings).post("/debug/compile", json={"definition": definition["definition"]})
    assert response.status_code == 422
    assert response.json()["code"] == "DEFINITION_INVALID"
    assert [(error["code"], error["path"]) for error in response.json()["errors"]] == [
        (definition["expected"]["code"], definition["expected"]["path"])
    ]


def test_debug_compile_rejects_a_bad_request(offline_settings: Settings) -> None:
    response = enabled(offline_settings).post("/debug/compile", json={"definition": [], "rowCap": 5})
    assert response.status_code == 400
    assert sorted((error["path"], error["code"]) for error in response.json()["errors"]) == [
        ("/definition", "MALFORMED"),
        ("/rowCap", "MALFORMED"),
    ]


def test_today_is_the_date_in_the_configured_zone_not_in_utc() -> None:
    # 22:30 UTC on the 10th is already the 11th in Israel (UTC+2 in November).
    late_evening_utc = datetime(2026, 11, 10, 22, 30, tzinfo=UTC)
    assert today_in("Asia/Jerusalem", late_evening_utc).isoformat() == "2026-11-11"
    assert today_in("UTC", late_evening_utc).isoformat() == "2026-11-10"
