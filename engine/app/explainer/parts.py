"""Text as parts: every rendered string also comes as the pieces it was built from.

A part says which node its clause belongs to and which placeholder it came from, so a client can mark a
condition without rendering anything itself. Joining the `text` of a list of parts gives the string exactly.
"""

from __future__ import annotations

import re
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any

_PLACEHOLDER = re.compile(r"\{(\w+)\}")


@dataclass(frozen=True, slots=True)
class TextPart:
    text: str
    node_id: str | None = None
    role: str | None = None

    def to_json(self) -> dict[str, Any]:
        body: dict[str, Any] = {"text": self.text}
        if self.node_id is not None:
            body["nodeId"] = self.node_id
        if self.role is not None:
            body["role"] = self.role
        return body


@dataclass(frozen=True, slots=True)
class Rendered:
    """A string and its parts; the string is the join of the parts."""

    parts: tuple[TextPart, ...]

    @property
    def text(self) -> str:
        return "".join(part.text for part in self.parts)

    def parts_json(self) -> list[dict[str, Any]]:
        return [part.to_json() for part in self.parts]


def rendered(parts: Iterable[TextPart]) -> Rendered:
    """An empty text gives no part (contracts/errors.md, Rendering, Parts)."""
    return Rendered(tuple(part for part in parts if part.text))


def fill(template: str, slots: Mapping[str, Sequence[TextPart]], node_id: str | None) -> list[TextPart]:
    """Split a template at its placeholders.

    Template text becomes parts with no role that carry `node_id`; a placeholder becomes the parts given for it,
    as they are. The template is used exactly as written: nothing is added, trimmed or reordered.
    """
    parts: list[TextPart] = []
    position = 0
    for match in _PLACEHOLDER.finditer(template):
        parts.append(TextPart(template[position : match.start()], node_id))
        parts.extend(slots.get(match.group(1), ()))
        position = match.end()
    parts.append(TextPart(template[position:], node_id))
    return [part for part in parts if part.text]


def fill_plain(template: str, values: Mapping[str, str]) -> str:
    """A template whose result is one string and no parts (a field on a path, a suggestion text)."""
    return _PLACEHOLDER.sub(lambda match: values.get(match.group(1), ""), template)
