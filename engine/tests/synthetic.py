"""A glossary about other things than the real one: tickets, queues and sites instead of employees.

Tests use it to prove that nothing in the engine is keyed on an entity, a field or a relationship of the real
glossary. Operators, phrases, formats, limits and suggestion texts are the real file's: they hold no entity.
"""

from __future__ import annotations

import copy
from typing import Any


def _text(value: str) -> dict[str, str]:
    return {"he": value}


def _field(key: str, field_type: str, column: str | None = None, **extra: Any) -> dict[str, Any]:
    field: dict[str, Any] = {"key": key, "label": _text(key.replace("_", " ")), "type": field_type}
    if "computed" not in extra:
        field["column"] = column or key
    field["nullable"] = extra.pop("nullable", False)
    field["visible"] = extra.pop("visible", True)
    field.update(extra)
    return field


def _entity(key: str, table: str, key_column: str, fields: list[dict[str, Any]], **extra: Any) -> dict[str, Any]:
    entity: dict[str, Any] = {
        "key": key,
        "label": {"singular": _text(key), "plural": _text(key + "s")},
        "description": _text(f"A {key}."),
        "table": {"schema": "ops", "name": table},
        "keyColumn": key_column,
        "rootable": extra.pop("rootable", True),
        "visible": extra.pop("visible", True),
        "identifyingFields": extra.pop("identifying", [fields[0]["key"]]),
        "fields": fields,
    }
    entity.update(extra)
    return entity


def _relationship(key: str, source: str, target: str, cardinality: str, from_column: str, to_column: str) -> dict:
    return {
        "key": key,
        "from": source,
        "to": target,
        "cardinality": cardinality,
        "join": {"fromColumn": from_column, "toColumn": to_column},
        "label": _text(f"the {key.split('.')[1]}"),
    }


ENTITIES: list[dict[str, Any]] = [
    _entity(
        "ticket",
        "Ticket",
        "ticket_id",
        [
            _field("title", "text"),
            _field("number", "number", "ticket_id", identifier=True),
            _field("summary", "text", nullable=True, required="always"),
            _field("opened_on", "date"),
            _field("closed_on", "date", nullable=True, required="inactive"),
            _field("due_on", "date", nullable=True),
            _field("days_open", "number", computed={"function": "age_years", "over": "opened_on"}, comparable=False),
            _field("priority", "number", nullable=True, unit=_text("pt"), required="active"),
            _field(
                "state",
                "enum",
                enumValues=[
                    {"value": "open", "label": _text("Open")},
                    {"value": "pending", "label": _text("Pending")},
                    {"value": "closed", "label": _text("Closed")},
                ],
            ),
            _field(
                "owner_link",
                "number",
                "owner_id",
                nullable=True,
                operators=["is_null", "is_not_null"],
                comparable=False,
                identifier=True,
            ),
            _field("internal_code", "text", visible=False),
        ],
        identifying=["title", "number"],
        lifecycle={"field": "state", "active": "open"},
    ),
    _entity(
        "queue",
        "Queue",
        "queue_id",
        [
            _field("name", "text"),
            _field("capacity", "number", nullable=True),
            _field(
                "enabled",
                "bool",
                valueLabels={"true": _text("Enabled"), "false": _text("Disabled")},
            ),
        ],
        lifecycle={"field": "enabled", "active": True},
    ),
    _entity(
        "site",
        "Site",
        "site_id",
        [
            _field("name", "text"),
            _field("enabled", "bool", valueLabels={"true": _text("Enabled"), "false": _text("Disabled")}),
        ],
        rootable=False,
        lifecycle={"field": "enabled", "active": True},
    ),
    _entity("audit", "Audit", "audit_id", [_field("note", "text")], visible=False),
]

RELATIONSHIPS: list[dict[str, Any]] = [
    _relationship("ticket.queue", "ticket", "queue", "many_to_one", "queue_id", "queue_id"),
    _relationship("queue.site", "queue", "site", "many_to_one", "site_id", "site_id"),
    _relationship("queue.twin", "queue", "queue", "one_to_one", "twin_id", "queue_id"),
    _relationship("queue.tickets", "queue", "ticket", "one_to_many", "queue_id", "queue_id"),
    _relationship("site.queues", "site", "queue", "one_to_many", "site_id", "site_id"),
    _relationship("ticket.audit", "ticket", "audit", "many_to_one", "audit_id", "audit_id"),
]


def synthetic_document(real_document: dict[str, Any]) -> dict[str, Any]:
    """The real glossary with its entities and relationships replaced by the ones above."""
    document = copy.deepcopy(real_document)
    document["glossaryVersion"] = "synthetic-1"
    document["entities"] = copy.deepcopy(ENTITIES)
    document["relationships"] = copy.deepcopy(RELATIONSHIPS)
    return document
