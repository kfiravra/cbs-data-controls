"""The executor: the only place that opens a connection, always as `dq_engine_ro` and only for a SELECT."""

from __future__ import annotations

from app.executor.database import Executor, translate_driver_error

__all__ = ["Executor", "translate_driver_error"]
