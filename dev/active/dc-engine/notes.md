# dc-engine notes

## State
Phases 1 and 2 done on 2026-11-11 (gates: `gates/phase-1.txt`, `gates/phase-2.txt`, 220 tests); phase 3, the
compiler, is next. The phase 1 review is running; its fixes land as one commit when it reports. The run is
unattended on Kfir's word of 2026-11-11 (the night brief, see "Decisions taken unattended"): no questions, no
stop at a phase gate, push and PR allowed once the gate passes, no merge.

What exists: `engine/` with `pyproject.toml`, `uv.lock`, `.python-version` (3.12) and `requirements.txt`; the
settings and the connection URL; problem details for every error; the correlation id; the glossary package
(model, loader, tables, public view, catalog comparison); the executor with its guards; the startup check;
`GET /health` and `GET /glossary`; the validator (`validate_definition(document, glossary, schema)`: schema
layer, semantic layer, `ValidatedDefinition`), not yet behind an endpoint. Start: `cd engine &&
.venv/bin/python -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000`.

## Next
1. Phase 3: operators and the LIKE escape, `age_years`, the builder (joins, EXISTS, truth columns, the page and
   count statements), the plan with parameter recipes, the cache, `POST /debug/compile`, the goldens, the
   harness lines.
2. Then phases 4, 5 and 7 in order, each closed by `/check --tests`, a reviewer on opus, one review-fix commit
   and a Log line here.
