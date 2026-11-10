"""The HTTP edge without a database: problems, the correlation id, the language, the glossary endpoint."""

from __future__ import annotations

import re
from typing import Any

import pytest
from starlette.testclient import TestClient

from app.errors import InternalError
from app.glossary import Glossary, public_view
from app.main import create_app
from app.settings import Settings
from app.web import MAX_BODY_BYTES, RunRequest, SuggestRequest, resolve_language

PROBLEM_KEYS = {"type", "title", "status", "code", "params", "correlationId"}
HEX_32 = re.compile(r"^[0-9a-f]{32}$")
VALID_BODY: dict[str, Any] = {"definition": {}}


def assert_problem(response: Any, status: int, code: str, *, with_errors: bool = False) -> dict[str, Any]:
    body = response.json()
    assert response.status_code == status
    assert response.headers["content-type"] == "application/problem+json"
    assert set(body) == PROBLEM_KEYS | ({"errors"} if with_errors else set())
    assert (body["type"], body["title"], body["status"], body["code"]) == ("about:blank", code, status, code)
    assert body["correlationId"] == response.headers["x-correlation-id"]
    return body


@pytest.fixture
def probe(offline_settings: Settings) -> TestClient:
    """The application plus two test-only routes: one takes the run request, one fails inside."""
    app = create_app(offline_settings)

    @app.post("/probe/run")
    def run(body: RunRequest) -> dict[str, Any]:
        return {"runDate": None if body.run_date is None else body.run_date.isoformat(), "rowCap": body.row_cap}

    @app.post("/probe/suggest")
    def suggest(body: SuggestRequest) -> dict[str, Any]:
        return {"rootEntity": body.root_entity, "max": body.max}

    @app.get("/probe/crash")
    def crash() -> None:
        raise RuntimeError("SELECT secret FROM hr.Employee -- a message that must not reach the caller")

    @app.get("/probe/internal")
    def internal() -> None:
        raise InternalError()

    return TestClient(app)


# --- problems -------------------------------------------------------------------------------------------------


def test_unknown_path_is_a_not_found_problem(client: TestClient) -> None:
    body = assert_problem(client.get("/no/such/path"), 404, "NOT_FOUND")
    assert body["params"] == {}


def test_method_the_path_does_not_serve_is_not_found(client: TestClient) -> None:
    assert_problem(client.delete("/glossary"), 404, "NOT_FOUND")


def test_path_with_a_trailing_slash_is_not_found_and_not_a_redirect(client: TestClient) -> None:
    for path in ("/health/", "/glossary/"):
        assert_problem(client.get(path, follow_redirects=False), 404, "NOT_FOUND")


def test_interactive_docs_are_not_served(client: TestClient) -> None:
    for path in ("/docs", "/redoc", "/openapi.json"):
        assert_problem(client.get(path), 404, "NOT_FOUND")


def test_unhandled_error_is_an_internal_error_without_its_message(probe: TestClient) -> None:
    response = probe.get("/probe/crash")
    assert_problem(response, 500, "INTERNAL_ERROR")
    assert "secret" not in response.text
    assert "Traceback" not in response.text


def test_domain_error_is_answered_with_its_code_and_status(probe: TestClient) -> None:
    assert_problem(probe.get("/probe/internal"), 500, "INTERNAL_ERROR")


def test_health_is_database_unavailable_when_nothing_was_started(client: TestClient) -> None:
    assert_problem(client.get("/health"), 503, "DATABASE_UNAVAILABLE")


