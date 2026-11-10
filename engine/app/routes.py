"""The endpoints of contracts/api.md §3. Plain `def`: pyodbc is synchronous and FastAPI runs these in its threadpool."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request

from app import ENGINE_VERSION
from app.services import Services

router = APIRouter()


def _services(request: Request) -> Services:
    return request.app.state.services


ServicesDep = Annotated[Services, Depends(_services)]


@router.get("/health")
def health(services: ServicesDep) -> dict[str, str]:
    services.glossary_guard.check_health()
    return {
        "status": "ok",
        "database": "ok",
        "glossaryVersion": services.glossary.version,
        "engineVersion": ENGINE_VERSION,
    }


@router.get("/glossary")
def glossary(services: ServicesDep) -> Mapping[str, Any]:
    return services.public_glossary
