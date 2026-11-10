"""The six examples of the contract through `POST /run` and `POST /validate`, against the seeded database.

Expected records and matched ids come from `contracts/examples/*.json`, and one full answer from the example of
`contracts/api.md`. These tests fail, and never skip, when the database is down.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import pytest
from starlette.testclient import TestClient

from app import ENGINE_VERSION
from app.services import today_in
from app.settings import Settings
from tests.conftest import CONTRACTS_DIR, example_files, invalid_files, read_json

pytestmark = pytest.mark.integration

MISSING_DATA = "missing-mandatory-data"


def runs() -> list[Any]:
    """Every example on its run date, and on each of its alternate dates."""
    cases: list[Any] = []
    for path in example_files():
        example = read_json(path)
        cases.append(pytest.param(example, example["runDate"], example["expected"], id=example["id"]))
        for alternate in example.get("alternateRuns", []):
            cases.append(
                pytest.param(
                    example, alternate["runDate"], alternate["expected"], id=f"{example['id']}@{alternate['runDate']}"
                )
            )
    return cases


def example(example_id: str) -> dict[str, Any]:
    return read_json(CONTRACTS_DIR / "examples" / f"{example_id}.json")


def run(client: TestClient, definition: dict[str, Any], **members: Any) -> dict[str, Any]:
    response = client.post("/run", json={"definition": definition, **members})
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.parametrize(("case", "run_date", "expected"), runs())
def test_example_flags_exactly_the_records_the_contract_expects(
    case: dict[str, Any], run_date: str, expected: dict[str, Any], live_client: TestClient
) -> None:
    answer = run(live_client, case["definition"], runDate=run_date)

    assert answer["runDate"] == run_date
    assert answer["totalCount"] == expected["total"]
    assert [(v["key"], v["matched"]) for v in answer["violations"]] == [
        (v["key"], v["matched"]) for v in expected["violations"]
    ]
    assert (answer["returnedCount"], answer["capExceeded"]) == (expected["total"], False)
    assert (answer["engineVersion"], answer["glossaryVersion"]) == (ENGINE_VERSION, "1.0.0")
    assert isinstance(answer["durationMs"], int)


@pytest.mark.parametrize(("case", "run_date", "expected"), runs())
def test_counts_per_node_agree_with_the_rows(
    case: dict[str, Any], run_date: str, expected: dict[str, Any], live_client: TestClient
) -> None:
    answer = run(live_client, case["definition"], runDate=run_date)
    in_rows: dict[str, int] = {}
    for violation in expected["violations"]:
        for node_id in violation["matched"]:
            in_rows[node_id] = in_rows.get(node_id, 0) + 1
    assert {item["id"]: item["count"] for item in answer["conditions"]} == {
        item["id"]: in_rows.get(item["id"], 0) for item in answer["conditions"]
    }
    for violation in answer["violations"]:
        assert [reason["conditionId"] for reason in violation["reasons"]] == violation["matched"]
        assert (
            violation["reasonText"]
            and "".join(part["text"] for part in violation["reasons"][0]["textParts"])
            == (violation["reasons"][0]["text"])
        )


def test_answer_is_the_example_of_the_api_contract(live_client: TestClient) -> None:
    """contracts/api.md §5 shows one request and its whole answer; only the duration may differ."""
    section = (CONTRACTS_DIR / "api.md").read_text(encoding="utf-8").split("### A `/run` answer", 1)[1]
    request, expected = (json.loads(block) for block in re.findall(r"```json\n(.*?)```", section, flags=re.DOTALL)[:2])
    response = live_client.post("/run", json=request, headers={"Accept-Language": "he"})
    answer = response.json()
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json"
    assert set(answer) == set(expected)
    answer.pop("durationMs")
    expected.pop("durationMs")
    assert answer == expected


def test_row_cap_cuts_the_rows_and_never_the_counts(live_client: TestClient) -> None:
    case = example(MISSING_DATA)
    whole = run(live_client, case["definition"], runDate=case["runDate"])
    capped = run(live_client, case["definition"], runDate=case["runDate"], rowCap=1)

    assert capped["totalCount"] == case["expected"]["total"]
    assert (capped["returnedCount"], capped["capExceeded"]) == (1, True)
    assert [v["key"] for v in capped["violations"]] == [case["expected"]["violations"][0]["key"]]
    assert capped["conditions"] == whole["conditions"], "counts are over all violations, whatever the cap"


def test_row_cap_above_the_ceiling_is_the_ceiling(live_client: TestClient, live_settings: Settings) -> None:
    case = example(MISSING_DATA)
    answer = run(live_client, case["definition"], runDate=case["runDate"], rowCap=live_settings.row_cap * 1000)
    assert answer["returnedCount"] == case["expected"]["total"]


def test_run_date_defaults_to_today_in_the_configured_zone(live_client: TestClient, live_settings: Settings) -> None:
    case = example(MISSING_DATA)
    assert run(live_client, case["definition"])["runDate"] == today_in(live_settings.time_zone).isoformat()


@pytest.mark.parametrize("header", ["fr", "en-US,he;q=0.5", "*", ""])
def test_language_that_is_not_listed_is_answered_in_the_default(header: str, live_client: TestClient) -> None:
    case = example(MISSING_DATA)
    body = {"definition": case["definition"], "runDate": case["runDate"], "rowCap": 1}
    default = live_client.post("/run", json=body).json()
    asked = live_client.post("/run", json=body, headers={"Accept-Language": header}).json()
    for member in ("sentence", "sentenceParts", "conditions", "violations"):
        assert asked[member] == default[member]


@pytest.mark.parametrize("path", example_files(), ids=lambda path: path.stem)
def test_validate_previews_the_sentence_a_run_will_carry(path: Path, live_client: TestClient) -> None:
    case = read_json(path)
    preview = live_client.post("/validate", json={"definition": case["definition"]})
    answer = run(live_client, case["definition"], runDate=case["runDate"], rowCap=1)

    assert preview.status_code == 200
    body = preview.json()
    assert set(body) == {"valid", "sentence", "sentenceParts", "conditions"}
    assert body["valid"] is True
    assert (body["sentence"], body["sentenceParts"]) == (answer["sentence"], answer["sentenceParts"])
    assert body["conditions"] == [
        {name: value for name, value in item.items() if name != "count"} for item in answer["conditions"]
    ]
    assert "".join(part["text"] for part in body["sentenceParts"]) == body["sentence"]


@pytest.mark.parametrize("path", invalid_files(), ids=lambda path: path.stem)
@pytest.mark.parametrize("endpoint", ["/validate", "/run"])
def test_invalid_fixture_is_a_definition_problem_on_both_endpoints(
    endpoint: str, path: Path, live_client: TestClient
) -> None:
    fixture = read_json(path)
    response = live_client.post(endpoint, json={"definition": fixture["definition"]})
    problem = response.json()
    assert response.status_code == 422
    assert response.headers["content-type"] == "application/problem+json"
    assert (problem["code"], problem["params"]) == ("DEFINITION_INVALID", {})
    assert [(error["code"], error["path"]) for error in problem["errors"]] == [
        (fixture["expected"]["code"], fixture["expected"]["path"])
    ]