# --- request errors -------------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("body", "expected"),
    [
        ({}, [{"path": "/definition", "code": "REQUIRED", "params": {}}]),
        ({"definition": None}, [{"path": "/definition", "code": "REQUIRED", "params": {}}]),
        ({"definition": []}, [{"path": "/definition", "code": "MALFORMED", "params": {}}]),
        ({"definition": "x"}, [{"path": "/definition", "code": "MALFORMED", "params": {}}]),
        ({**VALID_BODY, "sql": "x"}, [{"path": "/sql", "code": "MALFORMED", "params": {}}]),
        ({**VALID_BODY, "rowCap": 0}, [{"path": "/rowCap", "code": "OUT_OF_RANGE", "params": {"min": 1}}]),
        ({**VALID_BODY, "rowCap": -3}, [{"path": "/rowCap", "code": "OUT_OF_RANGE", "params": {"min": 1}}]),
        ({**VALID_BODY, "rowCap": "5"}, [{"path": "/rowCap", "code": "MALFORMED", "params": {}}]),
        ({**VALID_BODY, "rowCap": 2.5}, [{"path": "/rowCap", "code": "MALFORMED", "params": {}}]),
        ({**VALID_BODY, "rowCap": True}, [{"path": "/rowCap", "code": "MALFORMED", "params": {}}]),
        ({**VALID_BODY, "runDate": "2026-02-30"}, [{"path": "/runDate", "code": "MALFORMED", "params": {}}]),
        ({**VALID_BODY, "runDate": "01.11.2026"}, [{"path": "/runDate", "code": "MALFORMED", "params": {}}]),
        ({**VALID_BODY, "runDate": "20261101"}, [{"path": "/runDate", "code": "MALFORMED", "params": {}}]),
        ({**VALID_BODY, "runDate": 20261101}, [{"path": "/runDate", "code": "MALFORMED", "params": {}}]),
    ],
)
def test_bad_request_member_is_listed_with_its_pointer_and_code(probe: TestClient, body: Any, expected: Any) -> None:
    problem = assert_problem(probe.post("/probe/run", json=body), 400, "REQUEST_INVALID", with_errors=True)
    assert problem["errors"] == expected


def test_several_bad_members_are_listed_together(probe: TestClient) -> None:
    problem = assert_problem(
        probe.post("/probe/run", json={"rowCap": 0, "extra": 1}), 400, "REQUEST_INVALID", with_errors=True
    )
    assert sorted((error["path"], error["code"]) for error in problem["errors"]) == [
        ("/definition", "REQUIRED"),
        ("/extra", "MALFORMED"),
        ("/rowCap", "OUT_OF_RANGE"),
    ]


def test_body_that_is_not_an_object_is_malformed_at_the_root(probe: TestClient) -> None:
    problem = assert_problem(probe.post("/probe/run", json=[1, 2]), 400, "REQUEST_INVALID", with_errors=True)
    assert problem["errors"] == [{"path": "", "code": "MALFORMED", "params": {}}]


def test_null_means_not_given_for_an_optional_member(probe: TestClient) -> None:
    response = probe.post("/probe/run", json={**VALID_BODY, "runDate": None, "rowCap": None})
    assert response.status_code == 200
    assert response.json() == {"runDate": None, "rowCap": None}


def test_real_date_and_cap_are_accepted(probe: TestClient) -> None:
    response = probe.post("/probe/run", json={**VALID_BODY, "runDate": "2028-02-29", "rowCap": 1})
    assert response.json() == {"runDate": "2028-02-29", "rowCap": 1}


@pytest.mark.parametrize(
    ("body", "expected"),
    [
        ({"max": 0}, [{"path": "/max", "code": "OUT_OF_RANGE", "params": {"min": 1}}]),
        ({"max": "ten"}, [{"path": "/max", "code": "MALFORMED", "params": {}}]),
        ({"rootEntity": 7}, [{"path": "/rootEntity", "code": "MALFORMED", "params": {}}]),
        ({"limit": 5}, [{"path": "/limit", "code": "MALFORMED", "params": {}}]),
    ],
)
def test_bad_suggest_member_is_listed(probe: TestClient, body: Any, expected: Any) -> None:
    problem = assert_problem(probe.post("/probe/suggest", json=body), 400, "REQUEST_INVALID", with_errors=True)
    assert problem["errors"] == expected


def test_max_above_the_ceiling_is_not_an_error(probe: TestClient) -> None:
    assert probe.post("/probe/suggest", json={"max": 500}).status_code == 200


