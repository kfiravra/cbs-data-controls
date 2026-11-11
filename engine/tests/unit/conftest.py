from __future__ import annotations

import os

import pytest


@pytest.fixture(autouse=True)
def _no_engine_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    """Unit tests see no ENGINE_* variable of the developer's shell and a password that opens nothing."""
    for name in list(os.environ):
        if name.upper().startswith("ENGINE_") or name.upper() == "DQ_ENGINE_RO_PASSWORD":
            monkeypatch.delenv(name)
    monkeypatch.setenv("DQ_ENGINE_RO_PASSWORD", "offline-not-a-secret")
