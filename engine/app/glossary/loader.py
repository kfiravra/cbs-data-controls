"""Reads `contracts/glossary.json` into the typed model.

`scripts/contracts-check.py` is the integrity gate of the file. The loader only refuses what would make the
engine wrong: a missing member, a dangling reference, a key outside the closed lists the code implements.
"""

from __future__ import annotations

import json
from collections.abc import Mapping
from pathlib import Path
from types import MappingProxyType
from typing import Any, cast

from app.glossary.model import (
    COMPUTED_FUNCTIONS,
    FIELD_TYPES,
    OPERATOR_KEYS,
    REQUIRED_STATES,
    Arity,
    Computed,
    Entity,
    EnumValue,
    Field,
    FieldType,
    Formats,
    Glossary,
    GlossaryInvalid,
    Lifecycle,
    Limits,
    Operator,
    Phrases,
    RelatedPhrase,
    Relationship,
    SuggestionKind,
    SuggestionTexts,
    Text,
    Variants,
)
from app.glossary.tables import build_tables

_ARITIES: frozenset[object] = frozenset({0, 1, 2, "list"})
_NULL_OPERATORS: frozenset[str] = frozenset({"is_null", "is_not_null"})

Json = Mapping[str, Any]


def load_glossary(path: Path) -> Glossary:
    """Read and parse the glossary file; `GlossaryInvalid` names what is wrong with it."""
    with path.open(encoding="utf-8") as handle:
        document = json.load(handle)
    return parse_glossary(document)


def parse_glossary(document: Json) -> Glossary:
    try:
        return _parse(document)
    except (KeyError, TypeError, AttributeError) as exc:
        raise GlossaryInvalid(f"glossary: malformed or missing member ({exc!r})") from exc


def _parse(document: Json) -> Glossary:
    languages = tuple(document["languages"])
    default_language = document["defaultLanguage"]
    if default_language not in languages:
        raise GlossaryInvalid(f"glossary: defaultLanguage {default_language!r} is not one of languages")
    operators = _operators(document["operators"])
    entities = MappingProxyType({item["key"]: _entity(item, operators) for item in document["entities"]})
    relationships = _relationships(document["relationships"], entities)
    limits = document["limits"]
    return Glossary(
        version=document["glossaryVersion"],
        languages=languages,
        default_language=default_language,
        limits=Limits(
            max_depth=limits["maxDepth"],
            max_conditions=limits["maxConditions"],
            max_list_values=limits["maxListValues"],
            max_path_hops=limits["maxPathHops"],
            max_total_values=limits["maxTotalValues"],
        ),
        formats=MappingProxyType(
            {
                language: Formats(
                    date=item["date"],
                    group_separator=item["groupSeparator"],
                    decimal_separator=item["decimalSeparator"],
                )
                for language, item in document["formats"].items()
            }
        ),
        phrases=_phrases(document["phrases"]),
        operators=operators,
        entities=entities,
        relationships=relationships,
        suggestions=_suggestions(document["suggestions"]),
        tables=build_tables(entities, relationships),
        document=document,
    )


def _text(value: Json) -> Text:
    return MappingProxyType(dict(value))


def _variants(value: Json) -> Variants:
    return MappingProxyType({name: _text(text) for name, text in value.items()})


def _phrases(raw: Json) -> Phrases:
    def related(name: str) -> RelatedPhrase:
        return RelatedPhrase(sentence=_text(raw[name]["sentence"]), reason=_text(raw[name]["reason"]))

    return Phrases(
        and_=_text(raw["and"]),
        or_=_text(raw["or"]),
        group_open=_text(raw["groupOpen"]),
        group_close=_text(raw["groupClose"]),
        list_separator=_text(raw["listSeparator"]),
        reason_separator=_text(raw["reasonSeparator"]),
        field_on_path=_text(raw["fieldOnPath"]),
        related_any=related("relatedAny"),
        related_none=related("relatedNone"),
    )


def _operators(raw: list[Json]) -> Mapping[str, Operator]:
    operators: dict[str, Operator] = {}
    for item in raw:
        key = item["key"]
        if key not in OPERATOR_KEYS:
            raise GlossaryInvalid(f"glossary: operator {key!r} is not one the engine implements")
        if item["arity"] not in _ARITIES or isinstance(item["arity"], bool):
            raise GlossaryInvalid(f"glossary: operator {key!r} has the arity {item['arity']!r}")
        operators[key] = Operator(
            key=key,
            arity=cast(Arity, item["arity"]),
            types=frozenset(item["types"]),
            field_comparable=bool(item["fieldComparable"]),
            label=_variants(item["label"]),
            sentence=_variants(item["sentence"]),
            reason=_variants(item["reason"]),
        )
    return MappingProxyType(operators)