3. The gate, then push and PR (Kfir's word is in the night brief). No merge.

## Blockers
None. Steps that need another task's running service are listed under "Waiting for a merge" when they appear.

## Phase 0: `contracts/` against Design J (2026-11-11)
`contracts/` wins everywhere. The nine points of plan.md "Lines from dc-contracts as it merges" stand as written
there. Read in full: `glossary.json` 1.0.0, the schema, `api.md`, `errors.md`, the six examples and the thirteen
invalid fixtures. Further differences from Design J and Design G, none of which needs a contract change:

- Entity `label` is `{ singular, plural }`, each one text per language; a suggestion's `{entity}` is the plural.
- `computed` is `{ function, over }`, and `over` names the column the function reads (errors.md, Age).
- `phrases.relatedAny` and `phrases.relatedNone` are each `{ sentence, reason }`, not one text.
- `REQUEST_INVALID` carries `errors: [{ path, code, params }]` with the request error codes (`REQUIRED`,
  `OUT_OF_RANGE`, `MALFORMED`; `TOO_LONG` has no use in the engine). Design G names only the handler. Pinned per
  member in api.md: `definition` absent or null is `REQUIRED` and any non-object `MALFORMED`; a member the engine
  does not know is `MALFORMED` at that member; `rowCap` and `max` below 1 are `OUT_OF_RANGE`; a `runDate` that is
  not a real date is `MALFORMED`. 413 and 415 are `REQUEST_INVALID` without `errors`.
- The correlation id is taken from the request only when it matches `^[A-Za-z0-9._-]{1,64}$`; otherwise the
  engine creates 32 hexadecimal characters.
- `GLOSSARY_MISMATCH` params: `table` as `schema.name`, `column` null when the whole table is missing.
- `UNSUPPORTED_SCHEMA_VERSION` applies only to an object whose `schemaVersion` is present and is not the number
  1; a definition without the member goes to the schema.
- `nodeId` is the id of the nearest node at or above the path that has a string `id`; it is absent on
  `DUPLICATE_NODE_ID`.
- A member forbidden with `false` under `properties` is reported at its object. Python `jsonschema` does that
  by itself (its `descend` returns before it adds the member to the path); `scripts/contracts-check.py` pins
  `jsonschema==4.26.0`, and the engine pins the same version so both read the schema alike.
- The public glossary: a relationship has no `join`, and one that starts or ends at a hidden entity is left
  out; a field always has `operators`.
- `/debug/compile` lists params as `{ name, type, value }` in placeholder order.
- `is_empty` is NULL, the empty string or spaces only. SQL Server's `= ''` ignores trailing spaces, so Design
  D's expression already gives it; an integration test proves it on employee 1083.
- Record keys are strings of at most 64 characters.
- `README.md` has no engine heading: the skeleton only says the engine block of Configuration and the engine
  line of "Running the tests" are filled by dc-engine. Phase 4 decides where the section goes.

Machine on 2026-11-11: `odbcinst -q -d` lists `ODBC Driver 18 for SQL Server`; nothing listens on 8000; the
container `data-controls-db-1` is healthy on 127.0.0.1:1433; `scripts/db-check.sh` from this worktree: 27
passed, 0 failed.

## Decisions taken unattended (2026-11-11)
Each one was Kfir's to make and was made without him, on the night brief's "decide, write it in notes.md,
continue". He reads these first.

1. The session runs on Fable 5.2, not on Opus as plan.md decision 19 and the kickoff say: nobody was there to
   switch the model. Reviewers and the security auditor still run on opus.
2. Spend lines are written and not waited on. Kfir gave his word for every install in the plan (mid-turn
   message, 2026-11-11); reviews, the two extra suite runs and the image build go by the night brief.
3. This folder was committed alone, before any code, as the branch's first commit, on Kfir's explicit word;
   CLAUDE.md's "no docs-only commits" was set aside for that one commit.
4. Phase 0's `mv` step and `git worktree add` were skipped as told: the worktree existed and the folder came
   from git.

5. The test client runs on `httpx2`, not `httpx` (a dev dependency only): Starlette 1.10 deprecates `httpx`
   for its `TestClient`. `requirements.txt` is not affected.
6. `.env.example` writes `ENGINE_DB_HOST=127.0.0.1`; the code default stays `localhost` (Design A). On this
   machine `localhost` resolves to `::1` first and ODBC Driver 18 never falls back to IPv4 (tried with login
   timeouts of 5, 15 and 30 s), while compose publishes SQL Server on 127.0.0.1 only. `localhost` stays the
   default because it is what reaches a grader's local Windows instance over shared memory.
7. Request faults the plan left open, read from api.md as written: a body that is not JSON, by its media type
   or because it does not parse, is 415 `REQUEST_INVALID` with no error list; a body over 1 MiB is 413 (the
   api's limit, taken for the engine); a request with no body at all is judged by its route.
8. Every empty `ENGINE_*` variable means unset, not only the port and the driver, so `ENGINE_CONTRACTS_DIR=`
   in `.env.example` is the default path.
9. The interactive docs of FastAPI (`/docs`, `/redoc`, `/openapi.json`) are switched off: one internal caller,
   and an unknown path must answer `NOT_FOUND`.

## Waiting for a merge
(none yet)

## Docs for dc-delivery
One line per item, added in the step that makes it true (plan.md decision 24): the file and section, what it
says, what is true now. The list goes into the PR body under this heading at `/ship`.

- `docs/architecture.md` §14, "Configuration by environment variables: connection strings for the two logins":
  the engine takes no connection string. It reads `ENGINE_DB_HOST`, `ENGINE_DB_PORT`, `ENGINE_DB_NAME`,
  `ENGINE_DB_DRIVER` and `DQ_ENGINE_RO_PASSWORD`; the full list is the engine block of `.env.example`.
- `README.md`, Configuration table ("The engine and api blocks are filled by dc-engine and dc-api"): the
  engine's rows are the thirteen `ENGINE_*` keys of `.env.example`, with the meanings written there.
- `docker-compose.yml`, the engine service (dc-delivery's): it must set `ENGINE_DB_HOST=db` (and may leave
  `ENGINE_DB_PORT=1433`); the `.env` value `127.0.0.1` is for a host run and does not reach `db` from inside
  compose. The image's start command binds `0.0.0.0:8000`.
- README manual path, Windows: `ENGINE_DB_HOST=localhost` or `.\SQLEXPRESS` with `ENGINE_DB_PORT` empty; on
  WSL or Linux against the compose database, `127.0.0.1` (decision 6 above).
- Still to come: architecture §19 and §6 on suggestions, when phase 5 lands.

## Last reviewed
`c96bc1d` (phase 2), report in `reviews/phase-2.md`; phase 1 (`a426451`) in `reviews/phase-1.md`.

## Log
- 2026-11-10 created plan. Interview in two rounds (plan.md Decisions 1 to 5). Kfir chose `lifecycle` and
  `required` as the only suggestion knowledge in the glossary and moved example 1 to the LLM path; Claude Sonnet
  5.5 as the default model; only-violated suggestions; 1.5 days with the LLM adapter as the first cut; all four
  groups of contract additions, written the same day into the dc-contracts plan (its decisions 26 to 29, Design H).
- 2026-11-10 machine facts: Python 3.12.3, uv 0.11.26, pyright on PATH, no ruff on PATH, no host `sqlcmd`, no
  `.env` yet, Docker Desktop not running at planning time (nothing listened on 1433 or 8000). The `pgrep` pattern
  for running suites also matches the Playwright MCP servers.
- 2026-11-10 verified on SQLAlchemy 2.0.57 with a scratch script (plan.md Design D, "Verified at planning"):
  `autoescape=True` does not escape `[`; `.limit(int)` renders `TOP` as a literal and a bound limit becomes a
  `ROW_NUMBER()` wrapper; `col == False` is rendered inline. The `dc-engine` skill and the security-auditor brief
  say otherwise about `[` and about `.label(condition_id)`; phase 3 corrects them.
- 2026-11-10 `Skill(dc-engine)` is unknown until a file of its area exists; read
  `.claude/skills/dc-engine/SKILL.md` directly (the same finding as in dc-contracts).
- 2026-11-10 amended on Kfir's word for dc-delivery's four asks and its line to all three tasks: plan.md
  decisions 20 to 25, Design A (connection, start command, tooling, portability, the wheel check), Designs E, F
  and I, phases 0, 1 and 4 to 7, the gate, Risks and Out of scope. Chosen: `ENGINE_DB_DRIVER` plus an optional
  port, not a connection-string variable. The architecture edit of phase 5 became a "Docs for dc-delivery" line.
  The blocker on `msodbcsql18` was removed: version 18.7.1 was found installed (`/etc/odbcinst.ini` dated 20:57).
- 2026-11-10 verified for that amendment, in the scratchpad (plan.md Design A, "Verified at planning"): a
  wheels-only resolve of the planned pins for win_amd64 exits 0 on 3.12, 3.13 and 3.14, the same 32 pins on each;
  the list imports under 3.13.14 and 3.14.6 on Linux; pip 24.0 accepts the uv export; SQLAlchemy 2.0.57 builds
  `Server=.\SQLEXPRESS` from a host with no port; pydantic-settings 2.16.2 needs `env_ignore_empty` off for an
  empty port to win over `.env`; Ruff 0.17.4 has `PLW1514` only in preview; an open `anthropic` requirement
  resolves to 2.8.0, which is why the plan now says `>=1,<2`; `-o /dev/null` fails in `uv pip compile`. Nothing
  ran on Windows.
- 2026-11-10 side effect of that check: uv downloaded CPython 3.13.14 and 3.14.6 into `~/.local/share/uv/python/`
  (104 MB and 110 MB). uv now builds a project that has no `.python-version` on 3.14.
- 2026-11-11 phase 0, unattended. `/resume` found the notes stale (they still waited for dc-contracts, merged as
  `f9928bf`). Checked the driver, the port, the container and `scripts/db-check.sh` (27 passed), read
  `contracts/` against Design J and recorded the differences above. No gate file: phase 0 has no commit of its
  own in the plan; this folder was committed alone on Kfir's word (decision 3 above).
- 2026-11-11 phase 1, unattended, `gates/phase-1.txt`: ruff, pyright strict on `app/`, 137 tests (134 unit, 3
  against the seeded database), print guard, the wheel check `exit=0` for 3.12, 3.13 and 3.14, `/health` 200
  under uvicorn. Two modules beyond Design A's layout: `app/services.py` (the services container, the startup
  sequence, the one-minute health recheck) and `app/logs.py` (one log line with the correlation id and the
  `extra=` context). `uv sync` resolved fastapi 0.162.4, starlette 1.10.0, pydantic 2.14.3, sqlalchemy 2.0.57,
  pyodbc 5.5.0, jsonschema 4.26.0 (pinned), ruff 0.17.4, pyright 1.1.414, pytest 9.2.0.
- 2026-11-11 00:23 one pytest run of 6.6 s overlapped a Playwright run of the cbs-web session
  (`e2e/mocked/shell.spec.ts`): the `pgrep` line printed the other suite and the command went on anyway. Since
  then every suite here starts through a wrapper that waits until no other suite runs (scratchpad
  `wait-suite.sh`, 30 minutes at most); it waited once already, at 00:27.
- 2026-11-11 phase 2, unattended, `gates/phase-2.txt`: ruff, pyright, 220 tests, print guard. The validator
  rejects each of the thirteen fixtures with exactly one error at the fixture's code and path, and jsonschema
  4.26.0 does report a member forbidden with `false` at its object, as errors.md says. Choices inside the
  contract: a path fault does not stop the walk when the entity it reaches is still known (a one-to-many hop, a
  path over the limit), so the field, the operator and the values are checked too; an enum literal is matched
  exactly, not without regard to case (rendering is where the contract asks for that); literals are typed
  against the left field even when the operator is not allowed for it. A related node whose relationship is
  known but starts elsewhere still has its `where` checked in the entity the relationship reaches.
- 2026-11-11 review of phase 1 (`05369a6..a426451`, one reviewer on opus, `reviews/phase-1.md`): 0 critical,
  3 warnings, 7 info. Warnings: `tests/unit/test_settings.py:140` a raw Hebrew literal in a test (the Write
  tool had turned the escapes into characters), fixed: the name is built from code points; `app/main.py:39`
  `/health/` answered a bodiless 307, fixed: `redirect_slashes=False` and a test; `app/services.py:112` the
  missing-driver line named only the driver asked for, fixed: it now carries the driver asked for, the one
  chosen and the installed ones (the executor's own "database error" line before it stays: it holds the
  SQLSTATE). Info, fixed: `tests/unit/test_startup.py:15` imported the private `_guard`, now the public
  `ensure_single_select`; `services.py:100` context in the message, now in `extra=`; `services.py:42` catalog
  labels spelled in two modules, now constants of `compiler.queries`; `services.py:54,67` one exception
  instance shared between threads, now the finding is kept and a new exception raised per answer;
  `web.py:236` the media-type refusal ran before routing, now 415 is decided after routing (413 by declared
  length stays in front: such a body must not be read); `notes.md:97` "fourteen" keys, corrected to thirteen.
  Info, rejected by the session: `web.py:76,91` `ValidateRequest` and `DebugCompileRequest` unused: phases 3
  and 4 use them. All of it in the review-fix commit that follows this line.
- 2026-11-11 review of phase 2 (`a426451..c96bc1d`, one reviewer on opus, `reviews/phase-2.md`): 1 critical,
  3 warnings, 2 info. Critical: `app/validator/schema.py:34` a definition of 170 nested groups ended in
  `RecursionError` inside jsonschema and a 500; fixed: groups nested deeper than 32 levels (or the glossary's
  limit, if higher) are answered `TOO_DEEP` at `/where` before the schema is asked, the document-order walk no
  longer recurses, and the schema library is handed a copy cut at 72 JSON levels when the document is deeper.
  Found by the session while reproducing it and fixed with it: two lists nested 900 levels deep inside `values`
  crashed the same way. Tests at 33, 170, 400 and 5,000 levels. Consequence to know: for a tree deeper than 32
  groups the answer is `TOO_DEEP` alone, also when the document has schema errors too; from 5 to 32 the order of
  errors.md holds (schema errors first). Warnings: `tests/unit/test_validator.py` 752 lines, fixed: split into
  two modules and a helper; `semantic.py:153,224` the per-list `TOO_MANY_VALUES` ran only when the left field
  resolved, fixed: checked for every condition, with a test; `semantic.py:177` `PATH_NOT_REACHABLE` in a field
  path stopped the walk, fixed: it goes on from the entity the relationship reaches, with a test. Info, fixed:
  `semantic.py:51` the walk returned `None` beside a public error list, now it returns the tree or the errors.
  Info, left as it is by the session: `semantic.py:163,216,239` `pointer` and `node_id` travel together (a data
  clump): they are the two columns of every error record and a wrapper type would add a name without removing
  an argument. All of it in the review-fix commit that follows this line.
