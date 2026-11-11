"""JSON Pointers into a definition: where each one sits in the document, and which node it belongs to."""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
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


@dataclass(frozen=True, slots=True)
class TreeSize:
    """How big a condition tree is, as contracts/errors.md counts it."""

    depth: int
    nodes: int
    values: int


def tree_size(document: object) -> TreeSize:
    """Depth, nodes and literal values of the tree, read from the raw document without recursion.

    The root group counts one level, each group inside a group one more, and so does the `where` of a related
    node; every child that is not a group counts as a node; a `value` counts one and each item of `values`
    one. It asks nothing of the document's shape, so it can run before the schema does.
    """
    depth = nodes = values = 0
    root = cast(dict[str, Any], document).get("where") if isinstance(document, dict) else None
    pending: list[tuple[object, int]] = [(root, 1)]
    while pending:
        group, level = pending.pop()
        if not isinstance(group, dict):
            continue
        depth = max(depth, level)
        children = cast(dict[str, Any], group).get("children")
        for child in cast(list[Any], children) if isinstance(children, list) else ():
            if not isinstance(child, dict):
                continue
            members = cast(dict[str, Any], child)
            if isinstance(members.get("children"), list):
                pending.append((members, level + 1))
                continue
            nodes += 1
            listed = members.get("values")
            values += ("value" in members) + (len(cast(list[Any], listed)) if isinstance(listed, list) else 0)
            if "where" in members:
                pending.append((members["where"], level + 1))
    return TreeSize(depth, nodes, values)


def bounded(value: Any, levels: int, items: int) -> Any:
    """A copy of the value cut to a size a valid definition never passes.

    Whatever is nested deeper than `levels` is replaced by null, and a list keeps its first `items` items. The
    cut list is still longer than the schema allows, so the violation stays where it was.
    """
    if isinstance(value, dict):
        if levels == 0:
            return None
        return {name: bounded(member, levels - 1, items) for name, member in cast(dict[str, Any], value).items()}
    if isinstance(value, list):
        if levels == 0:
            return None
        return [bounded(item, levels - 1, items) for item in cast(list[Any], value)[:items]]
    return value


def exceeds(document: object, levels: int, items: int) -> bool:
    """Whether anything is nested deeper than `levels`, or any list holds more than `items` items; no recursion."""
    pending: list[tuple[object, int]] = [(document, 0)]
    while pending:
        value, depth = pending.pop()
        if isinstance(value, dict):
            members: list[Any] = list(cast(dict[str, Any], value).values())
        elif isinstance(value, list):
            members = cast(list[Any], value)
            if len(members) > items:
                return True
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
