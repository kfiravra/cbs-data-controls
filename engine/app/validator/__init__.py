"""The validator: a definition against the schema, then against the glossary. Authoritative for every caller."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from app.errors import DefinitionError, DefinitionInvalid
from app.glossary import Glossary
from app.validator.model import ResolvedField, ValidatedDefinition, Value, VCondition, VGroup, VNode, VRelated
from app.validator.pointers import document_positions, group_nesting
from app.validator.schema import WALKABLE_GROUP_DEPTH, DefinitionSchema, load_schema
from app.validator.semantic import SemanticWalk

__all__ = [
    "DEFINITION_ERROR_CODES",
    "DefinitionSchema",
    "ResolvedField",
    "VCondition",
    "VGroup",
    "VNode",
    "VRelated",
    "ValidatedDefinition",
    "Value",
    "load_schema",
    "validate_definition",
]

# The order of the "Definition error codes" table of contracts/errors.md: errors that share a path come out in it.
DEFINITION_ERROR_CODES: tuple[str, ...] = (
    "SCHEMA_VIOLATION",
    "UNSUPPORTED_SCHEMA_VERSION",
    "UNKNOWN_ENTITY",
    "ENTITY_NOT_ROOTABLE",
    "UNKNOWN_RELATIONSHIP",
    "PATH_NOT_REACHABLE",
    "PATH_NOT_TRAVERSABLE",
    "PATH_TOO_LONG",
    "UNKNOWN_FIELD",
    "RELATIONSHIP_NOT_QUANTIFIABLE",
    "OPERATOR_NOT_ALLOWED",
    "OPERAND_MISMATCH",
    "VALUE_TYPE_MISMATCH",
    "UNKNOWN_ENUM_VALUE",
    "FIELD_COMPARISON_NOT_ALLOWED",
    "FIELD_TYPE_MISMATCH",
    "RANGE_INVALID",
    "TOO_DEEP",
    "TOO_MANY_CONDITIONS",
    "TOO_MANY_VALUES",
    "DUPLICATE_NODE_ID",
)
_CODE_RANK = {code: rank for rank, code in enumerate(DEFINITION_ERROR_CODES)}
_SUPPORTED_SCHEMA_VERSION = 1


def validate_definition(
    document: Mapping[str, Any], glossary: Glossary, schema: DefinitionSchema
) -> ValidatedDefinition:
    """The resolved definition, or `DefinitionInvalid` with every error found (errors.md, Order of checks)."""
    if _unsupported_version(document):
        raise DefinitionInvalid([DefinitionError("UNSUPPORTED_SCHEMA_VERSION", "/schemaVersion")])
    # Far deeper than any limit could allow: answered before the recursive walks below could run out of stack.
    nesting = group_nesting(document)
    if nesting > max(WALKABLE_GROUP_DEPTH, glossary.limits.max_depth):
        too_deep = DefinitionError("TOO_DEEP", "/where", {"max": glossary.limits.max_depth, "actual": nesting})
        raise DefinitionInvalid([too_deep])
    violations = schema.violations(document)
    if violations:
        # Any schema error ends validation: the semantic layer reads members the schema guarantees.
        raise DefinitionInvalid(_in_document_order(violations, document))
    outcome = SemanticWalk(glossary).run(document)
    if isinstance(outcome, ValidatedDefinition):
        return outcome
    raise DefinitionInvalid(_in_document_order(outcome, document))


def _unsupported_version(document: Mapping[str, Any]) -> bool:
    """Present and not the number 1. A definition without the member goes on to the schema, which requires it."""
    if "schemaVersion" not in document:
        return False
    version = document["schemaVersion"]
    is_number = isinstance(version, (int, float)) and not isinstance(version, bool)
    return not (is_number and version == _SUPPORTED_SCHEMA_VERSION)


def _in_document_order(errors: Sequence[DefinitionError], document: Mapping[str, Any]) -> list[DefinitionError]:
    """By where the path sits in the JSON text; on one path by the code table, then by `params.index`."""
    positions = document_positions(document)
    return sorted(
        errors,
        key=lambda error: (
            positions.get(error.path, len(positions)),
            _CODE_RANK[error.code],
            error.params.get("index", -1),
        ),
    )
