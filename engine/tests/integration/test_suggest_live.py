"""`POST /suggest` against the seeded database.

The gate: every example of the contract marked `heuristic: true` is proposed, with a definition equal to the
example's node for node, and that definition flags exactly the example's records.
"""

from __future__ import annotations

import socket
from typing import Any

import pytest
from sqlalchemy import Connection
from sqlalchemy.exc import OperationalError
from starlette.testclient import TestClient

from app.main import create_app
from app.services import Services
from app.settings import Settings
from tests.conftest import example_files, read_json

pytestmark = pytest.mark.integration

ITEM_MEMBERS = {"name", "description", "rationale", "evidence", "definition", "sentence", "sentenceParts"}


def heuristic_examples() -> list[Any]:
    examples = [read_json(path) for path in example_files()]
    return [pytest.param(example, id=example["id"]) for example in examples if example.get("heuristic")]


def suggestions(client: TestClient, **body: Any) -> list[dict[str, Any]]:
    response = client.post("/suggest", json=body)
    assert response.status_code == 200, response.text
    assert set(response.json()) == {"items"}
    return response.json()["items"]


@pytest.fixture(scope="module")
def everything(live_client: TestClient) -> list[dict[str, Any]]:
    return suggestions(live_client, max=20)


def test_contract_marks_four_examples_as_reproducible() -> None:
    assert len(heuristic_examples()) == 4


@pytest.mark.parametrize("example", heuristic_examples())
def test_heuristic_example_is_proposed_node_for_node_and_flags_its_records(
    example: dict[str, Any], everything: list[dict[str, Any]], live_client: TestClient
) -> None:
    matching = [item for item in everything if item["definition"] == example["definition"]]
    assert len(matching) == 1, "exactly one suggestion has the example's definition"
    (item,) = matching

    answer = live_client.post("/run", json={"definition": item["definition"], "runDate": example["runDate"]}).json()
    assert answer["totalCount"] == example["expected"]["total"]
    assert [(v["key"], v["matched"]) for v in answer["violations"]] == [
        (v["key"], v["matched"]) for v in example["expected"]["violations"]
    ]
    found = item["evidence"][0]
    assert (found["key"], found["params"]["count"]) == ("violations_found", example["expected"]["total"])
    assert item["sentence"] == answer["sentence"]


def test_example_with_business_thresholds_is_not_proposed(everything: list[dict[str, Any]]) -> None:
    """No generator invents a threshold: a literal in a proposal is a lifecycle value, never a number."""
    unmarked = [read_json(path) for path in example_files() if not read_json(path).get("heuristic")]
    assert unmarked, "the contract keeps at least one example the heuristics cannot know"
    proposed = [item["definition"] for item in everything]
    assert all(example["definition"] not in proposed for example in unmarked)

    def literals(node: dict[str, Any]) -> list[Any]:
        own = [node["value"]] if "value" in node else []
        nested = [*node.get("children", []), *([node["where"]] if "where" in node else [])]
        return own + list(node.get("values", [])) + [value for child in nested for value in literals(child)]

    for definition in proposed:
        assert all(isinstance(value, (bool, str)) for value in literals(definition["where"]))


def test_every_suggestion_is_whole_valid_and_flags_what_its_evidence_says(
    everything: list[dict[str, Any]], live_client: TestClient
) -> None:
    assert everything
    for item in everything:
        assert set(item) == ITEM_MEMBERS
        assert 0 < len(item["name"]) <= 200
        assert item["description"] and item["rationale"]
        assert "".join(part["text"] for part in item["sentenceParts"]) == item["sentence"]
        assert all(set(evidence) == {"key", "params", "text"} and evidence["text"] for evidence in item["evidence"])
        assert "{" not in item["name"] + item["description"] + item["rationale"], "no placeholder is left unfilled"
        assert all("{" not in evidence["text"] for evidence in item["evidence"])

        assert live_client.post("/validate", json={"definition": item["definition"]}).status_code == 200
        today = live_client.post("/run", json={"definition": item["definition"], "rowCap": 1}).json()
        first = item["evidence"][0]
        assert first["key"] == "violations_found"
        assert today["totalCount"] == first["params"]["count"] >= 1


