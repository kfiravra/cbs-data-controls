"""The schema layer: `contracts/control-definition.schema.json`, one `SCHEMA_VIOLATION` per distinct location."""

from __future__ import annotations

import json
from collections.abc import Hashable, Iterator, Mapping
from pathlib import Path
from typing import Any, cast

from jsonschema import Draft202012Validator, ValidationError, validators

from app.errors import DefinitionError
from app.validator.pointers import bounded, exceeds, nearest_node_id, pointer_of

SCHEMA_FILE = "control-definition.schema.json"
SCHEMA_VIOLATION = "SCHEMA_VIOLATION"


def _identity(item: Any) -> Hashable:
    """What makes two JSON values the same item: 1 and 1.0 are one number, and neither is `true`."""
    if isinstance(item, bool):
        return ("boolean", item)
    if isinstance(item, (int, float)):
        return ("number", item)
    if isinstance(item, str):
        return ("string", item)
    if item is None:
        return ("null",)
    # A list or an object is never a valid item here; it is told apart by its canonical text.
    return ("json", json.dumps(item, sort_keys=True))


def _unique_items(validator: Any, wanted: bool, instance: Any, _schema: Mapping[str, Any]) -> Iterator[ValidationError]:
    """`uniqueItems` in one pass over the list.

    The library's own compares every pair of a list it cannot sort (a string among numbers is enough), which a
    caller could make cost seconds per request. The error sits where the library puts it: at the list.
    """
    if not wanted or not validator.is_type(instance, "array"):
        return
    seen: set[Hashable] = set()
    for item in instance:
        identity = _identity(item)
        if identity in seen:
            yield ValidationError("the list holds an item twice")
            return
        seen.add(identity)


# The draft 2020-12 validator with that one keyword replaced; the library types the result loosely.
_Validator: Any = cast(Any, validators).extend(Draft202012Validator, {"uniqueItems": _unique_items})


class DefinitionSchema:
    """The compiled schema. Built once; `violations` is safe to call from any thread."""

    def __init__(self, schema: Mapping[str, Any]) -> None:
        Draft202012Validator.check_schema(schema)
        self._validator: Draft202012Validator = _Validator(schema)
        # One item more than the longest list the schema allows anywhere: enough for `maxItems` to fail.
        self._list_bound = max(_max_items(schema), default=0) + 1

    def violations(self, document: Mapping[str, Any], group_depth: int) -> list[DefinitionError]:
        """Every location that breaks the schema, once each, in no particular order.

        The location is the instance location of the failing keyword. A member forbidden with `false` under
        `properties` comes out at its object: jsonschema reports a false subschema before it adds the member to
        the path, which is the location contracts/errors.md pins. `group_depth` is the deepest nesting of groups
        the caller lets through to here.
        """
        # The library recurses. A definition with at most `group_depth` nested groups is never nested deeper,
        # as JSON, than two levels a group and a few below the last one, and no valid one holds a list longer
        # than the schema allows; a document beyond either is cut to that size first. The violation is at or
        # above the cut, and the work no longer grows with what a caller sends.
        levels = 2 * group_depth + 8
        instance: Any = document
        if exceeds(document, levels, self._list_bound):
            instance = bounded(document, levels, self._list_bound)
        seen: dict[str, DefinitionError] = {}
        for error in self._validator.iter_errors(instance):  # pyright: ignore[reportUnknownMemberType]
            parts = list(error.absolute_path)
            path = pointer_of(parts)
            if path not in seen:
                seen[path] = DefinitionError(SCHEMA_VIOLATION, path, {}, nearest_node_id(document, parts))
        return list(seen.values())


def _max_items(schema: object) -> list[int]:
    """Every `maxItems` of the schema, wherever it sits."""
    found: list[int] = []
    pending: list[object] = [schema]
    while pending:
        node = pending.pop()
        if isinstance(node, dict):
            members = cast(dict[str, Any], node)
            if isinstance(members.get("maxItems"), int):
                found.append(members["maxItems"])
            pending.extend(members.values())
        elif isinstance(node, list):
            pending.extend(cast(list[Any], node))
    return found


def load_schema(contracts_dir: Path) -> DefinitionSchema:
    with (contracts_dir / SCHEMA_FILE).open(encoding="utf-8") as handle:
        return DefinitionSchema(json.load(handle))
