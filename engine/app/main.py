"""The application factory. Start it with `python -m uvicorn app.main:create_app --factory`."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import anyio.to_thread
from fastapi import FastAPI

from app import ENGINE_VERSION
from app.logs import configure_logging
from app.routes import create_router
from app.services import build_services, start_services
from app.settings import Settings, load_settings
from app.web import BoundaryMiddleware, install_error_handlers


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the application; nothing touches the database before the lifespan starts.

    With no argument the settings come from the environment and the repository's `.env`; tests pass their own.
    """
    if settings is None:
        settings = load_settings()
    configure_logging(settings.log_level_number)
    services = build_services(settings)

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncGenerator[None]:
        # Raising here makes uvicorn exit non-zero: that is how the engine refuses to start.
        await anyio.to_thread.run_sync(start_services, services)
        try:
            yield
        finally:
            services.executor.dispose()

    # An internal service with one caller: no interactive docs, no CORS, no authentication.
    app = FastAPI(
        title="Data Controls engine",
        version=ENGINE_VERSION,
        lifespan=lifespan,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        # Off: the default answers `/health/` with a 307 that has no problem body.
        redirect_slashes=False,
    )
    app.state.services = services
    install_error_handlers(app)
    app.add_middleware(BoundaryMiddleware)
    app.include_router(create_router(debug_compile=settings.debug_compile))
    return app
