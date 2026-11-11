"""Helpers shared by the validator's test modules."""

from __future__ import annotations

from typing import Any

import pytest

from app.errors import DefinitionInvalid
from app.glossary import Glossary, parse_glossary
from app.validator import DefinitionSchema, validate_definition
from tests.builders import all_of, cond
from tests.synthetic import synthetic_document

C0 = "/where/children/0"
C1 = "/where/children/1"


def rejected(document: dict[str, Any], glossary: Glossary, schema: DefinitionSchema) -> list[dict[str, Any]]:
    with pytest.raises(DefinitionInvalid) as raised:
        validate_definition(document, glossary, schema)
    return [error.to_json() for error in raised.value.errors]


def codes_and_paths(errors: list[dict[str, Any]]) -> list[tuple[str, str]]:
    return [(error["code"], error["path"]) for error in errors]


def doctored(glossary_document: dict[str, Any], change: Any) -> Glossary:
    document = synthetic_document(glossary_document)
    change(document)
    return parse_glossary(document)


def nested(depth: int) -> dict[str, Any]:
    """A chain of `depth` groups with one condition at the bottom."""
    node = all_of(cond("c1", "title", "eq", "x"))
    for _ in range(depth - 1):
        node = all_of(node)
    return node
