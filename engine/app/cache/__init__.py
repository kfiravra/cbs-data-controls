"""The compile cache: a bounded, thread-safe map from a definition's hash to its compiled plan.

It holds statements, never results: every run still queries the database.
"""

from __future__ import annotations

import hashlib
import json
import threading
from collections import OrderedDict
from collections.abc import Mapping
from typing import Any

__all__ = ["BoundedCache", "definition_key"]

DEFAULT_CAPACITY = 256


def definition_key(document: Mapping[str, Any], glossary_version: str, engine_version: str) -> str:
    """sha256 of the canonical definition JSON, the glossary version and the engine version.

    Canonical: sorted members and no spaces, so two spellings of one definition share a plan. A new glossary or a
    new engine changes every key, so a plan compiled under the old one is never served.
    """
    canonical = json.dumps(document, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    digest = hashlib.sha256()
    for part in (canonical, glossary_version, engine_version):
        digest.update(part.encode("utf-8"))
        digest.update(b"\x00")
    return digest.hexdigest()


class BoundedCache[V]:
    """Least recently used out once `capacity` entries are held; every operation is behind one lock."""

    def __init__(self, capacity: int = DEFAULT_CAPACITY) -> None:
        if capacity < 1:
            raise ValueError("capacity must be at least 1")
        self._capacity = capacity
        self._entries: OrderedDict[str, V] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: str) -> V | None:
        with self._lock:
            value = self._entries.get(key)
            if value is not None:
                self._entries.move_to_end(key)
            return value

    def put(self, key: str, value: V) -> None:
        with self._lock:
            self._entries[key] = value
            self._entries.move_to_end(key)
            while len(self._entries) > self._capacity:
                self._entries.popitem(last=False)

    def __len__(self) -> int:
        with self._lock:
            return len(self._entries)