def _resolved_operators(raw: Json, operators: Mapping[str, Operator], where: str) -> tuple[str, ...]:
    """The field's own list, else every operator of its type, minus the NULL tests when it is not nullable."""
    own = raw.get("operators")
    if own is not None:
        unknown = [key for key in own if key not in operators]
        if unknown:
            raise GlossaryInvalid(f"glossary: {where} lists the unknown operator {unknown[0]!r}")
        return tuple(key for key in operators if key in own)
    return tuple(
        key
        for key, operator in operators.items()
        if raw["type"] in operator.types and (raw["nullable"] or key not in _NULL_OPERATORS)
    )


def _field(raw: Json, operators: Mapping[str, Operator], entity_key: str) -> Field:
    where = f"field {entity_key}.{raw['key']}"
    if raw["type"] not in FIELD_TYPES:
        raise GlossaryInvalid(f"glossary: {where} has the type {raw['type']!r}")
    computed_raw = raw.get("computed")
    if (raw.get("column") is None) == (computed_raw is None):
        raise GlossaryInvalid(f"glossary: {where} needs exactly one of column and computed")
    if computed_raw is not None and computed_raw["function"] not in COMPUTED_FUNCTIONS:
        raise GlossaryInvalid(f"glossary: {where} uses the unknown function {computed_raw['function']!r}")
    required = raw.get("required")
    if required is not None and required not in REQUIRED_STATES:
        raise GlossaryInvalid(f"glossary: {where} has required {required!r}")
    labels = raw.get("valueLabels")
    return Field(
        key=raw["key"],
        label=_text(raw["label"]),
        type=cast(FieldType, raw["type"]),
        column=raw.get("column"),
        computed=None if computed_raw is None else Computed(computed_raw["function"], computed_raw["over"]),
        nullable=bool(raw["nullable"]),
        visible=bool(raw["visible"]),
        operators=_resolved_operators(raw, operators, where),
        unit=None if raw.get("unit") is None else _text(raw["unit"]),
        enum_values=tuple(EnumValue(item["value"], _text(item["label"])) for item in raw.get("enumValues", ())),
        value_labels=(
            None if labels is None else MappingProxyType({True: _text(labels["true"]), False: _text(labels["false"])})
        ),
        required=required,
        comparable=bool(raw.get("comparable", True)),
        identifier=bool(raw.get("identifier", False)),
    )


def _entity(raw: Json, operators: Mapping[str, Operator]) -> Entity:
    key = raw["key"]
    fields = MappingProxyType({item["key"]: _field(item, operators, key) for item in raw["fields"]})
    identifying = tuple(raw["identifyingFields"])
    for name in identifying:
        if name not in fields:
            raise GlossaryInvalid(f"glossary: entity {key} identifies records by the unknown field {name!r}")
    lifecycle_raw = raw.get("lifecycle")
    lifecycle = None
    if lifecycle_raw is not None:
        if lifecycle_raw["field"] not in fields:
            raise GlossaryInvalid(f"glossary: entity {key} has a lifecycle on the unknown field")
        lifecycle = Lifecycle(field=lifecycle_raw["field"], active=lifecycle_raw["active"])
    return Entity(
        key=key,
        label_singular=_text(raw["label"]["singular"]),
        label_plural=_text(raw["label"]["plural"]),
        schema=raw["table"]["schema"],
        table=raw["table"]["name"],
        key_column=raw["keyColumn"],
        rootable=bool(raw["rootable"]),
        visible=bool(raw["visible"]),
        identifying_fields=identifying,
        lifecycle=lifecycle,
        fields=fields,
    )


def _relationships(raw: list[Json], entities: Mapping[str, Entity]) -> Mapping[str, Relationship]:
    relationships: dict[str, Relationship] = {}
    for item in raw:
        for end in ("from", "to"):
            if item[end] not in entities:
                raise GlossaryInvalid(f"glossary: relationship {item['key']} names the unknown entity {item[end]!r}")
        relationships[item["key"]] = Relationship(
            key=item["key"],
            from_entity=item["from"],
            to_entity=item["to"],
            cardinality=item["cardinality"],
            from_column=item["join"]["fromColumn"],
            to_column=item["join"]["toColumn"],
            label=_text(item["label"]),
        )
    return MappingProxyType(relationships)


def _suggestions(raw: Json) -> SuggestionTexts:
    kinds = {
        name: SuggestionKind(
            name=_text(item["name"]),
            description=_text(item["description"]),
            rationale=_text(item["rationale"]),
        )
        for name, item in raw["kinds"].items()
    }
    evidence = {name: _text(text) for name, text in raw["evidence"].items()}
    return SuggestionTexts(kinds=MappingProxyType(kinds), evidence=MappingProxyType(evidence))
