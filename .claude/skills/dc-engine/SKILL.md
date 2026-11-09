---
name: dc-engine
description: "Repo facts for engine/, the Python control engine (FastAPI, SQLAlchemy Core as the only SQL builder, pyodbc on SQL Server, pytest golden tests), and the glossary, schema and examples in contracts/ that it loads. Loads on its own when those files are touched. Use when changing the glossary loader, validator, compiler, executor, explainer, compile cache, suggestions or an engine endpoint."
paths:
  - "engine/**"
  - "contracts/glossary.json"
  - "contracts/control-definition.schema.json"
  - "contracts/examples/**"
---

# dc-engine

FastAPI + Pydantic 2 on Python 3.12, SQLAlchemy Core 2 as the only way SQL is built, pyodbc with ODBC Driver 18
against SQL Server 2022, pytest. One stateless service; its modules follow architecture §6: `glossary` (loads
`contracts/glossary.json`, typed lookups, the startup check), `validator`, `compiler`, `executor`, `explainer`,
`cache`, `suggestions`. Layout: the package in `engine/app/`, tests in `engine/tests/` (`unit/`, `golden/`,
`integration/`), configuration in `engine/pyproject.toml`, the venv in `engine/.venv`. Conventions:
[.claude/rules/python.md](../../rules/python.md).

## Verify

```
cd engine && .venv/bin/python -m pytest      # integration tests need the seeded db on :1433
.venv/bin/ruff check . && .venv/bin/pyright
```

`/check` runs the right subset. `[tool.pyright]` sets `venvPath = "."` and `venv = ".venv"`, so a pyright from
PATH (the hook's fallback) still resolves the imports.

## How SQL is built (architecture §10, in code)

- Identifiers: one `sqlalchemy.Table` per glossary entity (schema `hr`, columns typed from the glossary), built
  at startup. Callers name glossary keys; an unknown or hidden key is `DEFINITION_INVALID` with its JSON path,
  never a fallback name.
- Values: bind parameters only (`column < value`, `bindparam`, `in_`). Never an f-string, `%`, `.format()`,
  `text()` with interpolation, `literal_column()` or `literal_binds` around anything a caller sent, golden tests
  and `/debug/compile` included. "Contains" filters use `col.contains(value, autoescape=True)`, so `%`, `_` and
  `[` in the value stay literal.
- Text columns are typed `Unicode` (NVARCHAR): the `mssql+pyodbc` dialect binds `String` as VARCHAR and `Unicode`
  as NVARCHAR (`use_setinputsizes`, on by default in SQLAlchemy 2), and a VARCHAR bind runs Hebrew through the
  database code page.
- Operators come from a closed map (operator key → SQLAlchemy expression); computed fields from a closed list of
  kinds in code (`age_years` and the like). Neither is extended from data.
- One `Select` per compile. Many-to-one paths (two hops at most) become joins; a one-to-many `related` node becomes
  a correlated `exists()` or `~exists()`, so rows never multiply. Each condition adds a flag column
  (`case((condition, 1), else_=0).label(condition_id)`) that the explainer reads.
- Date math runs in Python against the run date and binds a date: `age < 18` becomes `birth_date > run_date − 18
  years`. `DATEDIFF(year, …)` counts year boundaries, not birthdays, and a function on the column defeats the index.
- `/run` executes two statements derived from that one `Select`: the exact count, and a page capped at the row cap
  and ordered by the root key, so the page is deterministic.

## Facts that bite

- pyodbc is synchronous: routes and everything they call are plain `def` (FastAPI runs them in its threadpool).
  An `async def` route that calls the executor blocks the event loop for the whole query.
- Statement timeout: pyodbc `Connection.timeout` (seconds; set it in SQLAlchemy's `connect` event) applies to the
  cursors created after it. A timeout raises `OperationalError` with SQLSTATE `HYT00` → `QUERY_TIMEOUT`;
  connection failures (`08001`, `08S01`) → `DATABASE_UNAVAILABLE`; a failed login is `InterfaceError` `28000`.
- ODBC Driver 18 encrypts by default and the local container has a self-signed certificate, so the engine's
  connection string carries `TrustServerCertificate=yes`. Host runs need `unixodbc` and `msodbcsql18` (kickoff
  §1); the engine image installs them and builds from the repo root, because it reads `contracts/`.
- The startup check reads `INFORMATION_SCHEMA` as `dq_engine_ro`, which sees only what it may read: `hr`. It runs
  in the FastAPI lifespan; raising there makes uvicorn exit non-zero ("Application startup failed"), which is the
  refuse-to-start. The log line names the missing table or column.
- FastAPI's default 422 body (`{"detail": [...]}`) is English prose from Pydantic. Register handlers for
  `RequestValidationError`, `HTTPException` and `Exception`, so every error is problem details with `code`,
  `params` and a JSON `path`: never a traceback, SQL or a driver message.
- Language comes from `Accept-Language` (`he` or `en`; anything else → `he`). Reasons go out both as data (reason
  key + params per matched condition) and as text rendered from the glossary's templates in that language.
- The run date defaults to today in `Asia/Jerusalem` (`zoneinfo`), not the server's UTC date, which is still
  yesterday for the first two or three hours of every Israeli day.
- Compile cache key: a hash of the canonical definition (`json.dumps(sort_keys=True, separators=(",", ":"),
  ensure_ascii=False)`) plus the glossary version plus the engine version. It holds compiled statements, never
  results.
- Suggestions work with no LLM key (heuristics only). The LLM sees the glossary and aggregates, never row values;
  every suggestion goes through validator and compiler and is dropped when invalid. No LLM sits in the
  definition-to-SQL path.
- `/debug/compile` is off unless configured; no other endpoint returns SQL.

## Tests

- Golden: each `contracts/examples/*.json` compiles with `sqlalchemy.dialects.mssql` to SQL text with placeholders
  plus a params dict, stored in `tests/golden/`. Regenerating them takes a deliberate flag; review the diff and
  commit it with the compiler change.
- Rejections: one test per validator path (unknown field, hidden field, operator not allowed for the type, value
  type mismatch, unreachable path, nesting depth, condition count, list size, a third hop).
- Injection: values such as `'; DROP TABLE hr.Employee; --` stay bound parameters, match no rows, and never appear
  in the SQL text.
- Integration: the exact record keys of every example against the seeded db, boundary rows included. These tests
  fail when the db is down: a skipped integration test at a gate is a red gate.

## Read before changing

[architecture.md](../../../docs/architecture.md) §4.3 (glossary), §5 (definition), §6 (engine), §10 (security),
§11 (performance); `contracts/glossary.json`, `contracts/control-definition.schema.json`, `contracts/errors.md`.
