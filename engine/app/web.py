"""The HTTP edge: correlation id, language, request models, and the handlers that turn every error into a problem."""

from __future__ import annotations

import logging
import re
import uuid
from collections.abc import Mapping, Sequence
from contextvars import ContextVar
from datetime import date
from typing import Annotated, Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, StrictInt, StrictStr
from starlette.datastructures import Headers, MutableHeaders
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.errors import (
    PROBLEM_MEDIA_TYPE,
    EngineError,
    InternalError,
    NotFound,
    RequestError,
    RequestInvalid,
    to_problem,
)

logger = logging.getLogger(__name__)

CORRELATION_HEADER = "X-Correlation-Id"
MAX_BODY_BYTES = 1_048_576
_CORRELATION_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_BODY_METHODS = frozenset({"POST", "PUT", "PATCH"})
_NO_CORRELATION_ID = "-"

correlation_id_var: ContextVar[str] = ContextVar("correlation_id", default=_NO_CORRELATION_ID)


# --- language ---------------------------------------------------------------------------------------------


def resolve_language(accept_language: str | None, languages: Sequence[str], default: str) -> str:
    """The primary subtag of the first range of `Accept-Language` when the glossary lists it, else the default."""
    if accept_language:
        first_range = accept_language.split(",", 1)[0].split(";", 1)[0].strip()
        primary = first_range.split("-", 1)[0].lower()
        if primary in languages:
            return primary
    return default


# --- request models ---------------------------------------------------------------------------------------


def _real_date(value: Any) -> Any:
    """Only a `YYYY-MM-DD` string that names a real day; pydantic alone would also take a timestamp."""
    if value is None or isinstance(value, date):
        return value
    if not isinstance(value, str) or not _ISO_DATE.fullmatch(value):
        raise ValueError("not a YYYY-MM-DD date")
    return date.fromisoformat(value)


RunDate = Annotated[date | None, BeforeValidator(_real_date)]


class _RequestModel(BaseModel):
    # A member the engine does not know is refused (contracts/api.md, Unknown members).
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class ValidateRequest(_RequestModel):
    definition: dict[str, Any]


class RunRequest(_RequestModel):
    definition: dict[str, Any]
    run_date: RunDate = Field(default=None, alias="runDate")
    row_cap: StrictInt | None = Field(default=None, alias="rowCap", ge=1)


class SuggestRequest(_RequestModel):
    root_entity: StrictStr | None = Field(default=None, alias="rootEntity")
    max: StrictInt | None = Field(default=None, ge=1)


class DebugCompileRequest(_RequestModel):
    definition: dict[str, Any]
    run_date: RunDate = Field(default=None, alias="runDate")


# --- errors -----------------------------------------------------------------------------------------------

_UNPARSABLE_BODY = "json_invalid"
_RANGE_BOUNDS: Mapping[str, tuple[str, str]] = {
    "greater_than_equal": ("min", "ge"),
    "less_than_equal": ("max", "le"),
}


def _pointer(location: Sequence[Any]) -> str:
    """A pydantic location below `body` as a JSON Pointer into the request body."""
    return "".join("/" + str(part).replace("~", "~0").replace("/", "~1") for part in location[1:])


def _request_error(error: Mapping[str, Any]) -> RequestError:
    path = _pointer(error["loc"])
    kind = error["type"]
    if kind in _RANGE_BOUNDS:
        name, context_key = _RANGE_BOUNDS[kind]
        return RequestError(path, "OUT_OF_RANGE", {name: error["ctx"][context_key]})
    if kind == "extra_forbidden":
        return RequestError(path, "MALFORMED")
    # Absent and null both mean "not given" (contracts/api.md, Notation).
    if kind == "missing" or error.get("input") is None:
        return RequestError(path, "REQUIRED")
    return RequestError(path, "MALFORMED")


def request_invalid(errors: Sequence[Mapping[str, Any]]) -> RequestInvalid:
    """Pydantic's findings as the contract's request errors: codes and pointers, none of pydantic's prose."""
    if any(error["type"] == _UNPARSABLE_BODY for error in errors):
        return RequestInvalid(status=415)
    return RequestInvalid([_request_error(error) for error in errors])


