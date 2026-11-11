"""Logging for the `app` package: one line per record, with the correlation id and the record's context."""

from __future__ import annotations

import logging
import sys

from app.web import correlation_id_var

_PACKAGE_LOGGER = "app"
_STANDARD_ATTRIBUTES = frozenset(vars(logging.LogRecord("", 0, "", 0, "", None, None))) | {"message", "asctime"}


class _ContextFormatter(logging.Formatter):
    """Appends what a call passed in `extra=` as `key=value`, so context never has to be formatted into a message."""

    def format(self, record: logging.LogRecord) -> str:
        line = super().format(record)
        context = {name: value for name, value in vars(record).items() if name not in _STANDARD_ATTRIBUTES}
        context.pop("correlation_id", None)
        suffix = " ".join(f"{name}={value!r}" for name, value in context.items())
        return f"{line} {suffix}" if suffix else line


class _CorrelationFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.correlation_id = correlation_id_var.get()
        return True


class _EngineHandler(logging.StreamHandler):  # type: ignore[type-arg]
    """Marks the handler this module installed, so a second `create_app` does not add another."""


def configure_logging(level: int) -> None:
    logger = logging.getLogger(_PACKAGE_LOGGER)
    logger.setLevel(level)
    if any(isinstance(handler, _EngineHandler) for handler in logger.handlers):
        return
    handler = _EngineHandler(sys.stderr)
    handler.addFilter(_CorrelationFilter())
    handler.setFormatter(_ContextFormatter("%(asctime)s %(levelname)s %(name)s [%(correlation_id)s] %(message)s"))
    logger.addHandler(handler)
