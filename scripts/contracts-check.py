#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = ["jsonschema==4.26.0"]
# ///
"""Check the contracts every service builds against.

    uv run scripts/contracts-check.py [--root DIR]
    uv run scripts/contracts-check.py --render     the sentences and reasons of the examples, to read

Paths resolve from this script's location (or --root), so the working directory does not matter.

1. schema            contracts/control-definition.schema.json is a draft 2020-12 schema inside the keyword
                     subset both validators report alike: no not, anyOf or oneOf anywhere (Design I1).
2. glossary          contracts/glossary.json integrity (Design B, with H1 and H3).
3. agreement         the schema and the glossary agree on operators, arities, limits and key patterns.
4. examples          contracts/examples/*.json: the wrapper, the definition against the schema and the
                     glossary, the expected sets (Design D and G).
5. invalid fixtures  contracts/examples/invalid/*.json are rejected where they say, by the layer they say, with
                     a code of contracts/errors.md; the keys of errors.md equal the glossary's (Design F and G).

Output: one line per failure, each starting with the file path, printed after everything else (the Stop
hook shows the last lines of a failed check). Exit 1 on any failure, else 0 with a one-line summary.

--render runs no check. It prints, per example, the rule sentence and one reason per node in every language,
by the rendering rules of contracts/errors.md. It is a reading aid for the copy review; the engine's explainer
is the renderer, and this is not its specification.
"""

from __future__ import annotations

