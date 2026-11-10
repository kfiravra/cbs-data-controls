"""JSON Pointers into a definition: where each one sits in the document, and which node it belongs to."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any, cast


def escape(token: object) -> str:
    return str(token).replace("~", "~0").replace("/", "~1")


def pointer_of(parts: Iterable[object]) -> str:
    return "".join("/" + escape(part) for part in parts)


def document_positions(document: object) -> dict[str, int]:
    """Every pointer of the document with its rank in the JSON text: an object before the members inside it.

    Walked with a stack of its own, so a document nested thousands of levels deep cannot exhaust the interpreter's.
    """
    positions: dict[str, int] = {}
    pending: list[tuple[object, str]] = [(document, "")]
    while pending:
        value, pointer = pending.pop()
        positions[pointer] = len(positions)
        if isinstance(value, dict):
            members = [(member, f"{pointer}/{escape(name)}") for name, member in cast(dict[str, Any], value).items()]
        elif isinstance(value, list):
            members = [(item, f"{pointer}/{index}") for index, item in enumerate(cast(list[Any], value))]
        else:
            continue
        pending.extend(reversed(members))
    return positions


def group_nesting(document: object) -> int:
    """The depth of the tree as contracts/errors.md counts it, read from the raw document without recursion.

    The root group counts one, each group inside a group one more, and so does the `where` of a related node. It
    asks nothing of the document's shape, so it can run before the schema does.
    """
    deepest = 0
    root = cast(dict[str, Any], document).get("where") if isinstance(document, dict) else None
    pending: list[tuple[object, int]] = [(root, 1)]
    while pending:
        node, depth = pending.pop()
        if not isinstance(node, dict):
            continue
        deepest = max(deepest, depth)
        children = cast(dict[str, Any], node).get("children")
        for child in cast(list[Any], children) if isinstance(children, list) else ():
            if not isinstance(child, dict):
                continue
            members = cast(dict[str, Any], child)
            if isinstance(members.get("children"), list):
                pending.append((members, depth + 1))
            if "where" in members:
                pending.append((members["where"], depth + 1))
    return deepest


def bounded(value: Any, levels: int) -> Any:
    """A copy of the value in which whatever is nested deeper than `levels` is replaced by null."""
    if isinstance(value, dict):
        if levels == 0:
            return None
        return {name: bounded(member, levels - 1) for name, member in cast(dict[str, Any], value).items()}
    if isinstance(value, list):
        if levels == 0:
            return None
        return [bounded(item, levels - 1) for item in cast(list[Any], value)]
    return value


def nesting_exceeds(document: object, levels: int) -> bool:
    """Whether anything in the document is nested deeper than `levels`; no recursion."""
    pending: list[tuple[object, int]] = [(document, 0)]
    while pending:
        value, depth = pending.pop()
        if isinstance(value, dict):
            members: list[Any] = list(cast(dict[str, Any], value).values())
        elif isinstance(value, list):
            members = cast(list[Any], value)
        else:
            continue
        if depth >= levels:
            return True
        pending.extend((member, depth + 1) for member in members)
    return False


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
