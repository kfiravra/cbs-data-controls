"""The schema layer: `contracts/control-definition.schema.json`, one `SCHEMA_VIOLATION` per distinct location."""

from __future__ import annotations

import json
from collections.abc import Mapping
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

from app.errors import DefinitionError
from app.validator.pointers import bounded, nearest_node_id, nesting_exceeds, pointer_of

SCHEMA_FILE = "control-definition.schema.json"
SCHEMA_VIOLATION = "SCHEMA_VIOLATION"
# Groups nested deeper than this are answered with TOO_DEEP before the schema is asked (see `validate_definition`).
WALKABLE_GROUP_DEPTH = 32
# Each group level adds two JSON levels (its `children` list, then the node); a condition adds a few below it.
JSON_NESTING_BOUND = 2 * WALKABLE_GROUP_DEPTH + 8


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
        # The library walks recursively. A valid definition is never nested deeper than JSON_NESTING_BOUND, so
        # whatever lies below it is cut off first: the violation is at or above the cut.
        instance = bounded(document, JSON_NESTING_BOUND) if nesting_exceeds(document, JSON_NESTING_BOUND) else document
        seen: dict[str, DefinitionError] = {}
        for error in self._validator.iter_errors(instance):  # pyright: ignore[reportUnknownMemberType]
            parts = list(error.absolute_path)
            path = pointer_of(parts)
            if path not in seen:
                seen[path] = DefinitionError(SCHEMA_VIOLATION, path, {}, nearest_node_id(document, parts))
        return list(seen.values())


def load_schema(contracts_dir: Path) -> DefinitionSchema:
    with (contracts_dir / SCHEMA_FILE).open(encoding="utf-8") as handle:
        return DefinitionSchema(json.load(handle))
