"""The loader, the resolved operators, the tables, the public view and the catalog comparison."""

from __future__ import annotations

import copy
from typing import Any

import pytest
from sqlalchemy import Boolean, Date, Numeric, Unicode

from app.glossary import (
    COMPUTED_FUNCTIONS,
    OPERATOR_KEYS,
    CatalogColumn,
    Glossary,
    GlossaryInvalid,
    Mismatch,
    find_mismatches,
    parse_glossary,
    public_view,
)
from app.glossary.tables import physical_columns
from tests.synthetic import synthetic_document

PHYSICAL_KEYS = {"table", "keyColumn", "column", "computed", "join"}
NULL_TESTS = {"is_null", "is_not_null"}
SQL_TYPE_OF = {"number": Numeric, "text": Unicode, "enum": Unicode, "date": Date, "bool": Boolean}
DATABASE_TYPE_OF = {"number": "int", "text": "nvarchar", "enum": "nvarchar", "date": "date", "bool": "bit"}


@pytest.fixture
def synthetic(glossary_document: dict[str, Any]) -> Glossary:
    return parse_glossary(synthetic_document(glossary_document))


def keys_in(value: Any) -> set[str]:
    if isinstance(value, dict):
        return set(value) | {key for item in value.values() for key in keys_in(item)}
    if isinstance(value, list):
        return {key for item in value for key in keys_in(item)}
    return set()


def catalog_of(glossary: Glossary) -> list[CatalogColumn]:
    """A catalog in which every table and column of the glossary exists with a fitting type."""
    return [
        CatalogColumn(entity.schema, entity.table, column, DATABASE_TYPE_OF.get(field_type or "number", "int"))
        for entity in glossary.entities.values()
        for column, field_type in physical_columns(entity, glossary.relationships).items()
    ]


# --- the loader, against the real file ------------------------------------------------------------------------


def test_real_glossary_loads_with_its_top_level_values(glossary: Glossary, glossary_document: dict[str, Any]) -> None:
    assert glossary.version == glossary_document["glossaryVersion"]
    assert list(glossary.languages) == glossary_document["languages"]
    assert glossary.default_language == glossary_document["defaultLanguage"]
    assert list(glossary.entities) == [entity["key"] for entity in glossary_document["entities"]]
    assert list(glossary.relationships) == [item["key"] for item in glossary_document["relationships"]]
    assert glossary.limits.max_total_values == glossary_document["limits"]["maxTotalValues"]


def test_glossary_names_only_operators_and_functions_the_engine_implements(glossary: Glossary) -> None:
    assert set(glossary.operators) == OPERATOR_KEYS
    used = {
        field.computed.function for e in glossary.entities.values() for field in e.fields.values() if field.computed
    }
    assert used <= COMPUTED_FUNCTIONS


def test_field_with_its_own_operator_list_gets_exactly_that_list(
    glossary: Glossary, glossary_document: dict[str, Any]
) -> None:
    own_lists = [
        (entity["key"], field["key"], field["operators"])
        for entity in glossary_document["entities"]
        for field in entity["fields"]
        if "operators" in field
    ]
    assert own_lists, "the glossary has at least one field with its own operator list"
    for entity_key, field_key, operators in own_lists:
        assert sorted(glossary.entities[entity_key].fields[field_key].operators) == sorted(operators)


def test_field_without_a_list_gets_every_operator_of_its_type_in_glossary_order(
    glossary: Glossary, glossary_document: dict[str, Any]
) -> None:
    for entity in glossary_document["entities"]:
        for field in entity["fields"]:
            if "operators" in field:
                continue
            resolved = glossary.entities[entity["key"]].fields[field["key"]].operators
            of_type = [op["key"] for op in glossary_document["operators"] if field["type"] in op["types"]]
            assert [key for key in of_type if key in resolved] == list(resolved), "glossary order"
            assert set(of_type) - set(resolved) == (set() if field["nullable"] else NULL_TESTS & set(of_type))


def test_non_nullable_field_has_no_null_test(synthetic: Glossary) -> None:
    title = synthetic.entities["ticket"].fields["title"]
    assert not NULL_TESTS & set(title.operators)
    assert {"is_empty", "is_not_empty", "contains"} <= set(title.operators)


