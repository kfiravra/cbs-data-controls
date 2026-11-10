"""The business glossary: the typed model, its loader, the public view and the startup check."""

from __future__ import annotations

from app.glossary.check import CatalogColumn, Mismatch, find_mismatches
from app.glossary.loader import load_glossary, parse_glossary
from app.glossary.model import (
    COMPUTED_FUNCTIONS,
    OPERATOR_KEYS,
    QUANTIFIABLE_CARDINALITY,
    TRAVERSABLE_CARDINALITIES,
    Computed,
    Entity,
    EnumValue,
    Field,
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
from app.glossary.public import public_view

__all__ = [
    "COMPUTED_FUNCTIONS",
    "OPERATOR_KEYS",
    "QUANTIFIABLE_CARDINALITY",
    "TRAVERSABLE_CARDINALITIES",
    "CatalogColumn",
    "Computed",
    "Entity",
    "EnumValue",
    "Field",
    "Formats",
    "Glossary",
    "GlossaryInvalid",
    "Lifecycle",
    "Limits",
    "Mismatch",
    "Operator",
    "Phrases",
    "RelatedPhrase",
    "Relationship",
    "SuggestionKind",
    "SuggestionTexts",
    "Text",
    "Variants",
    "find_mismatches",
    "load_glossary",
    "parse_glossary",
    "public_view",
]
