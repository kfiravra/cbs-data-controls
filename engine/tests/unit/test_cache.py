"""The compile cache: bounded, least recently used out, keyed by definition, glossary version and engine version."""

from __future__ import annotations

import threading
from typing import Any

import pytest

from app import ENGINE_VERSION
from app.cache import MAX_CACHED_DEFINITION_CHARS, BoundedCache, fingerprint
from app.errors import DefinitionInvalid
from app.main import create_app
from app.services import Services
from app.settings import Settings
from tests.builders import all_of, cond, definition
from tests.conftest import example_files, read_json


def test_cache_returns_what_was_put() -> None:
    cache: BoundedCache[str] = BoundedCache(capacity=2)
    assert cache.get("a") is None
    cache.put("a", "plan a")
    assert cache.get("a") == "plan a"
    assert len(cache) == 1


def test_least_recently_used_entry_goes_first() -> None:
    cache: BoundedCache[str] = BoundedCache(capacity=2)
    cache.put("a", "A")
    cache.put("b", "B")
    assert cache.get("a") == "A"  # `a` is now the fresher of the two
    cache.put("c", "C")
    assert (cache.get("a"), cache.get("b"), cache.get("c")) == ("A", None, "C")
    assert len(cache) == 2


def test_cache_needs_room_for_one_entry() -> None:
    with pytest.raises(ValueError, match="capacity"):
        BoundedCache(capacity=0)


def test_cache_survives_many_threads() -> None:
    cache: BoundedCache[int] = BoundedCache(capacity=8)
    failures: list[BaseException] = []

    def work(worker: int) -> None:
        try:
            for step in range(2000):
                key = f"k{(worker * 7 + step) % 32}"
                cache.put(key, step)
                cache.get(key)
        except BaseException as error:  # noqa: BLE001 - whatever a race would raise is the finding
            failures.append(error)

    threads = [threading.Thread(target=work, args=(worker,)) for worker in range(8)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert failures == []
    assert len(cache) <= 8


def test_key_is_the_same_for_two_spellings_of_one_definition() -> None:
    one = {"schemaVersion": 1, "rootEntity": "ticket", "where": all_of(cond("c1", "title", "eq", "x"))}
    other = {"where": all_of(cond("c1", "title", "eq", "x")), "rootEntity": "ticket", "schemaVersion": 1}
    assert fingerprint(one, "1.0.0", "0.1.0") == fingerprint(other, "1.0.0", "0.1.0")


def test_key_changes_with_the_definition_the_glossary_and_the_engine() -> None:
    document = definition("ticket", all_of(cond("c1", "title", "eq", "x")))
    changed = definition("ticket", all_of(cond("c1", "title", "eq", "y")))
    base = fingerprint(document, "1.0.0", "0.1.0").key
    assert len(base) == 64
    assert len({base, fingerprint(changed, "1.0.0", "0.1.0").key, fingerprint(document, "1.0.1", "0.1.0").key,
                fingerprint(document, "1.0.0", "0.1.1").key}) == 4  # fmt: skip
    # The versions are separate parts of the key: moving a character from one to the other is another key.
    assert fingerprint(document, "1.0", ".00.1.0").key != fingerprint(document, "1.0.0", "0.1.0").key


def test_services_compile_a_definition_once_and_serve_it_from_the_cache(offline_settings: Settings) -> None:
    services: Services = create_app(offline_settings).state.services
    example: dict[str, Any] = read_json(example_files()[0])["definition"]
    first = services.plan_for(example)
    again = services.plan_for(dict(reversed(list(example.items()))))
    assert again is first
    assert len(services.plans) == 1
    assert services.glossary.version and ENGINE_VERSION


def test_invalid_definition_is_never_cached(offline_settings: Settings) -> None:
    services: Services = create_app(offline_settings).state.services
    for _ in range(2):
        with pytest.raises(DefinitionInvalid):
            services.plan_for(
                {"schemaVersion": 1, "rootEntity": "no_such_entity", "where": all_of(cond("c1", "x", "eq", 1))}
            )
    assert len(services.plans) == 0


def test_definition_far_larger_than_any_within_the_limits_is_compiled_and_not_kept(offline_settings: Settings) -> None:
    """A megabyte of text in one operand is valid (the contract sets no length); its plan must not fill the cache."""
    services: Services = create_app(offline_settings).state.services
    example: dict[str, Any] = read_json(example_files()[0])["definition"]
    text_field = next(
        field["key"]
        for entity in services.public_glossary["entities"]
        if entity["key"] == example["rootEntity"]
        for field in entity["fields"]
        if field["type"] == "text"
    )
    huge = definition(
        example["rootEntity"], all_of(cond("c1", text_field, "contains", "x" * MAX_CACHED_DEFINITION_CHARS))
    )
    assert not fingerprint(huge, "g", "e").cacheable
    assert services.plan_for(huge) is not services.plan_for(huge)
    assert len(services.plans) == 0
    assert fingerprint(example, "g", "e").cacheable


def test_key_of_a_definition_that_holds_half_a_surrogate_pair_is_still_computed() -> None:
    lone = definition("ticket", all_of(cond("c1", "title", "eq", chr(0xD800))))
    assert len(fingerprint(lone, "1.0.0", "0.1.0").key) == 64
