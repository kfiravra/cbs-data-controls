"""Short builders for definitions, so a test shows the tree and not the JSON around it."""

from __future__ import annotations

from typing import Any

_ABSENT: Any = object()


def cond(
    node_id: str,
    field: str,
    operator: str,
    value: Any = _ABSENT,
    *,
    path: list[str] | None = None,
    values: list[Any] | None = None,
    right: dict[str, Any] | None = None,
) -> dict[str, Any]:
    left: dict[str, Any] = {"field": field} if path is None else {"path": path, "field": field}
    node: dict[str, Any] = {"type": "condition", "id": node_id, "left": left, "operator": operator}
    if value is not _ABSENT:
        node["value"] = value
    if values is not None:
        node["values"] = values
    if right is not None:
        node["right"] = right
    return node


def ref(field: str, path: list[str] | None = None) -> dict[str, Any]:
    return {"field": field} if path is None else {"path": path, "field": field}


def all_of(*children: dict[str, Any]) -> dict[str, Any]:
    return {"type": "group", "op": "and", "children": list(children)}


def any_of(*children: dict[str, Any]) -> dict[str, Any]:
    return {"type": "group", "op": "or", "children": list(children)}


def related(node_id: str, relationship: str, quantifier: str, where: dict[str, Any]) -> dict[str, Any]:
    return {"type": "related", "id": node_id, "relationship": relationship, "quantifier": quantifier, "where": where}


def definition(root: str, where: dict[str, Any]) -> dict[str, Any]:
    return {"schemaVersion": 1, "rootEntity": root, "where": where}
