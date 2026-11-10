#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = ["jsonschema==4.26.0"]
# ///
"""Check the contracts every service builds against.

    uv run scripts/contracts-check.py [--root DIR]

Paths resolve from this script's location (or --root), so the working directory does not matter.

1. schema            contracts/control-definition.schema.json is a draft 2020-12 schema inside the keyword
                     subset both validators report alike: no not, anyOf or oneOf anywhere (Design I1).
2. glossary          contracts/glossary.json integrity (Design B, with H1 and H3).
3. agreement         the schema and the glossary agree on operators, arities, limits and key patterns.
4. examples          contracts/examples/*.json (arrives with phase 3).
5. invalid fixtures  contracts/examples/invalid/*.json and contracts/errors.md (arrives with phase 4).

Output: one line per failure, each starting with the file path, printed after everything else (the Stop
hook shows the last lines of a failed check). Exit 1 on any failure, else 0 with a one-line summary.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections.abc import Callable, Iterator
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, NamedTuple

from jsonschema import Draft202012Validator

DEFAULT_ROOT = Path(__file__).resolve().parent.parent
SCHEMA_FILE = "contracts/control-definition.schema.json"
GLOSSARY_FILE = "contracts/glossary.json"
EXAMPLES_DIR = "contracts/examples"
INVALID_DIR = "contracts/examples/invalid"
ERRORS_FILE = "contracts/errors.md"

DRAFT_2020_12 = "https://json-schema.org/draft/2020-12/schema"

# Design C and I1: the keywords the schema may use. not, anyOf and oneOf are named on their own (I1).
SCHEMA_KEYWORDS = frozenset({
    "$schema", "$id", "$defs", "$ref", "type", "const", "enum", "if", "then", "allOf", "properties",
    "required", "additionalProperties", "items", "minItems", "maxItems", "uniqueItems", "pattern",
    "minLength", "maxLength", "title", "description",
})
FORBIDDEN_KEYWORDS = frozenset({"not", "anyOf", "oneOf"})
ANNOTATIONS = frozenset({"title", "description"})
SUBSCHEMA_MAPS = ("$defs", "properties", "patternProperties", "dependentSchemas")
SUBSCHEMA_LISTS = ("allOf", "anyOf", "oneOf", "prefixItems")
SUBSCHEMA_SINGLES = ("items", "if", "then", "else", "not", "additionalProperties", "contains", "propertyNames",
                     "unevaluatedItems", "unevaluatedProperties", "contentSchema")

# Design B, H1 and H3: the shape of the glossary.
GLOSSARY_MEMBERS = ("glossaryVersion", "languages", "defaultLanguage", "limits", "formats", "phrases",
                    "operators", "entities", "relationships", "suggestions")
LIMIT_KEYS = ("maxDepth", "maxConditions", "maxListValues", "maxPathHops", "maxTotalValues")
FORMAT_MEMBERS = ("date", "groupSeparator", "decimalSeparator")
FIELD_TYPES = ("number", "text", "date", "bool", "enum")
ARITIES: tuple[int | str, ...] = (0, 1, 2, "list")
CARDINALITIES = ("many_to_one", "one_to_one", "one_to_many")
NULL_OPERATORS = ("is_null", "is_not_null")
REQUIRED_STATES = ("always", "active", "inactive")
COMPUTED_FUNCTIONS = {"age_years": "date"}  # function -> the type of the field it is computed over
TEXT_KINDS = ("label", "sentence", "reason")
OPERATOR_MEMBERS = ("key", "arity", "types", "fieldComparable", "label", "sentence", "reason")
ENTITY_MEMBERS = ("key", "label", "description", "table", "keyColumn", "rootable", "visible",
                  "identifyingFields", "fields")
ENTITY_OPTIONAL = ("lifecycle",)
FIELD_MEMBERS = ("key", "label", "type", "nullable", "visible")
FIELD_OPTIONAL = ("description", "column", "computed", "operators", "unit", "enumValues", "valueLabels",
                  "required", "comparable")
RELATIONSHIP_MEMBERS = ("key", "from", "to", "cardinality", "join", "label")
PLAIN_PHRASES = ("and", "or", "groupOpen", "groupClose", "listSeparator", "reasonSeparator")
PADDED_PHRASES = ("and", "or", "listSeparator", "reasonSeparator")  # carry their own spaces ("as written")
RELATED_PHRASES = ("relatedAny", "relatedNone")
SUGGESTION_KINDS = {
    "missing_required": frozenset({"entity"}),
    "date_order": frozenset({"entity", "earlier", "later"}),
    "active_under_inactive": frozenset({"entity", "relationship"}),
    "active_without_active_children": frozenset({"entity", "relationship"}),
    "missing_optional": frozenset({"entity", "field"}),
}
KIND_TEXTS = ("name", "description", "rationale")
EVIDENCE_KEYS = {
    "violations_found": frozenset({"count", "total"}),
    "field_missing": frozenset({"field", "count"}),
    "date_order_split": frozenset({"count", "total"}),
}

PLACEHOLDER = re.compile(r"\{([A-Za-z][A-Za-z0-9]*)\}")
HEBREW_LETTER = re.compile("[\\u05d0-\\u05ea]")  # alef to tav, written as escapes: the source stays English
LATIN_LETTER = re.compile(r"[A-Za-z]")
IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,127}$")
SEMVER = re.compile(r"^\d+\.\d+\.\d+$")
LANGUAGE = re.compile(r"^[a-z]{2}$")


# ---------------------------------------------------------------------------------------------------------
# Results


class Failure(NamedTuple):
    """One failure: the repository-relative file it is about and what is wrong."""

    path: str
    message: str


class Skipped(NamedTuple):
    """A check that did not run, with the reason; it reports no failure."""

    reason: str


CheckResult = list[Failure] | Skipped


@dataclass
class Context:
    """What every check gets: the repository root and the two documents, None when one did not load."""

    root: Path
    schema: Any = None
    glossary: Any = None
    load_failures: list[Failure] = field(default_factory=list)

    def file(self, rel: str) -> Path:
        """The absolute path of a repository-relative path."""
        return self.root / rel


_message_root = DEFAULT_ROOT  # set by load_context, so --root runs print repository-relative paths too


def fail(path: Path | str, message: str) -> Failure:
    """A failure about `path`: a repository-relative string, or a Path (made relative to the root when it is
    under it)."""
    if isinstance(path, Path):
        try:
            return Failure(path.resolve().relative_to(_message_root).as_posix(), message)
        except ValueError:
            return Failure(path.as_posix(), message)
    return Failure(path, message)


class Collector:
    """Collects failures about one file, each message prefixed with a JSON Pointer into it."""

    def __init__(self, path: str) -> None:
        self.path = path
        self.failures: list[Failure] = []

    def add(self, where: str, message: str) -> None:
        """Records a failure at JSON Pointer `where` ("" is the document)."""
        self.failures.append(fail(self.path, f"{where or '/'}: {message}"))


# ---------------------------------------------------------------------------------------------------------
# Reusable helpers (checks 4 and 5 and --render build on these)


def load_json(path: Path) -> tuple[Any, Failure | None]:
    """Reads a UTF-8 JSON file. Returns (document, None), or (None, failure) for a missing file, bad UTF-8,
    bad JSON or a duplicate member name (which json.loads would otherwise drop silently)."""

    def no_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        seen: dict[str, Any] = {}
        for k, v in pairs:
            if k in seen:
                raise ValueError(f"duplicate member {k!r}")
            seen[k] = v
        return seen

    try:
        text = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return None, fail(path, "file not found")
    except UnicodeDecodeError as e:
        return None, fail(path, f"not UTF-8: {e}")
    try:
        return json.loads(text, object_pairs_hook=no_duplicates), None
    except ValueError as e:
        return None, fail(path, f"not valid JSON: {e}")


def pointer(*parts: str | int) -> str:
    """A JSON Pointer from its reference tokens: pointer("entities", 0, "fields") is "/entities/0/fields"."""
    return "".join("/" + str(p).replace("~", "~0").replace("/", "~1") for p in parts)


def placeholders(template: str) -> set[str]:
    """The placeholder names a template uses: "{field}: {actual}" gives {"field", "actual"}."""
    return set(PLACEHOLDER.findall(template))


def by_key(items: Any, key: str) -> dict[str, Any] | None:
    """The member of a list of objects whose `key` is `key`, or None."""
    if isinstance(items, list):
        for item in items:
            if isinstance(item, dict) and item.get("key") == key:
                return item
    return None


def entity(glossary: dict[str, Any], key: str) -> dict[str, Any] | None:
    """The glossary entity with this key, or None."""
    return by_key(glossary.get("entities"), key)


def field_of(ent: dict[str, Any] | None, key: str) -> dict[str, Any] | None:
    """The field of an entity with this key, or None (also when the entity is None)."""
    return by_key(ent.get("fields"), key) if ent else None


def relationship(glossary: dict[str, Any], key: str) -> dict[str, Any] | None:
    """The glossary relationship with this key, or None."""
    return by_key(glossary.get("relationships"), key)


def operator(glossary: dict[str, Any], key: str) -> dict[str, Any] | None:
    """The glossary operator with this key, or None."""
    return by_key(glossary.get("operators"), key)


def follow_path(glossary: dict[str, Any], entity_key: str, path: list[str]) -> dict[str, Any] | None:
    """The entity a field path reaches from `entity_key`, hop by hop; None when a hop is unknown or does not
    start at the entity reached so far. Cardinality is not checked here."""
    current = entity(glossary, entity_key)
    for hop in path:
        rel = relationship(glossary, hop)
        if current is None or rel is None or rel.get("from") != current.get("key"):
            return None
        current = entity(glossary, rel.get("to", ""))
    return current


def resolved_operators(glossary: dict[str, Any], fld: dict[str, Any]) -> list[str]:
    """A field's operator keys: its `operators` override, else every operator whose `types` include the field's
    type, minus is_null and is_not_null when the field is not nullable (Design B), in glossary order."""
    if isinstance(fld.get("operators"), list):
        return list(fld["operators"])
    keys = []
    for op in glossary.get("operators", []):
        if fld.get("type") in op.get("types", []):
            if op.get("key") in NULL_OPERATORS and not fld.get("nullable"):
                continue
            keys.append(op["key"])
    return keys


def pick_variant(texts: dict[str, Any], field_type: str, right_is_field: bool) -> dict[str, str] | None:
    """The text variant used for a left field of `field_type`: the first present of `<type>.field`, `field`,
    `<type>`, `default`, the two `field` variants only when the right side is a field (Design B)."""
    order = [f"{field_type}.field", "field"] if right_is_field else []
    order += [field_type, "default"]
    for name in order:
        if name in texts:
            return texts[name]
    return None


def schema_validator(schema: dict[str, Any]) -> Draft202012Validator:
    """A draft 2020-12 validator for the definition schema (formats are not asserted)."""
    return Draft202012Validator(schema)


def document_order(instance: Any, path: list[str | int]) -> tuple[int, ...]:
    """A sort key that puts instance locations in document order: an object before its members, members in
    the order the JSON text lists them, array items by index."""
    key: list[int] = []
    node = instance
    for part in path:
        if isinstance(node, dict):
            key.append(list(node).index(part) if part in node else len(node))
            node = node.get(part)
        elif isinstance(node, list) and isinstance(part, int):
            key.append(part)
            node = node[part] if part < len(node) else None
        else:
            break
    return tuple(key)


def schema_errors(validator: Draft202012Validator, instance: Any) -> list[tuple[str, str]]:
    """The schema violations of an instance as (JSON Pointer, message): one per distinct instance location, in
    document order (errors.md, Schema violations). Python reports a false subschema at the object."""
    first: dict[tuple[str | int, ...], str] = {}
    for error in validator.iter_errors(instance):
        location = tuple(error.absolute_path)
        first.setdefault(location, error.message)
    ordered = sorted(first, key=lambda loc: document_order(instance, list(loc)))
    return [(pointer(*loc), first[loc]) for loc in ordered]


def iter_subschemas(schema: Any, where: str = "") -> Iterator[tuple[str, dict[str, Any]]]:
    """Every schema object inside a schema, with its JSON Pointer, the root first. Member names under
    properties and $defs are names, not keywords; boolean subschemas are skipped."""
    if not isinstance(schema, dict):
        return
    yield where, schema
    for kw in SUBSCHEMA_MAPS:
        if isinstance(schema.get(kw), dict):
            for name, sub in schema[kw].items():
                yield from iter_subschemas(sub, where + pointer(kw, name))
    for kw in SUBSCHEMA_LISTS:
        if isinstance(schema.get(kw), list):
            for i, sub in enumerate(schema[kw]):
                yield from iter_subschemas(sub, where + pointer(kw, i))
    for kw in SUBSCHEMA_SINGLES:
        if kw in schema:
            yield from iter_subschemas(schema[kw], where + pointer(kw))


def resolve_ref(schema: dict[str, Any], ref: str) -> Any:
    """The subschema a local reference ("#/$defs/name") points to, or None."""
    if not ref.startswith("#/"):
        return None
    node: Any = schema
    for token in ref[2:].split("/"):
        token = token.replace("~1", "/").replace("~0", "~")
        if not isinstance(node, dict) or token not in node:
            return None
        node = node[token]
    return node


def operand_rule(schema: dict[str, Any], arity_def: str) -> dict[str, Any] | None:
    """The `then` of the node's operand rule whose `if` names the operator list `#/$defs/<arity_def>` and asks
    for nothing else beyond type and operator; None when the schema has no such rule."""
    for rule in schema.get("$defs", {}).get("node", {}).get("allOf", []):
        cond = rule.get("if", {}) if isinstance(rule, dict) else {}
        props = cond.get("properties", {})
        if props.get("operator", {}).get("$ref") == f"#/$defs/{arity_def}" and set(cond.get("required", [])) == {
            "type", "operator"} and set(props) == {"type", "operator"}:
            return rule.get("then")
    return None


# ---------------------------------------------------------------------------------------------------------
# Check 1: the schema


def check_schema(ctx: Context) -> CheckResult:
    """The schema is a valid draft 2020-12 schema that keeps to the subset of Design C and I1."""
    schema = ctx.schema
    if schema is None:
        return Skipped(f"{SCHEMA_FILE} did not load")
    c = Collector(SCHEMA_FILE)
    if not isinstance(schema, dict):
        c.add("", "the schema is not an object")
        return c.failures
    if schema.get("$schema") != DRAFT_2020_12:
        c.add("/$schema", f"must be {DRAFT_2020_12}")
    if not isinstance(schema.get("$id"), str) or not schema.get("$id"):
        c.add("/$id", "missing")
    for error in Draft202012Validator(Draft202012Validator.META_SCHEMA).iter_errors(schema):
        c.add(pointer(*error.absolute_path), f"not a valid draft 2020-12 schema: {error.message}")
    for where, sub in iter_subschemas(schema):
        for kw in sub:
            if kw in FORBIDDEN_KEYWORDS:
                c.add(where + pointer(kw), f"{kw} is not allowed: the two validators locate it differently (I1)")
            elif kw not in SCHEMA_KEYWORDS:
                c.add(where + pointer(kw), f"keyword {kw} is outside the subset of Design C")
        if ("if" in sub) != ("then" in sub):
            c.add(where, "if and then come in pairs")
        for i, rule in enumerate(sub.get("allOf", []) if isinstance(sub.get("allOf"), list) else []):
            extra = set(rule) - {"if", "then"} - ANNOTATIONS if isinstance(rule, dict) else {"(not an object)"}
            if extra or not isinstance(rule, dict) or "if" not in rule:
                c.add(where + pointer("allOf", i), "allOf holds only plain if/then pairs")
        if sub.get("type") == "object" and sub.get("additionalProperties") is not False:
            c.add(where, "an object schema needs additionalProperties: false")
        ref = sub.get("$ref")
        if isinstance(ref, str) and resolve_ref(schema, ref) is None:
            c.add(where + "/$ref", f"{ref} does not resolve inside the schema")
    return c.failures


# ---------------------------------------------------------------------------------------------------------
# Check 2: the glossary


def check_text(c: Collector, where: str, text: Any, languages: list[str], allowed: frozenset[str] = frozenset(),
               required: frozenset[str] = frozenset(), padded: bool = False) -> None:
    """A {he, en} text: one non-empty string per language and nothing else, only `allowed` placeholders, the
    `required` ones present, the same placeholders in every language, no stray brace, no padding unless
    `padded`, no Hebrew letter in English and no Latin-only Hebrew."""
    if not isinstance(text, dict):
        c.add(where, f"must be an object with {', '.join(languages)}")
        return
    for extra in sorted(set(text) - set(languages)):
        c.add(where, f"unknown language {extra!r}")
    used: dict[str, set[str]] = {}
    for lang in languages:
        value = text.get(lang)
        if not isinstance(value, str) or not value.strip():
            c.add(where, f"missing {lang}")
            continue
        names = placeholders(value)
        used[lang] = names
        for name in sorted(names - allowed):
            c.add(where + pointer(lang), f"placeholder {{{name}}} is not allowed here"
                  + (f" (allowed: {', '.join('{' + a + '}' for a in sorted(allowed))})" if allowed else " (none is)"))
        for name in sorted(required - names):
            c.add(where + pointer(lang), f"placeholder {{{name}}} is missing")
        bare = PLACEHOLDER.sub("", value)
        if "{" in bare or "}" in bare:
            c.add(where + pointer(lang), "stray brace outside a placeholder")
        if not padded and value != value.strip():
            c.add(where + pointer(lang), "leading or trailing space")
        if lang == "en" and HEBREW_LETTER.search(bare):
            c.add(where + pointer(lang), "Hebrew letters in the English text")
        if lang == "he" and LATIN_LETTER.search(bare) and not HEBREW_LETTER.search(bare):
            c.add(where + pointer(lang), "the Hebrew text has Latin letters and no Hebrew letter")
    if len({frozenset(v) for v in used.values()}) > 1:
        c.add(where, "the languages use different placeholders: "
              + "; ".join(f"{lang} {sorted(v)}" for lang, v in used.items()))


def operand_placeholders(kind: str, arity: Any, right_is_field: bool) -> tuple[frozenset[str], frozenset[str]]:
    """(allowed, required) placeholders of an operator text: a label has none; a sentence names the field and
    every operand of its arity; a reason may add {actual} (and {otherActual} with a field) and needs {field}."""
    if kind == "label":
        return frozenset(), frozenset()
    if arity == 0:
        base = {"field"}
    elif arity == 1:
        base = {"field", "other"} if right_is_field else {"field", "value"}
    elif arity == 2:
        base = {"field", "value", "value2"}
    else:
        base = {"field", "values"}
    if kind == "sentence":
        return frozenset(base), frozenset(base)
    extra = {"actual", "otherActual"} if right_is_field else {"actual"}
    return frozenset(base | extra), frozenset({"field"})


def check_members(c: Collector, where: str, obj: Any, required: tuple[str, ...],
                  optional: tuple[str, ...] = ()) -> bool:
    """An object with every `required` member and no member outside `required` and `optional`. Returns
    whether it is an object at all."""
    if not isinstance(obj, dict):
        c.add(where, "must be an object")
        return False
    for name in required:
        if name not in obj:
            c.add(where, f"missing member {name}")
    for name in obj:
        if name not in required and name not in optional:
            c.add(where + pointer(name), "unknown member")
    return True


def is_int(value: Any) -> bool:
    """A JSON integer (a boolean is not one)."""
    return isinstance(value, int) and not isinstance(value, bool)


def check_identifier(c: Collector, where: str, value: Any) -> None:
    """A physical table or column name: letters, digits and underscores only."""
    if not isinstance(value, str) or not IDENTIFIER.match(value):
        c.add(where, f"{value!r} is not a plain SQL identifier")


def check_unique_keys(c: Collector, where: str, items: list[Any], what: str) -> None:
    """Every `key` in a list of objects is a string and appears once."""
    seen: set[str] = set()
    for i, item in enumerate(items):
        key = item.get("key") if isinstance(item, dict) else None
        if not isinstance(key, str) or not key:
            c.add(where + pointer(i), f"{what} without a key")
        elif key in seen:
            c.add(where + pointer(i, "key"), f"duplicate {what} key {key!r}")
        else:
            seen.add(key)


def check_operators(c: Collector, g: dict[str, Any], languages: list[str]) -> None:
    """Operators: keys, arity, types, fieldComparable and the legal text variants with their placeholders."""
    ops = g.get("operators")
    if not isinstance(ops, list) or not ops:
        c.add("/operators", "must be a non-empty list")
        return
    check_unique_keys(c, "/operators", ops, "operator")
    for i, op in enumerate(ops):
        where = pointer("operators", i)
        if not check_members(c, where, op, OPERATOR_MEMBERS):
            continue
        arity = op.get("arity")
        if not ((is_int(arity) and arity in ARITIES) or arity == "list"):
            c.add(where + "/arity", f"{arity!r} is not one of 0, 1, 2, \"list\"")
        types = op.get("types")
        if not isinstance(types, list) or not types or len(set(map(str, types))) != len(types) or any(
                t not in FIELD_TYPES for t in types):
            c.add(where + "/types", f"must be a non-empty list of distinct types from {', '.join(FIELD_TYPES)}")
            types = [t for t in types if t in FIELD_TYPES] if isinstance(types, list) else []
        comparable = op.get("fieldComparable")
        if not isinstance(comparable, bool):
            c.add(where + "/fieldComparable", "must be true or false")
        elif comparable and arity != 1:
            c.add(where + "/fieldComparable", "only an operator of arity 1 can compare two fields")
        legal = {"default", *types}
        if comparable is True:
            legal |= {"field", *(f"{t}.field" for t in types)}
        for kind in TEXT_KINDS:
            variants = op.get(kind)
            if not isinstance(variants, dict):
                c.add(where + pointer(kind), "must be an object of variants")
                continue
            if "default" not in variants:
                c.add(where + pointer(kind), "has no default variant")
            for name, text in variants.items():
                if name not in legal:
                    c.add(where + pointer(kind, name),
                          f"variant {name!r} is not legal here (legal: {', '.join(sorted(legal))})")
                    continue
                right_is_field = name == "field" or name.endswith(".field")
                allowed, required = operand_placeholders(kind, arity, right_is_field)
                check_text(c, where + pointer(kind, name), text, languages, allowed, required)


def check_field(c: Collector, g: dict[str, Any], ent: dict[str, Any], where: str, fld: Any,
                languages: list[str]) -> None:
    """One field: type, its column or computed source, flags, labels, values and the H1/H3 members."""
    if not check_members(c, where, fld, FIELD_MEMBERS, FIELD_OPTIONAL):
        return
    ftype = fld.get("type")
    if ftype not in FIELD_TYPES:
        c.add(where + "/type", f"{ftype!r} is not one of {', '.join(FIELD_TYPES)}")
    check_text(c, where + "/label", fld.get("label"), languages)
    if "description" in fld:
        check_text(c, where + "/description", fld["description"], languages)
    for flag in ("nullable", "visible"):
        if not isinstance(fld.get(flag), bool):
            c.add(where + pointer(flag), "must be true or false")
    has_column, has_computed = "column" in fld, "computed" in fld
    if has_column == has_computed:
        c.add(where, "needs exactly one of column and computed")
    if has_column:
        check_identifier(c, where + "/column", fld["column"])
    if has_computed:
        comp = fld["computed"]
        if check_members(c, where + "/computed", comp, ("function", "over")):
            function = comp.get("function")
            if function not in COMPUTED_FUNCTIONS:
                c.add(where + "/computed/function", f"{function!r} is not one of {', '.join(COMPUTED_FUNCTIONS)}")
            sources = [f for f in ent.get("fields", []) if isinstance(f, dict) and "column" in f
                       and f.get("column") == comp.get("over")]
            if not sources:
                c.add(where + "/computed/over", f"{comp.get('over')!r} is not the column of a stored field here")
            elif function in COMPUTED_FUNCTIONS and sources[0].get("type") != COMPUTED_FUNCTIONS[function]:
                c.add(where + "/computed/over", f"{function} needs a {COMPUTED_FUNCTIONS[function]} column")
        if fld.get("comparable") is not False:
            c.add(where, "a computed field needs comparable: false (H3)")
    if "comparable" in fld and not isinstance(fld["comparable"], bool):
        c.add(where + "/comparable", "must be true or false")
    if "unit" in fld:
        if ftype != "number":
            c.add(where + "/unit", "only a number field has a unit")
        check_text(c, where + "/unit", fld["unit"], languages)
    if (ftype == "enum") != ("enumValues" in fld):
        c.add(where, "enumValues belongs to, and is required on, every enum field and no other")
    if isinstance(fld.get("enumValues"), list) and fld["enumValues"]:
        seen: set[Any] = set()
        for j, item in enumerate(fld["enumValues"]):
            iw = where + pointer("enumValues", j)
            if check_members(c, iw, item, ("value", "label")):
                value = item.get("value")
                if not isinstance(value, str) or not value:
                    c.add(iw + "/value", "must be a non-empty string")
                elif value in seen:
                    c.add(iw + "/value", f"duplicate enum value {value!r}")
                seen.add(value)
                check_text(c, iw + "/label", item.get("label"), languages)
    elif "enumValues" in fld:
        c.add(where + "/enumValues", "must be a non-empty list")
    if (ftype == "bool") != ("valueLabels" in fld):
        c.add(where, "valueLabels belongs to, and is required on, every bool field and no other")
    if "valueLabels" in fld and check_members(c, where + "/valueLabels", fld["valueLabels"], ("true", "false")):
        for b in ("true", "false"):
            check_text(c, where + pointer("valueLabels", b), fld["valueLabels"].get(b), languages)
    if "operators" in fld:
        override = fld["operators"]
        if not isinstance(override, list) or not override or len(set(map(str, override))) != len(override):
            c.add(where + "/operators", "must be a non-empty list of distinct operator keys")
        else:
            for j, key in enumerate(override):
                op = operator(g, key) if isinstance(key, str) else None
                if op is None:
                    c.add(where + pointer("operators", j), f"unknown operator {key!r}")
                elif ftype not in op.get("types", []):
                    c.add(where + pointer("operators", j), f"{key} does not apply to the type {ftype}")
    if "required" in fld:
        state = fld["required"]
        if state not in REQUIRED_STATES:
            c.add(where + "/required", f"{state!r} is not one of {', '.join(REQUIRED_STATES)}")
        elif state != "always" and "lifecycle" not in ent:
            c.add(where + "/required", f"{state!r} needs a lifecycle on the entity (H1)")


def check_entities(c: Collector, g: dict[str, Any], languages: list[str]) -> None:
    """Entities: members, labels, physical names, fields, identifying fields and the lifecycle."""
    ents = g.get("entities")
    if not isinstance(ents, list) or not ents:
        c.add("/entities", "must be a non-empty list")
        return
    check_unique_keys(c, "/entities", ents, "entity")
    for i, ent in enumerate(ents):
        where = pointer("entities", i)
        if not check_members(c, where, ent, ENTITY_MEMBERS, ENTITY_OPTIONAL):
            continue
        label = ent.get("label")
        if check_members(c, where + "/label", label, ("singular", "plural")):
            for n in ("singular", "plural"):
                check_text(c, where + pointer("label", n), label.get(n), languages)
        check_text(c, where + "/description", ent.get("description"), languages)
        if check_members(c, where + "/table", ent.get("table"), ("schema", "name")):
            check_identifier(c, where + "/table/schema", ent["table"].get("schema"))
            check_identifier(c, where + "/table/name", ent["table"].get("name"))
        check_identifier(c, where + "/keyColumn", ent.get("keyColumn"))
        for flag in ("rootable", "visible"):
            if not isinstance(ent.get(flag), bool):
                c.add(where + pointer(flag), "must be true or false")
        fields = ent.get("fields")
        if not isinstance(fields, list) or not fields:
            c.add(where + "/fields", "must be a non-empty list")
            continue
        check_unique_keys(c, where + "/fields", fields, "field")
        for j, fld in enumerate(fields):
            check_field(c, g, ent, where + pointer("fields", j), fld, languages)
        ident = ent.get("identifyingFields")
        if not isinstance(ident, list) or not ident or len(set(map(str, ident))) != len(ident):
            c.add(where + "/identifyingFields", "must be a non-empty list of distinct field keys")
        else:
            for j, key in enumerate(ident):
                fld = field_of(ent, key) if isinstance(key, str) else None
                if fld is None:
                    c.add(where + pointer("identifyingFields", j), f"unknown field {key!r}")
                elif fld.get("visible") is not True:
                    c.add(where + pointer("identifyingFields", j), f"{key} is not visible")
        if "lifecycle" in ent and check_members(c, where + "/lifecycle", ent["lifecycle"], ("field", "active")):
            life = ent["lifecycle"]
            fld = field_of(ent, life.get("field")) if isinstance(life.get("field"), str) else None
            active = life.get("active")
            if fld is None:
                c.add(where + "/lifecycle/field", f"unknown field {life.get('field')!r}")
            elif fld.get("type") not in ("bool", "enum") or "computed" in fld or fld.get("visible") is not True:
                c.add(where + "/lifecycle/field", "must be a visible stored bool or enum field (H1)")
            elif fld.get("type") == "bool" and not isinstance(active, bool):
                c.add(where + "/lifecycle/active", "must be true or false for a bool field")
            elif fld.get("type") == "enum" and active not in [
                    v.get("value") for v in fld.get("enumValues", []) if isinstance(v, dict)]:
                c.add(where + "/lifecycle/active", f"{active!r} is not a value of {fld.get('key')}")


def check_relationships(c: Collector, g: dict[str, Any], languages: list[str]) -> None:
    """Relationships: keys, the entities at both ends, the cardinality, the join columns and the label."""
    rels = g.get("relationships")
    if not isinstance(rels, list):
        c.add("/relationships", "must be a list")
        return
    check_unique_keys(c, "/relationships", rels, "relationship")
    for i, rel in enumerate(rels):
        where = pointer("relationships", i)
        if not check_members(c, where, rel, RELATIONSHIP_MEMBERS):
            continue
        for end in ("from", "to"):
            key = rel.get(end)
            if not isinstance(key, str) or entity(g, key) is None:
                c.add(where + pointer(end), f"unknown entity {key!r}")
        if rel.get("cardinality") not in CARDINALITIES:
            c.add(where + "/cardinality", f"{rel.get('cardinality')!r} is not one of {', '.join(CARDINALITIES)}")
        if check_members(c, where + "/join", rel.get("join"), ("fromColumn", "toColumn")):
            check_identifier(c, where + "/join/fromColumn", rel["join"].get("fromColumn"))
            check_identifier(c, where + "/join/toColumn", rel["join"].get("toColumn"))
        check_text(c, where + "/label", rel.get("label"), languages)


def check_phrases(c: Collector, g: dict[str, Any], languages: list[str]) -> None:
    """Phrases: the joining words and separators, fieldOnPath and the two related phrases."""
    phrases = g.get("phrases")
    names = (*PLAIN_PHRASES, "fieldOnPath", *RELATED_PHRASES)
    if not check_members(c, "/phrases", phrases, names):
        return
    for name in PLAIN_PHRASES:
        check_text(c, pointer("phrases", name), phrases.get(name), languages, padded=name in PADDED_PHRASES)
    both = frozenset({"field", "relationship"})
    check_text(c, "/phrases/fieldOnPath", phrases.get("fieldOnPath"), languages, both, both)
    allowed = frozenset({"relationship", "conditions"})
    for name in RELATED_PHRASES:
        if check_members(c, pointer("phrases", name), phrases.get(name), ("sentence", "reason")):
            check_text(c, pointer("phrases", name, "sentence"), phrases[name].get("sentence"), languages, allowed,
                       allowed)
            check_text(c, pointer("phrases", name, "reason"), phrases[name].get("reason"), languages, allowed,
                       frozenset({"relationship"}))


def check_suggestions(c: Collector, g: dict[str, Any], languages: list[str]) -> None:
    """Suggestion texts (H1): the five kinds with name, description and rationale, the three evidence keys,
    each with only its own placeholders (evidence with all of them)."""
    sug = g.get("suggestions")
    if not check_members(c, "/suggestions", sug, ("kinds", "evidence")):
        return
    if check_members(c, "/suggestions/kinds", sug.get("kinds"), tuple(SUGGESTION_KINDS)):
        for kind, allowed in SUGGESTION_KINDS.items():
            texts = sug["kinds"].get(kind)
            if kind in sug["kinds"] and check_members(c, pointer("suggestions", "kinds", kind), texts, KIND_TEXTS):
                for t in KIND_TEXTS:
                    check_text(c, pointer("suggestions", "kinds", kind, t), texts.get(t), languages, allowed)
    if check_members(c, "/suggestions/evidence", sug.get("evidence"), tuple(EVIDENCE_KEYS)):
        for key, params in EVIDENCE_KEYS.items():
            if key in sug["evidence"]:
                check_text(c, pointer("suggestions", "evidence", key), sug["evidence"][key], languages, params,
                           params)


def check_glossary(ctx: Context) -> CheckResult:
    """Glossary integrity: Design B (structure, keys, references, texts and placeholders) with the H1 members
    (lifecycle, required, suggestions) and the H3 members (maxTotalValues, comparable)."""
    g = ctx.glossary
    if g is None:
        return Skipped(f"{GLOSSARY_FILE} did not load")
    c = Collector(GLOSSARY_FILE)
    if not check_members(c, "", g, GLOSSARY_MEMBERS):
        return c.failures
    if not isinstance(g.get("glossaryVersion"), str) or not SEMVER.match(g["glossaryVersion"]):
        c.add("/glossaryVersion", "must be a version such as 1.0.0")
    languages = g.get("languages")
    if not isinstance(languages, list) or not languages or len(set(map(str, languages))) != len(languages) or any(
            not isinstance(lang, str) or not LANGUAGE.match(lang) for lang in languages):
        c.add("/languages", "must be a non-empty list of distinct two-letter language codes")
        languages = ["he", "en"]
    if g.get("defaultLanguage") not in languages:
        c.add("/defaultLanguage", f"{g.get('defaultLanguage')!r} is not one of the languages")
    if check_members(c, "/limits", g.get("limits"), LIMIT_KEYS):
        for key in LIMIT_KEYS:
            if key in g["limits"] and (not is_int(g["limits"][key]) or g["limits"][key] < 1):
                c.add(pointer("limits", key), "must be a positive integer")
    if check_members(c, "/formats", g.get("formats"), tuple(languages)):
        for lang in languages:
            fmt = g["formats"].get(lang)
            if lang in g["formats"] and check_members(c, pointer("formats", lang), fmt, FORMAT_MEMBERS):
                date = fmt.get("date")
                rest = re.sub(r"dd|MM|yyyy", "", date) if isinstance(date, str) else ""
                if not isinstance(date, str) or any(date.count(t) != 1 for t in ("dd", "MM", "yyyy")) or not rest or any(
                        ch.isalnum() for ch in rest):
                    c.add(pointer("formats", lang, "date"), "must hold dd, MM and yyyy once each, with separators")
                for sep in ("groupSeparator", "decimalSeparator"):
                    if not isinstance(fmt.get(sep), str) or len(fmt.get(sep, "")) != 1:
                        c.add(pointer("formats", lang, sep), "must be one character")
                if fmt.get("groupSeparator") == fmt.get("decimalSeparator"):
                    c.add(pointer("formats", lang), "the two separators must differ")
    check_phrases(c, g, languages)
    check_operators(c, g, languages)
    check_entities(c, g, languages)
    check_relationships(c, g, languages)
    check_suggestions(c, g, languages)
    return c.failures


# ---------------------------------------------------------------------------------------------------------
# Check 3: agreement between the schema and the glossary


def check_agreement(ctx: Context) -> CheckResult:
    """The schema's operator enum equals the glossary's operator keys, its four arity lists equal the glossary's
    arities, its list, path and children limits equal `limits`, and every glossary key fits the key pattern."""
    schema, g = ctx.schema, ctx.glossary
    if not isinstance(schema, dict) or not isinstance(g, dict):
        return Skipped("the schema or the glossary did not load")
    c = Collector(SCHEMA_FILE)
    defs = schema.get("$defs", {})
    ops = [op for op in g.get("operators", []) if isinstance(op, dict)]
    glossary_keys = [op.get("key") for op in ops]
    schema_keys = defs.get("operator", {}).get("enum")
    if not isinstance(schema_keys, list):
        c.add("/$defs/operator/enum", "missing")
        schema_keys = []
    for key in sorted(set(glossary_keys) - set(schema_keys), key=str):
        c.add("/$defs/operator/enum", f"lacks the glossary operator {key!r}")
    for key in sorted(set(schema_keys) - set(glossary_keys), key=str):
        c.add("/$defs/operator/enum", f"has {key!r}, which the glossary does not define")
    arity_defs = {0: "operatorArity0", 1: "operatorArity1", 2: "operatorArity2", "list": "operatorArityList"}
    covered: list[Any] = []
    for arity, name in arity_defs.items():
        listed = defs.get(name, {}).get("enum")
        if not isinstance(listed, list):
            c.add(pointer("$defs", name, "enum"), "missing")
            continue
        covered += listed
        expected = {op.get("key") for op in ops if op.get("arity") == arity and is_int(op.get("arity")) == (
            arity != "list")}
        for key in sorted(expected - set(listed), key=str):
            c.add(pointer("$defs", name, "enum"), f"lacks {key!r}, which has arity {arity!r} in the glossary")
        for key in sorted(set(listed) - expected, key=str):
            c.add(pointer("$defs", name, "enum"), f"has {key!r}, which does not have arity {arity!r} in the glossary")
    if sorted(covered, key=str) != sorted(schema_keys, key=str):
        c.add("/$defs", "the four arity lists do not partition /$defs/operator/enum")
    limits = g.get("limits", {}) if isinstance(g.get("limits"), dict) else {}
    list_rule = operand_rule(schema, "operatorArityList")
    list_max = (list_rule or {}).get("properties", {}).get("values", {}).get("maxItems")
    if list_rule is None:
        c.add("/$defs/node/allOf", "no operand rule for #/$defs/operatorArityList")
    elif list_max != limits.get("maxListValues"):
        c.add("/$defs/node/allOf", f"the list operators take at most {list_max!r} values; "
              f"limits.maxListValues is {limits.get('maxListValues')!r}")
    path_max = defs.get("fieldRef", {}).get("properties", {}).get("path", {}).get("maxItems")
    if path_max != limits.get("maxPathHops"):
        c.add("/$defs/fieldRef/properties/path/maxItems",
              f"is {path_max!r}; limits.maxPathHops is {limits.get('maxPathHops')!r}")
    children_max = defs.get("node", {}).get("properties", {}).get("children", {}).get("maxItems")
    if children_max != limits.get("maxConditions"):
        c.add("/$defs/node/properties/children/maxItems",
              f"is {children_max!r}; limits.maxConditions is {limits.get('maxConditions')!r}")
    key_pattern = defs.get("key", {}).get("pattern")
    if isinstance(key_pattern, str):
        rx = re.compile(key_pattern)
        gc = Collector(GLOSSARY_FILE)
        for i, ent in enumerate(g.get("entities", [])):
            if not isinstance(ent, dict):
                continue
            keys = [(pointer("entities", i, "key"), ent.get("key"))]
            keys += [(pointer("entities", i, "fields", j, "key"), f.get("key"))
                     for j, f in enumerate(ent.get("fields", [])) if isinstance(f, dict)]
            for where, key in keys:
                if not isinstance(key, str) or not rx.match(key):
                    gc.add(where, f"{key!r} does not match the schema's key pattern {key_pattern}")
        for i, rel in enumerate(g.get("relationships", [])):
            key = rel.get("key") if isinstance(rel, dict) else None
            if not isinstance(key, str) or not rx.match(key):
                gc.add(pointer("relationships", i, "key"), f"{key!r} does not match the schema's key pattern")
        c.failures += gc.failures
    else:
        c.add("/$defs/key/pattern", "missing")
    return c.failures


# ---------------------------------------------------------------------------------------------------------
# Checks 4 and 5: stubs


def check_examples(ctx: Context) -> CheckResult:
    """Check 4 (Design G): the wrapper shape of contracts/examples/*.json, the definition against the schema,
    the glossary references, expected.total and unique ids. Arrives with phase 3."""
    return Skipped("arrives with phase 3")


def check_invalid_fixtures(ctx: Context) -> CheckResult:
    """Check 5 (Design G): contracts/examples/invalid/*.json fail (schema layer) or pass (semantic layer) the
    schema, and every expected code is a row of contracts/errors.md. Arrives with phase 4."""
    return Skipped("arrives with phase 4")


CHECKS: list[tuple[str, Callable[[Context], CheckResult]]] = [
    ("schema", check_schema),
    ("glossary", check_glossary),
    ("agreement", check_agreement),
    ("examples", check_examples),
    ("invalid fixtures", check_invalid_fixtures),
]


# ---------------------------------------------------------------------------------------------------------
# Entry point


def load_context(root: Path) -> Context:
    """Loads the schema and the glossary under `root`; a file that does not load becomes a failure."""
    global _message_root
    _message_root = root
    ctx = Context(root=root)
    ctx.schema, failure = load_json(ctx.file(SCHEMA_FILE))
    if failure:
        ctx.load_failures.append(fail(SCHEMA_FILE, failure.message))
    ctx.glossary, failure = load_json(ctx.file(GLOSSARY_FILE))
    if failure:
        ctx.load_failures.append(fail(GLOSSARY_FILE, failure.message))
    return ctx


def main(argv: list[str] | None = None) -> int:
    """Runs every check and prints the failures last; 1 on any failure, else 0."""
    parser = argparse.ArgumentParser(description="Check contracts/: the definition schema, the glossary and "
                                                 "their agreement.")
    parser.add_argument("--root", type=Path, default=DEFAULT_ROOT,
                        help="repository root holding contracts/ (default: the parent of scripts/)")
    args = parser.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    ctx = load_context(args.root.resolve())
    failures = list(ctx.load_failures)
    passed: list[str] = []
    skipped: list[str] = []
    for name, check in CHECKS:
        result = check(ctx)
        if isinstance(result, Skipped):
            skipped.append(f"{name} ({result.reason})")
        elif result:
            failures += result
        else:
            passed.append(name)

    if failures:
        print(f"contracts-check: {len(failures)} failure{'s' if len(failures) != 1 else ''}")
        for f in failures:
            print(f"{f.path}: {f.message}")
        return 1
    summary = f"contracts-check: ok, {len(passed)} checks passed ({', '.join(passed)})"
    if skipped:
        summary += f"; skipped: {', '.join(skipped)}"
    print(summary)
    return 0


if __name__ == "__main__":
    sys.exit(main())
