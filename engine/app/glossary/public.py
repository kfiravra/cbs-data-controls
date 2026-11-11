"""The glossary as `GET /glossary` serves it: no physical name, nothing hidden, every field's operators resolved."""

from __future__ import annotations

from typing import Any

from app.glossary.model import Entity, Glossary

_ENTITY_PRIVATE = frozenset({"table", "keyColumn", "fields"})
_FIELD_PRIVATE = frozenset({"column", "computed", "operators"})
_RELATIONSHIP_PUBLIC = ("key", "from", "to", "cardinality", "label")
_AS_IN_THE_FILE = ("glossaryVersion", "languages", "defaultLanguage", "limits", "formats", "phrases", "operators")


def public_view(glossary: Glossary) -> dict[str, Any]:
    document = glossary.document
    view: dict[str, Any] = {name: document[name] for name in _AS_IN_THE_FILE}
    view["entities"] = [
        _public_entity(raw, entity)
        for raw in document["entities"]
        if (entity := glossary.visible_entity(raw["key"])) is not None
    ]
    view["relationships"] = [
        {name: raw[name] for name in _RELATIONSHIP_PUBLIC}
        for raw in document["relationships"]
        if glossary.usable_relationship(raw["key"]) is not None
    ]
    view["suggestions"] = document["suggestions"]
    return view


def _public_entity(raw: dict[str, Any], entity: Entity) -> dict[str, Any]:
    public = {name: value for name, value in raw.items() if name not in _ENTITY_PRIVATE}
    public["fields"] = [
        {
            **{name: value for name, value in raw_field.items() if name not in _FIELD_PRIVATE},
            "operators": list(field.operators),
        }
        for raw_field in raw["fields"]
        if (field := entity.visible_field(raw_field["key"])) is not None
    ]
    return public
