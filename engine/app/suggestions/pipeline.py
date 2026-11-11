"""From candidates to suggestions: each one is validated, compiled and counted like a user's definition.

A candidate the validator rejects is a bug of its generator: it is dropped with a warning. One that flags no
record today is dropped silently. What is left gets its evidence and its texts, all rendered from the glossary.
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import date
from typing import Any

from app.compiler import CompiledPlan
from app.errors import DefinitionInvalid
from app.executor import Counts
from app.explainer import Explainer, fill_plain, format_number
from app.glossary import Entity, Glossary
from app.suggestions.generators import KINDS, Candidate, candidates
from app.suggestions.profile import EntityProfile

logger = logging.getLogger(__name__)

EVIDENCE_KEYS = ("violations_found", "field_missing", "date_order_split")
# contracts/api.md, SuggestionItem: a name has at most this many characters (a control's name has the same limit).
NAME_LIMIT = 200


@dataclass(frozen=True, slots=True)
class Sources:
    """What the pipeline reaches the compiler and the data through. Tests hand in stand-ins."""

    plan_for: Callable[[Mapping[str, Any]], CompiledPlan]
    count: Callable[[CompiledPlan, date], Counts]
    profile: Callable[[Entity], EntityProfile]


def missing_texts(glossary: Glossary) -> list[str]:
    """The suggestion texts a glossary lacks; empty when every kind and evidence key the engine uses has one."""
    return [f"suggestions.kinds.{kind}" for kind in KINDS if kind not in glossary.suggestions.kinds] + [
        f"suggestions.evidence.{key}" for key in EVIDENCE_KEYS if key not in glossary.suggestions.evidence
    ]


def suggest(
    glossary: Glossary,
    sources: Sources,
    *,
    language: str,
    today: date,
    root_entity: str | None,
    limit: int,
) -> list[dict[str, Any]]:
    """Up to `limit` suggestions that flag at least one record today, in the order of the generators."""
    roots = _roots(glossary, root_entity)
    profiles = {entity.key: sources.profile(entity) for entity in roots}

    explainer = Explainer(glossary, language)
    writer = _Writer(glossary, language)
    items: list[dict[str, Any]] = []
    for candidate in candidates(glossary, roots, profiles):
        if len(items) >= limit:
            break
        try:
            plan = sources.plan_for(candidate.definition)
        except DefinitionInvalid as error:
            logger.warning(
                "a suggested definition is not valid and was dropped",
                extra={
                    "kind": candidate.kind,
                    "root": candidate.root.key,
                    "codes": [item.code for item in error.errors],
                },
            )
            continue
        counts = sources.count(plan, today)
        if counts.total == 0:
            continue
        items.append(writer.item(candidate, plan, counts, profiles[candidate.root.key], explainer))
    return items


def _roots(glossary: Glossary, root_entity: str | None) -> list[Entity]:
    """The entities a suggestion may be rooted at; a key that is not one of them gives none."""
    roots = [entity for entity in glossary.entities.values() if entity.visible and entity.rootable]
    return roots if root_entity is None else [entity for entity in roots if entity.key == root_entity]


class _Writer:
    """Renders one suggestion's texts and evidence in one language."""

    def __init__(self, glossary: Glossary, language: str) -> None:
        self._glossary = glossary
        self._language = language
        self._formats = glossary.formats[language]

    def item(
        self,
        candidate: Candidate,
        plan: CompiledPlan,
        counts: Counts,
        profile: EntityProfile,
        explainer: Explainer,
    ) -> dict[str, Any]:
        texts = self._glossary.suggestions.kinds[candidate.kind]
        root = candidate.root
        labels = {"entity": root.label_plural[self._language]}
        labels.update({name: root.fields[key].label[self._language] for name, key in candidate.fields.items()})
        if candidate.relationship is not None:
            labels["relationship"] = candidate.relationship.label[self._language]
        sentence = explainer.sentence(plan.definition)
        return {
            "name": fill_plain(texts.name[self._language], labels)[:NAME_LIMIT],
            "description": fill_plain(texts.description[self._language], labels),
            "rationale": fill_plain(texts.rationale[self._language], labels),
            "evidence": self._evidence(candidate, counts, profile),
            "definition": candidate.definition,
            "sentence": sentence.text,
            "sentenceParts": sentence.parts_json(),
        }

    def _evidence(self, candidate: Candidate, counts: Counts, profile: EntityProfile) -> list[dict[str, Any]]:
        """`violations_found` always, then the kind's own (contracts/errors.md, Evidence keys)."""
        evidence = [self._one("violations_found", {"count": counts.total, "total": profile.rows}, candidate.root)]
        for field_key, node_id in candidate.missing_nodes.items():
            params = {"field": field_key, "count": counts.matched.get(node_id, 0)}
            evidence.append(self._one("field_missing", params, candidate.root))
        if candidate.date_pair is not None:
            params = {"count": counts.total, "total": candidate.date_pair.both}
            evidence.append(self._one("date_order_split", params, candidate.root))
        return evidence

    def _one(self, key: str, params: dict[str, Any], root: Entity) -> dict[str, Any]:
        """One evidence item: raw params, and the text with numbers and the field's label written out."""
        written = {
            name: (root.fields[value].label[self._language] if name == "field" else format_number(value, self._formats))
            for name, value in params.items()
        }
        template = self._glossary.suggestions.evidence[key][self._language]
        return {"key": key, "params": params, "text": fill_plain(template, written)}