def test_missing_required_evidence_counts_each_field_in_the_state_that_requires_it(
    everything: list[dict[str, Any]], live_client: TestClient
) -> None:
    example = read_json(next(path for path in example_files() if path.stem == "missing-mandatory-data"))
    (item,) = [candidate for candidate in everything if candidate["definition"] == example["definition"]]
    counted = {evidence["params"]["field"]: evidence["params"]["count"] for evidence in item["evidence"][1:]}
    assert all(evidence["key"] == "field_missing" for evidence in item["evidence"][1:])

    # The same numbers, read from the example file: in how many expected records each "missing" node is matched.
    def missing_nodes(node: dict[str, Any]) -> dict[str, str]:
        if node["type"] == "condition":
            return {node["left"]["field"]: node["id"]} if node["operator"] in ("is_null", "is_empty") else {}
        return {field: node_id for child in node["children"] for field, node_id in missing_nodes(child).items()}

    expected = {
        field: sum(node_id in violation["matched"] for violation in example["expected"]["violations"])
        for field, node_id in missing_nodes(example["definition"]["where"]).items()
    }
    assert counted == expected


def test_date_order_evidence_is_the_split_the_seed_documents(everything: list[dict[str, Any]]) -> None:
    example = read_json(next(path for path in example_files() if path.stem == "termination-before-hire"))
    (item,) = [candidate for candidate in everything if candidate["definition"] == example["definition"]]
    split = item["evidence"][1]
    # sql/README.md: 25 employees have both dates, and three have the termination before the hire.
    assert (split["key"], split["params"]) == ("date_order_split", {"count": 3, "total": 25})


def test_max_cuts_the_answer_and_keeps_its_order(live_client: TestClient, everything: list[dict[str, Any]]) -> None:
    assert suggestions(live_client, max=1) == everything[:1]
    assert suggestions(live_client, max=3) == everything[:3]
    assert suggestions(live_client) == everything[:10]  # the default
    assert suggestions(live_client, max=500) == everything  # above the ceiling of 20 is the ceiling


def test_root_entity_keeps_the_suggestions_rooted_there(
    live_client: TestClient, everything: list[dict[str, Any]], glossary_document: dict[str, Any]
) -> None:
    for entity in glossary_document["entities"]:
        rooted = suggestions(live_client, rootEntity=entity["key"], max=20)
        assert rooted == [item for item in everything if item["definition"]["rootEntity"] == entity["key"]]
    assert suggestions(live_client, rootEntity="no_such_entity") == []


def test_bad_request_member_is_refused(live_client: TestClient) -> None:
    response = live_client.post("/suggest", json={"max": 0, "limit": 5})
    assert response.status_code == 400
    assert sorted((error["path"], error["code"]) for error in response.json()["errors"]) == [
        ("/limit", "MALFORMED"),
        ("/max", "OUT_OF_RANGE"),
    ]


def test_statement_that_runs_past_the_timeout_is_a_query_timeout(
    live_client: TestClient, live_settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    """As for `/run`: the driver's error is fabricated, everything around it is real."""

    def times_out(_connection: Any, statement: Any, *_args: Any, **_kwargs: Any) -> Any:
        raise OperationalError(str(statement), {}, Exception("HYT00", "[HYT00] Query timeout expired"))

    monkeypatch.setattr(Connection, "execute", times_out)
    response = live_client.post("/suggest", json={})
    assert response.status_code == 504
    assert (response.json()["code"], response.json()["params"]) == (
        "QUERY_TIMEOUT",
        {"timeoutSeconds": live_settings.query_timeout_seconds},
    )


def test_suggest_is_database_unavailable_when_the_port_is_closed(live_settings: Settings) -> None:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        closed_port = probe.getsockname()[1]
    app = create_app(live_settings.model_copy(update={"db_host": "127.0.0.1", "db_port": closed_port}))
    services: Services = app.state.services
    services.executor.start()
    try:
        response = TestClient(app).post("/suggest", json={})
    finally:
        services.executor.dispose()
    assert (response.status_code, response.json()["code"]) == (503, "DATABASE_UNAVAILABLE")
