# Phase 1 review: engine, `05369a6..a426451`

Reviewer: the `reviewer` agent on opus, 2026-11-11, read-only. Report as returned.

Phase 1 has no critical findings: three warnings and seven info items across the two axes.

## Standards

Genericity is clean. Nothing in `engine/app` is keyed on a real entity, field or relationship; it only uses
operator keys and the computed kind `age_years`.

1. **warning, hard violation.** `engine/tests/unit/test_settings.py:140`: the Hebrew database name is a raw Hebrew
   literal, so the comment beside it ("written as escapes: the source stays English") is false. This breaks the
   CLAUDE.md rule "English-only code ... and tests" and Design I's "the test source stays English".
2. **info, hard violation.** `engine/tests/unit/test_startup.py:15` imports the private `_guard` under a pyright
   ignore. CODING-STANDARDS says to test "through public interfaces, not implementation", and python.md says
   "nothing imports a sibling's private names".
3. **info, hard violation.** `engine/app/services.py:100`: `logger.critical("startup failed: %s", error)` writes
   context into the message. python.md says "context in `extra=`".
4. **info, judgment (shotgun surgery).** `engine/app/services.py:42` reads `row["table_schema"]` and the other
   columns by label strings that are defined in `engine/app/compiler/queries.py:35-38`. Renaming one label gives
   a KeyError at startup, not a type error.
5. **info, judgment.** In `GlossaryGuard`, `services.py:54` raises `self._mismatch`, read outside the lock,
   instead of the `first` it just found. At `:67`, concurrent threads re-raise one cached exception instance,
   which shares and grows its `__traceback__` until the next recheck. Harmless today, but not thread-safe.
6. **info, judgment (speculative generality).** `engine/app/web.py:76,91`: `ValidateRequest` and
   `DebugCompileRequest` are not used anywhere. Phase 1 lists `web.py` for "correlation id, language" only.

## Plan

1. **warning.** `engine/app/main.py:39`: FastAPI's default `redirect_slashes=True` answers `GET /health/` or
   `/glossary/` with a 307 that has no body. api.md §1 says "Every response that is not 2xx is a `Problem`", and
   an unknown path is 404 `NOT_FOUND`. No test covers it.
2. **warning.** `services.py:112-115`: the IM002 exit logs only `asked`, after a separate "database error" line
   from `engine/app/executor/database.py:104`. Design A asks for "one log line: the driver asked for and the
   installed ones". The installed list is what a grader with a wrong `ENGINE_DB_DRIVER` needs.
3. **info.** `web.py:236`: `_refusal` runs before routing. A POST to an unknown path or to `/health` with a
   non-JSON body, or with a declared length over 1 MiB, gets 415 or 413 instead of 404 `NOT_FOUND` (api.md §1).
4. **info.** `dev/active/dc-engine/notes.md:97` tells dc-delivery about "the fourteen `ENGINE_*` keys".
   `.env.example` has 13, or 14 counting `DQ_ENGINE_RO_PASSWORD`.

Unattended decisions 5 to 9 are sound: Starlette 1.10's test client does import `httpx2` and warns on `httpx`;
`127.0.0.1` matches the address compose publishes SQL Server on; 413/415 and "empty means unset" are consistent
with api.md and decision 20; turning the docs off is what the 404 rule requires.

The rest matches Designs A, B and G: settings (an empty variable equals unset, the environment wins over `.env`,
the port must be 1 to 65535, the driver choice is 18 before 17); the public view holds no physical name and
nothing hidden; a mismatch or a missing driver ends the start at once, otherwise it waits; the middleware
re-raises once the response has started, enforces the limit on streamed bodies, and puts the correlation id on
500s.

**Totals.** Standards: 0 critical, 1 warning, 5 info. Plan: 0 critical, 2 warnings, 2 info.
