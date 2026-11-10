"""The schema layer: `contracts/control-definition.schema.json`, one `SCHEMA_VIOLATION` per distinct location."""

from __future__ import annotations

import json
from collections.abc import Mapping
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

from app.errors import DefinitionError
from app.validator.pointers import nearest_node_id, pointer_of

SCHEMA_FILE = "control-definition.schema.json"
SCHEMA_VIOLATION = "SCHEMA_VIOLATION"


class DefinitionSchema:
    """The compiled schema. Built once; `violations` is safe to call from any thread."""

    def __init__(self, schema: Mapping[str, Any]) -> None:
        Draft202012Validator.check_schema(schema)
        self._validator = Draft202012Validator(schema)

    def violations(self, document: Mapping[str, Any]) -> list[DefinitionError]:
        """Every location that breaks the schema, once each, in no particular order.

        The location is the instance location of the failing keyword. A member forbidden with `false` under
        `properties` comes out at its object: jsonschema reports a false subschema before it adds the member to
        the path, which is the location contracts/errors.md pins.
        """
        seen: dict[str, DefinitionError] = {}
        for error in self._validator.iter_errors(document):  # pyright: ignore[reportUnknownMemberType]
            parts = list(error.absolute_path)
            path = pointer_of(parts)
            if path not in seen:
                seen[path] = DefinitionError(SCHEMA_VIOLATION, path, {}, nearest_node_id(document, parts))
        return list(seen.values())


def load_schema(contracts_dir: Path) -> DefinitionSchema:
    with (contracts_dir / SCHEMA_FILE).open(encoding="utf-8") as handle:
        return DefinitionSchema(json.load(handle))