def test_nullable_field_has_the_null_tests(synthetic: Glossary) -> None:
    assert NULL_TESTS <= set(synthetic.entities["ticket"].fields["priority"].operators)


def test_flags_default_to_comparable_and_not_identifier(synthetic: Glossary) -> None:
    fields = synthetic.entities["ticket"].fields
    assert (fields["title"].comparable, fields["title"].identifier) == (True, False)
    assert (fields["owner_link"].comparable, fields["owner_link"].identifier) == (False, True)
    assert fields["days_open"].comparable is False


@pytest.mark.parametrize(
    ("change", "message"),
    [
        (lambda d: d["entities"][0]["identifyingFields"].append("no_such_field"), "no_such_field"),
        (lambda d: d["entities"][0]["lifecycle"].update(field="no_such_field"), "lifecycle"),
        (lambda d: d["relationships"][0].update(to="no_such_entity"), "no_such_entity"),
        (lambda d: d["entities"][0]["identifyingFields"].append("internal_code"), "hidden field"),
        (lambda d: d["entities"][0]["lifecycle"].update(field="internal_code"), "unknown or hidden"),
        (lambda d: d["entities"][0]["fields"][0].update(operators=["no_such_operator"]), "no_such_operator"),
        (lambda d: d["operators"][0].update(key="sounds_like"), "sounds_like"),
        (lambda d: d["entities"][0]["fields"][6]["computed"].update(function="shoe_size"), "shoe_size"),
        (lambda d: d["entities"][0]["fields"][0].pop("column"), "exactly one of column and computed"),
        (lambda d: d.update(defaultLanguage="xx"), "defaultLanguage"),
        (lambda d: d.pop("limits"), "limits"),
    ],
)
def test_loader_refuses_a_glossary_it_cannot_use(glossary_document: dict[str, Any], change: Any, message: str) -> None:
    document = synthetic_document(glossary_document)
    change(document)
    with pytest.raises(GlossaryInvalid) as raised:
        parse_glossary(document)
    assert message in str(raised.value)


# --- tables ---------------------------------------------------------------------------------------------------


def test_each_entity_has_a_table_with_exactly_the_columns_the_glossary_names(
    glossary: Glossary, glossary_document: dict[str, Any]
) -> None:
    for entity in glossary_document["entities"]:
        named = {entity["keyColumn"]}
        named |= {field.get("column") or field["computed"]["over"] for field in entity["fields"]}
        for relationship in glossary_document["relationships"]:
            if relationship["from"] == entity["key"]:
                named.add(relationship["join"]["fromColumn"])
            if relationship["to"] == entity["key"]:
                named.add(relationship["join"]["toColumn"])
        table = glossary.tables[entity["key"]]
        assert (table.schema, table.name) == (entity["table"]["schema"], entity["table"]["name"])
        assert set(table.c.keys()) == named


def test_stored_field_columns_are_typed_from_the_field_type(
    glossary: Glossary, glossary_document: dict[str, Any]
) -> None:
    for entity in glossary_document["entities"]:
        for field in entity["fields"]:
            if "column" in field:
                column = glossary.tables[entity["key"]].c[field["column"]]
                assert isinstance(column.type, SQL_TYPE_OF[field["type"]]), (entity["key"], field["key"])


def test_text_columns_are_unicode_so_hebrew_is_bound_as_nvarchar(synthetic: Glossary) -> None:
    assert isinstance(synthetic.tables["ticket"].c["title"].type, Unicode)
    assert isinstance(synthetic.tables["ticket"].c["state"].type, Unicode)


def test_computed_field_reads_its_source_column_as_a_date(synthetic: Glossary) -> None:
    assert isinstance(synthetic.tables["ticket"].c["opened_on"].type, Date)
    assert "days_open" not in synthetic.tables["ticket"].c


# --- the public view ------------------------------------------------------------------------------------------


def test_public_view_holds_no_physical_name(glossary: Glossary) -> None:
    assert not keys_in(public_view(glossary)) & PHYSICAL_KEYS


