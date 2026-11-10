"""The endpoints of contracts/api.md §3. Plain `def`: pyodbc is synchronous and FastAPI runs these in its threadpool."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request

from app import ENGINE_VERSION
from app.compiler import RenderedStatement, render_statement
from app.errors import DebugDisabled
from app.services import Services
from app.web import DebugCompileRequest


def _services(request: Request) -> Services:
    return request.app.state.services


ServicesDep = Annotated[Services, Depends(_services)]


def create_router(*, debug_compile: bool) -> APIRouter:
    """The routes of one application. `/debug/compile` shows SQL text only when the configuration turns it on."""
    router = APIRouter()
    router.add_api_route("/health", health, methods=["GET"])
    router.add_api_route("/glossary", glossary, methods=["GET"])
    # When it is off no body is read: every call is the same 404.
    router.add_api_route("/debug/compile", compile_for_debug if debug_compile else debug_disabled, methods=["POST"])
    return router


def health(services: ServicesDep) -> dict[str, str]:
    services.glossary_guard.check_health()
    return {
        "status": "ok",
        "database": "ok",
        "glossaryVersion": services.glossary.version,
        "engineVersion": ENGINE_VERSION,
    }


def glossary(services: ServicesDep) -> Mapping[str, Any]:
    return services.public_glossary


def debug_disabled() -> None:
    raise DebugDisabled()


def compile_for_debug(body: DebugCompileRequest, services: ServicesDep) -> dict[str, Any]:
    """The two statements of a run, as text with placeholders and the values beside it. Nothing is executed."""
    plan = services.plan_for(body.definition)
    parameters = plan.parameters(body.run_date or services.today())
    page = render_statement(plan.page_statement(services.settings.row_cap), parameters)
    count = render_statement(plan.count, parameters)
    return {
        "sql": page.sql,
        "params": _parameters(page),
        "countSql": count.sql,
        "countParams": _parameters(count),
    }


def _parameters(statement: RenderedStatement) -> list[dict[str, Any]]:
    return [{"name": item.name, "type": item.type, "value": item.value} for item in statement.parameters]
