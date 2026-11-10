"""Reading, comparing and rewriting the golden files of this folder."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

GOLDEN_DIR = Path(__file__).resolve().parent


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