def test_public_view_serves_the_rest_of_the_file_as_it_is(
    glossary: Glossary, glossary_document: dict[str, Any]
) -> None:
    view = public_view(glossary)
    for name in ("glossaryVersion", "languages", "defaultLanguage", "limits", "formats", "phrases", "operators"):
        assert view[name] == glossary_document[name]
    assert view["suggestions"] == glossary_document["suggestions"]
    for served, source in zip(view["entities"], glossary_document["entities"], strict=True):
        for name in ("key", "label", "description", "rootable", "visible", "identifyingFields", "lifecycle"):
            assert served[name] == source[name]
    for served, source in zip(view["relationships"], glossary_document["relationships"], strict=True):
        assert served == {name: source[name] for name in ("key", "from", "to", "cardinality", "label")}


def test_public_view_gives_every_field_its_resolved_operators(glossary: Glossary) -> None:
    for entity in public_view(glossary)["entities"]:
        for field in entity["fields"]:
            assert field["operators"] == list(glossary.entities[entity["key"]].fields[field["key"]].operators)
            assert field["visible"] is True


def test_public_view_keeps_the_flags_a_client_reads(synthetic: Glossary) -> None:
    ticket = next(entity for entity in public_view(synthetic)["entities"] if entity["key"] == "ticket")
    fields = {field["key"]: field for field in ticket["fields"]}
    assert fields["owner_link"]["comparable"] is False
    assert fields["owner_link"]["identifier"] is True
    assert fields["summary"]["required"] == "always"
    assert fields["priority"]["unit"] == {"he": "pt"}
    assert [item["value"] for item in fields["state"]["enumValues"]] == ["open", "pending", "closed"]
    assert ticket["lifecycle"] == {"field": "state", "active": "open"}


def test_public_view_leaves_out_what_is_hidden(synthetic: Glossary) -> None:
    view = public_view(synthetic)
    assert "audit" not in [entity["key"] for entity in view["entities"]]
    ticket = next(entity for entity in view["entities"] if entity["key"] == "ticket")
    assert "internal_code" not in [field["key"] for field in ticket["fields"]]
    assert "ticket.audit" not in [relationship["key"] for relationship in view["relationships"]]
    assert "ticket.queue" in [relationship["key"] for relationship in view["relationships"]]


# --- the startup comparison -----------------------------------------------------------------------------------


def test_catalog_that_holds_everything_is_no_mismatch(glossary: Glossary) -> None:
    assert find_mismatches(glossary, catalog_of(glossary)) == []


def test_renamed_column_in_the_glossary_is_a_mismatch_that_names_it(glossary_document: dict[str, Any]) -> None:
    catalog = catalog_of(parse_glossary(glossary_document))
    doctored = copy.deepcopy(glossary_document)
    entity = doctored["entities"][0]
    field = next(field for field in entity["fields"] if "column" in field and field["column"] != entity["keyColumn"])
    field["column"] = "renamed_by_the_test"
    table = f"{entity['table']['schema']}.{entity['table']['name']}"
    assert find_mismatches(parse_glossary(doctored), catalog) == [Mismatch(table, "renamed_by_the_test")]


def test_missing_table_is_a_mismatch_without_a_column(synthetic: Glossary) -> None:
    catalog = [column for column in catalog_of(synthetic) if column.table != "Queue"]
    assert find_mismatches(synthetic, catalog) == [Mismatch("ops.Queue", None)]


def test_column_of_the_wrong_type_family_is_a_mismatch(synthetic: Glossary) -> None:
    catalog = [
        CatalogColumn(
            c.schema, c.table, c.column, "nvarchar" if (c.table, c.column) == ("Ticket", "priority") else c.data_type
        )
        for c in catalog_of(synthetic)
    ]
    assert find_mismatches(synthetic, catalog) == [Mismatch("ops.Ticket", "priority")]


@pytest.mark.parametrize(
    ("column", "data_type"),
    [
        ("priority", "decimal"),
        ("priority", "bigint"),
        ("title", "varchar"),
        ("opened_on", "datetime2"),
        ("state", "nchar"),
    ],
)
def test_every_type_of_a_family_fits(synthetic: Glossary, column: str, data_type: str) -> None:
    catalog = [
        CatalogColumn(
            c.schema, c.table, c.column, data_type if (c.table, c.column) == ("Ticket", column) else c.data_type
        )
        for c in catalog_of(synthetic)
    ]
    assert find_mismatches(synthetic, catalog) == []