def _has_body_of_another_media_type(headers: Headers) -> bool:
    """A body that does not say it is JSON. FastAPI leaves such a body unparsed, so its route cannot read it."""
    declared = headers.get("content-length", "")
    has_body = "transfer-encoding" in headers or (declared.isdigit() and int(declared) > 0)
    media_type = headers.get("content-type", "").split(";", 1)[0].strip().lower()
    return has_body and media_type != "application/json" and not media_type.endswith("+json")


def _from_http_exception(error: HTTPException) -> EngineError:
    if error.status_code in (404, 405):
        return NotFound()
    if error.status_code == 413:
        return RequestInvalid(status=413)
    if error.status_code in (400, 415):
        # FastAPI's 400 means the body could not be read as JSON at all (not UTF-8, for one).
        return RequestInvalid(status=415)
    if 400 <= error.status_code < 500:
        return RequestInvalid()
    return InternalError()


def problem_response(error: EngineError) -> JSONResponse:
    correlation_id = correlation_id_var.get()
    return JSONResponse(
        to_problem(error, correlation_id),
        status_code=error.http_status,
        media_type=PROBLEM_MEDIA_TYPE,
        headers={CORRELATION_HEADER: correlation_id},
    )


def install_error_handlers(app: FastAPI) -> None:
    """Every answer that is not 2xx is a problem: a code and params, never a sentence."""

    def engine_error(_request: Request, error: Exception) -> Response:
        if not isinstance(error, EngineError):  # registered for EngineError only
            raise error
        return problem_response(error)

    def validation_error(request: Request, error: Exception) -> Response:
        if not isinstance(error, RequestValidationError):
            raise error
        if _has_body_of_another_media_type(request.headers):
            return problem_response(RequestInvalid(status=415))
        return problem_response(request_invalid(error.errors()))

    def http_error(_request: Request, error: Exception) -> Response:
        if not isinstance(error, HTTPException):
            raise error
        return problem_response(_from_http_exception(error))

    app.add_exception_handler(EngineError, engine_error)
    app.add_exception_handler(RequestValidationError, validation_error)
    app.add_exception_handler(HTTPException, http_error)


# --- the boundary middleware ------------------------------------------------------------------------------


class _BodyTooLarge(HTTPException):
    """Raised while the body is read; an HTTPException so FastAPI passes it on instead of answering 400."""

    def __init__(self) -> None:
        super().__init__(status_code=413)


def _refusal(scope: Scope) -> RequestInvalid | None:
    """What must be refused before anything is read: a body whose declared length is over the limit."""
    declared = Headers(scope=scope).get("content-length", "")
    if scope["method"] in _BODY_METHODS and declared.isdigit() and int(declared) > MAX_BODY_BYTES:
        return RequestInvalid(status=413)
    return None


class BoundaryMiddleware:
    """Outermost: gives the request its correlation id, bounds the body, and answers anything unhandled with 500."""

    def __init__(self, app: ASGIApp) -> None:
        self._app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self._app(scope, receive, send)
            return

        given = Headers(scope=scope).get(CORRELATION_HEADER, "")
        correlation_id = given if _CORRELATION_ID.fullmatch(given) else uuid.uuid4().hex
        token = correlation_id_var.set(correlation_id)
        started = False
        received = 0

        async def bounded_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > MAX_BODY_BYTES:
                    raise _BodyTooLarge()
            return message

        async def send_with_id(message: Message) -> None:
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
                MutableHeaders(scope=message)[CORRELATION_HEADER] = correlation_id
            await send(message)

        try:
            refusal = _refusal(scope)
            if refusal is not None:
                await problem_response(refusal)(scope, receive, send_with_id)
                return
            await self._app(scope, bounded_receive, send_with_id)
        except Exception:
            # The traceback stays in the log, under the correlation id; the caller gets the code alone.
            logger.exception("unhandled error")
            if started:
                raise
            await problem_response(InternalError())(scope, receive, send_with_id)
        finally:
            correlation_id_var.reset(token)
