# dc-engine notes

## State
Phases 1 to 5 done on 2026-11-11 (gates: `gates/phase-1.txt` to `gates/phase-5.txt` and
`gates/readme-commands.txt`, 493 tests); phase 7, the image, is next, then the gate. Phases 1 to 3 are
reviewed and their fixes committed; the reviews of phases 4 and 5 are running. The run is unattended on Kfir's
word of 2026-11-11 (the night brief, see "Decisions taken unattended"): no questions, no stop at a phase gate,
push and PR allowed once the gate passes, no merge.

What exists: the engine of architecture §6, all six endpoints. `engine/` holds `pyproject.toml`, `uv.lock`,
`.python-version` (3.12) and `requirements.txt`; settings and the connection URL; problem details; the glossary
package; the validator; the compiler and its cache; the executor; the explainer; the suggestions (a profile
per entity, five generators, the pipeline); `GET /health`, `GET /glossary`, `POST /validate`, `POST /run`,
`POST /suggest`, `POST /debug/compile` (off by default). On the seed `/suggest` returns seven proposals, four of
them the examples marked `heuristic: true`, node for node. Start: `cd engine && .venv/bin/python -m uvicorn
app.main:create_app --factory --host 127.0.0.1 --port 8000`.

For Kfir's read at the gate: `engine/tests/golden/*.text.json` (six files: the rule sentence, a sentence per
node, one reason per matched node, in Hebrew) and one `/suggest` answer, saved as `gates/suggest-answer.json`
at the gate.

## Next
1. Phase 7: `engine/Dockerfile`, build, a smoke run on the compose network.
2. The gate: `/check all --tests`, the lock and its export, the wheel check, the suite under 3.13 and 3.14,
   the §19 items test by test, the security auditor, the lines for dc-api and dc-delivery, `/ship`.
