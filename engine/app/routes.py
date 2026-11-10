"""The endpoints of contracts/api.md §3. Plain `def`: pyodbc is synchronous and FastAPI runs these in its threadpool."""

from __future__ import annotations

import logging
import time
from collections.abc import Mapping
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request
from starlette.responses import JSONResponse

from app import ENGINE_VERSION
from app.compiler import RenderedStatement, render_statement
from app.errors import DebugDisabled
from app.explainer import Explainer, describe
from app.services import Services
from app.web import DebugCompileRequest, RunRequest, ValidateRequest, resolve_language

logger = logging.getLogger(__name__)


def _services(request: Request) -> Services:
    return request.app.state.services


ServicesDep = Annotated[Services, Depends(_services)]


def _language(request: Request, services: ServicesDep) -> str:
    """The language of every rendered text of the answer (contracts/api.md, Language)."""
    glossary = services.glossary
    return resolve_language(request.headers.get("accept-language"), glossary.languages, glossary.default_language)


LanguageDep = Annotated[str, Depends(_language)]


def create_router(*, debug_compile: bool) -> APIRouter:
    """The routes of one application. `/debug/compile` shows SQL text only when the configuration turns it on."""
    router = APIRouter()
    router.add_api_route("/health", health, methods=["GET"])
    router.add_api_route("/glossary", glossary, methods=["GET"])
    router.add_api_route("/validate", validate, methods=["POST"])
    router.add_api_route("/run", run, methods=["POST"], response_model=None)
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


def validate(body: ValidateRequest, services: ServicesDep, language: LanguageDep) -> dict[str, Any]:
    """A dry compile: the definition is validated and compiled, and nothing is sent to the database."""
    plan = services.plan_for(body.definition)
    return {"valid": True, **describe(Explainer(services.glossary, language), plan.definition)}


def run(body: RunRequest, services: ServicesDep, language: LanguageDep) -> JSONResponse:
    """Count, then a capped page ordered by key; every violation comes back with a reason per matched node.

    Stateless: nothing is stored here, and the SQL never leaves the engine.
    """
    started = time.perf_counter()
    plan = services.plan_for(body.definition)
    run_date = body.run_date or services.today()
    ceiling = services.settings.row_cap
    cap = ceiling if body.row_cap is None else min(body.row_cap, ceiling)
    outcome = services.executor.run_compiled(plan, run_date, cap)

    explainer = Explainer(services.glossary, language)
    violations = [explainer.violation(plan, row, run_date) for row in outcome.rows]
    answer = {
        "runDate": run_date.isoformat(),
        "totalCount": outcome.counts.total,
        "returnedCount": len(violations),
        "capExceeded": outcome.counts.total > len(violations),
        "durationMs": 0,
        "engineVersion": ENGINE_VERSION,
        "glossaryVersion": services.glossary.version,
        **describe(explainer, plan.definition, outcome.counts.matched),
        "violations": violations,
    }
    answer["durationMs"] = round((time.perf_counter() - started) * 1000)
    # Counts and timing only: a row value or a reason never goes into a log line.
    logger.info(
        "run",
        extra={
            "root": plan.definition.root.key,
            "total": outcome.counts.total,
            "returned": len(violations),
            "duration_ms": answer["durationMs"],
        },
    )
    # Built from plain values already; handed over as it is rather than through FastAPI's model encoder.
    return JSONResponse(answer)


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
