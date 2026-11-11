"""The suggestion generators and their pipeline on a glossary about tickets and queues, with the data replaced
by stand-ins. Nothing here names an entity, a field or a relationship of the real glossary: the generators read
`lifecycle`, `required`, cardinality and type, and these tests prove that this is all they read.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import date
from pathlib import Path
from typing import Any

import pytest

from app.compiler import CompiledPlan, compile_definition, render_statement
from app.executor import Counts
from app.glossary import Glossary, GlossaryInvalid, parse_glossary
from app.main import create_app
from app.settings import Settings
from app.suggestions import (
    DatePair,
    EntityProfile,
    Sources,
    candidates,
    missing_texts,
    query_for,
    read_profile,
    suggest,
)
from app.suggestions.generators import KINDS
from app.suggestions.pipeline import EVIDENCE_KEYS
from app.validator import DefinitionSchema, validate_definition
from tests.builders import all_of, any_of, cond, definition, ref, related
from tests.conftest import CONTRACTS_DIR
from tests.synthetic import english_document

TODAY = date(2026, 11, 11)
LANGUAGE = "en"

PROFILES = {
    "ticket": EntityProfile(
        rows=40,
        missing={"due_on": 2, "owner_link": 20},
        date_pairs=(
            DatePair("opened_on", "closed_on", both=40, first_earlier=37, second_earlier=2),
            DatePair("opened_on", "due_on", both=3, first_earlier=2, second_earlier=1),
            DatePair("closed_on", "due_on", both=20, first_earlier=10, second_earlier=10),
        ),
    ),
    "queue": EntityProfile(rows=8, missing={"capacity": 0}, date_pairs=()),
}

# What Design H's conventions give for the synthetic glossary, written out by hand.
MISSING_REQUIRED = definition(
    "ticket",
    any_of(
        cond("c1", "summary", "is_empty"),
        all_of(cond("c2", "state", "eq", "open"), cond("c3", "priority", "is_null")),
        all_of(cond("c4", "state", "ne", "open"), cond("c5", "closed_on", "is_null")),
    ),
)
DATE_ORDER = definition("ticket", all_of(cond("c1", "closed_on", "lt", right=ref("opened_on"))))
TICKET_UNDER_QUEUE = definition(
    "ticket", all_of(cond("c1", "state", "eq", "open"), cond("c2", "enabled", "eq", False, path=["ticket.queue"]))
)
TICKET_UNDER_SITE = definition(
    "ticket",
    all_of(cond("c1", "state", "eq", "open"), cond("c2", "enabled", "eq", False, path=["ticket.queue", "queue.site"])),
)
QUEUE_UNDER_SITE = definition(
    "queue", all_of(cond("c1", "enabled", "eq", True), cond("c2", "enabled", "eq", False, path=["queue.site"]))
)
QUEUE_WITHOUT_OPEN_TICKETS = definition(
    "queue",
    all_of(
        cond("c1", "enabled", "eq", True),
        related("r1", "queue.tickets", "none", all_of(cond("c2", "state", "eq", "open"))),
    ),
)
MISSING_OPTIONAL = definition("ticket", all_of(cond("c1", "due_on", "is_null")))

EXPECTED = [
    ("missing_required", MISSING_REQUIRED),
    ("date_order", DATE_ORDER),
    ("active_under_inactive", TICKET_UNDER_QUEUE),
    ("active_under_inactive", TICKET_UNDER_SITE),
    ("active_under_inactive", QUEUE_UNDER_SITE),
    ("active_without_active_children", QUEUE_WITHOUT_OPEN_TICKETS),
    ("missing_optional", MISSING_OPTIONAL),
]


def roots(glossary: Glossary) -> list[Any]:
    return [entity for entity in glossary.entities.values() if entity.visible and entity.rootable]


def sources(glossary: Glossary, schema: DefinitionSchema, totals: dict[str, int] | None = None) -> Sources:
    """The real validator and compiler; the data is `PROFILES` and a count per root entity (3 unless given)."""

    def plan_for(document: Any) -> CompiledPlan:
        return compile_definition(validate_definition(document, glossary, schema), glossary)

    def count(plan: CompiledPlan, _today: date) -> Counts:
        total = (totals or {}).get(plan.definition.root.key, 3)
        return Counts(total, {node.node_id: index + 1 for index, node in enumerate(plan.nodes)})

    return Sources(plan_for=plan_for, count=count, profile=lambda entity: PROFILES[entity.key])


def suggested(glossary: Glossary, schema: DefinitionSchema, **options: Any) -> list[dict[str, Any]]:
    settings: dict[str, Any] = {"language": LANGUAGE, "today": TODAY, "root_entity": None, "limit": 20}
    totals = options.pop("totals", None)
    settings.update(options)
    return suggest(glossary, sources(glossary, schema, totals), **settings)


# --- the generators -------------------------------------------------------------------------------------------


def test_generators_propose_what_the_conventions_give_in_the_order_of_the_table(english_glossary: Glossary) -> None:
    proposed = [
        (item.kind, item.definition) for item in candidates(english_glossary, roots(english_glossary), PROFILES)
    ]
    assert proposed == EXPECTED


def test_every_proposal_is_a_valid_definition(english_glossary: Glossary, schema: DefinitionSchema) -> None:
    for candidate in candidates(english_glossary, roots(english_glossary), PROFILES):
        validate_definition(candidate.definition, english_glossary, schema)


def test_nothing_is_proposed_for_an_entity_that_may_not_be_a_root(english_glossary: Glossary) -> None:
    proposed = {item.root.key for item in candidates(english_glossary, roots(english_glossary), PROFILES)}
    assert proposed == {"ticket", "queue"}  # `site` has a lifecycle and children, and is not rootable


def test_date_order_needs_enough_rows_a_usual_order_and_at_least_one_exception(english_glossary: Glossary) -> None:
    def proposals(pair: DatePair) -> list[Any]:
        profiles = {**PROFILES, "ticket": EntityProfile(40, {}, (pair,))}
        proposed = candidates(english_glossary, roots(english_glossary), profiles)
        return [candidate.definition for candidate in proposed if candidate.kind == "date_order"]

    reversed_order = definition("ticket", all_of(cond("c1", "opened_on", "lt", right=ref("closed_on"))))
    assert proposals(DatePair("opened_on", "closed_on", 40, 37, 2)) == [DATE_ORDER]
    assert proposals(DatePair("opened_on", "closed_on", 5, 4, 1)) == [DATE_ORDER]  # five rows hold both: enough
    assert proposals(DatePair("opened_on", "closed_on", 4, 3, 1)) == []  # four: too few
    assert proposals(DatePair("opened_on", "closed_on", 0, 0, 0)) == []  # none at all
    assert proposals(DatePair("opened_on", "closed_on", 40, 40, 0)) == []  # no row in the other order
    assert proposals(DatePair("opened_on", "closed_on", 40, 25, 15)) == []  # no usual order
    assert proposals(DatePair("opened_on", "closed_on", 40, 32, 8)) == [DATE_ORDER]  # 80% on the dot
    assert proposals(DatePair("opened_on", "closed_on", 40, 31, 8)) == []  # just under, one row equal
    assert proposals(DatePair("opened_on", "closed_on", 40, 2, 37)) == [reversed_order]
    # Mostly equal dates have no usual order: neither rule is proposed, though each has two rows against it.
    assert proposals(DatePair("opened_on", "closed_on", 40, 2, 2)) == []


def test_date_field_that_may_not_be_compared_is_left_out_of_the_pairs(glossary_document: dict[str, Any]) -> None:
    document = english_document(glossary_document)
    next(field for field in document["entities"][0]["fields"] if field["key"] == "due_on")["comparable"] = False
    glossary = parse_glossary(document)
    assert list(query_for(glossary.entities["ticket"], glossary).pairs) == [("opened_on", "closed_on")]


def test_optional_field_is_proposed_only_when_a_few_rows_lack_it(english_glossary: Glossary) -> None:
    def proposals(missing: dict[str, int], rows: int = 40) -> list[Any]:
        profiles = {**PROFILES, "ticket": EntityProfile(rows, missing, ())}
        proposed = candidates(english_glossary, roots(english_glossary), profiles)
        return [candidate.fields["field"] for candidate in proposed if candidate.kind == "missing_optional"]

    assert proposals({"due_on": 4, "owner_link": 1}) == ["due_on", "owner_link"]  # 10% on the dot, and one row
    assert proposals({"due_on": 5, "owner_link": 0}) == []
    assert proposals({"due_on": 0, "owner_link": 0}, rows=0) == []  # an empty table proposes nothing
    # A field the glossary marks as required is never "optional", whatever the data says.
    assert proposals({"due_on": 0, "summary": 1, "priority": 1, "closed_on": 1}) == []


def test_required_field_that_cannot_be_missing_is_left_out_and_the_others_stay(
    glossary_document: dict[str, Any], schema: DefinitionSchema
) -> None:
    """A required number that is never NULL has no test for "missing": the proposal goes on without it."""
    document = english_document(glossary_document)
    fields = {field["key"]: field for field in document["entities"][0]["fields"]}
    fields["priority"]["nullable"] = False
    fields["closed_on"]["operators"] = ["lt", "gt"]  # its own list leaves the NULL test out
    glossary = parse_glossary(document)

    (required,) = [c for c in candidates(glossary, roots(glossary), PROFILES) if c.kind == "missing_required"]
    assert required.definition == definition("ticket", all_of(cond("c1", "summary", "is_empty")))
    assert required.missing_nodes == {"summary": "c1"}
    validate_definition(required.definition, glossary, schema)


def test_two_valued_lifecycle_is_inactive_by_its_other_value_and_a_wider_one_by_not_active(
    english_glossary: Glossary,
) -> None:
    proposed = candidates(english_glossary, roots(english_glossary), PROFILES)
    by_kind = {(candidate.kind, candidate.root.key): candidate.definition for candidate in proposed}
    inactive_ticket = by_kind[("missing_required", "ticket")]["where"]["children"][2]["children"][0]
    inactive_site = by_kind[("active_under_inactive", "queue")]["where"]["children"][1]
    assert (inactive_ticket["operator"], inactive_ticket["value"]) == ("ne", "open")  # three states
    assert (inactive_site["operator"], inactive_site["value"]) == ("eq", False)  # a bool has two


# --- the pipeline ---------------------------------------------------------------------------------------------


def test_suggestions_carry_their_texts_evidence_definition_and_sentence(
    english_glossary: Glossary, schema: DefinitionSchema
) -> None:
    items = suggested(english_glossary, schema, totals={"ticket": 3, "queue": 2})
    assert [item["definition"] for item in items] == [expected for _, expected in EXPECTED]
    assert all(
        set(item) == {"name", "description", "rationale", "evidence", "definition", "sentence", "sentenceParts"}
        for item in items
    )

    required, order, under_queue, under_site, queue_under_site, no_tickets, optional = items
    assert required["name"] == "tickets with required data missing"
    assert required["evidence"] == [
        {"key": "violations_found", "params": {"count": 3, "total": 40}, "text": "3 of 40 now"},
        {"key": "field_missing", "params": {"field": "summary", "count": 1}, "text": "without summary: 1"},
        {"key": "field_missing", "params": {"field": "priority", "count": 3}, "text": "without priority: 3"},
        {"key": "field_missing", "params": {"field": "closed_on", "count": 5}, "text": "without closed on: 5"},
    ]
    assert required["sentence"] == (
        "summary is empty or (state is Open and priority is missing) or (state is not Open and closed on is missing)"
    )
    assert "".join(part["text"] for part in required["sentenceParts"]) == required["sentence"]

    assert order["name"] == "closed on before opened on"
    assert order["description"] == "Finds tickets whose closed on is before their opened on."
    assert order["rationale"] == "In most records closed on is not before opened on."
    assert order["evidence"][1] == {
        "key": "date_order_split",
        "params": {"count": 3, "total": 40},
        "text": "3 of the 40 records with both dates are reversed",
    }

    assert under_queue["name"] == "Active tickets under an inactive the queue"
    assert under_site["name"] == "Active tickets under an inactive the site"  # the last relationship of the path
    assert queue_under_site["evidence"] == [
        {"key": "violations_found", "params": {"count": 2, "total": 8}, "text": "2 of 8 now"}
    ]
    assert no_tickets["name"] == "Active queues without an active the tickets"
    assert no_tickets["sentence"] == "enabled is Enabled and has no the tickets with (state is Open)"
    assert optional["name"] == "tickets without due on"
    assert optional["description"] == 'Finds tickets whose "due on" is missing.'


def test_numbers_of_an_evidence_text_follow_the_language_formats(
    english_glossary: Glossary, schema: DefinitionSchema
) -> None:
    (item,) = suggested(english_glossary, schema, totals={"ticket": 12500}, limit=1)
    assert item["evidence"][0] == {
        "key": "violations_found",
        "params": {"count": 12500, "total": 40},
        "text": "12 500 of 40 now",
    }


def test_name_is_cut_to_the_length_the_contract_allows(
    glossary_document: dict[str, Any], schema: DefinitionSchema
) -> None:
    document = english_document(glossary_document)
    document["entities"][0]["label"]["plural"]["en"] = "tickets " * 60
    (item,) = suggested(parse_glossary(document), schema, limit=1)
    assert len(item["name"]) == 200
    assert item["name"].startswith("tickets tickets ")


def test_proposal_that_flags_nothing_today_is_dropped(english_glossary: Glossary, schema: DefinitionSchema) -> None:
    items = suggested(english_glossary, schema, totals={"ticket": 0, "queue": 4})
    assert [item["definition"] for item in items] == [QUEUE_UNDER_SITE, QUEUE_WITHOUT_OPEN_TICKETS]


def test_answer_is_cut_to_the_limit_in_the_order_of_the_generators(
    english_glossary: Glossary, schema: DefinitionSchema
) -> None:
    items = suggested(english_glossary, schema, limit=2)
    assert [item["definition"] for item in items] == [MISSING_REQUIRED, DATE_ORDER]


@pytest.mark.parametrize(
    ("root_entity", "expected"),
    [
        ("queue", [QUEUE_UNDER_SITE, QUEUE_WITHOUT_OPEN_TICKETS]),
        ("site", []),  # exists, and may not be a root
        ("audit", []),  # hidden
        ("invoice", []),  # unknown
    ],
)
def test_root_entity_keeps_the_proposals_rooted_there(
    root_entity: str, expected: list[Any], english_glossary: Glossary, schema: DefinitionSchema
) -> None:
    items = suggested(english_glossary, schema, root_entity=root_entity)
    assert [item["definition"] for item in items] == expected


def test_proposal_the_validator_rejects_is_dropped_with_a_warning(
    glossary_document: dict[str, Any], schema: DefinitionSchema, caplog: pytest.LogCaptureFixture
) -> None:
    document = english_document(glossary_document)
    state = next(field for field in document["entities"][0]["fields"] if field["key"] == "state")
    state["operators"] = ["ne", "in"]  # "active" can no longer be written as `eq`
    without_eq = parse_glossary(document)

    with caplog.at_level(logging.WARNING):
        items = suggested(without_eq, schema)
    assert [item["definition"] for item in items] == [DATE_ORDER, QUEUE_UNDER_SITE, MISSING_OPTIONAL]
    dropped = [(vars(record)["kind"], vars(record)["root"], vars(record)["codes"]) for record in caplog.records]
    assert dropped == [
        ("missing_required", "ticket", ["OPERATOR_NOT_ALLOWED"]),
        ("active_under_inactive", "ticket", ["OPERATOR_NOT_ALLOWED"]),
        ("active_under_inactive", "ticket", ["OPERATOR_NOT_ALLOWED"]),
        ("active_without_active_children", "queue", ["OPERATOR_NOT_ALLOWED"]),
    ]


# --- the profile ----------------------------------------------------------------------------------------------


def test_profile_is_one_aggregate_select_over_the_entity_own_table(english_glossary: Glossary) -> None:
    query = query_for(english_glossary.entities["ticket"], english_glossary)
    sql = render_statement(query.query.statement, query.query.parameters).sql
    assert sql.startswith("SELECT count(*) AS n, sum(CASE WHEN (e0.due_on IS NULL) THEN 1 ELSE 0 END) AS x0")
    assert sql.rstrip().endswith("FROM ops.[Ticket] AS e0")
    assert sql.count("SELECT") == 1 and ";" not in sql
    assert set(query.missing) == {"due_on", "owner_link"}  # nullable, stored, visible, not required
    assert list(query.pairs) == [("opened_on", "closed_on"), ("opened_on", "due_on"), ("closed_on", "due_on")]
    assert set(re.findall(r"e0\.(\w+)", sql)) == {"due_on", "owner_id", "opened_on", "closed_on"}


def test_profile_reads_its_counts_from_the_one_row(english_glossary: Glossary) -> None:
    query = query_for(english_glossary.entities["ticket"], english_glossary)
    row: dict[str, Any] = {query.rows: 40, query.missing["due_on"]: 2, query.missing["owner_link"]: None}
    for index, labels in enumerate(query.pairs.values()):
        row.update({labels.both: 10 + index, labels.below: index, labels.above: None})
    profile = read_profile(query, row)
    assert (profile.rows, profile.missing) == (40, {"due_on": 2, "owner_link": 0})  # SUM over nothing is NULL
    assert profile.date_pairs[1] == DatePair("opened_on", "due_on", both=11, first_earlier=1, second_earlier=0)


def test_text_field_counts_as_missing_when_it_is_empty_too(glossary_document: dict[str, Any]) -> None:
    document = english_document(glossary_document)
    next(field for field in document["entities"][0]["fields"] if field["key"] == "summary").pop("required")
    query = query_for(parse_glossary(document).entities["ticket"], parse_glossary(document))
    sql = render_statement(query.query.statement, query.query.parameters).sql
    assert "sum(CASE WHEN (e0.summary IS NULL OR e0.summary = :empty) THEN 1 ELSE 0 END)" in sql
    assert dict(query.query.parameters) == {"empty": ""}


# --- the glossary's texts -------------------------------------------------------------------------------------


def test_kinds_and_evidence_keys_are_the_contract_lists(glossary_document: dict[str, Any], glossary: Glossary) -> None:
    section = (CONTRACTS_DIR / "errors.md").read_text(encoding="utf-8").split("## Evidence keys", 1)[1]
    catalogue = re.findall(r"^\| `([A-Za-z_]+)` \|", section.split("\n## ", 1)[0], flags=re.MULTILINE)
    assert list(EVIDENCE_KEYS) == catalogue
    assert list(KINDS) == list(glossary_document["suggestions"]["kinds"])
    assert missing_texts(glossary) == []


def test_glossary_without_a_text_the_engine_writes_is_reported(glossary_document: dict[str, Any]) -> None:
    document = english_document(glossary_document)
    del document["suggestions"]["kinds"]["date_order"]
    del document["suggestions"]["evidence"]["field_missing"]
    assert missing_texts(parse_glossary(document)) == [
        "suggestions.kinds.date_order",
        "suggestions.evidence.field_missing",
    ]


def test_engine_does_not_start_on_a_glossary_it_cannot_serve(
    glossary_document: dict[str, Any], offline_settings: Settings, tmp_path: Path
) -> None:
    document = english_document(glossary_document)
    del document["suggestions"]["kinds"]["missing_optional"]
    document["limits"]["maxTotalValues"] = 501
    (tmp_path / "glossary.json").write_text(json.dumps(document), encoding="utf-8", newline="\n")
    schema_text = (CONTRACTS_DIR / "control-definition.schema.json").read_text(encoding="utf-8")
    (tmp_path / "control-definition.schema.json").write_text(schema_text, encoding="utf-8", newline="\n")

    with pytest.raises(GlossaryInvalid) as refused:
        create_app(offline_settings.model_copy(update={"contracts_dir": tmp_path}))
    assert "limits.maxTotalValues above 500" in str(refused.value)
    assert "suggestions.kinds.missing_optional" in str(refused.value)
