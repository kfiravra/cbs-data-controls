"""JSON Pointers into a definition: where each one sits in the document, and which node it belongs to."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any, cast


def escape(token: object) -> str:
    return str(token).replace("~", "~0").replace("/", "~1")


def pointer_of(parts: Iterable[object]) -> str:
    return "".join("/" + escape(part) for part in parts)


def document_positions(document: object) -> dict[str, int]:
    """Every pointer of the document with its rank in the JSON text: an object before the members inside it."""
    positions: dict[str, int] = {}

    def walk(value: object, pointer: str) -> None:
        positions[pointer] = len(positions)
        if isinstance(value, dict):
            for name, member in cast(dict[str, Any], value).items():
                walk(member, f"{pointer}/{escape(name)}")
        elif isinstance(value, list):
            for index, item in enumerate(cast(list[Any], value)):
                walk(item, f"{pointer}/{index}")

    walk(document, "")
    return positions


def nearest_node_id(document: object, parts: Iterable[object]) -> str | None:
    """The `id` of the nearest node at or above the location that has a string id.

    A node is the root `where`, an item of a `children` list, or the `where` of a related node; a field
    reference is not one, whatever members it carries.
    """
    found: str | None = None
    current: object = document
    previous: object = None
    for part in parts:
        if isinstance(current, dict):
            current = cast(dict[str, Any], current).get(str(part))
        elif isinstance(current, list) and isinstance(part, int) and 0 <= part < len(cast(list[Any], current)):
            current = cast(list[Any], current)[part]
        else:
            break
        is_node = part == "where" or previous == "children"
        if is_node and isinstance(current, dict):
            node_id = cast(dict[str, Any], current).get("id")
            if isinstance(node_id, str):
                found = node_id
        previous = part
    return found
