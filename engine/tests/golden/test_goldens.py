"""Golden tests: each example of the contract compiles to the statements and parameters stored beside this file.

`pytest --update-goldens` rewrites them. Read the diff before committing it: it is the compiler's behaviour.
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any

import pytest

from app.compiler import compile_definition, render_statement
from app.glossary import Glossary
from app.validator import DefinitionSchema, validate_definition
from tests.conftest import example_files, read_json

GOLDEN_DIR = Path(__file__).resolve().parent
# The cap a run uses when the caller names none (ENGINE_ROW_CAP's default).
ROW_CAP = 5000


def check_golden(name: str, actual: str, update: bool) -> None:
    """Compare with the stored text; with `--update-goldens`, store it instead. UTF-8 and `\\n` on every system."""
    path = GOLDEN_DIR / name
    if update:
        path.write_text(actual, encoding="utf-8", newline="\n")
        return
    assert path.exists(), f"{name} is missing: run pytest --update-goldens and review the new file"
    assert actual == path.read_text(encoding="utf-8"), f"{name} differs: if the change is meant, --update-goldens"


def as_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


@pytest.mark.parametrize("path", example_files(), ids=lambda path: path.stem)
def test_example_compiles_to_its_golden_statements(
    path: Path, glossary: Glossary, schema: DefinitionSchema, request: pytest.FixtureRequest
) -> None:
    update = bool(request.config.getoption("--update-goldens"))
    example = read_json(path)
    plan = compile_definition(validate_definition(example["definition"], glossary, schema), glossary)
    parameters = plan.parameters(date.fromisoformat(example["runDate"]))
    page = render_statement(plan.page_statement(ROW_CAP), parameters)
    count = render_statement(plan.count, parameters)

    def listed(statement: Any) -> list[dict[str, Any]]:
        return [{"name": item.name, "type": item.type, "value": item.value} for item in statement.parameters]

    check_golden(f"{example['id']}.page.sql", page.sql + "\n", update)
    check_golden(f"{example['id']}.count.sql", count.sql + "\n", update)
    check_golden(f"{example['id']}.params.json", as_json({"page": listed(page), "count": listed(count)}), update)
