# dc-engine: the Python control engine
Created: 2026-11-10 · Branch: feat/engine (worktree `../cbs-engine`, cut from `origin/main` after dc-contracts merges)
Amended: 2026-11-10 for dc-delivery's asks (decisions 20 to 25; the Log in `notes.md` says what changed)
Amended: 2026-11-10 by the dc-contracts session on Kfir's scope decision, with the lines from the merged contracts (the two sections after the Decisions)

## Goal

After this task `engine/` is the FastAPI service of architecture §6. It loads `contracts/glossary.json`, refuses to
start when the glossary and the database disagree, validates a control definition, compiles it into one
parameterized SELECT, runs it as `dq_engine_ro` under a row cap and a timeout, and returns the violating records
with the reason each one failed, rendered in the request's language: Hebrew, the one language the glossary
lists. `/suggest` proposes controls from the glossary's lifecycle and required-field data and from counts on `hr`.
The api (dc-api) is its only caller and builds its run flow on it, and nothing else may read `hr`, so every
guarantee of architecture §10 is implemented and tested here. It must also start from source with Python 3.12
or later and pip alone, on Windows too, against a grader's local SQL Server, a named instance included
(dc-delivery's manual path). The
submission is due 2026-11-15: the budget is one and a half working days, in parallel with dc-api and dc-web.

## Decisions

From the interview (Kfir, 2026-11-10):

1. **Business knowledge for suggestions is two glossary properties and nothing else**: `lifecycle` per entity and
   `required` per field. `/suggest` must yield examples 2, 3, 4 and 5 exactly. Example 1 needs the thresholds 18
   and 15,000; they are business knowledge, no generator invents them, and they are never written into the
   glossary or the code, so example 1 is not proposed. The §19 gate line already says so (the scope decision
   aligned it). (Rejected: `range` declarations with a `when`; profiling only, which reproduces example 2 alone.)
2. (Removed by the scope decision of 2026-11-10: there is no LLM lane. The number stays so that later references
   keep their meaning.)
3. **`/suggest` returns only candidates that flag at least one record now**, each with that count as evidence.
   (Rejected: guard rules that flag nothing today.)
4. **Budget 1.5 days.** Order: validator, compiler, executor, explainer and endpoints, then the generators. If
   late, cut in this order: the generators beyond the gate (two steps of phase 5), the image (phase 7). A gate
   item is never cut.
5. **The contract additions this plan needs are written into dc-contracts before its freeze** (its decisions 26 to
   29 and Design H, added at planning time): suggestion data, sentence and reason parts, `maxTotalValues` and
   `comparable`, four clarifications. Design J below lists them as assumptions.

Settled here, inside the architecture:

6. **One inner SELECT, two statements derived from it.** The inner select carries the real WHERE and one truth
   column per node; the page and the count statements wrap it and compute "matched" (dc-contracts decision 8) from
   the truth columns. One implementation serves the rows and the per-condition counts, and a caller value is bound
   exactly twice. (Rejected: matched flags that repeat the ancestors' predicates, which multiplies parameters;
   matched computed in Python for rows and in SQL for counts, two implementations that can drift.)
7. **Nothing a caller typed reaches the SQL text, node ids included.** Column aliases are generated (`k`, `d0`,
   `a0`, `t0`, `m0`) and mapped back in Python. The `dc-engine` skill says `.label(condition_id)`; phase 3 corrects it.
8. **Every operand is an explicit typed `bindparam`.** The plan stores parameter names with a recipe for each
   value (a constant, or the run date minus n years), so one cached plan serves every run date and every row cap.
   A Python `bool` is never compared inline: SQLAlchemy renders `col == False` as `= 0`.
9. **LIKE operands are escaped by the compiler**, not by `autoescape=True`, which leaves `[` alone (a character
   class in T-SQL). The skill and the security-auditor brief claim otherwise; phase 3 corrects both.
10. **The row cap is `.limit(int)`**, which SQLAlchemy renders as `TOP n` through its integer literal; a bound cap
    turns the statement into a `ROW_NUMBER()` wrapper. It is the one value that is not a parameter: an `int`,
    validated at the boundary, clamped to `ENGINE_ROW_CAP`, and rendered by SQLAlchemy, never by engine code.
11. **`age_years` compiles to birth-date ranges** (Design D table), takes no part in field-to-field comparisons
    (`comparable: false`), and its actual value for a reason is computed in Python from the birth date.
12. **Validation reports everything it finds**: the schema layer first, the semantic layer only on a
    schema-valid document, errors in document order.
13. **The explainer renders parts; a string is the join of its parts.**
14. **A suggestion candidate is an ordinary definition**: it is validated, compiled and counted like a user's.
    Generators are a closed list in code, keyed on glossary properties (lifecycle, required, cardinality, type),
    never on an entity or a field key.
15. (Removed by the scope decision: no LLM boundary exists. Architecture §6 keeps the step as a design that is not
    built.)
16. **Startup**: wait up to 30 s for the database, then exit non-zero; a glossary mismatch exits at once, and so
    does a missing ODBC driver. `/health` repeats the glossary check at most once a minute.
17. **Tooling**: uv with `uv.lock`, a `.python-version` of 3.12 and an exported `requirements.txt` (decisions 21
    and 23); the Ruff block of `.claude/standards/linter-followups.md` plus `PLW1514` (decision 22); pyright
    strict on `app/`.
18. **Internal service**: no CORS, no authentication, bound to 127.0.0.1 in development. The api's attempt
    timeout must stay above the engine's worst case, about 60 s for a run of two 30-second statements: one line
    to the dc-api session at the gate.
19. **Reviews and models**: `/phase-review engine` at the end of every code phase (one reviewer on opus each),
    `security-auditor` once before `/ship`; no Sonnet lane; execution is test-first at the seams of Design I.

From dc-delivery's asks (carried by Kfir, 2026-11-10, after `dev/active/dc-delivery/plan.md` was written):

20. **The connection is set by parts: a driver variable and an optional port.** `ENGINE_DB_DRIVER` names the ODBC
    driver; unset, the engine takes the first of `ODBC Driver 18 for SQL Server` and `ODBC Driver 17 for SQL
    Server` that `pyodbc.drivers()` lists. `ENGINE_DB_PORT` unset or empty puts no port into `Server=`: that is
    how a named instance over shared memory is reached (`ENGINE_DB_HOST=.\SQLEXPRESS`), and it is 1433 over TCP
    everywhere else. Unset has to mean the same as empty, because cmd and Windows PowerShell delete a variable
    that is set to nothing. (Rejected: one variable with a full ODBC
    connection string, like the api's `ConnectionStrings__Dq`. It would hold the password in a second place and
    let a deployment hand the engine any login, `sa` included; this way the login stays the constant
    `dq_engine_ro` and the URL is still built by `URL.create`. Choosing the driver when the variable is unset is
    this plan's addition to the ask.)
21. **Python 3.12 or later with no upper bound, and Windows is a host the engine must start on.**
    `requires-python = ">=3.12"`; development, the image and the lint and type targets stay on 3.12
    (`engine/.python-version`). Every runtime dependency must have a win_amd64 wheel for CPython 3.12, 3.13 and
    3.14: a wheels-only resolve of the exported pins per version (Design A) runs whenever the lock changes and at
    the gate. Nothing POSIX-only at import or at start. (Written for the offline bundle and kept without it: the
    from-source path installs with pip on whatever Python the grader has, python.org ships installers for 3.13
    and 3.14 only, and pip must find a wheel for every pin.)
22. **Every text file is read and written as UTF-8, by name**: `encoding="utf-8"` on every `open`, `read_text`
    and `write_text` in `app/` and `tests/`, and `env_file_encoding="utf-8"` in the settings. Ruff's `PLW1514`
    enforces it. (Before 3.15 Python opens a file in the machine's code page, cp1255 on a Hebrew Windows, and the
    glossary and the examples hold Hebrew.)
23. **`requirements.txt` belongs to phase 1, not to the image**, so cutting phase 7 no longer cuts it. It is
    exported in the commit that changes the lock and compared with a fresh export at the gate. The README's engine
    section starts the engine with Python and pip alone: a venv, `pip install -r requirements.txt`, then
    `python -m uvicorn app.main:create_app --factory`.
24. **This task writes the README's engine section and no other document.** The §17 documents
    (`docs/architecture.md` is one of them), `docs/submission.he.md` and the rest of the README are
    dc-delivery's, on `feat/delivery`. Whatever this task makes untrue in them gets a line in `notes.md` under
    "Docs for dc-delivery" when it happens, and the list goes into the PR body under that heading at `/ship`. The
    architecture edit that phase 5 carried is now such a line.
25. **The notes Log records what each review found.** For every `/phase-review`, the security audit and Kfir's
    read at the gate: what was reviewed, every finding with its severity and `path:line`, and what happened to
    each (fixed, in which commit; rejected, by whom and why; rewritten by Kfir). A verdict word never stands in for
    the findings, and "no findings" is written only when the review returned none. `docs/ai-usage.md` is built
    from these lines.

## Scope decision (Kfir, 2026-11-10; written in by the dc-contracts session, which carried it through all five plans)

Applied to the text of this plan. Where a line still disagrees with this section, this section holds.

1. **Hebrew only.** `contracts/glossary.json` lists `"languages": ["he"]` and every text is an object with the
   one key `he`. The mechanism stays: texts keyed by language, `Accept-Language` resolved against `languages`, a
   language that is not listed answered in `defaultLanguage`, the run's language returned. No English golden, no
   English read at the gate. Code that indexes a text takes the language as a value; nothing names `he`.
2. **Suggestions are heuristics only.** No `anthropic` dependency, no `ANTHROPIC_API_KEY`, no `ENGINE_LLM_*`
   setting, no port or adapter, no prompt builder, no LLM tests, no phase 6. The `/suggest` answer is
   `{ items }`: the `source` member existed only for the LLM and is gone from `contracts/api.md`.
3. **No offline Windows bundle** in dc-delivery, so nothing here is shipped as wheels. Everything this plan built
   for a grader's Windows stays, because the from-source path needs all of it: `requirements.txt` and the
   pip-only start (decision 23), the driver and port settings (decision 20), UTF-8 by name (decision 22), and
   the win_amd64 wheel check with the suite runs under 3.13 and 3.14 (decision 21).

## Lines from dc-contracts as it merges (2026-11-10)

`contracts/` wins over this plan (phase 0). These are the points where the merged contract says more than, or
other than, the Designs below; each is one decision already made there.

- **Reason params**: every condition reason carries `actual`, and every field comparison `rightActual`, also when
  the template shows neither (`errors.md`, Reason keys). Design D's "actual columns per condition whose reason
  shows a value" becomes: for every condition that can be matched.
- **A related node's relationship**: unknown is `UNKNOWN_RELATIONSHIP`; one that does not start at the scope
  entity is `PATH_NOT_REACHABLE`; `RELATIONSHIP_NOT_QUANTIFIABLE` is only for one that is not one-to-many. Design C
  uses the third for all three.
- **The path of every definition error** is pinned per code in `errors.md`: a semantic error names the member the
  editor edits as one input (`<node>/left`, `/right`, `/operator`, `/value`, `/values` with `params.index`,
  `/relationship`, `/id`). Errors that share a path follow the order of the code table, then `params.index`. The
  invalid fixtures carry code and path, and `scripts/contracts-check.py` proves both.
- **`/suggest`** may also answer 504 `QUERY_TIMEOUT`; `max` defaults to 10 with a ceiling of 20; the engine
  rejects a request member it does not know (400, `MALFORMED` at that member). A `definition` that is not a JSON
  object is 400 `MALFORMED`, never a schema violation.
- **Values**: a number literal at or beyond 10^15 in absolute value is `VALUE_TYPE_MISMATCH`. An enum's label is
  found without regard to case, and a stored value with no entry is shown as stored. A NULL renders as nothing and
  no part is empty. A unit follows its value after one space, inside the same part.
- **`identifier: true`** on a number field (employee and department numbers, the two assignment fields): the
  value is written digit for digit, with no group separator. The public glossary serves the flag.
- **Glossary members Design J does not list**: entity `description`; field `label`, `description`, `identifier`.
  `arity` is 0, 1, 2 or the string `"list"`. `formats.<language>` is `{ date, groupSeparator, decimalSeparator }`.
- **Wording**: the two related `sentence` phrases bracket `{conditions}` themselves and the renderer adds no
  bracket; `is_null` reads "חסר" for every type and "ריק" belongs to `is_empty`; the placeholders of suggestion
  texts are defined in `errors.md` (Rendering, Suggestions).
- **Text across the boundary**: the standards now say it as the contract does. An error crosses as a code and
  params; rendered sentences and reasons are the one text that crosses.

## Phases

Every code phase ends the same way: tick each step as it finishes and update `notes.md` State and Next,
`/check --tests`, save the output as `gates/phase-N.txt`, `/phase-review engine`, one `fix(engine): review fixes`
commit, a Log line in `notes.md`. Before anything that costs money or minutes (the first `uv sync`, a review, the
image build) state it in one line and wait for the word. Before every pytest run:
`pgrep -fa "pytest|dotnet test|ng test|vitest|playwright"`; the Playwright MCP servers (`playwright-mcp`) match
that pattern and are not suites. `touch .claude/state/red` only while a slice is deliberately red.

The Log line of a review is a record, not a verdict (decision 25): the range reviewed and the totals per
severity; every critical and warning finding as `path:line` with a few words; for each, fixed in `<sha>`, or
rejected with the reason and by whom (the session or Kfir); and what Kfir rewrote or overruled. Info findings by
count. The reviewer's report is saved whole as `reviews/phase-N.md`.

A document that this task makes untrue and does not own (decision 24) gets its line in `notes.md` under "Docs for
dc-delivery" in the same step: the file and section, what it says, what is true now.

### Phase 0: preconditions (no commit)
- [x] dc-contracts passed its gate and is merged: `contracts/` is on `origin/main`.
- [x] The worktree, on Kfir's word (kickoff §5), from the main tree: `git worktree add ../cbs-engine -b feat/engine
      origin/main`, `cp .env ../cbs-engine/.env`, `mkdir -p ../cbs-engine/dev/active && mv dev/active/dc-engine
      ../cbs-engine/dev/active/`. This task's session runs in `../cbs-engine` on Opus.
- [x] Host driver: `odbcinst -q -d` lists `ODBC Driver 18 for SQL Server` (17 serves as well, decision 20).
      `msodbcsql18` 18.7.1 has been on this host since 2026-11-10 20:57; it was missing when this plan was first
      written.
- [x] Database: the container runs from the main tree and `scripts/db-check.sh` passed there after the last seed
      change. Never `db-init.sh` from the worktree.
- [x] Read `contracts/` against Design J and write every difference into `notes.md` before phase 1. `contracts/`
      wins; something the engine needs and `contracts/` lacks is a contract change (one commit on main on Kfir's
      word, one line to the other sessions).
- [x] Port: `ss -ltn | grep ':8000'`. If another project's container holds it, smoke runs use `ENGINE_PORT=8010`;
      ask before stopping anything.

### Phase 1: skeleton, glossary, startup check (about 2 h)
- [ ] `engine/pyproject.toml` (`requires-python = ">=3.12"`), `.python-version` (`3.12`), `uv.lock` and `.venv`
      through `uv sync` (state the download first), per Design A.
- [ ] `engine/requirements.txt` exported from the lock, then the Windows wheel check for 3.12, 3.13 and 3.14, both
      per Design A. A package with no wheel is replaced, or pinned to a version that has one, before code depends
      on it.
- [ ] `.env.example`: the engine block of Design A with placeholders (`ENGINE_DB_PORT=1433` written out,
      `ENGINE_DB_DRIVER=` left empty); the same keys in the worktree's `.env`.
- [ ] `app/settings.py` (the settings, the driver choice and the connection URL of Design A), `app/errors.py`
      (domain exceptions and the one mapping to problem details), `app/web.py` (correlation id, language),
      `app/main.py` (`create_app(settings=None)`, lifespan) per Designs A and G.
- [ ] `app/glossary/`: typed model, loader, resolved operators, tables, the public view, per Design B.
- [ ] The startup check per Design B: the catalog read is built in `compiler` and run by `executor`; `glossary`
      compares the sets.
- [ ] `GET /health` and `GET /glossary`.
- [ ] Tests: the loader and the resolved operators against the real glossary; the public view has no `table`,
      `keyColumn`, `column`, `computed` or `join` key; a doctored copy of the glossary (one column renamed) raises
      `GLOSSARY_MISMATCH` naming it and the app refuses to start; an unknown route and a malformed body answer
      problem details with a code and no prose; the connection settings of Design I.

Verify: `/check --tests` · the wheel check prints `exit=0` for each of the three versions · `cd engine &&
.venv/bin/python -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port ${ENGINE_PORT:-8000}`, then
`curl -s localhost:${ENGINE_PORT:-8000}/health`
Commit: `feat(engine): service skeleton, glossary loader and startup check`

### Phase 2: validator (about 1.5 h)
- [ ] The schema layer per Design C.
- [ ] The semantic layer per Design C: scopes and paths, operators and operands, limits, ids; one check per
      definition error code of `contracts/errors.md`.
- [ ] `ValidatedDefinition` per Design C, the only input of the compiler and the explainer.
- [ ] Tests: every `contracts/examples/*.json` is valid; every `contracts/examples/invalid/*.json` yields its
      expected code and path; one more test for each definition error code the fixtures do not cover; every limit
      is read from the glossary and exceeded by one; a hidden field through a doctored glossary; `true` is not a
      number; two errors in one definition come back together, in document order.

Verify: `/check --tests`
Commit: `feat(engine): definition validator with the full rejection catalogue`

### Phase 3: compiler, cache, goldens (about 2.5 h)
- [ ] `compiler/operators.py`: the closed map of the eighteen operators and the LIKE escape, per Design D.
- [ ] `compiler/computed.py`: the `age_years` table of Design D and its Python `actual`.
- [ ] `compiler/build.py`: aliases and LEFT joins, `related` nodes as correlated `exists()`, truth columns, the
      inner select and the two derived statements; `CompiledPlan` with parameter recipes, per Design D.
- [ ] `cache/`: bounded, thread-safe, keyed per Design D.
- [ ] `POST /debug/compile` behind `ENGINE_DEBUG_COMPILE`; 404 `DEBUG_DISABLED` otherwise.
- [ ] Goldens for the six examples and the `--update-goldens` flag, per Design I.
- [ ] Tests: the invariants of Design I on every example and on generated definitions; injection strings in
      every operand position appear only in the parameters; the age table row by row, 29 February included; LIKE
      escaping; a definition at `maxTotalValues` stays under 2,100 parameters; one plan serves two run dates and
      two caps; the join to a parent is a LEFT OUTER JOIN.
- [ ] Harness lines this phase makes wrong: in `.claude/skills/dc-engine/SKILL.md` the `autoescape` sentence, the
      `.label(condition_id)` sentence and the two-statements sentence; in `.claude/agents/security-auditor.md` the
      `autoescape` clause. Then `node --test .claude/hooks/tests/*.test.mjs`.

Verify: `/check --tests` · `node --test .claude/hooks/tests/*.test.mjs`
Commit: `feat(engine): compiler with golden tests and compile cache`

### Phase 4: executor, explainer, `/validate` and `/run` (about 2.75 h)
- [ ] `executor/`: count, then page, on one connection; the guards; timeout and error mapping, per Design E.
- [ ] `explainer/`: parts, formats, the rule sentence, reasons, per Design F.
- [ ] `POST /validate` and `POST /run` per Design G.
- [ ] Integration tests per Design I: the six examples with their exact keys and matched ids, example 1 on both
      of its dates; the cap; count and page agree; injection end to end; NULL semantics; LIKE wildcards stay
      literal; Hebrew round trip; the database down.
- [ ] `tests/golden/<id>.text.json`: the rendered sentence, the per-node sentences and one reason per matched node,
      in every language the glossary lists (Hebrew), for the six examples. Kfir reads these at the gate. One test
      asks for a language that is not listed and gets the default.
- [ ] `README.md`, the engine section only (dc-contracts left its heading in the skeleton): what must be installed
      (Python 3.12 or later, ODBC Driver 18 or 17), the start with Python and pip alone and the same with uv, the
      variables of Design A, the tests, and that the timeout path is proven on a fabricated error. Nothing outside
      the section is touched (decision 24).
- [ ] Every command of that section run once as written, in a scratch copy of `engine/` (without `.venv`) and
      `contracts/` with the worktree's `.env` beside them: a venv from `python3 -m venv`, `pip install -r
      requirements.txt` (state the download first), `/health` answers 200 and one example runs. Save the
      transcript as `gates/readme-commands.txt`.

Verify: `/check --tests` · with the service up: `curl -s -X POST localhost:8000/run -H 'content-type:
application/json' -d "{\"definition\": $(jq .definition contracts/examples/minor-high-salary.json), \"runDate\":
\"2026-11-01\"}" | jq '.totalCount, [.violations[].key]'`
Commit: `feat(engine): executor, explainer and the validate and run endpoints`

### Phase 5: suggestions (about 2 h)
- [ ] The profile per Design H: one aggregate SELECT per entity, built in `compiler`, run by `executor`.
- [ ] Generators `missing_required`, `date_order`, `active_under_inactive` (one hop) and
      `active_without_active_children`, per Design H.
- [ ] The pipeline (validate, compile, count, drop, evidence, text, order, cut) and `POST /suggest`.
- [ ] The gate test: every example marked `heuristic: true` has a suggestion whose
      definition equals the example's, node for node, and which flags exactly the example's records.
- [ ] Genericity tests: every generator runs on a synthetic glossary with other entities, fields and
      relationships and a stub counter, and names nothing from the real one.
- [ ] (first cut) `active_under_inactive` over two-hop paths.
- [ ] (first cut) Generator `missing_optional`.

Verify: `/check --tests` · `curl -s -X POST localhost:8000/suggest -d '{}' -H 'content-type: application/json' |
jq '[.items[].name]'`
Commit: `feat(engine): control suggestions from lifecycle, required fields and counts`

### Phase 6: (removed by the scope decision: no LLM lane)

### Phase 7: engine image (about 1 h; the second cut)
- [ ] `engine/Dockerfile`: `python:3.12-slim`, `msodbcsql18` and `unixodbc`, `pip install -r requirements.txt`
      (the file of phase 1), a non-root user, the build context is the repository root (it copies `contracts/` and
      `engine/`), `ENGINE_DB_DRIVER` set to the driver the image installs, the start command of Design A on
      `0.0.0.0:8000`.
- [ ] Smoke (state the build minutes first): build, run on the compose network of `data-controls` with the
      worktree's `.env`, `/health` answers 200 and one example runs. The compose service stays with dc-delivery.

Verify: `docker build -f engine/Dockerfile -t dc-engine .` · the smoke above
Commit: `build(engine): container image`

### Gate
- [ ] `/check all --tests` in the worktree: ruff, pyright, pytest with nothing skipped or deselected, the print
      guard, the hook tests (this branch edits `.claude/`). Save as `gates/final.txt`.
- [ ] The lock and its export agree (`uv lock --check`; `uv export --no-dev --format requirements-txt | diff -
      requirements.txt`), and the Windows wheel check of Design A prints `exit=0` for 3.12, 3.13 and 3.14.
- [ ] The suite once under 3.13 and once under 3.14: `uv run --isolated --locked --python 3.14 python -m pytest`
      (state it first: two more suite runs and the wheels of each version). A failure found here is fixed here.
- [ ] The §19 gate item by item, each with the test that proves it: goldens for the six examples; every
      rejection path; injection values bound; the exact planted ids from the seed; `/suggest` yields examples 2 to
      5 exactly.
- [ ] Kfir reads `tests/golden/*.text.json` and one `/suggest` answer, in Hebrew. The Log says what
      he changed or rejected, in his words where he gave them.
- [ ] `security-auditor` on `git diff origin/main...HEAD` (one agent on opus: state it); fix critical and high.
      The report is saved as `reviews/security.md` and logged per decision 25.
- [ ] One line to the dc-api session: the statement timeout (30 s) and every difference from Design J that phase
      0 recorded.
- [ ] `notes.md` State holds what dc-delivery reads first (its phase B0): the variables as built, the start
      command, the Python versions the suite ran under, which phases were cut, and the "Docs for dc-delivery" list.
- [ ] `/ship dc-engine`. Its docs-drift step proposes edits: apply only those to this task's own files (the
      README's engine section, the engine block of `.env.example`, `.claude/`); every other one joins "Docs for
      dc-delivery". The PR body gets that heading as a fifth section, one line per item: the file and section,
      what it says, what is true now. Push, PR and merge on Kfir's word.

## Design

### A. Layout, configuration, tooling

```
engine/
  pyproject.toml  uv.lock  .python-version  requirements.txt  Dockerfile
  app/
    __init__.py     ENGINE_VERSION (a test compares it with pyproject)
    main.py         create_app(settings=None), lifespan; no app object is built at import
    settings.py     Settings (pydantic-settings; the environment, then the repository's .env), the connection URL
    errors.py       domain exceptions, problem details
    web.py          correlation id, language, request and response models
    routes.py       the six endpoints, plain def
    glossary/  validator/  compiler/  executor/  explainer/  cache/  suggestions/
  tests/
    conftest.py  unit/  golden/  integration/
```

One package per module of §6, each with a small public surface (`.claude/rules/python.md`). SQL, always as
SQLAlchemy Core expressions, exists only in `compiler` and `executor`.

| Variable | Default | Meaning |
|---|---|---|
| `ENGINE_DB_HOST`, `ENGINE_DB_NAME` | `localhost`, `DataControls` | the host goes into `Server=` as written (`db`, `.\SQLEXPRESS`); the login is always `dq_engine_ro` |
| `ENGINE_DB_PORT` | empty | unset or empty: no port in `Server=` (1433 over TCP, or the instance's own protocol); a number: `host,port` |
| `ENGINE_DB_DRIVER` | empty | unset or empty: `ODBC Driver 18 for SQL Server`, else 17, whichever is installed; set: used as written |
| `DQ_ENGINE_RO_PASSWORD` | (the database block) | never logged |
| `ENGINE_PORT` | `8000` | the value the start commands give to `--port`; the app does not read it |
| `ENGINE_ROW_CAP` | `5000` | default and maximum of `rowCap` |
| `ENGINE_QUERY_TIMEOUT_SECONDS` | `30` | per statement |
| `ENGINE_STARTUP_DB_WAIT_SECONDS` | `30` | then exit non-zero |
| `ENGINE_TIME_ZONE` | `Asia/Jerusalem` | the default run date |
| `ENGINE_DEBUG_COMPILE` | `false` | |
| `ENGINE_CONTRACTS_DIR` | `contracts/` beside `engine/` | |
| `ENGINE_LOG_LEVEL` | `INFO` | SQL text only at DEBUG |
| `ENGINE_SUGGEST_MAX` | `10` | default of `max`; the ceiling is 20 |

The default language is the glossary's.

**Connection** (decision 20). The URL is built with `sqlalchemy.engine.URL.create`, never by formatting a string:
`mssql+pyodbc`, the user `dq_engine_ro`, the password, the host as written, the port or `None`, the database, and
the query `driver`, `Encrypt=yes`, `TrustServerCertificate=yes`. `Encrypt` is written out so that drivers 17 and
18 behave alike (17 does not encrypt unless told to); the api's string says the same.

- Port: unset or empty is `None`. A `before` validator turns the empty string into `None`, and `env_ignore_empty`
  stays off, or a port in `.env` would win over an empty variable. Any other value is an integer from 1 to 65535,
  or the engine does not start and the message names the variable.
- Driver: `ENGINE_DB_DRIVER` as written when it is set. Otherwise the first of `ODBC Driver 18 for SQL Server` and
  `ODBC Driver 17 for SQL Server` that `pyodbc.drivers()` lists. When neither is installed, or the first
  connection answers `IM002`, the start ends at once with one log line: the driver asked for and the installed
  ones. Waiting cannot repair it.
- Order: a variable in the process environment wins over `.env`, an empty one included. In `.env` a value with a
  backslash is written without quotes.

**Start command** (decision 23), from `engine/`, the same on every system once a venv exists:
`python -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000`. `create_app()` with no argument
builds `Settings()` itself; tests pass their own. The paths of `.env` and of `contracts/` are resolved from the
location of `settings.py`, never from the working directory.

**Tooling.** `uv sync` creates `engine/.venv`, where the harness expects ruff, pyright and pytest.
`requires-python = ">=3.12"`, and `.python-version` holds `3.12`: without it uv builds the venv on the newest
interpreter it has, which is 3.14 on this machine since planning. Runtime: fastapi, uvicorn (plain, without the
`standard` extra), pydantic-settings, sqlalchemy 2.0.x, pyodbc, jsonschema, tzdata (Windows has no zone
database). Development: pytest, httpx (for `TestClient`), ruff, pyright.
`[tool.uv] package = false`; pytest `pythonpath = ["."]`, marker `integration`, option `--update-goldens`. Ruff:
the block of `linter-followups.md`, line length 120, `target-version = "py312"`, and `PLW1514` added to `select`
with `preview = true` and `explicit-preview-rules = true` (it is a preview rule in Ruff 0.17; the second flag
keeps every other preview rule off). Pyright: `pythonVersion = "3.12"`, `venvPath = "."`, `venv = ".venv"`,
strict on `app/`; if a third-party stub gap costs more than ten minutes, relax the one rule that bites and write
the reason beside it. Versions are pinned by the lock at execution time.

**Portability** (decisions 21 and 22):
- every text file is opened as UTF-8 by name and written with `newline="\n"`; the settings read `.env` with
  `env_file_encoding="utf-8"`;
- paths go through `pathlib` and start from `__file__`;
- no POSIX-only module, signal or `strftime` flag (`%-d` fails on Windows): dates are formatted from their fields;
- no dependency that has to compile on install, which the wheel check proves.

**`requirements.txt` and the wheel check**, in `engine/`:

```
uv export --no-dev --format requirements-txt > requirements.txt
for v in 3.12 3.13 3.14; do
  uv pip compile requirements.txt --python-version $v --python-platform x86_64-pc-windows-msvc \
    --only-binary :all: --no-header -q > /dev/null; echo "$v exit=$?"
done
```

The export goes through a redirect, so the command line in the file's header carries no output flag and a fresh
export by dc-delivery or by the gate compares equal. The project is not a package, so the file has no `-e .`
line. The check exits 1 and names the package when a pinned version has no win_amd64 wheel for that Python; `-o
/dev/null` cannot replace the redirect (uv writes a temporary file beside its output). uv fetches a 3.13 and a
3.14 interpreter for the check where they are missing, about 105 MB each.

Verified at planning, 2026-11-10, on a scratch lock that still held `anthropic`, which is no longer in the list:
the three resolves exit 0 (pyodbc 5.5.0, pydantic-core 2.50.4, sqlalchemy 2.0.57, greenlet 3.5.6 and rpds-py
2026.9.1 among the pins); a control with pyodbc 5.1.0 on 3.14 exits 1; the list imports under 3.13.14 and 3.14.6
on Linux; pip 24.0 accepts the exported file with its hashes and markers (`pip install --dry-run`). SQLAlchemy 2.0.57 turns the host `.\SQLEXPRESS` with no port into
`Server=.\SQLEXPRESS` and `db` with 1433 into `Server=db,1433`, and it braces a password that holds `;` or `}`.
pydantic-settings 2.16.2 behaves as the port bullet says. Nothing was run on Windows.

### B. Glossary and the startup check

- Frozen dataclasses for the glossary, entities, fields, relationships, operators, limits, lifecycle and text
  variants. The loader fails with a clear message on a dangling reference; `scripts/contracts-check.py` is the
  real integrity gate.
- A field's operators: its override, else every operator whose `types` include its type, minus `is_null` and
  `is_not_null` when it is not nullable.
- One `sqlalchemy.Table` per entity, built from the glossary alone (schema, table, and only the columns the
  glossary names: fields, the key, join columns, the source column of a computed field). Types: number `Numeric`,
  text and enum `Unicode`, date `Date`, bool `Boolean`. No database is needed to build them, so unit and golden
  tests run without one.
- Public view (`GET /glossary`): the glossary without `table`, `keyColumn`, `column`, `computed` and `join`,
  hidden fields and entities removed, every field with its resolved `operators`; `lifecycle`, `required`,
  `comparable`, `limits`, `phrases`, `formats` and `suggestions` are served as they are.
- Startup check: one SELECT on `INFORMATION_SCHEMA.COLUMNS` for the schemas the glossary names (a Core `Table`
  for the catalog view, the schema names bound). A missing table or column, or a column whose type family does not
  fit the field's type (number: integer and decimal types; text and enum: character types; date: `date` and
  `datetime2`; bool: `bit`), is `GLOSSARY_MISMATCH` with `table` and `column`: logged, and the lifespan raises, so
  uvicorn exits non-zero.

### C. Validator

`validate_definition(raw, glossary) -> ValidatedDefinition`, or `DefinitionInvalid(errors)` with every error as
`{ code, path, nodeId?, params }`, `path` a JSON Pointer.

1. `schemaVersion` other than 1 is `UNSUPPORTED_SCHEMA_VERSION` and nothing else is checked.
2. Schema layer: `jsonschema` (draft 2020-12) over `contracts/control-definition.schema.json`, every error as
   `SCHEMA_VIOLATION` at its instance location, one per distinct path. Any schema error ends validation here.
3. Semantic layer, walking the tree with a scope (the entity whose fields a node may name):
   - root: `UNKNOWN_ENTITY`, `ENTITY_NOT_ROOTABLE`;
   - field reference: each hop of `path` must exist (`UNKNOWN_RELATIONSHIP`), start at the entity reached so far
     (`PATH_NOT_REACHABLE`) and be many-to-one or one-to-one (`PATH_NOT_TRAVERSABLE`), at most `maxPathHops`
     (`PATH_TOO_LONG`); the field must exist there and be visible (`UNKNOWN_FIELD`);
   - `related`: the relationship must exist, start at the scope entity and be one-to-many
     (`RELATIONSHIP_NOT_QUANTIFIABLE`); its `where` is validated in the scope of the related entity;
   - operator: in the field's resolved operators (`OPERATOR_NOT_ALLOWED`); operand shape against its arity
     (`OPERAND_MISMATCH`);
   - value: number (a JSON number, never a boolean), text, `YYYY-MM-DD` date that exists, boolean, or an enum
     value of the field (`VALUE_TYPE_MISMATCH`, `UNKNOWN_ENUM_VALUE`); `between` low above high is `RANGE_INVALID`;
   - field-to-field: the operator is `fieldComparable` and neither field is `comparable: false`
     (`FIELD_COMPARISON_NOT_ALLOWED`); the two types are equal (`FIELD_TYPE_MISMATCH`);
   - whole tree: `TOO_DEEP`, `TOO_MANY_CONDITIONS`, `TOO_MANY_VALUES` (per list and in total), `DUPLICATE_NODE_ID`,
     with the definitions of depth and count that `contracts/errors.md` gives.
4. Output: the resolved tree. `VGroup(op, children)`, `VCondition(id, field, operator, operand, path)`,
   `VRelated(id, relationship, quantifier, where, path)`; a resolved field holds its relationships and the
   glossary field; an operand is nothing, a typed value (`int`, `Decimal(str(v))`, `date`, `bool`, `str`), a tuple
   of values, or another resolved field. The compiler trusts it and validates nothing again.

### D. Compiler

**Statement shape.**

```
inner   SELECT e0.<key> AS k, <identifying columns> AS d0.., <actual columns> AS a0..,
               CASE WHEN <predicate of node i> THEN 1 ELSE 0 END AS t0..
        FROM <root> AS e0 LEFT OUTER JOIN <parent> AS j1 ON ..        one alias per distinct path prefix
        WHERE <predicate of the root group>
page    SELECT TOP (cap) q.k, q.d*, q.a*, CASE WHEN <matched(i) over q.t*> THEN 1 ELSE 0 END AS m0..
        FROM (inner) AS q ORDER BY q.k
count   SELECT COUNT(*) AS total, SUM(CASE WHEN <matched(i) over q.t*> THEN 1 ELSE 0 END) AS m0..
        FROM (inner, without d* and a*) AS q
```

- Nodes with a truth column, and so with a count and a place in `matched`: conditions outside any `related`
  sub-tree, and `related` nodes. `matched(i)` is `t_i = 1` and the truth of every group between the node and the
  root, the root excluded (the WHERE already holds), each group's truth written over the `t` columns of its
  children. No caller value appears in the outer statements.
- A `related` node is `EXISTS` (any) or `NOT EXISTS` (none) over the related table under its own alias,
  correlated on the join columns, its `where` compiled in that scope with its own joins; nesting is allowed.
  Conditions inside it get no truth column.
- An actual column per condition whose reason shows a value (the left column, and the right one in a field
  comparison), one per distinct alias and column.
- The compiler asserts the parameter count is under 2,000; `maxTotalValues` makes that hold.

**Operators** (closed map; `c` is the left column, `p` a bind or the right column):

| Keys | Expression |
|---|---|
| `eq`, `ne`, `lt`, `lte`, `gt`, `gte` | `c == p`, `c != p`, `c < p`, `c <= p`, `c > p`, `c >= p` |
| `between`, `not_between` | `c.between(p1, p2)`, `~c.between(p1, p2)` |
| `in`, `not_in` | `c.in_(bindparam(expanding=True))`, `c.not_in(..)` |
| `contains`, `not_contains`, `starts_with`, `ends_with` | `c.contains(p, escape="/")`, its negation, `c.startswith(..)`, `c.endswith(..)`, the operand escaped first |
| `is_null`, `is_not_null` | `c.is_(None)`, `c.is_not(None)` |
| `is_empty`, `is_not_empty` | `c IS NULL OR c = ''`, `c IS NOT NULL AND c <> ''`, the empty string a bind |

SQL's three-valued logic gives the contract's NULL rule with no extra code: a comparison with NULL matches
nothing, the negative operators included. The LIKE escape doubles `/` and prefixes `%`, `_` and `[` with `/`.
Numbers bind as integers when whole and as `Decimal` otherwise; text as `Unicode`; dates as `Date`.

**`age_years`** (`S(n)` is the run date minus `n` years, 29 February becoming 28, clamped to the range of DATE;
`c` is the birth-date column; age is whole, so a fractional operand is rounded as the comparison requires):

| Operator | Predicate |
|---|---|
| `lt v` | `c > S(ceil(v))` |
| `lte v` | `c > S(floor(v) + 1)` |
| `gt v` | `c <= S(floor(v) + 1)` |
| `gte v` | `c <= S(ceil(v))` |
| `eq v` | `c <= S(v) AND c > S(v + 1)`; false when `v` is not whole |
| `ne v` | `c > S(v) OR c <= S(v + 1)`; `c IS NOT NULL` when `v` is not whole |
| `between a b`, `not_between a b` | `gte a AND lte b`, `lt a OR gt b` |
| `in`, `not_in` | the `OR` of `eq`, the `AND` of `ne` |

The actual value is `run.year - birth.year`, minus one when the run date's (month, day) is before the birth
date's. Example 1 on 2026-11-01 is `birth_date > 2008-11-01`, which is what the oracle of dc-contracts computes.

**Plan and cache.** `CompiledPlan` holds the two `Select` objects without a limit, the parameter recipes, the
column map (alias to display field, to actual, to node) and the validated definition. The cache maps
sha256(canonical definition JSON + glossary version + engine version) to a plan: 256 entries, least recently used
out, behind a lock. It never holds a result. The cap is applied per run with `.limit(cap)` on a copy.

**Verified at planning on SQLAlchemy 2.0.57** (a scratch script, not kept): `.limit(5000)` renders
`TOP __[POSTCOMPILE_param_1]` and a bound limit renders a `ROW_NUMBER()` wrapper; `mssql.dialect()` without a
driver compiles named placeholders (`:p0`); `autoescape=True` turns `50%` into `50/%` and leaves `[a-z]` as it is;
`~between`, `not_in` and `~contains` render `NOT BETWEEN`, `NOT IN` and `NOT LIKE`; `col == False` renders `= 0`
with no parameter; the constants of a `CASE` are parameters.

### E. Executor

- `count_compiled(plan, run_date)` and `run_compiled(plan, run_date, cap)`: one connection, the count statement
  first, then the page. Suggestions use the count alone.
- Guards before anything is sent: the statement is a `sqlalchemy.sql.Select` that came from a `CompiledPlan`, and
  its compiled text holds no `;`. A failure is `INTERNAL_ERROR` and nothing runs.
- Timeout: a `connect` event sets `dbapi_connection.timeout`; the login timeout goes in `connect_args`.
  `pool_pre_ping=True`.
- Mapping by SQLSTATE: `HYT00` and `HYT01` to `QueryTimeout(timeoutSeconds)`; `08xxx`, `28000` and a missing
  driver (`IM002`) to `DatabaseUnavailable`; anything else to `InternalError`. The driver's message is logged
  with the correlation id and never returned. At startup `IM002` ends the start instead (Design A).
- Count and page run at the default isolation level. `hr` is never written by the system, so they agree; on a
  database written concurrently they could differ by the rows changed in between (a documented limitation).

### F. Explainer

- A part is `{ text, nodeId?, role? }`. A template is split at its placeholders: template text gives parts with
  no role, a placeholder gives a part with the role of the contract (`field`, `value`, `actual`, `other`,
  `otherActual`, `relationship`); a list gives one part per value with the separator between them. Every part of
  a node's clause carries its `nodeId`; joining words and brackets carry none. The string is the join of the parts.
- Variant lookup per dc-contracts Design B: `<type>.field`, `field`, `<type>`, `default`.
- Values: dates by `formats[language]` (tokens `dd`, `MM`, `yyyy`, filled from the date's fields, never through
  `strftime`), numbers with grouping and trailing zeros trimmed (no `locale`), enum and bool values by their
  labels, a field on a path through `fieldOnPath`. Whether a unit is shown is whatever `contracts/errors.md` says.
- Rule sentence: the root group rendered recursively with `and`, `or`, `groupOpen` and `groupClose`; a `related`
  node through `relatedAny` or `relatedNone` with its sub-tree as `{conditions}`.
- `conditions[]`: the nodes that can be matched, in document order, each with `sentence`, `sentenceParts` and, in
  `/run`, `count`.
- A violation: `key` as a string, `display` (the root's identifying fields as JSON scalars: a `Decimal` as a
  number, a date as `YYYY-MM-DD`), `matched` in document order, one reason per matched node (`conditionId`,
  `reasonKey`, `params`, `text`, `textParts`), and `reasonText` joined with `reasonSeparator`.
- No row value and no rendered reason is ever logged.

### G. HTTP surface and errors

| Method and path | 200 | Errors |
|---|---|---|
| `GET /health` | `{ status, database, glossaryVersion, engineVersion }` | 503 `DATABASE_UNAVAILABLE`, 503 `GLOSSARY_MISMATCH` |
| `GET /glossary` | the public view | |
| `POST /validate` | `{ valid: true, sentence, sentenceParts, conditions }` | 422 `DEFINITION_INVALID` |
| `POST /run` | `{ runDate, totalCount, returnedCount, capExceeded, durationMs, engineVersion, glossaryVersion, sentence, sentenceParts, conditions, violations }` | 422, 504 `QUERY_TIMEOUT`, 503 |
| `POST /suggest` | `{ items: [{ name, description, rationale, evidence, definition, sentence, sentenceParts }] }` | 503, 504 `QUERY_TIMEOUT` |
| `POST /debug/compile` | `{ sql, params, countSql, countParams }` | 404 `DEBUG_DISABLED`, 422 |

- Routes are plain `def`. Request models are Pydantic with unknown keys forbidden; `runDate` defaults to today in
  `ENGINE_TIME_ZONE`; `rowCap` is an integer of at least 1, clamped to `ENGINE_ROW_CAP`; `max` is clamped to 20.
- Every error is problem details (`application/problem+json`): `{ type: "about:blank", title: <code>, status,
  code, params, errors?, correlationId }`. Handlers for `RequestValidationError` (400 `REQUEST_INVALID`),
  Starlette's `HTTPException` (404 and 405 as `NOT_FOUND`), the domain exceptions, and `Exception` (500
  `INTERNAL_ERROR`). No prose, no traceback, no SQL, no driver message.
- `X-Correlation-Id` is read or created, returned, and put on every log record through a context variable.
- Language: the primary subtag of the first range of `Accept-Language` when the glossary's `languages` list it,
  else `defaultLanguage`. The list holds `he` alone, so every answer is Hebrew; the code names no language.

### H. Suggestions

**Profile.** Per entity one aggregate SELECT: the row count and, per visible field, the null count, for text the
empty count, the distinct count, and for number and date fields that are not identifying fields the minimum and
maximum. The generators read typed `Profile` objects and the glossary, nothing else.

**Generators** (each returns candidate definitions; ids are `c1..` and `r1..` in document order; fields in glossary
order; a single-child OR collapses; the root is always a group). "Active" is `lifecycle.field eq lifecycle.active`;
"inactive" is `eq` the other value when the field has exactly two (a bool, an enum of two), else `ne` the active
value. "Missing" is `is_empty` for text and `is_null` for every other type.

| Kind | For | Candidate | Reproduces |
|---|---|---|---|
| `missing_required` | an entity with a `required` field | `OR(` each `always` field missing `, AND(active, OR(` the `active` fields missing `)), AND(inactive, OR(` the `inactive` fields missing `)))` | example 4 |
| `date_order` | two visible, stored date fields of one entity | both orders are counted; when at least 5 rows hold both, one order holds in at least 80% of them and the other in at least one row: `AND(later lt field earlier)` | example 2 |
| `active_under_inactive` | a many-to-one relationship (later: a two-hop path) whose two ends have a `lifecycle` | `AND(active, path › parent inactive)` | example 3 |
| `active_without_active_children` | a one-to-many relationship whose two ends have a `lifecycle` | `AND(active, none of the relationship where AND(child active))` | example 5 |
| `missing_optional` (first cut) | a nullable field without `required`, missing in at most 10% of rows and at least one | `AND(field missing)` | |

The two numbers of `date_order` and the one of `missing_optional` are tuning constants of the generator, named in
its module. They are not rule parameters: no generator invents a threshold that ends up inside a definition.

**Pipeline.** Candidates in the order of the table, then of the glossary; each is validated, compiled and counted
(today's run date); a candidate that fails validation is dropped with a warning (a generator bug); one that flags
no record is dropped; evidence is attached (`violations_found` always, `field_missing` per field of a
`missing_required` item, `date_order_split` for `date_order`); name, description, rationale and evidence text are
rendered from `suggestions` in the glossary, the sentence by the explainer; the list is cut to `max`. `rootEntity` keeps the candidates rooted there.

### I. Tests

**Seams** (confirmed with this plan; the `/tdd` loop works at these and nowhere deeper): the validator as a
function (definition to codes and paths); the compiler as a function (definition and glossary to SQL text and
parameters); an endpoint through `TestClient`; the executor against the seeded database; the suggestion pipeline
with a stub counter; the connection settings as a function (the variables and the list of
installed drivers to the ODBC connection string).

**Goldens**: `tests/golden/<example id>.page.sql`, `.count.sql` and `.params.json`, compiled with
`mssql.dialect()` (named placeholders), parameters as name, type and value. `--update-goldens` rewrites them; the
diff is reviewed and committed with the compiler change. They are read and written as UTF-8 with `\n` line ends.

**Connection settings** (no database and no driver: the string is what `dialect.create_connect_args(url)`
returns, and the driver list is passed in): `db` with 1433; a host alone; `.\SQLEXPRESS` and
`lpc:(local)\SQLEXPRESS` with no port, unchanged; an unset and an empty port are the same; `abc` and `0` stop the
start with a message that names the variable; a driver that is set is used as written; unset picks 18 before 17,
17 when it is alone, and fails with the installed names when neither is there; a password with `;` and `}` arrives
whole and appears in no log line and in no `repr`; `.env` is read as UTF-8.

**Invariants** (on the six examples and on a few dozen definitions generated from the glossary): the statement is
a `Select`; the text has no `;`; no node id, operand value or other caller string occurs in the text; every table
and column in the text is one the glossary names.

**The gate, test by test**:

| Gate item (§19) | Test |
|---|---|
| goldens for the six examples | `tests/golden/`, parametrized over `contracts/examples/*.json` |
| every rejection path | `contracts/examples/invalid/*.json` plus one test per remaining code and per limit |
| injection values bound | `'; DROP TABLE hr.Employee; --` and friends in `value`, `values` and LIKE operands: only in the parameters, zero rows returned, the row count of the table unchanged; a key or an id carrying SQL is rejected by the schema |
| the exact planted ids | every example through `POST /run` with its `runDate`: `totalCount`, the keys in order, `matched` per record; example 1 also on its alternate date |
| `/suggest` yields examples 2 to 5 | phase 5's gate test over the examples marked `heuristic: true` |

**Also**: `rowCap: 1` on the missing-data example gives the full `totalCount`, one row, `capExceeded` and counts
over all violations; for every example the sum of `matched` over the rows equals `conditions[].count`; a negative
operator does not match a NULL; `is_empty` matches NULL, the empty string and spaces; a `contains` of `%`, of `_`
and of a bracket class built from the first letters of two seeded names returns no row; a name read from one run's
`display` and used as an `eq` operand finds its record (Hebrew survives the bind; the test source stays English);
a root record with no parent is still flagged through an OR branch; with the database port closed `/health` and
`/run` answer 503 `DATABASE_UNAVAILABLE`; the timeout mapping is tested on a fabricated driver error, because a
read-only login has no way to run a slow statement. Integration tests fail when the database is down; they never
skip.

### J. What this plan assumes about `contracts/` (phase 0 checks each line)

- Glossary: top-level `glossaryVersion`, `languages`, `defaultLanguage`, `limits` (`maxDepth`, `maxConditions`,
  `maxListValues`, `maxPathHops`, `maxTotalValues`), `formats`, `phrases`, `operators`, `entities`,
  `relationships`, `suggestions { kinds, evidence }`. Entity: `key`, `table { schema, name }`, `keyColumn`,
  `label`, `rootable`, `visible`, `identifyingFields`, `fields`, `lifecycle { field, active }`. Field: `key`,
  `type`, `column` or `computed`, `nullable`, `visible`, `operators`, `unit`, `enumValues`, `valueLabels`,
  `required`, `comparable`. Relationship: `key`, `from`, `to`, `cardinality`, `join { fromColumn, toColumn }`,
  `label`. Operator: `key`, `arity`, `types`, `fieldComparable`, `label`, `sentence`, `reason`.
- Examples: `{ id, name, description, runDate, definition, expected { total, violations: [{ key, matched }] },
  alternateRuns?, heuristic? }`; `invalid/*.json` as `{ layer, expected { code, path }, definition }`.
- `api.md`: the engine table of Design G, parts included; `conditions[]` lists the nodes that can be matched.
- `errors.md`: the codes, the definition error codes with their params, the reason keys, the evidence keys, the
  part roles, the definitions of depth and count, the rendering rules.

## Risks

- **`contracts/` differs from Design J**, or an amendment did not land. Phase 0 compares before any code; the
  engine follows `contracts/`, and a real gap is a contract change on main with one line to the other sessions.
- **The ODBC driver on the host**: `msodbcsql18` is installed since 2026-11-10. Should it go missing, nothing in
  phases 1 to 5 that touches the database runs; the fallback is the image first (phase 7) and pytest inside it.
- **Windows is never run in this task**: the host has no Windows Python. What this task proves is the wheel
  resolve, the UTF-8 rule, the connection-string tests and the suite under 3.13 and 3.14 on Linux. dc-delivery
  writes the from-source path for Windows and runs it on Linux; `Encrypt=yes` with driver 17 over shared memory
  stays untried, and the limitations document says so.
- **`PLW1514` is a preview rule** (Ruff 0.17.4 on 2026-11-10). If the Ruff in the lock has dropped or renamed it,
  the rule becomes a unit test that walks `app/` and `tests/` with `ast`; it is never dropped silently.
- **A reproduced example drifts**: if dc-contracts reshapes the definition of example 2, 3, 4 or 5, or the seed
  breaks the 80% rule of `date_order`, the gate test goes red. The conventions of Design H are in its Design H1.
- **Hebrew through pyodbc**: a `String` bind goes through the code page. Columns are `Unicode`, and the round-trip
  test of Design I is the proof.
- **The 2,100-parameter cap**: guarded by `maxTotalValues`, the compiler's assertion and a test at the limit.
- **The timeout path is proven only on a fabricated error.** Say so in the README and at the gate.
- **Three suites on one machine**: pytest here, `dotnet test` and `ng test` in the other worktrees. `pgrep` first.
- **Port 8000** may be held by another project's container: `ENGINE_PORT`, and ask before stopping anything.
- **Wording**: the templates are dc-contracts'; the engine renders them mechanically. Kfir's read at the gate is
  the last cheap moment; a wording change after it is a glossary commit on main.
- **Time**: the cut order of decision 4. Record every cut in `notes.md` with what dc-delivery must say about it.
  Decisions 20 to 23 add about three quarters of an hour to phases 1 and 4 and three steps to the gate, and none
  of that is on the cut list.

## Out of scope

- The engine's compose service, the manual-path instructions, and every document except the README's engine
  section (dc-delivery, decision 24).
- A variable that holds a whole connection string; Windows authentication for the engine.
- An LLM step in the suggestions, English texts, a wheelhouse to ship (the scope decision).
- The api and the client; storing results; paging over stored results.
- Thresholds, ranges or any rule parameter in the glossary; suggestions built on percentiles or outliers.
- Field-to-field comparisons that involve a computed field; relative values such as "today" in a definition.
- Authentication, asynchronous runs, metrics, tracing.
