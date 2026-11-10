"""Shared fixtures. Unit and golden tests need no database; integration tests need the seeded one and never skip."""

from __future__ import annotations

import json
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from starlette.testclient import TestClient

from app.glossary import Glossary, load_glossary
from app.main import create_app
from app.settings import Settings, load_settings

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
CONTRACTS_DIR = REPOSITORY_ROOT / "contracts"
EXAMPLES_DIR = CONTRACTS_DIR / "examples"
INVALID_DIR = EXAMPLES_DIR / "invalid"


def pytest_addoption(parser: pytest.Parser) -> None:
    parser.addoption(
        "--update-goldens",
        action="store_true",
        default=False,
        help="rewrite tests/golden/* from the compiler and the explainer; review the diff before committing it",
    )


def read_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def example_files() -> list[Path]:
    return sorted(EXAMPLES_DIR.glob("*.json"))


def invalid_files() -> list[Path]:
    return sorted(INVALID_DIR.glob("*.json"))


@pytest.fixture(scope="session")
def glossary_document() -> dict[str, Any]:
    return read_json(CONTRACTS_DIR / "glossary.json")


@pytest.fixture(scope="session")
def glossary() -> Glossary:
    return load_glossary(CONTRACTS_DIR / "glossary.json")


@pytest.fixture
def offline_settings(monkeypatch: pytest.MonkeyPatch) -> Settings:
    """Settings that read no `.env` and name a database nobody is asked to reach."""
    monkeypatch.setenv("DQ_ENGINE_RO_PASSWORD", "offline-not-a-secret")
    return load_settings(None)


@pytest.fixture
def client(offline_settings: Settings) -> TestClient:
    """The application without its lifespan: no connection is ever opened."""
    return TestClient(create_app(offline_settings))


@pytest.fixture(scope="session")
def live_settings() -> Settings:
    """The developer's settings: the repository's `.env` and the environment."""
    return load_settings()


@pytest.fixture(scope="session")
def live_client(live_settings: Settings) -> Iterator[TestClient]:
    """The application started against the seeded database; startup fails the test when it is down."""
    with TestClient(create_app(live_settings)) as started:
        yield started
