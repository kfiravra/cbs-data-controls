"""What the SQL means on real rows: NULL, emptiness, LIKE, Hebrew, parents that are missing, injection.

Field keys are taken from the contract's examples, never spelled here. The record keys are the planted and
boundary rows documented in `sql/README.md`. These tests fail, and never skip, when the database is down.
"""

from __future__ import annotations

import socket
from typing import Any

import pytest
from starlette.testclient import TestClient

from app.main import create_app
from app.services import Services
from app.settings import Settings
from tests.builders import all_of, any_of, definition
from tests.conftest import CONTRACTS_DIR, read_json

pytestmark = pytest.mark.integration

RUN_DATE = "2026-11-01"
# sql/README.md, "Planted and boundary rows".
ALL_EMPLOYEES = 85
NO_SALARY = {"1058", "1084", "1086", "1090", "1115"}
EMAIL_NULL, EMAIL_EMPTY, EMAIL_SPACES = "1081", "1082", "1083"
NO_EMAIL = {EMAIL_NULL, EMAIL_EMPTY, EMAIL_SPACES, "1086", "1088", "1089"}
NO_DEPARTMENT = "1085"
INJECTION = "'; DROP TABLE hr.Employee; --"


def node_of(example_id: str, node_id: str) -> dict[str, Any]:
    """A node of an example of the contract, found by its id."""

    def search(node: dict[str, Any]) -> dict[str, Any] | None:
        if node.get("id") == node_id:
            return node
        for child in [*node.get("children", []), *([node["where"]] if "where" in node else [])]:
            found = search(child)
            if found is not None:
                return found
        return None

    found = search(read_json(CONTRACTS_DIR / "examples" / f"{example_id}.json")["definition"]["where"])
    assert found is not None
    return found


ROOT = read_json(CONTRACTS_DIR / "examples" / "missing-mandatory-data.json")["definition"]["rootEntity"]
# Fields by what they are, read from the examples: a nullable text, a nullable number, a link, a parent's flag.
TEXT = node_of("missing-mandatory-data", "c2")["left"]
NUMBER = node_of("missing-mandatory-data", "c3")["left"]
LINK = node_of("missing-mandatory-data", "c4")["left"]
PARENT_FLAG = node_of("active-in-inactive-department", "c2")["left"]


def condition(node_id: str, left: dict[str, Any], operator: str, **operand: Any) -> dict[str, Any]:
    return {"type": "condition", "id": node_id, "left": left, "operator": operator, **operand}


def run(client: TestClient, where: dict[str, Any]) -> dict[str, Any]:
    response = client.post("/run", json={"definition": definition(ROOT, where), "runDate": RUN_DATE})
    assert response.status_code == 200, response.text
    return response.json()


def keys(answer: dict[str, Any]) -> set[str]:
    return {violation["key"] for violation in answer["violations"]}


@pytest.fixture(scope="module")
def name_field(glossary_document: dict[str, Any]) -> dict[str, Any]:
    """The first identifying field of the root entity: a name, stored in Hebrew in the seed."""
    entity = next(item for item in glossary_document["entities"] if item["key"] == ROOT)
    return {"field": entity["identifyingFields"][0]}


@pytest.fixture(scope="module")
def everyone(live_client: TestClient, name_field: dict[str, Any]) -> dict[str, Any]:
    return run(live_client, all_of(condition("c1", name_field, "is_not_empty")))


def test_seed_holds_the_documented_number_of_records(everyone: dict[str, Any]) -> None:
    assert everyone["totalCount"] == ALL_EMPLOYEES


# --- NULL -----------------------------------------------------------------------------------------------------


def test_missing_value_is_found_only_by_the_null_test(live_client: TestClient) -> None:
    assert keys(run(live_client, all_of(condition("c1", NUMBER, "is_null")))) == NO_SALARY


@pytest.mark.parametrize(
    "operand",
    [
        {"operator": "ne", "value": 1},
        {"operator": "not_in", "values": [1, 2]},
        {"operator": "not_between", "values": [1, 2]},
        {"operator": "gt", "value": 0},
    ],
    ids=lambda operand: operand["operator"],
)
def test_comparison_never_matches_a_null_the_negative_ones_included(
    operand: dict[str, Any], live_client: TestClient
) -> None:
    # Nobody earns 1 or 2, so each of these is true for every known salary and for no missing one.
    answer = run(live_client, all_of(condition("c1", NUMBER, **operand)))
    assert answer["totalCount"] == ALL_EMPLOYEES - len(NO_SALARY)
    assert not keys(answer) & NO_SALARY


def test_negative_text_operator_matches_an_empty_text_and_not_a_null(live_client: TestClient) -> None:
    answer = run(live_client, all_of(condition("c1", TEXT, "not_contains", value="@")))
    assert {EMAIL_EMPTY, EMAIL_SPACES} <= keys(answer)
    assert EMAIL_NULL not in keys(answer)


def test_field_of_a_missing_parent_is_null_and_matches_no_comparison(live_client: TestClient) -> None:
    for value in (True, False):
        assert NO_DEPARTMENT not in keys(run(live_client, all_of(condition("c1", PARENT_FLAG, "eq", value=value))))
        assert NO_DEPARTMENT not in keys(run(live_client, all_of(condition("c1", PARENT_FLAG, "ne", value=value))))