3. Push and PR (Kfir's word is in the night brief). No merge.

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

10. Only caller values are parameters; the 1 and 0 of the flags are written into the text by SQLAlchemy
    (`literal_execute`, the mechanism of `TOP n`), and the engine refuses at startup a glossary whose
    `maxTotalValues` is above 500. This replaces what stood here before the phase 3 review, a second statement
    shape that filtered on the flags. Why: Design D binds a value twice per statement (its flag and the WHERE)
    and says `maxTotalValues` keeps a statement under 2,000 parameters. Two things broke that. A value of a list
    on the computed age is two dates, so four parameters; and the constants of the flags, bound as parameters,
    were sent once per use, which grows with conditions times depth (the reviewer's critical finding: thirty
    conditions three groups deep passed 2,000 and answered 500). With the constants out of the parameters the
    worst definition the limits allow sends exactly 2,000 (SQL Server refuses 2,100), so the second shape could
    never run and was removed.
11. "29 February becoming 28" (Design D) is applied only when the target year has no 29 February. Read
    literally it would turn S(4) of 2028-02-29 into 2024-02-28 and make somebody born on 2024-02-29 three
    years old on their fourth birthday; the contract's formula decides, and a test on real rows proves the
    ranges against it (`tests/unit/test_age.py`).
12. `eq` on an age with a fractional operand is "false" in Design D. SQLAlchemy renders `false()` as `CASE WHEN
    0` on SQL Server, which is not valid there, so the compiler writes `c IS NULL AND c IS NOT NULL`.
13. The engine refuses at startup a glossary it cannot serve (an operator with no expression, a computed field
    with an operator its function lacks, or a computed field not marked `comparable: false`), instead of
    failing on the first run that meets it.
14. `/debug/compile` shows named placeholders (`:p0`), each parameter once in the order it first appears, with
    an expanded list as `:p3_1, :p3_2`; `TOP n` is rendered by SQLAlchemy from the configured cap. When the
    endpoint is off no body is read, so every call is the same 404.

15. The README got a new `## Engine` section, placed before `## Configuration`. Phase 4 says dc-contracts left
    a heading for it in the skeleton; there is none, only two sentences inside Configuration and "Running the
    tests" that name dc-engine. Those two sentences were left alone (decision 24: the rest of the README is
    dc-delivery's) and are listed under "Docs for dc-delivery".
16. `rowCap` above `ENGINE_ROW_CAP` is clamped, as api.md says, and `durationMs` covers validation, compiling,
    both statements and the rendering of the answer.

17. The profile holds only what the generators read: the row count, the rows in which each optional field is
    missing, and for each pair of stored date fields how many rows hold both and each order. Design H also
    lists distinct counts, minima and maxima; no generator of the plan reads them, so they are not queried.
18. Both first-cut items of phase 5 are built (the two-hop `active_under_inactive` and `missing_optional`):
    nothing was late. On the seed they add three proposals to the four of the gate: active employees under
    an inactive ministry (7 records), active departments under an inactive ministry (1), departments without
    a manager (1). Kfir may want fewer; `max` and `rootEntity` cut the answer, and removing a generator is one
    line of `GENERATORS`.
19. `date_order` reads "one order holds in at least 80% of them and the other in at least one row" strictly:
    at least 80% of the rows that hold both dates have the later one after the earlier one, equal dates
    counting for neither order (21 of 25 on the seed, 84%). First written the other way, with equal dates on
    the side of the usual order; the phase 5 review showed that two dates that are mostly equal then get both
    opposite rules proposed.
20. The engine refuses at startup a glossary that lacks a suggestion text it writes (a kind or an evidence
    key), like the other "cannot serve" checks of decision 13.

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
- `README.md`, Configuration, last line ("The engine and api blocks are filled by dc-engine and dc-api") and
  "Running the tests", last bullet ("Engine, api and web: one command each, filled by dc-engine ..."): the
  engine's variables, start commands and test commands are in the new `## Engine` section; these two
  sentences can point there or be folded into it.
- `README.md`, Contracts table, `glossary.json` row and the `--render` line ("Hebrew and English labels",
  "he and en"): the glossary lists Hebrew alone (the scope decision). Not this task's text; seen while
  writing the Engine section.
- `docs/architecture.md` §6, compiler ("emits one computed flag per condition for reasons"): the flag columns
  have generated labels and exist for the nodes that can be matched (conditions outside a related node, and
  related nodes); "matched" is computed in the outer statements. §11 "Compile cache ... unchanged definitions
  skip validation and compilation" holds as written.
- For the limitations document: the statement timeout path is proven on a fabricated driver error only; count
  and page run as two statements at the default isolation level, so on a database written between them they
  could differ; an age operand beyond the range of DATE is clamped to 0001-01-01 (reviews/phase-3.md, info 3).
- `docs/architecture.md` §6, suggestions ("computes aggregate statistics on `hr` (null rates, ranges, distinct
  counts, FK orphans, date-pair sanity)"): what is built is one aggregate SELECT per rootable entity with the
  row count, the missing count of each optional field and the order of each pair of date fields; no ranges,
  distinct counts or orphans. The generators are five: `missing_required`, `date_order`,
  `active_under_inactive` (one and two hops), `active_without_active_children`, `missing_optional`.
- `docs/architecture.md` §19, the engine gate ("`/suggest` yields examples 2 to 5"): it does, node for node,
  and on the seed it yields three more proposals (decision 18). Example 1 is never proposed: no generator
  writes a number into a definition.
- For the limitations document: a suggestion is counted on today's date; the profile and each count are
  separate statements; `/suggest` runs one statement per rootable entity and one per candidate (ten on the
  seed), each under the statement timeout.

## Last reviewed
`57e3e28` (phase 5), report in `reviews/phase-5.md`; phases 1 to 4 in `reviews/phase-1.md` to `phase-4.md`.

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
- 2026-11-11 phase 3, unattended, `gates/phase-3.txt`: ruff, pyright, 343 tests, print guard, hook tests
  226 of 226. The invariants of Design I hold on the six examples and on every definition generated from the
  real glossary and from a synthetic one (tickets and queues): one SELECT, no `;`, no string or number literal
  in the text but the LIKE wildcard, the escape character and the row cap, no node id, and only tables and
  columns the glossary names. Verified on SQLAlchemy 2.0.57 before writing: an explicit `bindparam` keeps a
  bool out of the text; `contains(..., escape="/")` renders `LIKE '%' + :p + '%' ESCAPE '/'`; `false()` renders
  `CASE WHEN 0`; `render_postcompile` shows `TOP 5000` and `IN (:p3_1, :p3_2)`; a qmark compile's
  `positiontup` counts the values a statement sends. Found while testing the limit: the parameter arithmetic of
  the plan (decision 10 above). Harness lines corrected: three sentences of `dc-engine/SKILL.md` (autoescape,
  the label, the two statements), the autoescape clause of `agents/security-auditor.md`, and a new fact in the
  skill about `localhost` and `::1`.
- 2026-11-11 review of phase 3 (`e74d531..a9b3ec8`, one reviewer on opus, `reviews/phase-3.md`): 1 critical,
  2 warnings, 5 info. Critical: `app/compiler/build.py:332,339` the flag constants were bound as parameters on
  every use, so thirty single-value conditions three groups deep (or 26 at four) passed 2,000 parameters and a
  valid definition answered 500; fixed: the 1 and 0 are rendered into the text by SQLAlchemy, a statement sends
  caller values only, and tests pin the count for the deepest and widest tree the limits allow (60) and for
  500 values on an ordinary field (1,000) and on the computed one (2,000). Warnings: decision 10's second shape
  was sized on values alone and tested as text only: removed, since it can no longer be reached, and replaced
  by a startup check on `maxTotalValues` (decision 10 as it now stands); `build.py:165,332,336` `_holds` read an
  attribute only `_matched` assigned: the helper is local to `_matched` again and nothing is assigned late.
  Info, fixed: `SKILL.md:46-48` and `:58-60` reworded to what the code does; `build.py:236,336` the `t` label
  formatted in two places, now one function; `build.py:102` parameter names tied to the two constants, gone
  with them; `tests/unit/test_debug_compile.py:51` computed its expectation the way the code does and would
  raise on 29 February, now a fixed "today" and the contract's own example. Info, left by the session:
  `computed.py:31-32` the clamp to 0001-01-01 is off by one day for a record born on that very day and an
  operand above the run year: no real birth date is there, and the exact form needs a second kind of
  parameter; `build.py:179-185` the builder walks the tree for the nodes that can be matched though the
  validator can list them: it needs each node's predicate and the groups above it, which only its own walk
  has. The goldens were regenerated (the constants are now `1` and `0` in the text) and the diff read. All of
  it in the review-fix commit that follows this line.
- 2026-11-11 phase 4, unattended, `gates/phase-4.txt` and `gates/readme-commands.txt`: ruff, pyright, 460
  tests (334 unit and golden, 126 against the seeded database), print guard. Proven on the seed through
  `POST /run`: every example on its run date, and example 1 on 2026-10-31, flags exactly the keys and matched
  ids of its file; the per-node counts equal the sums over the rows; the answer to the request of
  `contracts/api.md` §5 equals the example there in every member but `durationMs`; `rowCap: 1` returns one row
  and the counts of all ten; `is_empty` finds NULL, the empty string and spaces (1081, 1082, 1083 and the three
  other rows of sql/README.md); `ne`, `not_in`, `not_between` and `not_contains` never match a NULL; a field of
  a missing parent matches no comparison, and employee 1085 is still flagged through an OR branch; `%`, `_` and
  a bracket class in a LIKE operand match nothing; a Hebrew name read from one answer finds its record as an
  operand; injection text returns no row and the table still holds 85; a closed port answers 503. The explainer
  is also tested on an English glossary with other formats (`tests/synthetic.py`), so no test spells Hebrew and
  no code names a language. Every command of the README's Engine section ran once in a scratch copy: the pip
  path and the uv path both answer `/health` 200 and run the example.
- 2026-11-11 phase 5, unattended, `gates/phase-5.txt`: ruff, pyright, 493 tests (354 unit and golden, 139
  against the seeded database), print guard. The gate test: each of the four examples marked `heuristic: true`
  has exactly one suggestion whose definition equals the example's, and that definition, run on the example's
  date, flags the example's keys with its matched ids; the unmarked examples are never proposed and no proposal
  holds a number. Evidence on the seed: missing mandatory data 10 of 85 (email 4, salary 4, department 1,
  termination date 2, the counts of the example file), termination before hire 3 of the 25 rows with both
  dates. The generators and the pipeline are also tested on the synthetic glossary in English with stand-ins
  for the data: the seven proposals expected there are written out by hand from Design H's conventions.
- 2026-11-11 review of phase 4 (`642f140..a49c710`, one reviewer on opus, `reviews/phase-4.md`): 0 critical,
  1 warning, 11 info. Warning: `tests/integration/test_examples_live.py:114` the row-cap test passed for any
  cap of ten or more, so the clamp was unproven; fixed: the test now starts the engine with `ENGINE_ROW_CAP`
  at 2 and asks for 5,000,000, for 3 and for nothing (two rows each time), and for 1. Info, fixed:
  `executor/database.py:149` no fabricated timeout went through the executor or `/run`: a live test now
  raises a fabricated `HYT00` from the connection and gets 504 with `timeoutSeconds`;
  `test_semantics_live.py:211` a field key spelled in a test, now read from the example;
  `test_explainer.py:16` two tests on names outside the public surface, replaced by one through `violation`
  (a NULL value leaves no empty part); `render.py:24` a mutable dict for a closed set, now immutable;
  `test_text_goldens_live.py:17` helpers imported from a test module, moved to `tests/golden/files.py`;
  `test_examples_live.py:136` `/validate` never tried without a database, now six unit tests on a client that
  never connected; `README.md:113,134,75` the `ENGINE_PORT` row, where the text goldens run, and the Windows
  spelling of the venv command, reworded. Info, no change needed: `executor/database.py:104`
  `count_compiled` had no caller: phase 5 calls it. Info, left by the session: `explainer/__init__.py:40`,
  `render.py:195` the explainer builds the answer's dicts itself: the shapes of api.md are the renderer's
  output, and moving them to the routes would put rendering knowledge in two modules. All of it in the
  review-fix commit that follows this line.
- 2026-11-11 review of phase 5 (`a49c710..57e3e28`, one reviewer on opus, `reviews/phase-5.md`): 0 critical,
  2 warnings, 5 info. Warnings: `suggestions/generators.py:65-71` with `shape.py:64-70` a required field that
  cannot be NULL (or whose own operator list has no NULL test) made the whole `missing_required` proposal of
  its entity invalid and dropped; fixed: a field with no test for "missing" is left out and the others stay,
  with a test on such a glossary; `generators.py:98-103` equal dates counted as the usual order in both
  directions, so mostly-equal dates got both opposite rules; fixed: only rows strictly in the usual order
  count (decision 19 as it now stands), with the reviewer's case as a test. Info, fixed: `profile.py:42-46`
  a date field marked `comparable: false` is no longer paired; `generators.py:25-33` each kind is now written
  once, as a key of `GENERATORS`, and the cardinality of a parent is a constant of the glossary module;
  `pipeline.py:112` a name is cut to 200 characters; `compiler/profile.py:41-83` Design H in plan.md now says
  what the profile holds as built; `tests/unit/test_suggestions.py:135-166` the gaps are tested: exactly five
  rows, no rows at all, the startup refusal through `create_app`, and `/suggest` answering 504 on a fabricated
  timeout. All of it in the review-fix commit that follows this line.
