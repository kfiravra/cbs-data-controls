"""The words a user reads: the rule sentence, a sentence per node and one reason per matched node, per example.

Stored as `tests/golden/<id>.text.json`, in every language the glossary lists, from a run on the seeded database.
They are read by a person before the gate: the engine renders the glossary's templates mechanically, and this is
where an awkward sentence shows. `pytest --update-goldens` rewrites them.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from starlette.testclient import TestClient

from tests.conftest import example_files, read_json
from tests.golden.test_goldens import as_json, check_golden

pytestmark = pytest.mark.integration


def rendered_texts(client: TestClient, example: dict[str, Any], language: str) -> dict[str, Any]:
    response = client.post(
        "/run",
        json={"definition": example["definition"], "runDate": example["runDate"]},
        headers={"Accept-Language": language},
    )
    assert response.status_code == 200, response.text
    answer = response.json()
    reasons: dict[str, str] = {}
    for violation in answer["violations"]:
        for reason in violation["reasons"]:
            # The first record that matches a node gives its sample reason.
            reasons.setdefault(reason["conditionId"], reason["text"])
    return {
        "sentence": answer["sentence"],
        "conditions": {item["id"]: item["sentence"] for item in answer["conditions"]},
        "reasons": {item["id"]: reasons[item["id"]] for item in answer["conditions"] if item["id"] in reasons},
        "firstReasonText": answer["violations"][0]["reasonText"],
    }


@pytest.mark.parametrize("path", example_files(), ids=lambda path: path.stem)
def test_example_reads_as_its_golden_text(
    path: Path, live_client: TestClient, glossary_document: dict[str, Any], request: pytest.FixtureRequest
) -> None:
    example = read_json(path)
    texts = {language: rendered_texts(live_client, example, language) for language in glossary_document["languages"]}
    for language_texts in texts.values():
        matched_somewhere = {node for violation in example["expected"]["violations"] for node in violation["matched"]}
        assert set(language_texts["reasons"]) == matched_somewhere, "one reason per node that is matched somewhere"
    check_golden(f"{example['id']}.text.json", as_json(texts), bool(request.config.getoption("--update-goldens")))
