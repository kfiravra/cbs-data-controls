---
paths:
  - "engine/**/*.py"
---

# Python conventions (judgment calls only)

Already enforced by tooling, so do not restate them in reviews: ruff and pyright with the configuration in
`engine/pyproject.toml`, and `print(` outside tests through the print guard.

- `from __future__ import annotations` at the top of every module; type hints on every signature; `X | None`, never
  `Optional[X]`.
- Plain `def` for routes and for everything that reaches the database (pyodbc is synchronous and FastAPI runs `def`
  routes in its threadpool); `async def` only for code that awaits.
- Pydantic models at the HTTP boundary only. Inside, `@dataclass(frozen=True, slots=True)` for glossary entries,
  compiled plans and reasons.
- One package per module of architecture §6, each with a small public surface (`validate_definition`,
  `compile_definition`, `run_compiled`, …); helpers start with `_`; nothing imports a sibling's private names.
- SQL exists only in `compiler` and `executor`, and only as SQLAlchemy Core expressions. A string holding SQL anywhere
  else is a review finding.
- Closed sets are immutable (`frozenset`, `MappingProxyType`) for operators and computed kinds; constants are
  `SCREAMING_SNAKE_CASE`.
- Errors are domain exceptions that carry `code`, `path` and `params` (`DefinitionInvalid`, `QueryTimeout`, …);
  routes never raise `HTTPException` with prose. Catch specific exceptions, never a bare `except:`.
- `logger = logging.getLogger(__name__)` per module, context in `extra=`; never row values or rendered reasons in a
  log line (they hold personal data).
- Tests: pytest functions, fixtures in `conftest.py`, `pytest.mark.parametrize` over `contracts/examples/` and the
  rejection cases. Expected values come from the contracts and the goldens, never recomputed the way the code
  computes them.
