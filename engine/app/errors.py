"""Domain errors and their one mapping to problem details (contracts/errors.md, contracts/api.md `Problem`).

An error leaves the engine as a code, params and paths. No sentence, SQL text or driver message is ever part of it.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any, ClassVar

PROBLEM_MEDIA_TYPE = "application/problem+json"


def _no_params() -> Mapping[str, Any]:
    return {}


@dataclass(frozen=True, slots=True)
class DefinitionError:
    """One fault of a control definition; `path` is a JSON Pointer into the definition."""

    code: str
    path: str
    params: Mapping[str, Any] = field(default_factory=_no_params)
    node_id: str | None = None

    def to_json(self) -> dict[str, Any]:
        body: dict[str, Any] = {"code": self.code, "path": self.path}
        if self.node_id is not None:
            body["nodeId"] = self.node_id
        body["params"] = dict(self.params)
        return body


@dataclass(frozen=True, slots=True)
class RequestError:
    """One fault of a request body; `path` is a JSON Pointer into the body."""

    path: str
    code: str
    params: Mapping[str, Any] = field(default_factory=_no_params)

    def to_json(self) -> dict[str, Any]:
        return {"path": self.path, "code": self.code, "params": dict(self.params)}


class EngineError(Exception):
    """Base of every error a caller can be answered with."""

    code: ClassVar[str] = "INTERNAL_ERROR"
    status: ClassVar[int] = 500

    def __init__(self, params: Mapping[str, Any] | None = None) -> None:
        super().__init__(self.code)
        self.params: Mapping[str, Any] = dict(params or {})

    @property
    def http_status(self) -> int:
        return self.status

    def error_items(self) -> list[dict[str, Any]] | None:
        return None


class InternalError(EngineError):
    """Anything else. The details are logged with the correlation id and never returned."""


class NotFound(EngineError):
    code = "NOT_FOUND"
    status = 404


class DebugDisabled(EngineError):
    code = "DEBUG_DISABLED"
    status = 404


class DatabaseUnavailable(EngineError):
    code = "DATABASE_UNAVAILABLE"
    status = 503

    def __init__(self, sqlstate: str | None = None) -> None:
        super().__init__()
        # For the log and for the startup decision (a missing driver ends the start); never part of the answer.
        self.sqlstate = sqlstate


class GlossaryMismatch(EngineError):
    code = "GLOSSARY_MISMATCH"
    status = 503

    def __init__(self, table: str, column: str | None) -> None:
        super().__init__({"table": table, "column": column})


class QueryTimeout(EngineError):
    code = "QUERY_TIMEOUT"
    status = 504

    def __init__(self, timeout_seconds: int) -> None:
        super().__init__({"timeoutSeconds": timeout_seconds})


class DefinitionInvalid(EngineError):
    code = "DEFINITION_INVALID"
    status = 422

    def __init__(self, errors: Sequence[DefinitionError]) -> None:
        super().__init__()
        self.errors = tuple(errors)

    def error_items(self) -> list[dict[str, Any]]:
        return [error.to_json() for error in self.errors]


class RequestInvalid(EngineError):
    """400 with the faults listed; 413 and 415 carry no list (contracts/api.md, Common rules)."""

    code = "REQUEST_INVALID"
    status = 400

    def __init__(self, errors: Sequence[RequestError] = (), *, status: int = 400) -> None:
        super().__init__()
        self.errors = tuple(errors)
        self._status = status

    @property
    def http_status(self) -> int:
        return self._status

    def error_items(self) -> list[dict[str, Any]] | None:
        if self._status != 400:
            return None
        return [error.to_json() for error in self.errors]


def to_problem(error: EngineError, correlation_id: str) -> dict[str, Any]:
    """The body of an error answer: `{ type, title, status, code, params, errors?, correlationId }`."""
    body: dict[str, Any] = {
        "type": "about:blank",
        "title": error.code,
        "status": error.http_status,
        "code": error.code,
        "params": dict(error.params),
    }
    items = error.error_items()
    if items is not None:
        body["errors"] = items
    body["correlationId"] = correlation_id
    return body
