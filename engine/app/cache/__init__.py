"""The compile cache: a bounded, thread-safe map from a definition's hash to its compiled plan.

It holds statements, never results: every run still queries the database.
"""

from __future__ import annotations

import hashlib
import json
import threading
from collections import OrderedDict
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

__all__ = ["MAX_CACHED_DEFINITION_CHARS", "BoundedCache", "Fingerprint", "fingerprint"]

DEFAULT_CAPACITY = 256
# A definition within the glossary's limits is a few kilobytes of JSON. One far larger can only be so through
# long text literals, which the contract does not bound; its plan is compiled and run but not kept, so the
# cache cannot be made to hold hundreds of megabytes.
MAX_CACHED_DEFINITION_CHARS = 65_536


@dataclass(frozen=True, slots=True)
class Fingerprint:
    """The cache key of a definition, and the size of its canonical JSON."""

    key: str
    size: int

    @property
    def cacheable(self) -> bool:
        return self.size <= MAX_CACHED_DEFINITION_CHARS


def fingerprint(document: Mapping[str, Any], glossary_version: str, engine_version: str) -> Fingerprint:
    """sha256 of the canonical definition JSON, the glossary version and the engine version.

    Canonical: sorted members and no spaces, so two spellings of one definition share a plan. A new glossary or a
    new engine changes every key, so a plan compiled under the old one is never served.
    """
    canonical = json.dumps(document, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    digest = hashlib.sha256()
    for part in (canonical, glossary_version, engine_version):
        # A JSON string may hold a lone surrogate, which is not text; it is hashed as it stands and the
        # validator is the one to refuse it.
        digest.update(part.encode("utf-8", errors="surrogatepass"))
        digest.update(b"\x00")
    return Fingerprint(digest.hexdigest(), len(canonical))


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
