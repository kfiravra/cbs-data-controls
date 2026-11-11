"""The building blocks of a suggested definition, and the conventions every generator shares.

Ids are `c1..` for conditions and `r1..` for related nodes, in document order; fields come in glossary order; an
OR of one child collapses to that child; the root is always a group. Everything is read from the glossary: no
entity, field or relationship is named here.
"""

from __future__ import annotations

from typing import Any

from app.glossary import Entity, Field

Node = dict[str, Any]


def condition(field_key: str, operator: str, path: list[str] | None = None, **operand: Any) -> Node:
    """A condition without its id; `number_nodes` gives the ids once the tree is whole."""
    left: Node = {"field": field_key} if not path else {"path": list(path), "field": field_key}
    return {"type": "condition", "id": "", "left": left, "operator": operator, **operand}


def related(relationship: str, quantifier: str, where: Node) -> Node:
    return {"type": "related", "id": "", "relationship": relationship, "quantifier": quantifier, "where": where}


def all_of(*children: Node) -> Node:
    return {"type": "group", "op": "and", "children": list(children)}


def any_of(children: list[Node]) -> Node:
    """An OR group; with one child it is that child."""
    return children[0] if len(children) == 1 else {"type": "group", "op": "or", "children": list(children)}


def as_root(node: Node) -> Node:
    """The root of a definition is always a group."""
    return node if node["type"] == "group" else all_of(node)


def definition(root: Entity, where: Node) -> Node:
    return {"schemaVersion": 1, "rootEntity": root.key, "where": number_nodes(as_root(where))}


def number_nodes(where: Node) -> Node:
    """Give every condition and related node its id, in document order."""
    counters = {"condition": 0, "related": 0}
    prefixes = {"condition": "c", "related": "r"}

    def visit(node: Node) -> None:
        kind = node["type"]
        if kind in counters:
            counters[kind] += 1
            node["id"] = f"{prefixes[kind]}{counters[kind]}"
        for child in node.get("children", ()):
            visit(child)
        if kind == "related":
            visit(node["where"])

    visit(where)
    return where


def missing_operator(field: Field) -> str | None:
    """How a field is found missing: text can also be empty, everything else can only be NULL.

    None when the glossary does not let the field be tested that way (a number that is never NULL, a field whose
    own operator list leaves the test out): such a field cannot be missing, and no proposal asks whether it is.
    """
    operator = "is_empty" if field.type == "text" else "is_null"
    return operator if operator in field.operators else None


def is_missing(field: Field) -> Node | None:
    operator = missing_operator(field)
    return None if operator is None else condition(field.key, operator)


def is_active(entity: Entity, path: list[str] | None = None) -> Node | None:
    """The entity's lifecycle field equal to the value that means active; None when it has no lifecycle."""
    if entity.lifecycle is None:
        return None
    return condition(entity.lifecycle.field, "eq", path, value=entity.lifecycle.active)


def is_inactive(entity: Entity, path: list[str] | None = None) -> Node | None:
    """Equal to the other value when the lifecycle field has exactly two, else different from the active one."""
    if entity.lifecycle is None:
        return None
    field = entity.fields[entity.lifecycle.field]
    active = entity.lifecycle.active
    values: list[Any] = [True, False] if field.type == "bool" else [item.value for item in field.enum_values]
    others = [value for value in values if value != active]
    if len(values) == 2 and len(others) == 1:
        return condition(field.key, "eq", path, value=others[0])
    return condition(field.key, "ne", path, value=active)
