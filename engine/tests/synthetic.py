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


# --- the same glossary in another language --------------------------------------------------------------------
#
# English texts for every operator, phrase and suggestion, with formats that differ from the real file's, so a
# test can state the sentence it expects in plain English and prove that no code names a language.

ENGLISH = "en"

ENGLISH_FORMATS = {ENGLISH: {"date": "MM/dd/yyyy", "groupSeparator": " ", "decimalSeparator": ","}}

ENGLISH_PHRASES = {
    "and": " and ",
    "or": " or ",
    "groupOpen": "(",
    "groupClose": ")",
    "listSeparator": ", ",
    "reasonSeparator": "; ",
    "fieldOnPath": "{field} of {relationship}",
    "relatedAny": {
        "sentence": "has {relationship} with ({conditions})",
        "reason": "has {relationship} with {conditions}",
    },
    "relatedNone": {
        "sentence": "has no {relationship} with ({conditions})",
        "reason": "has no {relationship} with {conditions}",
    },
}


def _comparison(word: str, date_word: str) -> dict[str, dict[str, str]]:
    return {
        "sentence": {
            "default": f"{{field}} {word} {{value}}",
            "date": f"{{field}} {date_word} {{value}}",
            "field": f"{{field}} {word} {{other}}",
            "date.field": f"{{field}} {date_word} {{other}}",
        },
        "reason": {
            "default": f"{{field}} is {{actual}} ({word} {{value}})",
            "date": f"{{field}} is {{actual}} ({date_word} {{value}})",
            "field": f"{{field}} is {{actual}} ({word} {{other}}: {{otherActual}})",
            "date.field": f"{{field}} is {{actual}} ({date_word} {{other}}: {{otherActual}})",
        },
    }


def _text_test(phrase: str) -> dict[str, dict[str, str]]:
    return {
        "sentence": {"default": f'{{field}} {phrase} "{{value}}"'},
        "reason": {"default": f'{{field}} is {{actual}} ({phrase} "{{value}}")'},
    }


ENGLISH_OPERATOR_TEXTS: dict[str, dict[str, dict[str, str]]] = {
    "eq": {
        "sentence": {"default": "{field} is {value}", "field": "{field} equals {other}"},
        "reason": {"default": "{field} is {actual}", "field": "{field} is {actual} (equals {other})"},
    },
    "ne": {
        "sentence": {
            "default": "{field} is not {value}",
            "text": '{field} is not "{value}"',
            "field": "{field} differs from {other}",
        },
        "reason": {
            "default": "{field} is {actual} (not {value})",
            "text": '{field} is {actual} (not "{value}")',
            "field": "{field} is {actual} (differs from {other}: {otherActual})",
        },
    },
    "lt": _comparison("below", "before"),
    "lte": _comparison("at most", "not after"),
    "gt": _comparison("above", "after"),
    "gte": _comparison("at least", "not before"),
    "between": {
        "sentence": {"default": "{field} between {value} and {value2}"},
        "reason": {"default": "{field} is {actual} (between {value} and {value2})"},
    },
    "not_between": {
        "sentence": {"default": "{field} outside {value} to {value2}"},
        "reason": {"default": "{field} is {actual} (outside {value} to {value2})"},
    },
    "in": {
        "sentence": {"default": "{field} one of: {values}"},
        "reason": {"default": "{field} is {actual} (in the list)"},
    },
    "not_in": {
        "sentence": {"default": "{field} none of: {values}"},
        "reason": {"default": "{field} is {actual} (not in the list)"},
    },
    "contains": _text_test("contains"),
    "not_contains": _text_test("does not contain"),
    "starts_with": _text_test("starts with"),
    "ends_with": _text_test("ends with"),
    "is_null": {"sentence": {"default": "{field} is missing"}, "reason": {"default": "{field} is missing"}},
    "is_not_null": {"sentence": {"default": "{field} is present"}, "reason": {"default": "{field} is {actual}"}},
    "is_empty": {"sentence": {"default": "{field} is empty"}, "reason": {"default": "{field} is empty"}},
    "is_not_empty": {"sentence": {"default": "{field} is not empty"}, "reason": {"default": "{field} is {actual}"}},
}

ENGLISH_SUGGESTIONS = {
    "kinds": {
        "missing_required": {
            "name": "{entity} with required data missing",
            "description": "Finds {entity} that lack a field they must have.",
            "rationale": "The glossary marks these fields as required.",
        },
        "date_order": {
            "name": "{later} before {earlier}",
            "description": "Finds {entity} whose {later} is before their {earlier}.",
            "rationale": "In most records {later} is not before {earlier}.",
        },
        "active_under_inactive": {
            "name": "Active {entity} under an inactive {relationship}",
            "description": "Finds active {entity} whose {relationship} is inactive.",
            "rationale": "An active record under an inactive {relationship} suggests an update that was not finished.",
        },
        "active_without_active_children": {
            "name": "Active {entity} without an active {relationship}",
            "description": "Finds active {entity} that have no active {relationship}.",
            "rationale": "An active record with no active {relationship} may be out of date.",
        },
        "missing_optional": {
            "name": "{entity} without {field}",
            "description": 'Finds {entity} whose "{field}" is missing.',
            "rationale": '"{field}" is not required, yet most records have it.',
        },
    },
    "evidence": {
        "violations_found": "{count} of {total} now",
        "field_missing": "without {field}: {count}",
        "date_order_split": "{count} of the {total} records with both dates are reversed",
    },
}


def _in_english(value: Any) -> Any:
    """Every text leaf `{ "he": ... }` under an entity or a relationship, keyed by the other language."""
    if isinstance(value, dict):
        if set(value) == {"he"}:
            return {ENGLISH: value["he"]}
        return {name: _in_english(member) for name, member in value.items()}
    if isinstance(value, list):
        return [_in_english(item) for item in value]
    return value


def _texts(value: Any) -> Any:
    """A tree of plain strings as a tree of texts in the one language."""
    if isinstance(value, dict):
        return {name: _texts(member) for name, member in value.items()}
    return {ENGLISH: value}


def english_document(real_document: dict[str, Any]) -> dict[str, Any]:
    """The synthetic glossary with English as its only language; operator keys and arities stay the real ones."""
    document = synthetic_document(real_document)
    document["glossaryVersion"] = "synthetic-en-1"
    document["languages"] = [ENGLISH]
    document["defaultLanguage"] = ENGLISH
    document["formats"] = copy.deepcopy(ENGLISH_FORMATS)
    document["phrases"] = _texts(ENGLISH_PHRASES)
    document["suggestions"] = _texts(ENGLISH_SUGGESTIONS)
    document["entities"] = _in_english(document["entities"])
    document["relationships"] = _in_english(document["relationships"])
    for operator in document["operators"]:
        texts = ENGLISH_OPERATOR_TEXTS[operator["key"]]
        operator["label"] = {"default": {ENGLISH: operator["key"]}}
        operator["sentence"] = _texts(texts["sentence"])
        operator["reason"] = _texts(texts["reason"])
    return document