def test_record_with_no_parent_is_still_flagged_through_an_or_branch(live_client: TestClient) -> None:
    where = any_of(condition("c1", PARENT_FLAG, "eq", value=False), condition("c2", LINK, "is_null"))
    answer = run(live_client, where)
    orphan = next(violation for violation in answer["violations"] if violation["key"] == NO_DEPARTMENT)
    assert orphan["matched"] == ["c2"]
    assert orphan["reasons"][0]["params"]["actual"] is None
    # The join did not drop it, and did not multiply anybody either.
    assert len(answer["violations"]) == len(keys(answer)) == answer["totalCount"]


# --- emptiness ------------------------------------------------------------------------------------------------


def test_empty_is_null_or_the_empty_string_or_spaces_only(live_client: TestClient) -> None:
    answer = run(live_client, all_of(condition("c1", TEXT, "is_empty")))
    assert keys(answer) == NO_EMAIL
    stored = {violation["key"]: violation["reasons"][0]["params"]["actual"] for violation in answer["violations"]}
    assert stored[EMAIL_NULL] is None
    assert stored[EMAIL_EMPTY] == ""
    assert stored[EMAIL_SPACES] != "" and stored[EMAIL_SPACES].strip() == ""


def test_not_empty_is_everybody_else(live_client: TestClient) -> None:
    answer = run(live_client, all_of(condition("c1", TEXT, "is_not_empty")))
    assert answer["totalCount"] == ALL_EMPLOYEES - len(NO_EMAIL)
    assert not keys(answer) & NO_EMAIL


# --- LIKE and Hebrew ------------------------------------------------------------------------------------------


def test_like_wildcards_in_an_operand_are_literal(
    live_client: TestClient, everyone: dict[str, Any], name_field: dict[str, Any]
) -> None:
    key = name_field["field"]
    first, second = (violation["display"][key] for violation in everyone["violations"][:2])
    # A class built from the first letters of two seeded names would match both if `[` were a wildcard.
    character_class = f"[{first[0]}{second[0]}]"
    for operand in ("%", "_", character_class, f"{first[0]}%", f"{first[0]}_"):
        for operator in ("contains", "starts_with", "ends_with"):
            answer = run(live_client, all_of(condition("c1", name_field, operator, value=operand)))
            assert answer["totalCount"] == 0, (operator, operand)
    with_letter = run(live_client, all_of(condition("c1", name_field, "starts_with", value=first[0])))
    assert everyone["violations"][0]["key"] in keys(with_letter), "the same letter without a wildcard does match"


def test_hebrew_operand_read_from_the_database_finds_its_record(
    live_client: TestClient, everyone: dict[str, Any], name_field: dict[str, Any]
) -> None:
    key = name_field["field"]
    wanted = everyone["violations"][0]
    name = wanted["display"][key]
    assert any(ord(letter) > 127 for letter in name), "the seeded names are not ASCII"

    answer = run(live_client, all_of(condition("c1", name_field, "eq", value=name)))
    assert wanted["key"] in keys(answer)
    assert {violation["display"][key] for violation in answer["violations"]} == {name}
    assert answer["violations"][0]["reasons"][0]["params"] == {"left": name_field, "actual": name, "value": name}
    listed = run(live_client, all_of(condition("c1", name_field, "in", values=[name, "no such name"])))
    assert keys(listed) == keys(answer)


# --- injection, end to end ------------------------------------------------------------------------------------


def test_injection_text_is_a_value_that_matches_nothing_and_changes_nothing(
    live_client: TestClient, everyone: dict[str, Any], name_field: dict[str, Any]
) -> None:
    for operand in (
        {"operator": "eq", "value": INJECTION},
        {"operator": "in", "values": [INJECTION, "' OR '1'='1"]},
        {"operator": "contains", "value": INJECTION},
        {"operator": "starts_with", "value": INJECTION},
        {"operator": "ends_with", "value": "%' OR 1=1 --"},
    ):
        answer = run(live_client, all_of(condition("c1", name_field, **operand)))
        assert (answer["totalCount"], answer["violations"]) == (0, []), operand
    again = run(live_client, all_of(condition("c1", name_field, "is_not_empty")))
    assert again["totalCount"] == everyone["totalCount"] == ALL_EMPLOYEES


def test_key_or_id_that_carries_sql_is_rejected_before_anything_runs(live_client: TestClient) -> None:
    for document in (
        definition(ROOT + "; DROP TABLE hr.Employee", all_of(condition("c1", TEXT, "is_empty"))),
        definition(ROOT, all_of(condition("c1; DROP TABLE hr.Employee", TEXT, "is_empty"))),
        definition(ROOT, all_of(condition("c1", {"field": "email; DROP TABLE hr.Employee"}, "is_empty"))),
    ):
        response = live_client.post("/run", json={"definition": document, "runDate": RUN_DATE})
        assert response.status_code == 422
        assert {error["code"] for error in response.json()["errors"]} == {"SCHEMA_VIOLATION"}


# --- the database is down -------------------------------------------------------------------------------------


def test_run_is_database_unavailable_when_the_port_is_closed(live_settings: Settings) -> None:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        closed_port = probe.getsockname()[1]
    app = create_app(live_settings.model_copy(update={"db_host": "127.0.0.1", "db_port": closed_port}))
    services: Services = app.state.services
    services.executor.start()
    try:
        where = all_of(condition("c1", TEXT, "is_empty"))
        response = TestClient(app).post("/run", json={"definition": definition(ROOT, where)})
    finally:
        services.executor.dispose()
    assert response.status_code == 503
    assert response.headers["content-type"] == "application/problem+json"
    assert (response.json()["code"], response.json()["params"]) == ("DATABASE_UNAVAILABLE", {})
    assert "errors" not in response.json()