def test_body_that_is_not_json_is_415_without_an_error_list(probe: TestClient) -> None:
    headers = {"content-type": "application/json"}
    assert_problem(probe.post("/probe/run", content=b'{"definition": ', headers=headers), 415, "REQUEST_INVALID")
    assert_problem(probe.post("/probe/run", content=b"\xff\xfe{}", headers=headers), 415, "REQUEST_INVALID")


def test_body_of_another_media_type_is_415(probe: TestClient) -> None:
    response = probe.post("/probe/run", content=b'{"definition": {}}', headers={"content-type": "text/plain"})
    assert_problem(response, 415, "REQUEST_INVALID")
    assert_problem(probe.post("/probe/run", data={"definition": "x"}), 415, "REQUEST_INVALID")


def test_request_without_a_body_is_judged_by_its_path_not_its_media_type(probe: TestClient) -> None:
    assert_problem(probe.post("/no/such/path"), 404, "NOT_FOUND")
    problem = assert_problem(probe.post("/probe/run"), 400, "REQUEST_INVALID", with_errors=True)
    assert problem["errors"] == [{"path": "", "code": "REQUIRED", "params": {}}]


def test_unknown_path_is_not_found_whatever_the_body_says_it_is(probe: TestClient) -> None:
    response = probe.post("/no/such/path", content=b"plain text", headers={"content-type": "text/plain"})
    assert_problem(response, 404, "NOT_FOUND")


def test_body_over_the_size_limit_is_413(probe: TestClient) -> None:
    oversized = b'{"definition": {"pad": "' + b"x" * MAX_BODY_BYTES + b'"}}'
    response = probe.post("/probe/run", content=oversized, headers={"content-type": "application/json"})
    assert_problem(response, 413, "REQUEST_INVALID")


def test_streamed_body_over_the_size_limit_is_413(probe: TestClient) -> None:
    def chunks() -> Any:
        yield b'{"definition": {"pad": "'
        for _ in range(MAX_BODY_BYTES // 65536 + 2):
            yield b"x" * 65536
        yield b'"}}'

    response = probe.post("/probe/run", content=chunks(), headers={"content-type": "application/json"})
    assert_problem(response, 413, "REQUEST_INVALID")


# --- correlation id -------------------------------------------------------------------------------------------


def test_correlation_id_of_the_request_is_returned(client: TestClient) -> None:
    response = client.get("/glossary", headers={"X-Correlation-Id": "api-7f3a.2026_11"})
    assert response.headers["x-correlation-id"] == "api-7f3a.2026_11"


@pytest.mark.parametrize("given", ["has space", "x" * 65, "semi;colon", ""])
def test_correlation_id_that_does_not_fit_is_replaced(client: TestClient, given: str) -> None:
    response = client.get("/glossary", headers={"X-Correlation-Id": given})
    assert HEX_32.fullmatch(response.headers["x-correlation-id"])


def test_correlation_id_is_created_when_none_is_sent_and_differs_per_request(client: TestClient) -> None:
    first = client.get("/no/such/path").json()["correlationId"]
    second = client.get("/no/such/path").json()["correlationId"]
    assert HEX_32.fullmatch(first)
    assert HEX_32.fullmatch(second)
    assert first != second


# --- language -------------------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("header", "expected"),
    [
        (None, "he"),
        ("", "he"),
        ("he", "he"),
        ("he-IL,en;q=0.8", "he"),
        ("HE-il", "he"),
        ("en-US,he;q=0.9", "he"),  # only the first range counts, and it is not listed: the default
        ("fr;q=0.5", "he"),
        ("*", "he"),
    ],
)
def test_language_is_the_first_range_when_listed_else_the_default(header: str | None, expected: str) -> None:
    assert resolve_language(header, ["he"], "he") == expected


def test_language_follows_the_list_it_is_given() -> None:
    assert resolve_language("en-GB", ["he", "en"], "he") == "en"
    assert resolve_language("de", ["he", "en"], "en") == "en"


# --- the glossary endpoint ------------------------------------------------------------------------------------


def test_glossary_endpoint_serves_the_public_view(client: TestClient, glossary: Glossary) -> None:
    response = client.get("/glossary")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json"
    assert response.json() == public_view(glossary)
