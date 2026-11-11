"""Suggestions: controls the engine proposes from the glossary's own knowledge and from counts on the data.

Heuristics only. Nothing leaves the system, no key exists, and every proposal passes the validator and the
compiler like any definition a user wrote.
"""

from __future__ import annotations

from app.suggestions.generators import Candidate, candidates
from app.suggestions.pipeline import Sources, missing_texts, suggest
from app.suggestions.profile import DatePair, EntityProfile, load_profile, query_for, read_profile

__all__ = [
    "Candidate",
    "DatePair",
    "EntityProfile",
    "Sources",
    "candidates",
    "load_profile",
    "missing_texts",
    "query_for",
    "read_profile",
    "suggest",
]