import argparse
import io
import json
import re
import sys
from collections.abc import Callable, Iterator
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
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
FIELD_OPTIONAL = ("description", "column", "computed", "operators", "unit", "enumValues", "valueLabels", "identifier",
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
ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
NUMBER_BOUND = 10**15  # errors.md, VALUE_TYPE_MISMATCH: a number literal stays below this in absolute value

# Design D: the wrapper of an example control.
EXAMPLE_MEMBERS = ("id", "name", "description", "runDate", "definition", "expected")
EXAMPLE_OPTIONAL = ("heuristic", "alternateRuns")
EXAMPLE_ID = re.compile(r"^[a-z][a-z0-9-]{0,63}$")

# Design F: the invalid fixtures and the catalogue they name. A catalogue row starts with its code or key in
# backticks (errors.md states the same pattern); a table runs from its "## " heading to the next one.
FIXTURE_LAYERS = ("schema", "semantic")
CATALOGUE_ROW = re.compile(r"^\| `([A-Za-z_]+)` \|")
DEFINITION_CODES_HEADING = "Definition error codes"
REASON_KEYS_HEADING = "Reason keys"
EVIDENCE_KEYS_HEADING = "Evidence keys"
RELATED_REASON_KEYS = ("related_any", "related_none")


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


def dig(node: Any, *names: str) -> Any:
    """The value at a chain of member names, or None as soon as a step is not an object or lacks the member."""
    for name in names:
        if not isinstance(node, dict):
            return None
        node = node.get(name)
    return node


def as_list(value: Any) -> list[Any]:
    """The value when it is a list, else an empty list."""
    return value if isinstance(value, list) else []


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
    for op in glossary.get("operators") or []:
        types = dig(op, "types")
        if isinstance(types, list) and fld.get("type") in types:
            if op.get("key") in NULL_OPERATORS and not fld.get("nullable"):
                continue
            keys.append(op.get("key"))
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
    rules = dig(schema, "$defs", "node", "allOf")
    for rule in rules if isinstance(rules, list) else []:
        props, required = dig(rule, "if", "properties"), dig(rule, "if", "required")
        if (isinstance(props, dict) and set(props) == {"type", "operator"}
                and dig(props, "operator", "$ref") == f"#/$defs/{arity_def}"
                and isinstance(required, list) and set(map(str, required)) == {"type", "operator"}):
            then = dig(rule, "then")
            return then if isinstance(then, dict) else None
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


def check_field_source(c: Collector, ent: dict[str, Any], where: str, fld: dict[str, Any]) -> None:
    """Where a field's values come from: exactly one of a column and a computed source over a stored column of
    the right type. A computed field is never comparable (H3)."""
    has_column, has_computed = "column" in fld, "computed" in fld
    if has_column == has_computed:
        c.add(where, "needs exactly one of column and computed")
    if has_column:
        check_identifier(c, where + "/column", fld["column"])
    if not has_computed:
        return
    comp = fld["computed"]
    if check_members(c, where + "/computed", comp, ("function", "over")):
        function = comp.get("function")
        needs = COMPUTED_FUNCTIONS.get(function) if isinstance(function, str) else None
        if needs is None:
            c.add(where + "/computed/function", f"{function!r} is not one of {', '.join(COMPUTED_FUNCTIONS)}")
        sources = [f for f in as_list(ent.get("fields")) if isinstance(f, dict) and "column" in f and f.get("column") == comp.get("over")]
        if not sources:
            c.add(where + "/computed/over", f"{comp.get('over')!r} is not the column of a stored field here")
        elif needs is not None and sources[0].get("type") != needs:
            c.add(where + "/computed/over", f"{function} needs a {needs} column")
    if fld.get("comparable") is not False:
        c.add(where, "a computed field needs comparable: false (H3)")


def check_field_values(c: Collector, where: str, fld: dict[str, Any], languages: list[str]) -> None:
    """What a field's values look like: the unit of a number, the values of an enum, the two labels of a bool."""
    ftype = fld.get("type")
    if "unit" in fld:
        if ftype != "number":
            c.add(where + "/unit", "only a number field has a unit")
        check_text(c, where + "/unit", fld["unit"], languages)
    if (ftype == "enum") != ("enumValues" in fld):
        c.add(where, "enumValues belongs to, and is required on, every enum field and no other")
    if isinstance(fld.get("enumValues"), list) and fld["enumValues"]:
        seen: set[str] = set()
        for j, item in enumerate(fld["enumValues"]):
            item_where = where + pointer("enumValues", j)
            if not check_members(c, item_where, item, ("value", "label")):
                continue
            value = item.get("value")
            if not isinstance(value, str) or not value:
                c.add(item_where + "/value", "must be a non-empty string")
            elif value in seen:
                c.add(item_where + "/value", f"duplicate enum value {value!r}")
            else:
                seen.add(value)
            check_text(c, item_where + "/label", item.get("label"), languages)
    elif "enumValues" in fld:
        c.add(where + "/enumValues", "must be a non-empty list")
    if (ftype == "bool") != ("valueLabels" in fld):
        c.add(where, "valueLabels belongs to, and is required on, every bool field and no other")
    if "valueLabels" in fld and check_members(c, where + "/valueLabels", fld["valueLabels"], ("true", "false")):
        for b in ("true", "false"):
            check_text(c, where + pointer("valueLabels", b), fld["valueLabels"].get(b), languages)


def check_field_rules(c: Collector, g: dict[str, Any], ent: dict[str, Any], where: str, fld: dict[str, Any]) -> None:
    """What may be done with a field: its operator override, `required`, `comparable` and `identifier`."""
    ftype = fld.get("type")
    if "operators" in fld:
        override = fld["operators"]
        if not isinstance(override, list) or not override or len(set(map(str, override))) != len(override):
            c.add(where + "/operators", "must be a non-empty list of distinct operator keys")
        else:
            for j, key in enumerate(override):
                op = operator(g, key) if isinstance(key, str) else None
                types = dig(op, "types")
                if op is None:
                    c.add(where + pointer("operators", j), f"unknown operator {key!r}")
                elif not isinstance(types, list) or ftype not in types:
                    c.add(where + pointer("operators", j), f"{key} does not apply to the type {ftype}")
    if "required" in fld:
        state = fld["required"]
        if not isinstance(state, str) or state not in REQUIRED_STATES:
            c.add(where + "/required", f"{state!r} is not one of {', '.join(REQUIRED_STATES)}")
        elif state != "always" and "lifecycle" not in ent:
            c.add(where + "/required", f"{state!r} needs a lifecycle on the entity (H1)")
    for flag in ("comparable", "identifier"):
        if flag in fld and not isinstance(fld[flag], bool):
            c.add(where + pointer(flag), "must be true or false")
    if fld.get("identifier") is True and (ftype != "number" or "unit" in fld):
        c.add(where + "/identifier", "only a number field without a unit can be an identifier")


def check_field(c: Collector, g: dict[str, Any], ent: dict[str, Any], where: str, fld: Any,
                languages: list[str]) -> None:
    """One field: its members, type, labels and flags, then its source, its values and its rules."""
    if not check_members(c, where, fld, FIELD_MEMBERS, FIELD_OPTIONAL):
        return
    if not isinstance(fld.get("type"), str) or fld["type"] not in FIELD_TYPES:
        c.add(where + "/type", f"{fld.get('type')!r} is not one of {', '.join(FIELD_TYPES)}")
    check_text(c, where + "/label", fld.get("label"), languages)
    if "description" in fld:
        check_text(c, where + "/description", fld["description"], languages)
    for flag in ("nullable", "visible"):
        if not isinstance(fld.get(flag), bool):
            c.add(where + pointer(flag), "must be true or false")
    check_field_source(c, ent, where, fld)
    check_field_values(c, where, fld, languages)
    check_field_rules(c, g, ent, where, fld)


def check_lifecycle(c: Collector, ent: dict[str, Any], where: str) -> None:
    """An entity's lifecycle (H1): a visible stored bool or enum field, and the value of it that means active."""
    life = ent["lifecycle"]
    if not check_members(c, where, life, ("field", "active")):
        return
    fld = field_of(ent, life.get("field")) if isinstance(life.get("field"), str) else None
    active = life.get("active")
    if fld is None:
        c.add(where + "/field", f"unknown field {life.get('field')!r}")
    elif fld.get("type") not in ("bool", "enum") or "computed" in fld or fld.get("visible") is not True:
        c.add(where + "/field", "must be a visible stored bool or enum field (H1)")
    elif fld.get("type") == "bool" and not isinstance(active, bool):
        c.add(where + "/active", "must be true or false for a bool field")
    elif fld.get("type") == "enum" and active not in [dig(v, "value") for v in as_list(fld.get("enumValues"))]:
        c.add(where + "/active", f"{active!r} is not a value of {fld.get('key')}")


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
        if "lifecycle" in ent:
            check_lifecycle(c, ent, where + "/lifecycle")


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
    if not check_members(c, "/phrases", phrases, names) or not isinstance(phrases, dict):
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
    if not check_members(c, "/suggestions", sug, ("kinds", "evidence")) or not isinstance(sug, dict):
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


ARITY_DEFS: dict[int | str, str] = {0: "operatorArity0", 1: "operatorArity1", 2: "operatorArity2",
                                    "list": "operatorArityList"}


def enum_of(c: Collector, schema: dict[str, Any], name: str) -> list[Any]:
    """The `enum` of `#/$defs/<name>`, or an empty list after recording that it is missing."""
    listed = dig(schema, "$defs", name, "enum")
    if not isinstance(listed, list):
        c.add(pointer("$defs", name, "enum"), "missing")
        return []
    return listed


def agree_operators(c: Collector, schema: dict[str, Any], ops: list[dict[str, Any]]) -> None:
    """The schema's operator enum equals the glossary's operator keys, and its four arity lists split that enum
    as the glossary's arities do."""
    schema_keys = enum_of(c, schema, "operator")
    glossary_keys = {op.get("key") for op in ops}
    for key in sorted(glossary_keys - set(schema_keys), key=str):
        c.add("/$defs/operator/enum", f"lacks the glossary operator {key!r}")
    for key in sorted(set(schema_keys) - glossary_keys, key=str):
        c.add("/$defs/operator/enum", f"has {key!r}, which the glossary does not define")
    covered: list[Any] = []
    for arity, name in ARITY_DEFS.items():
        listed = enum_of(c, schema, name)
        covered += listed
        expected = {op.get("key") for op in ops if op.get("arity") == arity and is_int(op.get("arity")) == (
            arity != "list")}
        for key in sorted(expected - set(listed), key=str):
            c.add(pointer("$defs", name, "enum"), f"lacks {key!r}, which has arity {arity!r} in the glossary")
        for key in sorted(set(listed) - expected, key=str):
            c.add(pointer("$defs", name, "enum"), f"has {key!r}, which does not have arity {arity!r} in the glossary")
    if sorted(covered, key=str) != sorted(schema_keys, key=str):
        c.add("/$defs", "the four arity lists do not partition /$defs/operator/enum")


def agree_limits(c: Collector, schema: dict[str, Any], limits: dict[str, Any]) -> None:
    """The three limits the schema can express equal the glossary's: list values, path hops, children."""
    list_rule = operand_rule(schema, "operatorArityList")
    list_max = dig(list_rule, "properties", "values", "maxItems")
    if list_rule is None:
        c.add("/$defs/node/allOf", "no operand rule for #/$defs/operatorArityList")
    elif list_max != limits.get("maxListValues"):
        c.add("/$defs/node/allOf", f"the list operators take at most {list_max!r} values; "
              f"limits.maxListValues is {limits.get('maxListValues')!r}")
    for where, names, key in (
            ("/$defs/fieldRef/properties/path/maxItems", ("fieldRef", "properties", "path", "maxItems"), "maxPathHops"),
            ("/$defs/node/properties/children/maxItems", ("node", "properties", "children", "maxItems"),
             "maxConditions")):
        found = dig(schema, "$defs", *names)
        if found != limits.get(key):
            c.add(where, f"is {found!r}; limits.{key} is {limits.get(key)!r}")


def agree_keys(c: Collector, schema: dict[str, Any], g: dict[str, Any]) -> list[Failure]:
    """Every entity, field and relationship key of the glossary fits the schema's key pattern. The failures are
    about the glossary file and are returned; a missing pattern is recorded on the schema's collector."""
    key_pattern = dig(schema, "$defs", "key", "pattern")
    if not isinstance(key_pattern, str):
        c.add("/$defs/key/pattern", "missing")
        return []
    rx = re.compile(key_pattern)
    gc = Collector(GLOSSARY_FILE)
    keys: list[tuple[str, Any]] = []
    for i, ent in enumerate(g.get("entities") or []):
        keys.append((pointer("entities", i, "key"), dig(ent, "key")))
        fields = dig(ent, "fields")
        keys += [(pointer("entities", i, "fields", j, "key"), dig(f, "key"))
                 for j, f in enumerate(fields if isinstance(fields, list) else [])]
    keys += [(pointer("relationships", i, "key"), dig(rel, "key")) for i, rel in enumerate(g.get("relationships") or [])]
    for where, key in keys:
        if not isinstance(key, str) or not rx.match(key):
            gc.add(where, f"{key!r} does not match the schema's key pattern {key_pattern}")
    return gc.failures


def check_agreement(ctx: Context) -> CheckResult:
    """The schema and the glossary agree: on the operator keys and their arities, on the limits the schema can
    express, and on the pattern every key must fit."""
    schema, g = ctx.schema, ctx.glossary
    if not isinstance(schema, dict) or not isinstance(g, dict):
        return Skipped("the schema or the glossary did not load")
    c = Collector(SCHEMA_FILE)
    ops = [op for op in g.get("operators") or [] if isinstance(op, dict)]
    agree_operators(c, schema, ops)
    agree_limits(c, schema, g["limits"] if isinstance(g.get("limits"), dict) else {})
    key_failures = agree_keys(c, schema, g)
    return c.failures + key_failures


# ---------------------------------------------------------------------------------------------------------
# Check 4: the example controls


def is_iso_date(value: Any) -> bool:
    """A string holding a real YYYY-MM-DD date."""
    if not isinstance(value, str) or not ISO_DATE.match(value):
        return False
    try:
        date.fromisoformat(value)
    except ValueError:
        return False
    return True


def literal_problem(fld: dict[str, Any], value: Any) -> tuple[str, str] | None:
    """Why a literal does not fit the type of the field it is compared with, as (definition error code, text),
    or None when it fits (errors.md, VALUE_TYPE_MISMATCH and UNKNOWN_ENUM_VALUE)."""
    kind = fld.get("type")
    if kind == "number":
        fits = isinstance(value, (int, float)) and not isinstance(value, bool) and abs(value) < NUMBER_BOUND
    elif kind == "bool":
        fits = isinstance(value, bool)
    elif kind == "date":
        fits = is_iso_date(value)
    elif kind == "enum":
        if isinstance(value, str) and value not in {dig(v, "value") for v in as_list(fld.get("enumValues"))}:
            return "UNKNOWN_ENUM_VALUE", f"{value!r} is not an enum value of field {fld.get('key')!r}"
        fits = isinstance(value, str)
    else:
        fits = isinstance(value, str)
    return None if fits else ("VALUE_TYPE_MISMATCH", f"{value!r} is not a {kind} literal (field {fld.get('key')!r})")


class DefinitionWalk:
    """Walks a schema-valid definition against the glossary, as the semantic layer of errors.md describes it,
    and records every fault it finds with its definition error code. Afterwards `faults` holds (JSON Pointer
    into the definition, code), `ids` every node id and `matchable` the ids that can be matched (errors.md,
    Matched), in document order. The glossary must have passed check 2."""

    def __init__(self, c: Collector, where: str, glossary: dict[str, Any]) -> None:
        self.c = c
        self.where = where
        self.g = glossary
        self.faults: list[tuple[str, str]] = []
        self.ids: list[str] = []
        self.matchable: list[str] = []
        self.depth = 0
        self.values = 0

    def fault(self, code: str, path: str, message: str) -> None:
        """Records a fault at `path` (a JSON Pointer into the definition) under its definition error code."""
        self.faults.append((path, code))
        self.c.add(self.where + path, f"{code}: {message}")

    def run(self, definition: dict[str, Any]) -> None:
        """Checks the root entity, the whole tree and the three limits of the tree."""
        root = entity(self.g, definition.get("rootEntity", ""))
        if root is None or not root.get("visible"):
            self.fault("UNKNOWN_ENTITY", "/rootEntity", f"no visible entity {definition.get('rootEntity')!r}")
            return
        if not root.get("rootable"):
            self.fault("ENTITY_NOT_ROOTABLE", "/rootEntity", f"entity {root.get('key')!r} may not be a root entity")
        self.group("/where", root, definition["where"], 1, False)
        limits = self.g.get("limits")
        if not isinstance(limits, dict):
            limits = {}
        for code, actual, key, what in (("TOO_DEEP", self.depth, "maxDepth", "groups deep"),
                                        ("TOO_MANY_CONDITIONS", len(self.ids), "maxConditions", "nodes"),
                                        ("TOO_MANY_VALUES", self.values, "maxTotalValues", "literal values")):
            if is_int(limits.get(key)) and actual > limits[key]:
                self.fault(code, "/where", f"{actual} {what}; limits.{key} is {limits[key]}")

    def group(self, where: str, scope: dict[str, Any], node: dict[str, Any], depth: int, in_related: bool) -> None:
        """A group: `depth` counts the groups from the root down to this one (errors.md, Depth)."""
        self.depth = max(self.depth, depth)
        for i, child in enumerate(node.get("children", [])):
            child_where = where + pointer("children", i)
            if child.get("type") == "group":
                self.group(child_where, scope, child, depth + 1, in_related)
            elif child.get("type") == "condition":
                self.condition(child_where, scope, child, in_related)
            else:
                self.related(child_where, scope, child, depth, in_related)

    def note_id(self, where: str, node: dict[str, Any], in_related: bool) -> None:
        """Records a node id, and a fault when an earlier node already carries it; a node inside a related
        sub-tree is never matched."""
        if node["id"] in self.ids:
            self.fault("DUPLICATE_NODE_ID", where + "/id", f"node id {node['id']!r} is already used by an earlier node")
        self.ids.append(node["id"])
        if not in_related:
            self.matchable.append(node["id"])

    def field(self, where: str, scope: dict[str, Any], ref: dict[str, Any]) -> dict[str, Any] | None:
        """The glossary field a field reference names from `scope`, or None after recording why not."""
        current = scope
        for hop in ref.get("path", []):
            rel = relationship(self.g, hop)
            if rel is None:
                self.fault("UNKNOWN_RELATIONSHIP", where, f"unknown relationship {hop!r}")
                return None
            if rel.get("from") != current.get("key"):
                self.fault("PATH_NOT_REACHABLE", where,
                           f"relationship {hop!r} does not start at entity {current.get('key')!r}")
                return None
            if rel.get("cardinality") == "one_to_many":
                self.fault("PATH_NOT_TRAVERSABLE", where,
                           f"relationship {hop!r} is one_to_many: it belongs in a related node, not in a path")
                return None
            target = entity(self.g, rel.get("to", ""))
            if target is None:
                return None
            current = target
        fld = field_of(current, ref.get("field", ""))
        if fld is None or not fld.get("visible"):
            self.fault("UNKNOWN_FIELD", where, f"entity {current.get('key')!r} has no visible field {ref.get('field')!r}")
            return None
        return fld

    def comparison(self, where: str, scope: dict[str, Any], node: dict[str, Any], op: dict[str, Any],
                   left: dict[str, Any]) -> None:
        """A field-to-field comparison (errors.md, Field comparisons)."""
        right = self.field(where + "/right", scope, node["right"])
        if not op.get("fieldComparable"):
            self.fault("FIELD_COMPARISON_NOT_ALLOWED", where + "/right",
                       f"operator {node['operator']!r} does not compare two fields")
        elif right is not None:
            for side, fld in (("left", left), ("right", right)):
                if fld.get("comparable") is False:
                    self.fault("FIELD_COMPARISON_NOT_ALLOWED", where + pointer(side),
                               f"field {fld.get('key')!r} is not comparable with another field")
            if left.get("type") != right.get("type"):
                self.fault("FIELD_TYPE_MISMATCH", where + "/right",
                           f"compares a {left.get('type')} field with a {right.get('type')} field")

    def condition(self, where: str, scope: dict[str, Any], node: dict[str, Any], in_related: bool) -> None:
        """A condition: the left field, the operator for its type, and the operand against that type."""
        self.note_id(where, node, in_related)
        literals = [("/value", "", node["value"])] if "value" in node else []
        literals += [("/values", f"item {i}: ", v) for i, v in enumerate(node.get("values", []))]
        self.values += len(literals)
        left = self.field(where + "/left", scope, node["left"])
        op = operator(self.g, node["operator"])
        if left is None or op is None:
            return
        if node["operator"] not in resolved_operators(self.g, left):
            self.fault("OPERATOR_NOT_ALLOWED", where + "/operator", f"operator {node['operator']!r} is not allowed "
                       f"for field {left.get('key')!r} of type {left.get('type')!r}")
            return
        if "right" in node:
            self.comparison(where, scope, node, op, left)
        problems = [(member, prefix, literal_problem(left, v)) for member, prefix, v in literals]
        for member, prefix, problem in problems:
            if problem:
                self.fault(problem[0], where + member, prefix + problem[1])
        in_order = op.get("arity") != 2 or len(literals) != 2 or any(problem for _, _, problem in problems)
        if not in_order and literals[0][2] > literals[1][2]:
            self.fault("RANGE_INVALID", where + "/values", "the first value is above the second")

    def related(self, where: str, scope: dict[str, Any], node: dict[str, Any], depth: int, in_related: bool) -> None:
        """A related node: a one-to-many relationship that starts at the scope entity, and its sub-tree."""
        self.note_id(where, node, in_related)
        rel = relationship(self.g, node["relationship"])
        at = where + "/relationship"
        if rel is None:
            self.fault("UNKNOWN_RELATIONSHIP", at, f"unknown relationship {node['relationship']!r}")
        elif rel.get("from") != scope.get("key"):
            self.fault("PATH_NOT_REACHABLE", at, f"relationship {node['relationship']!r} does not start at entity "
                       f"{scope.get('key')!r}")
        elif rel.get("cardinality") != "one_to_many":
            self.fault("RELATIONSHIP_NOT_QUANTIFIABLE", at, f"relationship {node['relationship']!r} is "
                       f"{rel.get('cardinality')}; a related node needs a one_to_many relationship")
        else:
            target = entity(self.g, rel.get("to", ""))
            if target is not None:
                self.group(where + "/where", target, node["where"], depth + 1, True)


def key_order(key: str) -> tuple[int, int, str]:
    """Record keys in the order the database returns them: integer keys by value, any other key as text."""
    return (0, int(key), "") if key.isdigit() else (1, 0, key)


def check_expected(c: Collector, where: str, expected: Any, matchable: list[str] | None) -> None:
    """An expected set: `total` equals the number of violations; keys are unique strings in key order; every
    `matched` lists ids that can be matched, once each, in document order. `matchable` is None when the
    definition could not be walked."""
    if not check_members(c, where, expected, ("total", "violations")):
        return
    violations = expected.get("violations")
    if not isinstance(violations, list):
        c.add(where + "/violations", "must be a list")
        return
    if not is_int(expected.get("total")) or expected.get("total") != len(violations):
        c.add(where + "/total", f"is {expected.get('total')!r}; the example lists {len(violations)} violations")
    keys: list[str] = []
    for i, violation in enumerate(violations):
        item = where + pointer("violations", i)
        if not check_members(c, item, violation, ("key", "matched")):
            continue
        key, matched = violation.get("key"), violation.get("matched")
        if isinstance(key, str) and key:
            keys.append(key)
        else:
            c.add(item + "/key", "must be a non-empty string (record keys are strings)")
        if not isinstance(matched, list) or not matched or not all(isinstance(m, str) for m in matched):
            c.add(item + "/matched", "must be a non-empty list of node ids")
        elif matchable is not None:
            unknown = [m for m in matched if m not in matchable]
            if unknown:
                c.add(item + "/matched", f"{', '.join(unknown)}: not a node of the definition that can be matched "
                      "(a node inside a related sub-tree never is)")
            elif matched != [m for m in matchable if m in matched]:
                c.add(item + "/matched", "must list each id once, in document order")
    if len(set(keys)) != len(keys):
        c.add(where + "/violations", "a record key appears twice")
    elif keys != sorted(keys, key=key_order):
        c.add(where + "/violations", "must be ordered by record key")


def check_example(c: Collector, glossary: dict[str, Any], validator: Draft202012Validator, stem: str,
                  doc: Any) -> None:
    """One example file: the wrapper, the definition against the schema and then the glossary, the expected
    set of its run date and of every alternate run."""
    languages = [lang for lang in glossary.get("languages", []) if isinstance(lang, str)] or ["he", "en"]
    if not check_members(c, "", doc, EXAMPLE_MEMBERS, EXAMPLE_OPTIONAL):
        return
    if doc.get("id") != stem or not EXAMPLE_ID.match(stem):
        c.add("/id", f"must equal the file name {stem!r}: lower-case letters, digits and hyphens")
    check_text(c, "/name", doc.get("name"), languages)
    check_text(c, "/description", doc.get("description"), languages)
    if not is_iso_date(doc.get("runDate")):
        c.add("/runDate", "must be a real YYYY-MM-DD date")
    if "heuristic" in doc and not isinstance(doc["heuristic"], bool):
        c.add("/heuristic", "must be true or false")

    matchable: list[str] | None = None
    errors = schema_errors(validator, doc.get("definition"))
    for where, message in errors:
        c.add("/definition" + where, f"schema: {message}")
    if not errors:
        walk = DefinitionWalk(c, "/definition", glossary)
        walk.run(doc["definition"])
        matchable = walk.matchable

    check_expected(c, "/expected", doc.get("expected"), matchable)
    runs = doc.get("alternateRuns", [])
    if not isinstance(runs, list) or ("alternateRuns" in doc and not runs):
        c.add("/alternateRuns", "must be a non-empty list when present")
        return
    run_dates = [doc.get("runDate")]
    for i, run in enumerate(runs):
        where = pointer("alternateRuns", i)
        if not check_members(c, where, run, ("runDate", "expected")):
            continue
        if not is_iso_date(run.get("runDate")):
            c.add(where + "/runDate", "must be a real YYYY-MM-DD date")
        elif run["runDate"] in run_dates:
            c.add(where + "/runDate", f"{run['runDate']} is already a run date of this example")
        run_dates.append(run.get("runDate"))
        check_expected(c, where + "/expected", run.get("expected"), matchable)


def example_files(ctx: Context) -> list[Path]:
    """The example files, by name; contracts/examples/invalid/ is not among them."""
    directory = ctx.file(EXAMPLES_DIR)
    return sorted(directory.glob("*.json")) if directory.is_dir() else []


def check_examples(ctx: Context) -> CheckResult:
    """Check 4 (Design D and G): every contracts/examples/*.json has the wrapper shape, a definition that passes
    the schema and names only what the glossary allows, unique node ids, and expected sets whose total, key
    order and matched ids hold together."""
    schema, glossary = ctx.schema, ctx.glossary
    if not isinstance(schema, dict) or not isinstance(glossary, dict):
        return Skipped("the schema or the glossary did not load")
    files = example_files(ctx)
    if not files:
        return [fail(EXAMPLES_DIR, "no example files")]
    validator = schema_validator(schema)
    failures: list[Failure] = []
    for path in files:
        rel = f"{EXAMPLES_DIR}/{path.name}"
        doc, failure = load_json(path)
        if failure:
            failures.append(fail(rel, failure.message))
            continue
        c = Collector(rel)
        check_example(c, glossary, validator, path.stem, doc)
        failures += c.failures
    return failures


# ---------------------------------------------------------------------------------------------------------
# Check 5: the invalid fixtures and the error catalogue


def catalogue_tables(text: str) -> dict[str, list[tuple[str, list[str]]]]:
    """The catalogue tables of errors.md by "## " heading: per row its code or key and its other cells."""
    tables: dict[str, list[tuple[str, list[str]]]] = {}
    heading = ""
    for line in text.splitlines():
        if line.startswith("## "):
            heading = line[3:].strip()
        match = CATALOGUE_ROW.match(line)
        if match:
            cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
            tables.setdefault(heading, []).append((match.group(1), cells[1:]))
    return tables


def check_catalogue(c: Collector, glossary: dict[str, Any], tables: dict[str, list[tuple[str, list[str]]]]) -> None:
    """errors.md against the glossary: no key leads two rows, the reason keys are the operator keys plus the
    two related keys, and the evidence keys are the keys of suggestions.evidence."""
    seen: set[str] = set()
    for heading, rows in tables.items():
        for key, _ in rows:
            if key in seen:
                c.add(heading, f"`{key}` leads more than one row of the file")
            seen.add(key)
    expectations = (
        (REASON_KEYS_HEADING, {op.get("key") for op in glossary.get("operators", [])} | set(RELATED_REASON_KEYS),
         "an operator key of the glossary, or related_any or related_none"),
        (EVIDENCE_KEYS_HEADING, set(glossary.get("suggestions", {}).get("evidence", {})),
         "a key of suggestions.evidence in the glossary"),
    )
    for heading, expected, what in expectations:
        listed = {key for key, _ in tables.get(heading, [])}
        for key in sorted(expected - listed, key=str):
            c.add(heading, f"no row for `{key}`")
        for key in sorted(listed - expected, key=str):
            c.add(heading, f"`{key}` is not {what}")


def check_fixture(c: Collector, glossary: dict[str, Any], validator: Draft202012Validator,
                  codes: dict[str, str], doc: Any) -> None:
    """One invalid fixture: the wrapper; a code of the catalogue whose layer is the fixture's; a schema-layer
    definition fails the schema with one error, at the expected path; a semantic-layer definition passes the
    schema and the glossary walk of check 4 finds the expected code at the expected path."""
    if not check_members(c, "", doc, ("layer", "expected", "definition")):
        return
    layer, expected = doc.get("layer"), doc.get("expected")
    if layer not in FIXTURE_LAYERS:
        c.add("/layer", f"must be one of {', '.join(FIXTURE_LAYERS)}")
        return
    if not check_members(c, "/expected", expected, ("code", "path")):
        return
    code, path = expected.get("code"), expected.get("path")
    if code not in codes:
        c.add("/expected/code", f"{code!r} is not a row of '{DEFINITION_CODES_HEADING}' in {ERRORS_FILE}")
    elif codes[code] != layer:
        c.add("/expected/code", f"{ERRORS_FILE} gives {code} the layer {codes[code]!r}; the fixture says {layer!r}")
    if not isinstance(path, str) or (path and not path.startswith("/")):
        c.add("/expected/path", "must be a JSON Pointer into the definition")
        return

    errors = schema_errors(validator, doc.get("definition"))
    if layer == "schema":
        found = [where for where, _ in errors]
        if found != [path]:
            c.add("/definition", f"the schema must report one error, at {path!r}; it reports "
                  + (", ".join(repr(where) for where in found) if found else "none"))
        return
    if errors:
        c.add("/definition", "a semantic-layer fixture must pass the schema; it fails at "
              + ", ".join(repr(where) for where, _ in errors))
        return
    walk = DefinitionWalk(Collector(c.path), "", glossary)
    walk.run(doc["definition"])
    if (path, code) not in walk.faults:
        c.add("/definition", f"the glossary must reject it with {code} at {path!r}; the walk finds "
              + (", ".join(f"{found} at {where!r}" for where, found in walk.faults) if walk.faults else "no fault"))


def check_invalid_fixtures(ctx: Context) -> CheckResult:
    """Check 5 (Design F and G): contracts/errors.md lists the keys the glossary defines, and every
    contracts/examples/invalid/*.json is rejected by the layer it names, at the path it names, with a code of
    the catalogue."""
    schema, glossary = ctx.schema, ctx.glossary
    if not isinstance(schema, dict) or not isinstance(glossary, dict):
        return Skipped("the schema or the glossary did not load")
    try:
        text = ctx.file(ERRORS_FILE).read_text(encoding="utf-8")
    except (FileNotFoundError, UnicodeDecodeError) as e:
        return [fail(ERRORS_FILE, f"cannot be read: {e}")]
    tables = catalogue_tables(text)
    catalogue = Collector(ERRORS_FILE)
    check_catalogue(catalogue, glossary, tables)
    failures = list(catalogue.failures)
    codes = {code: (cells[0] if cells else "") for code, cells in tables.get(DEFINITION_CODES_HEADING, [])}
    if not codes:
        failures.append(fail(ERRORS_FILE, f"no rows under '## {DEFINITION_CODES_HEADING}'"))

    directory = ctx.file(INVALID_DIR)
    files = sorted(directory.glob("*.json")) if directory.is_dir() else []
    if not files:
        failures.append(fail(INVALID_DIR, "no invalid fixtures"))
    validator = schema_validator(schema)
    layers: set[str] = set()
    for path in files:
        rel = f"{INVALID_DIR}/{path.name}"
        doc, failure = load_json(path)
        if failure:
            failures.append(fail(rel, failure.message))
            continue
        if not EXAMPLE_ID.match(path.stem):
            failures.append(fail(rel, "the file name must be lower-case letters, digits and hyphens"))
        c = Collector(rel)
        check_fixture(c, glossary, validator, codes, doc)
        failures += c.failures
        if isinstance(doc, dict) and doc.get("layer") in FIXTURE_LAYERS:
            layers.add(doc["layer"])
    for layer in FIXTURE_LAYERS:
        if files and layer not in layers:
            failures.append(fail(INVALID_DIR, f"no fixture of the {layer} layer"))
    return failures


CHECKS: list[tuple[str, Callable[[Context], CheckResult]]] = [
    ("schema", check_schema),
    ("glossary", check_glossary),
    ("agreement", check_agreement),
    ("examples", check_examples),
    ("invalid fixtures", check_invalid_fixtures),
]
FOUNDATION = ("schema", "glossary")  # the checks after these two read both documents and trust their shape
SCRIPT_FILE = "scripts/contracts-check.py"


def run_checks(ctx: Context) -> tuple[list[Failure], list[str], list[str]]:
    """Runs the checks in order and returns (failures, the names that passed, the skipped with their reason).
    A check after the foundation is skipped while the schema or the glossary has failures, and a check that
    raises becomes a failure line, so no finding is ever lost to a traceback."""
    failures = list(ctx.load_failures)
    passed: list[str] = []
    skipped: list[str] = []
    for name, check in CHECKS:
        if name not in FOUNDATION and failures:
            skipped.append(f"{name} (the schema or the glossary has failures)")
            continue
        try:
            result = check(ctx)
        except Exception as e:  # noqa: BLE001 - the boundary of the script: report, never crash
            result = [fail(SCRIPT_FILE, f"the {name} check stopped on {type(e).__name__}: {e}")]
        if isinstance(result, Skipped):
            skipped.append(f"{name} ({result.reason})")
        elif result:
            failures += result
        else:
            passed.append(name)
    return failures, passed, skipped


# ---------------------------------------------------------------------------------------------------------
# --render: the sentences and reasons of the examples, to read

# A reason shows what a record holds, and this script reads no database. These are the values of the first
# planted record of each example in sql/60_seed_hr.sql, by node id: the left value, or (left, right) for a
# field-to-field comparison. A node without a sample keeps its {actual} placeholder in the output.
RENDER_SAMPLES: dict[str, dict[str, Any]] = {
    "minor-high-salary": {"c1": 16, "c2": 16500},
    "termination-before-hire": {"c1": ("2012-06-01", "2015-06-01")},
    "active-in-inactive-department": {"c1": "active", "c2": False},
    "missing-mandatory-data": {"c1": "active", "c5": "inactive"},
    "department-without-active-employees": {"c1": True},
    "inactive-ministry-salary-out-of-range": {"c1": "active", "c2": False, "c3": 4500, "c4": 52000},
}

# What the placeholders of the suggestion texts stand for in the reading aid: glossary keys and seed counts.
RENDER_SUGGESTIONS: dict[str, dict[str, Any]] = {
    "missing_required": {"entity": "employee"},
    "date_order": {"entity": "employee", "earlier": ("employee", "hire_date"),
                   "later": ("employee", "termination_date")},
    "active_under_inactive": {"entity": "employee", "relationship": "employee.department"},
    "active_without_active_children": {"entity": "department", "relationship": "department.employees"},
    "missing_optional": {"entity": "department", "field": ("department", "manager_assignment")},
    "violations_found": {"count": 3, "total": 85},
    "field_missing": {"field": ("employee", "email"), "count": 4},
    "date_order_split": {"count": 3, "total": 25},
}


def fill(template: str, values: dict[str, str]) -> str:
    """A template with its placeholders replaced; a placeholder without a value stays as written."""
    return PLACEHOLDER.sub(lambda m: values.get(m.group(1), m.group(0)), template)


class Renderer:
    """Renders sentences and reasons in one language by the rules of contracts/errors.md (Rendering), as plain
    strings. The engine's explainer is the renderer of the system; this one exists for the copy review."""

    def __init__(self, glossary: dict[str, Any], lang: str) -> None:
        self.g = glossary
        self.lang = lang
        self.phrases = glossary["phrases"]
        self.format = glossary["formats"][lang]

    def number(self, value: int | float) -> str:
        """Groups of three integer digits, the fraction without trailing zeros."""
        whole, _, fraction = f"{Decimal(str(value)):f}".partition(".")
        grouped = f"{int(whole):,}".replace(",", self.format["groupSeparator"])
        fraction = fraction.rstrip("0")
        return grouped + (self.format["decimalSeparator"] + fraction if fraction else "")

    def literal(self, fld: dict[str, Any], value: Any) -> str:
        """A value of a field: by its type, with the field's unit after it; NULL is nothing."""
        if value is None:
            return ""
        kind = fld.get("type")
        if kind == "bool" and isinstance(value, bool):
            text = fld["valueLabels"]["true" if value else "false"][self.lang]
        elif kind == "enum":
            labels = {v["value"]: v["label"][self.lang] for v in fld.get("enumValues", [])}
            text = labels.get(value, str(value))
        elif kind == "date" and is_iso_date(value):
            year, month, day = value.split("-")
            text = self.format["date"].replace("yyyy", year).replace("MM", month).replace("dd", day)
        elif kind == "number" and isinstance(value, (int, float)) and not isinstance(value, bool):
            text = str(value) if fld.get("identifier") else self.number(value)
        else:
            text = str(value)
        return f"{text} {fld['unit'][self.lang]}" if "unit" in fld else text

    def field(self, scope: dict[str, Any], ref: dict[str, Any]) -> tuple[str, dict[str, Any]]:
        """A field reference as (text, field): the label, through fieldOnPath with the last relationship of the
        path when it has one."""
        path = ref.get("path", [])
        target = follow_path(self.g, scope["key"], path)
        fld = field_of(target, ref["field"])
        if fld is None:
            return ref["field"], {}
        label = fld["label"][self.lang]
        if path:
            rel = relationship(self.g, path[-1])
            label = fill(self.phrases["fieldOnPath"][self.lang],
                         {"field": label, "relationship": rel["label"][self.lang] if rel else path[-1]})
        return label, fld

    def condition(self, scope: dict[str, Any], node: dict[str, Any], kind: str, sample: Any = None) -> str:
        """A condition's `sentence` or `reason` variant, filled."""
        op = operator(self.g, node["operator"]) or {}
        label, fld = self.field(scope, node["left"])
        variant = pick_variant(op.get(kind, {}), fld.get("type", ""), "right" in node)
        if variant is None:
            return f"{label} {node['operator']}"
        values = {"field": label}
        if "value" in node:
            values["value"] = self.literal(fld, node["value"])
        if "values" in node and op.get("arity") == 2:
            values["value"], values["value2"] = (self.literal(fld, v) for v in node["values"])
        elif "values" in node:
            values["values"] = self.phrases["listSeparator"][self.lang].join(self.literal(fld, v) for v in node["values"])
        actual, other_actual = sample if isinstance(sample, tuple) else (sample, None)
        if "right" in node:
            values["other"], other = self.field(scope, node["right"])
            if other_actual is not None:
                values["otherActual"] = self.literal(other, other_actual)
        if actual is not None:
            values["actual"] = self.literal(fld, actual)
        return fill(variant[self.lang], values)

    def related(self, node: dict[str, Any], kind: str) -> str:
        """A related node: relatedAny or relatedNone, with its sub-tree as {conditions}, not bracketed."""
        rel = relationship(self.g, node["relationship"]) or {}
        target = entity(self.g, rel.get("to", "")) or {}
        phrase = self.phrases["relatedAny" if node["quantifier"] == "any" else "relatedNone"][kind][self.lang]
        return fill(phrase, {"relationship": rel.get("label", {}).get(self.lang, node["relationship"]),
                             "conditions": self.group(target, node["where"])})

    def node(self, scope: dict[str, Any], node: dict[str, Any], kind: str = "sentence", sample: Any = None) -> str:
        """One node rendered alone."""
        if node["type"] == "condition":
            return self.condition(scope, node, kind, sample)
        if node["type"] == "related":
            return self.related(node, kind)
        return self.group(scope, node)

    def group(self, scope: dict[str, Any], node: dict[str, Any]) -> str:
        """A group: its children joined by its operator's word, a child group in brackets."""
        parts = []
        for child in node["children"]:
            text = self.node(scope, child)
            if child["type"] == "group":
                text = self.phrases["groupOpen"][self.lang] + text + self.phrases["groupClose"][self.lang]
            parts.append(text)
        return self.phrases[node["op"]][self.lang].join(parts)

    def suggestion_values(self, sample: dict[str, Any]) -> dict[str, str]:
        """The placeholder values of a suggestion text: plural entity labels, field and relationship labels,
        numbers."""
        values: dict[str, str] = {}
        for name, key in sample.items():
            if isinstance(key, tuple):
                fld = field_of(entity(self.g, key[0]), key[1])
                values[name] = fld["label"][self.lang] if fld else key[1]
            elif isinstance(key, int):
                values[name] = self.number(key)
            elif name == "entity":
                ent = entity(self.g, key)
                values[name] = ent["label"]["plural"][self.lang] if ent else key
            else:
                rel = relationship(self.g, key)
                values[name] = rel["label"][self.lang] if rel else key
        return values


def matchable_nodes(scope: dict[str, Any], group: dict[str, Any]) -> Iterator[tuple[dict[str, Any], dict[str, Any]]]:
    """(scope entity, node) for every condition and related node outside a related sub-tree, in document order."""
    for child in group["children"]:
        if child["type"] == "group":
            yield from matchable_nodes(scope, child)
        else:
            yield scope, child


def render(ctx: Context) -> int:
    """Prints the reading aid: per example and language the name, the rule sentence and, per node that can be
    matched, its sentence and its reason; then the suggestion texts. Returns the exit code."""
    glossary = ctx.glossary
    if ctx.load_failures or not isinstance(glossary, dict):
        for failure in ctx.load_failures:
            print(f"{failure.path}: {failure.message}")
        return 1
    languages = glossary["languages"]
    for path in example_files(ctx):
        doc, failure = load_json(path)
        if failure:
            print(f"{failure.path}: {failure.message}")
            return 1
        definition = doc["definition"]
        root = entity(glossary, definition["rootEntity"])
        if root is None:
            print(f"{EXAMPLES_DIR}/{path.name}: unknown root entity (run the check without --render)")
            return 1
        samples = RENDER_SAMPLES.get(doc["id"], {})
        print(f"== {doc['id']} (root: {definition['rootEntity']}, run date {doc['runDate']}, "
              f"{doc['expected']['total']} records) ==")
        for lang in languages:
            r = Renderer(glossary, lang)
            print(f"[{lang}] name:        {doc['name'][lang]}")
            print(f"[{lang}] description: {doc['description'][lang]}")
            print(f"[{lang}] sentence:    {r.group(root, definition['where'])}")
            for scope, node in matchable_nodes(root, definition["where"]):
                print(f"[{lang}]   {node['id']} sentence: {r.node(scope, node)}")
                print(f"[{lang}]   {node['id']} reason:   {r.node(scope, node, 'reason', samples.get(node['id']))}")
        print()
    suggestions = glossary["suggestions"]
    print("== suggestion kinds ==")
    for kind, texts in suggestions["kinds"].items():
        for lang in languages:
            values = Renderer(glossary, lang).suggestion_values(RENDER_SUGGESTIONS.get(kind, {}))
            for name in KIND_TEXTS:
                print(f"[{lang}] {kind} {name}: {fill(texts[name][lang], values)}")
    print()
    print("== suggestion evidence ==")
    for key, text in suggestions["evidence"].items():
        for lang in languages:
            values = Renderer(glossary, lang).suggestion_values(RENDER_SUGGESTIONS.get(key, {}))
            print(f"[{lang}] {key}: {fill(text[lang], values)}")
    return 0


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
    parser = argparse.ArgumentParser(description="Check contracts/: the definition schema, the glossary, their "
                                                 "agreement, the example controls and the invalid fixtures.")
    parser.add_argument("--root", type=Path, default=DEFAULT_ROOT,
                        help="repository root holding contracts/ (default: the parent of scripts/)")
    parser.add_argument("--render", action="store_true",
                        help="print the rule sentence and the reasons of every example in each language, and "
                             "run no check")
    args = parser.parse_args(argv)
    if isinstance(sys.stdout, io.TextIOWrapper):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    ctx = load_context(args.root.resolve())
    if args.render:
        return render(ctx)
    failures, passed, skipped = run_checks(ctx)
    if failures:
        print(f"contracts-check: {len(failures)} failure{'s' if len(failures) != 1 else ''}"
              + (f"; skipped: {', '.join(skipped)}" if skipped else ""))
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
