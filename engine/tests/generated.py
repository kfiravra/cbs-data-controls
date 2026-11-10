"""Definitions generated from a glossary: one per field and operator, per path, per related node, per comparison.

Nothing is random. Every caller-chosen string is distinctive, so a test can look for it in SQL text.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

from app.glossary import Entity, Field, Glossary, Operator
from tests.builders import all_of, cond, definition, ref, related

NODE_ID = "zqnode"
TEXT_OPERAND = "zqoperand"
NUMBER_OPERAND = 987654321
DATE_OPERANDS = ("1987-06-05", "1988-07-06")


def _one(field: Field, shift: int = 0) -> Any:
    if field.type == "number":
        return NUMBER_OPERAND + shift
    if field.type == "date":
        return DATE_OPERANDS[shift % 2]
    if field.type == "bool":
        return shift % 2 == 0
    if field.type == "enum":
        return field.enum_values[shift % len(field.enum_values)].value
    return f"{TEXT_OPERAND}{shift}"


def operand_for(field: Field, operator: Operator) -> dict[str, Any]:
    """The operand members a condition needs for this operator on this field."""
    if operator.arity == 0:
        return {}
    if operator.arity == 1:
        return {"value": _one(field)}
    if operator.arity == 2:
        return {"values": [_one(field, 0), _one(field, 1)]}
    values = [_one(field, shift) for shift in range(3)]
    return {"values": list(dict.fromkeys(values))}


def _condition(node_id: str, field: Field, operator: Operator, path: list[str] | None = None) -> dict[str, Any]:
    node = cond(node_id, field.key, operator.key, path=path)
    node.update(operand_for(field, operator))
    return node


def _visible_fields(entity: Entity) -> list[Field]:
    return [field for field in entity.fields.values() if field.visible]


def generated_definitions(glossary: Glossary) -> Iterator[tuple[str, dict[str, Any]]]:
    """(label, definition) pairs that the validator accepts."""
    roots = [entity for entity in glossary.entities.values() if entity.visible and entity.rootable]
    for root in roots:
        for field in _visible_fields(root):
            for key in field.operators:
                yield (
                    f"{root.key}.{field.key} {key}",
                    definition(root.key, all_of(_condition(NODE_ID, field, glossary.operators[key]))),
                )
        yield from _on_paths(glossary, root)
        yield from _related(glossary, root)
        yield from _comparisons(glossary, root)


def _on_paths(glossary: Glossary, root: Entity) -> Iterator[tuple[str, dict[str, Any]]]:
    def hops(entity: Entity) -> list[Any]:
        return [
            relationship
            for relationship in glossary.relationships.values()
            if relationship.from_entity == entity.key
            and relationship.cardinality in ("many_to_one", "one_to_one")
            and glossary.usable_relationship(relationship.key) is not None
        ]

    for first in hops(root):
        middle = glossary.entities[first.to_entity]
        paths = [[first.key]] + [[first.key, second.key] for second in hops(middle)]
        for path in paths:
            target = glossary.entities[glossary.relationships[path[-1]].to_entity]
            field = _visible_fields(target)[0]
            operator = glossary.operators[field.operators[0]]
            yield (
                f"{root.key} via {'>'.join(path)}",
                definition(root.key, all_of(_condition(NODE_ID, field, operator, path))),
            )


def _related(glossary: Glossary, root: Entity) -> Iterator[tuple[str, dict[str, Any]]]:
    for relationship in glossary.relationships.values():
        if relationship.from_entity != root.key or relationship.cardinality != "one_to_many":
            continue
        target = glossary.entities[relationship.to_entity]
        field = _visible_fields(target)[0]
        inner = _condition(f"{NODE_ID}in", field, glossary.operators[field.operators[0]])
        for quantifier in ("any", "none"):
            yield (
                f"{root.key} {quantifier} {relationship.key}",
                definition(root.key, all_of(related(NODE_ID, relationship.key, quantifier, all_of(inner)))),
            )


def _comparisons(glossary: Glossary, root: Entity) -> Iterator[tuple[str, dict[str, Any]]]:
    comparable = [field for field in _visible_fields(root) if field.comparable]
    for left in comparable:
        for right in comparable:
            if left.key == right.key or left.type != right.type:
                continue
            for key in left.operators:
                if glossary.operators[key].field_comparable:
                    yield (
                        f"{root.key}.{left.key} {key} {right.key}",
                        definition(root.key, all_of(cond(NODE_ID, left.key, key, right=ref(right.key)))),
                    )
                    break
