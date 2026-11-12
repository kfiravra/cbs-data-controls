# dc-contracts: repo skeleton, database and contracts
Created: 2026-11-10 · Branch: feat/contracts (cut from main at 2303d2f, which is pushed)

## Goal

After this task a clean machine runs `docker compose up -d db && scripts/db-init.sh` and gets the `DataControls`
database: schema `hr` seeded in Hebrew with planted violations, schema `dq` empty, and two logins that can each do
only their own job. `contracts/` holds the definition schema, the glossary, six example controls with the exact
records each must flag, both HTTP APIs and the error catalogue. The engine, api and web tasks then start in three
worktrees and build against `contracts/` without talking to each other, so everything they must agree on is decided
here. Nothing else starts before this gate, and the submission is due 2026-11-15: the budget for this task is one
working day.

## Decisions

From the interview (Kfir, 2026-11-10):

1. **Run date**: the seed uses absolute dates and every example carries `runDate: "2026-11-01"`. Rows are planted so
   each example flags the same records on any run date from 2026-11-01 to 2027-12-31 (planted minors are born
   2010-01-01 or later; the boundary employee is born 2008-11-01). Example 1 also carries an alternate expected set
   for 2026-10-31, when that employee is still 17. (UI runs use today and must match the docs; rejected: dates
   relative to the init day, which hold only when the run day is the init day.)
2. **Examples 5 and 6**: `department-without-active-employees` (root Department, one-to-many `none`) and
   `inactive-ministry-salary-out-of-range` (root Employee, two-hop path, nested OR). (With examples 1 to 4 they use
   every node type, both relationship kinds and two root entities; rejected: a manager example, a nested-related one.)
3. **Reason and rule-sentence text has one source, the glossary.** The engine renders it; `he.json`
   holds screen and error text only. (Rejected: `reasons.*` keys in the i18n files as §5.1 and §8 say; two copies drift.)
4. **"No department" is a glossary field, not a new node kind**: a visible employee field `department_assignment`
   (column `department_id`, label "שיוך למחלקה", operators only `is_null` and
   `is_not_null` through the §4.3 override). §5 does not change and the compiler needs nothing new. (Kfir's design;
   rejected: a `related` node on a many-to-one relationship, a NULL check on the department's name.)
5. **Expected sets list the matched condition ids per record**, and db-check's hand-written SQL prints the same.
6. **Seed names**: real ministry names, with the dissolved Development Ministry as the inactive one; invented people.
7. **Three harness edits ride in this task**: `/task-plan` reads `dc-*/SKILL.md` by file, pkgmap gets a
   `contracts-check` row, and CLAUDE.md allows Hebrew control names in `contracts/examples/` as data.

Contract design settled here, inside the architecture:

8. **Matched means contributing**: a condition or related node is matched for a record when it is true and every
   group above it up to the root is true. A true condition on a failed AND branch is not a reason. Conditions inside
   a `related` sub-tree are never matched; the related node itself is.
9. **Record keys are strings** (`"1051"`) in both APIs, in `dq.RunResult` and in the examples, so a non-integer key
   needs no contract change.
10. **JSON Schema draft 2020-12, conservative subset**: `$defs`, `$ref`, `oneOf`, `const`, `enum`, `if`/`then`,
    `pattern`, `minItems`/`maxItems`, `additionalProperties: false`. Python `jsonschema`, JsonSchema.Net and ajv all
    support it.
11. **Limits live in the glossary** (`limits`: depth 4, 30 conditions, 100 list values, 2 hops), because depth and
    total count cannot be expressed in the schema. The schema repeats the two it can express and the contracts check
    asserts they agree.
12. **Operator text model**: each operator has `label`, `sentence` and `reason`, each with variants (`default`,
    `<type>`, `field`, `<type>.field`), so Hebrew can say "לפני" for dates and "מתחת ל־" for numbers. No text
    agrees with the gender of the field: comparisons use prepositions, the rest a colon style ("{field}: {value}",
    "שכר: חסר"). (Kfir's final wording at the Gate read; the first version said "מוקדם מ" and "קטן מ".)
13. **The engine returns everything rendered** (rule `sentence`, a `sentence` per condition, a `text` per reason,
    `reasonText`), so no client has to render. Re-rendering from the served templates is allowed, never required.
14. **`hr` carries structural constraints only** (keys, FKs, the status domain) and explicit ids without IDENTITY.
    The business rules are what the controls detect, so the database must not enforce them.
15. **`dq` adds three columns to §4.2**: `Run.summary` (JSON: rule sentence, per-condition sentence and count),
    `RunResult.seq` (stable page order) and `RunResult.display_text` (search and sort). The results screen never
    calls the engine, so the breakdown has to be stored with the run.
16. **A new `ControlVersion` is written only when the definition hash changes**; a name or description edit keeps
    the version.
17. **Compose holds `db` and `db-init` only**, with `name: data-controls` and the port bound to 127.0.0.1. The
    engine and api services arrive with dc-delivery (§19 task 5).
18. **`scripts/db-init.sh` is the one init implementation**. The `db-init` container runs it; on a host it wraps
    `docker compose run --rm db-init`; a host with `sqlcmd` and `DB_HOST` set runs the scripts directly. It refuses
    to run in a linked worktree. Seed inserts are keyed, so a changed seed row needs `--reset`, which drops the
    database and with it every session's `dq` rows.
19. **`scripts/db-check.sh` is the oracle**: one hand-written SELECT per example in `sql/checks/`, run as
    `dq_engine_ro` and compared with the example's expected set. It shares no code with the engine.
20. **The contracts check is Python run by uv** (`uv run scripts/contracts-check.py`, `jsonschema` pinned inline).
    (The same validator library the engine will use; rejected: Node and ajv, which need a root `package.json`.)
21. **`contracts/examples/invalid/`** holds about twelve definitions that must be rejected, each with its layer,
    expected code and JSON pointer. (An accept-everything schema would also "validate the six examples"; the same
    files feed the engine's and the api's rejection tests.)
22. **Three API shapes differ from the architecture's wording**: validation is `POST /api/v1/controls/validate`
    without an id (a new control has none); the debug endpoint is `POST /debug/compile` (it carries a definition);
    starting a run answers 201 with the run even when the run failed (the failure is its `status` and `error`).
23. **`.env.example` has three blocks** (database, engine, api). This task fills only the database block, so the
    parallel tasks edit separate regions of the file.
24. **No `department.manager` relationship in v1**; `manager_employee_id` is exposed as `manager_assignment`, the
    same pattern as decision 4. (A cyclic relationship no example uses; adding it later is the glossary-only change
    that `docs/glossary.md` will demonstrate.)
25. **`docs/architecture.md` is aligned, not trimmed**: only the lines that decisions 3, 8, 12, 15 and 22 change,
    in the commit that changes the contract. `contracts/api.md` states that it wins where the two differ.

From the planning of dc-engine (Kfir, 2026-11-10; the shapes are in Design H, which wins where it differs from B to F):

26. **The glossary carries what the suggestion generators need and no rule parameters**: `lifecycle` per entity,
    `required` per field, and the text of suggestions and of their evidence. The engine must
    reproduce examples 2, 3, 4 and 5 from them. Example 1's thresholds (18 and 15,000) are business knowledge: no
    generator invents them, and they stay out of the glossary. (Rejected: `range` declarations; profiling only.)
27. **Sentences and reasons are also returned as parts** (`sentenceParts`, `textParts`), because a single string
    cannot carry the condition marks that `docs/design.md` asks for. The engine stays the only renderer (decision 13).
28. **`limits.maxTotalValues` (500) and a `comparable` field flag.** SQL Server accepts 2,100 parameters per
    statement and the engine binds every value twice; a computed field has no column to compare with another field,
    and the public glossary hides `computed`, so the editor needs the flag.
29. **Four clarifications**: node types by `if`/`then` instead of `oneOf`; depth and condition count defined; which
    nodes `conditions[]` lists; `/debug/compile` returns both statements.

From the planning of dc-web (Kfir, 2026-11-10, given with the word to execute):

30. **The Hebrew date pattern is `dd.MM.yyyy`** (`formats.he.date`). (The `en` format went with the English values:
    decision 37.)
31. **Identifying fields are name first**: employee `first_name`, `last_name`, `employee_number`; department `name`,
    `department_number`. `display_text` is those values joined by one space, in that order.

From the review of the branch (2026-11-10; made by the orchestrator while fixing findings, open to Kfir's objection
at the Gate read):

32. **A number field may be marked `identifier: true`** (employee and department numbers, the two assignment
    fields): it names a record and is written digit for digit, never with a thousands separator, which is also how
    `display_text` holds it. (A meaning the glossary carries; rejected: a client that special-cases field keys.)
33. **The two related `sentence` phrases bracket `{conditions}`**, so a condition that follows a related node cannot
    be read into it. The renderer still adds no bracket of its own, and the reasons are unchanged.
34. **`is_null` says "חסר" for every type**; "ריק" is the word of `is_empty` alone. A
    bool's value labels agree with the field label before the colon ("סטטוס: פעיל"), not with the entity.
35. **Passwords reach sqlcmd through the environment**, never on a command line, and `.env.example` holds none.
36. **`NETWORK_ERROR` is a client-derived code** in `errors.md`, beside `ROW_CAP_EXCEEDED`; `REQUEST_INVALID` also
    answers 413 and 415; `page` is 1 to 1,000,000; a number literal stays below 10^15; a `definition` that is not a
    JSON object is a malformed request (400), not a schema violation.

Scope decision (Kfir, 2026-11-10, after the review and before the push; carried by this session through
`contracts/`, `docs/`, `.claude/` and the five plans):

37. **Hebrew only.** The language mechanism stays as designed: texts keyed by language, `languages` and
    `defaultLanguage` in the glossary, `Accept-Language`, the run's language. Only the English values went:
    `languages` is `["he"]`, every text is an object with the one key `he`, `formats` holds `he` alone, and the
    examples carry Hebrew names and descriptions. A request for a language that is not listed gets the default.
    No `en.json`, no language switch, no English test or screenshot.
38. **Suggestions are heuristics only.** No LLM lane and no contract member that existed only for it: the
    `source` member of `/suggest` and the keyed timing are gone. `docs/architecture.md` §6 keeps the LLM step as a
    design that is not built.
39. **Delivery has two paths**: Docker, and short from-source instructions. The offline Windows bundle is gone
    from the delivery plan and from every plan that served it.
40. **Web screenshots at 390 and 1440 only.**

Not touched by 37 to 40, on purpose: `README.md` (Kfir's word), `sql/` (the `language` column still accepts `he`
and `en`), `dev/briefs/`, the notes of the other four tasks.

Execution (Kfir, 2026-11-10): the whole task in one run on Fable, three Opus lanes (phase 1; phase 2; the phase 4
documents) beside the orchestrator's phase 3, no per-phase review, one review over the whole branch at the end,
then the Gate, the push and the PR. No merge.

## Phases

Every phase ends the same way: tick the steps as they finish, `/check --tests`, save the verify output under
`gates/phase-N.txt`, `/phase-review` for the areas named, one `fix(<scope>): review fixes` commit, a Log line in
`notes.md`. State the spend before `docker compose pull`, before a review fan-out and before anything else that
costs minutes, then wait for the word. The Design section below is the specification each step builds from.

### Phase 0: path-scoped skills in the harness
- [x] `.claude/skills/task-plan/SKILL.md` line 20: replace "Call the Skill tool with the matching domain skill" by
      an instruction to read `.claude/skills/dc-<area>/SKILL.md` with the Read tool, and say why (a skill with
      `paths:` cannot be loaded through the Skill tool before a file of its area is touched).
- [x] `.claude/README.md` line 18: "or on demand" becomes "or by reading the file".

Verify: `node --test .claude/hooks/tests/*.test.mjs`
Commit: `chore(claude): read path-scoped dc skills by file in task-plan` (no review: two lines of text)

### Phase 1: skeleton and database structure
- [x] Root files: `.gitattributes` (`* text=auto eol=lf`, so `.sh` and `.sql` survive a Windows checkout),
      `.editorconfig` (UTF-8, LF, final newline; 2 spaces, 4 for `.py`, `.sql`, `.cs`), and the build and cache
      folders of all three stacks in `.gitignore`, so the parallel tasks do not each edit it.
- [x] `.env.example` per Design A, and a local `.env` copied from it (ignored by git).
- [x] `docker-compose.yml` per Design A.
- [x] `scripts/db-init.sh` per Design A (executable).
- [x] `sql/00_database.sql`, `10_schemas.sql`, `20_hr_tables.sql`, `30_dq_tables.sql`, `40_logins.sql`,
      `50_indexes.sql` and `sql/cleanup_runs.sql` per Design A and `.claude/rules/sql.md`.
- [x] `scripts/db-check.sh` with the sections `structure` and `permissions` per Design A (executable).
- [x] `README.md` skeleton: the §17 headings, the database quick start, the repository map, and one line per later
      section naming the task that fills it. `sql/README.md`: script order, what each script creates, the two
      logins, `--reset`, and running the scripts by hand in SSMS (SQLCMD Mode for the password variables).
- [x] `.claude/skills/dc-sql/SKILL.md`: correct the facts this phase changed (the fixed compose project name,
      `--reset`, the worktree refusal inside the script).

Verify:
```
docker compose pull db                          # about 1.6 GB on disk the first time: say so and wait
docker compose up -d db && scripts/db-init.sh
scripts/db-init.sh                              # second run changes nothing and exits 0
scripts/db-check.sh                             # structure and permissions pass
```
Review: `/phase-review sql infra`
Commit: `feat(sql): database skeleton, hr and dq schemas, two logins`

### Phase 2: definition schema and glossary
- [x] `contracts/control-definition.schema.json` per Design C.
- [x] `contracts/glossary.json` per Design B, with a text per language for every label and template (Hebrew alone
      since decision 37).
- [x] `scripts/contracts-check.py` per Design G, checks 1 to 3.
- [x] pkgmap: a `contracts-check` row in the default column for `contracts/**` and `scripts/contracts-check.py`,
      with a skip line when `uv` is missing. Update `pkgmap.test.mjs` (the "contracts prose -> nothing" case
      changes), the matrix and `allowed-tools` in `.claude/skills/check/SKILL.md`, the map in `.claude/README.md`
      and the Verify list in CLAUDE.md.
- [x] `scripts/db-check.sh` section `glossary`: every table and column the glossary names exists in
      `INFORMATION_SCHEMA` as `dq_engine_ro` sees it. One static query dumps the columns and jq compares the sets;
      no SQL is built from the glossary.
- [x] Amendments per Design H1, H3 and H4a: `lifecycle`, `required`, `comparable`, `limits.maxTotalValues` and the
      `suggestions` block in the glossary; node types by `if`/`then` in the schema; checks 2 and 3 extended.
- [x] Design I1 for the schema: a member that is not allowed is `false` under `properties` or falls to
      `additionalProperties: false`; no `not`, `anyOf` or `oneOf` anywhere, and check 1 fails on any of the three.
- [x] `docs/architecture.md` §4.3: the operator text model, `limits`, and `lifecycle`, `required` and `comparable`
      (decisions 11, 12, 26 and 28).

Verify: `uv run scripts/contracts-check.py` · `scripts/db-check.sh` · `node --test .claude/hooks/tests/*.test.mjs`
Review: `/phase-review engine api web infra` (the glossary and the schema are read by all three services)
Commit: `feat(contracts): definition schema and business glossary`

### Phase 3: seed, examples and the oracle
- [x] `sql/60_seed_hr.sql` per Design D: one transaction, keyed inserts, a `-- PLANTED <example-id>: …` or
      `-- BOUNDARY <example-id>: …` comment above every row an example must or must not flag.
- [x] `contracts/examples/<id>.json`, six files per Design D, expected sets taken from the PLANTED comments.
- [x] `sql/checks/<id>.sql`, six hand-written SELECTs per Design D that return the key and one contributing flag
      per condition id.
- [x] `scripts/db-check.sh` sections `hebrew` (no `?` in a seeded name, first letters in the Hebrew block) and
      `examples` (prints key, name and matched ids per violating record; fails on any difference from the example
      file; runs example 1 on both of its dates).
- [x] `scripts/contracts-check.py` check 4 and `--render` per Design G.
- [x] `sql/README.md`: the planted and boundary rows per example, and the stability window of decision 1.
- [x] CLAUDE.md: the Hebrew gotcha names `contracts/examples/` (control names are data), per decision 7.
- [x] Design H1 for the examples and the seed: `heuristic: true` on examples 2 to 5, the seed sanity lines in
      `sql/README.md`, check 4 accepting the key.

Verify:
```
docker compose down -v                          # the git guard asks: it deletes the seeded database
docker compose up -d db && scripts/db-init.sh
scripts/db-check.sh                             # all five sections pass, six examples match
uv run scripts/contracts-check.py
```
Review: `/phase-review sql engine`
Commit: `feat(sql): hebrew seed with planted violations and six example controls`

### Phase 4: HTTP APIs and error catalogue
- [x] `contracts/errors.md` per Design F, in the strict table format the check parses.
- [x] `contracts/api.md` per Design E.
- [x] `contracts/examples/invalid/*.json` per Design F, and check 5 in `scripts/contracts-check.py`.
- [x] Harness lines for decision 3: `.claude/rules/typescript.md` line 21, `.claude/skills/dc-web/SKILL.md` lines
      45 and 68, `.claude/skills/ship/SKILL.md` line 29 (reason text comes from the glossary, not from i18n).
- [x] CLAUDE.md "Where to read": rows for `contracts/api.md`, `contracts/errors.md` and `sql/README.md`. The file
      must stay at or under 100 lines (an infra test enforces it; it has 94 today).
- [x] Design H in `contracts/api.md` and `contracts/errors.md`: parts (H2), the evidence keys (H1), the params of
      `TOO_MANY_VALUES` and `FIELD_COMPARISON_NOT_ALLOWED` (H3), depth and count, `conditions[]` and
      `/debug/compile` (H4b to H4d).
- [x] Design I in `contracts/api.md`, `contracts/errors.md` and the fixtures: the two decisions, the three lines
      of I1 for `errors.md` and the fixtures, and the pinned details I2 to I14.
- [x] `docs/architecture.md`: the lines of §4.2, §5.1, §6, §7 and §8 that decisions 3, 8, 15, 22 and 27 change.
      (The dc-engine gate line of §19 changes in the engine task, with decision 26.)
- [x] `README.md`: the contracts section (what each file fixes, how a contract change is made).

Verify: `uv run scripts/contracts-check.py` · `node --test .claude/hooks/tests/*.test.mjs` · `/check all --tests`
Review: `/phase-review api web engine`
Commit: `feat(contracts): http api and error catalogue`

### Gate
- [x] From a clean container: `docker compose down -v`, `docker compose up -d db && scripts/db-init.sh`,
      `scripts/db-init.sh` again, `scripts/db-check.sh`, `uv run scripts/contracts-check.py`,
      `node --test .claude/hooks/tests/*.test.mjs`. Save the output as `gates/final.txt`.
- [x] Kfir reads `uv run scripts/contracts-check.py --render`: the rule sentence and the reasons of the six
      examples, in Hebrew. This is the last moment a wording change is free.
- [x] `/ship`, then the PR and the merge on Kfir's word. (PR #1, merged by Kfir as `f9928bf` on 2026-11-10;
      archived by dc-delivery, 2026-11-11)
- [x] After the merge, on main: `scripts/db-init.sh --reset` if the seed changed since the last init, then the
      three worktrees of kickoff §5, with `.env` copied into each (it is ignored by git, so a new worktree has none).
      (2026-11-10 23:57: the three worktrees cut from `f9928bf`, each with `.env`; `sql/` unchanged since the
      Gate's init)

## Design

### A. Database, compose and scripts

**Compose** (`name: data-controls`):
- `db`: `mcr.microsoft.com/mssql/server:2022-latest`; `ACCEPT_EULA=Y`, `MSSQL_SA_PASSWORD` (required, with a clear
  message when unset), `MSSQL_COLLATION=Hebrew_CI_AS`, `MSSQL_PID=Developer`; port `127.0.0.1:${DB_PORT:-1433}:1433`;
  a named volume on `/var/opt/mssql`; a healthcheck that runs `SELECT 1` through `/opt/mssql-tools18/bin/sqlcmd -C`.
- `db-init`: the same image, `depends_on: db: service_healthy`, `./sql` and `./scripts` mounted read-only, runs
  `scripts/db-init.sh`, never restarts.

**`.env.example`**: block `database` with `MSSQL_SA_PASSWORD`, `DQ_APP_PASSWORD`, `DQ_ENGINE_RO_PASSWORD`,
`DB_PORT`; empty blocks `engine` and `api` with a header comment each. Passwords must pass the SQL Server policy and
avoid quotes, `$`, `;` and spaces (they travel as sqlcmd variables).

**`scripts/db-init.sh [--reset]`**: waits for the server, then runs `sql/NN_*.sql` in lexical order with
`sqlcmd -b -f 65001`, passing the two login passwords with `-v`. Mode by where it runs: inside the init container
it runs sqlcmd directly; on a host with `sqlcmd` and `DB_HOST` set it does the same (the manual path); otherwise it
calls `docker compose run --rm db-init`. `--reset` drops `DataControls` first. In a linked worktree it exits with
the reason (the test is the one in `.claude/hooks/lib/tools.sh`, `dc_linked_worktree`).

**`hr`** (no IDENTITY, no business CHECK; text is NVARCHAR):

| Table | Columns |
|---|---|
| `hr.Ministry` | `id INT` PK · `name NVARCHAR(100)` · `is_active BIT` default 1 |
| `hr.Department` | `id INT` PK · `ministry_id INT` FK · `name NVARCHAR(100)` · `is_active BIT` default 1 · `manager_employee_id INT NULL` FK to Employee |
| `hr.Employee` | `id INT` PK · `department_id INT NULL` FK · `national_id NVARCHAR(9)` unique · `first_name`, `last_name NVARCHAR(50)` · `email NVARCHAR(254) NULL` · `birth_date DATE` · `hire_date DATE` · `termination_date DATE NULL` · `salary DECIMAL(12,2) NULL` · `status NVARCHAR(10)` CHECK in (`active`, `inactive`) |

Department and Employee reference each other, so the manager FK is added after both tables exist and the seed sets
managers with an UPDATE after the employees are in.

**`dq`**:

| Table | Columns |
|---|---|
| `dq.Control` | `id INT IDENTITY` PK · `name NVARCHAR(200)` · `description NVARCHAR(1000) NULL` · `root_entity_key NVARCHAR(64)` · `current_version INT` · `is_active BIT` default 1 · `created_at`, `updated_at DATETIME2(3)` default `SYSUTCDATETIME()` · `row_version ROWVERSION` |
| `dq.ControlVersion` | PK (`control_id`, `version`) · `definition NVARCHAR(MAX)` ISJSON · `definition_hash NVARCHAR(64)` · `created_at` |
| `dq.Run` | `id INT IDENTITY` PK · (`control_id`, `control_version`) FK to ControlVersion · `run_date DATE` · `language NVARCHAR(5)` CHECK in (`he`, `en`) · `started_at` · `finished_at NULL` · `status NVARCHAR(20)` default `running`, CHECK in (`running`, `succeeded`, `failed`, `timed_out`) · `total_count`, `stored_count`, `duration_ms INT NULL` · `summary NVARCHAR(MAX) NULL` ISJSON · `error_code NVARCHAR(64) NULL` · `error_params NVARCHAR(MAX) NULL` ISJSON · `engine_version NVARCHAR(32) NULL` · `correlation_id NVARCHAR(64)` |
| `dq.RunResult` | `id BIGINT IDENTITY` PK · `run_id INT` FK, ON DELETE CASCADE · `seq INT` · `record_key NVARCHAR(64)` · `record_display NVARCHAR(MAX)` ISJSON · `display_text NVARCHAR(400)` · `matched_condition_ids NVARCHAR(MAX)` ISJSON · `reasons NVARCHAR(MAX)` ISJSON · `reason_text NVARCHAR(MAX)` · unique (`run_id`, `seq`) |

**Indexes**: every FK column; `hr.Employee` `birth_date`, `status`, `salary`; `dq.Run (control_id, started_at DESC)`.

**Logins** (passwords as `$(DQ_APP_PASSWORD)` and `$(DQ_ENGINE_RO_PASSWORD)`): `dq_app` gets SELECT, INSERT, UPDATE,
DELETE on `SCHEMA::dq` and an explicit DENY of the same on `SCHEMA::hr`. `dq_engine_ro` gets SELECT on `SCHEMA::hr`,
a DENY of INSERT, UPDATE, DELETE on `hr` and a DENY of all four on `dq`. No DDL, no EXECUTE, nothing to `public`.
A re-run resets the passwords with ALTER LOGIN.

**`sql/cleanup_runs.sql`**: outside the init order; deletes runs beyond `$(KEEP_LAST_RUNS)` per control or older
than `$(KEEP_DAYS)` days (results cascade); run as `dq_app`.

**`scripts/db-check.sh`**: prints `PASS` or `FAIL` per assertion and exits 1 on any failure. `structure`: the
database collation, both schemas, the seven tables. `permissions`: `dq_engine_ro` can read `hr.Employee` and gets
error 229 on a read of `dq.Control`, on an UPDATE of `hr.Employee` and on a CREATE TABLE; `dq_app` can insert into
`dq.Control` inside a rolled-back transaction and gets error 229 on a read of `hr.Employee`. Sections `glossary`,
`hebrew` and `examples` arrive in phases 2 and 3. It reads passwords from `.env` and reaches sqlcmd through
`docker compose exec -T db`.

### B. Glossary (`contracts/glossary.json`)

Top-level keys: `glossaryVersion` (`"1.0.0"`), `languages`, `defaultLanguage` (`"he"`), `limits`
(`maxDepth 4`, `maxConditions 30`, `maxListValues 100`, `maxPathHops 2`, `maxTotalValues 500`: Design H3), `formats` (per language: the date pattern,
`dd.MM.yyyy` for he (decision 30); numbers with `,` grouping and trailing zeros trimmed), `phrases`,
`operators`, `entities`, `relationships`, `suggestions` (Design H1). Every label is an object keyed by language:
`{ "he": … }`, with one key per entry of `languages` (decision 37).

**Entities** (each: `key`, `table { schema, name }`, `keyColumn`, `label { singular, plural }`, `description`,
`rootable`, `visible`, `identifyingFields`, `fields`):

| Entity | Field key | Type | Column | Nullable | Notes |
|---|---|---|---|---|---|
| `employee` (hr.Employee, rootable; identifying: `first_name`, `last_name`, `employee_number`: decision 31) | `employee_number` | number | `id` | no | |
| | `national_id` | text | `national_id` | no | |
| | `first_name`, `last_name` | text | same name | no | |
| | `email` | text | `email` | yes | |
| | `birth_date` | date | `birth_date` | no | |
| | `age` | number | computed `age_years` over `birth_date` | no | whole years on the run date |
| | `hire_date` | date | `hire_date` | no | |
| | `termination_date` | date | `termination_date` | yes | |
| | `salary` | number | `salary` | yes | unit ₪ |
| | `status` | enum | `status` | no | values `active`, `inactive` with labels |
| | `department_assignment` | number | `department_id` | yes | operators `is_null`, `is_not_null` only; label "שיוך למחלקה" |
| `department` (hr.Department, rootable; identifying: `name`, `department_number`) | `department_number` | number | `id` | no | |
| | `name` | text | `name` | no | |
| | `is_active` | bool | `is_active` | no | value labels for true and false |
| | `manager_assignment` | number | `manager_employee_id` | yes | operators `is_null`, `is_not_null` only |
| `ministry` (hr.Ministry, rootable; identifying: `name`) | `name` | text | `name` | no | |
| | `is_active` | bool | `is_active` | no | value labels for true and false |

`age` is `run.year − birth.year`, minus one when the run date's (month, day) is before the birth date's. A field
may carry `operators` (an override), `unit`, `enumValues [{ value, label }]` or `valueLabels { true, false }`.
Without an override a field's operators are those whose `types` include its type, minus `is_null` and
`is_not_null` when it is not nullable.

**Relationships** (each: `key`, `from`, `to`, `cardinality`, `join { fromColumn, toColumn }`, `label`):
`employee.department` (many_to_one, `department_id` → `id`), `department.ministry` (many_to_one, `ministry_id` →
`id`), `department.employees` (one_to_many, `id` → `department_id`), `ministry.departments` (one_to_many, `id` →
`ministry_id`).

**Operators** (each: `key`, `arity`, `types`, `fieldComparable`, `label`, `sentence`, `reason`):

| Keys | Arity | Types | Right side may be a field |
|---|---|---|---|
| `eq`, `ne` | 1 | number, text, date, bool, enum | yes |
| `lt`, `lte`, `gt`, `gte` | 1 | number, date | yes |
| `between`, `not_between` | 2 (inclusive) | number, date | no |
| `in`, `not_in` | list | number, text, enum | no |
| `contains`, `not_contains`, `starts_with`, `ends_with` | 1 | text | no |
| `is_null`, `is_not_null` | 0 | every type | no |
| `is_empty`, `is_not_empty` | 0 | text (NULL, empty or spaces only) | no |

**Text**: `label`, `sentence` and `reason` are each an object of variants, every variant keyed by language. Lookup
order: `<type>.field`, `field`, `<type>`, `default` (the two `field` variants only when the right side is a field).
Placeholders: `{field}`, `{value}`, `{value2}`, `{values}`, `{actual}`, `{other}`, `{otherActual}`. `phrases`
holds `and`, `or`, `groupOpen`, `groupClose`, `listSeparator`, `reasonSeparator`, `fieldOnPath` (a field label
with its relationship labels) and `relatedAny` / `relatedNone` (each `{ sentence, reason }` with `{relationship}`
and `{conditions}`). A comparison with NULL never matches, the negative operators included.

### C. Definition schema (`contracts/control-definition.schema.json`)

```
definition  { "schemaVersion": 1, "rootEntity": key, "where": group }
group       { "type": "group", "op": "and" | "or", "children": [group | condition | related] }      1 to 30 children
condition   { "type": "condition", "id": id, "left": fieldRef, "operator": key, operand }
related     { "type": "related", "id": id, "relationship": key, "quantifier": "any" | "none", "where": group }
fieldRef    { "path": [relationshipKey], "field": key }                                             path optional, at most 2
operand     arity 0: nothing · arity 1: "value" (number | string | boolean) or "right": fieldRef
            arity 2: "values" with exactly 2 items · list: "values" with 1 to 100 unique items
```

`id` matches `^[a-z][a-z0-9_]{0,31}$`; keys match `^[a-z][a-z0-9_.]{0,63}$`; dates are `YYYY-MM-DD` strings;
`operator` is an enum of the eighteen keys; `additionalProperties` is false on every object. The operand shape per
operator is enforced with `if`/`then`. Left to the validators because the schema cannot say it: unique ids across
the tree, depth, the total number of conditions, and everything that needs the glossary. `related.where` is
required (§5); a `related` node names a one-to-many relationship that starts at the entity of its scope.

### D. Examples and seed

**Example file**: `{ id, name { he }, description { he }, runDate, definition, expected { total,
violations: [{ key, matched: [id] }] }, alternateRuns?: [{ runDate, expected }] }`. `id` equals the file name;
violations are ordered by the root key as the database orders it.

| Id | Hebrew name | Root | Definition (ids in brackets) |
|---|---|---|---|
| `minor-high-salary` | קטינים בשכר גבוה | employee | AND( [c1] `age` lt 18, [c2] `salary` gt 15000 ) |
| `termination-before-hire` | סיום העסקה לפני תחילתה | employee | AND( [c1] `termination_date` lt field `hire_date` ) |
| `active-in-inactive-department` | עובדים פעילים במחלקה לא פעילה | employee | AND( [c1] `status` eq active, [c2] `employee.department` › `is_active` eq false ) |
| `missing-mandatory-data` | נתוני חובה חסרים | employee | OR( AND( [c1] `status` eq active, OR( [c2] `email` is_empty, [c3] `salary` is_null, [c4] `department_assignment` is_null ) ), AND( [c5] `status` eq inactive, [c6] `termination_date` is_null ) ) |
| `department-without-active-employees` | מחלקות פעילות ללא עובדים פעילים | department | AND( [c1] `is_active` eq true, [r1] none of `department.employees` where AND( [c2] `status` eq active ) ) |
| `inactive-ministry-salary-out-of-range` | חריגות שכר במשרד לא פעיל | employee | AND( [c1] `status` eq active, [c2] `employee.department` › `department.ministry` › `is_active` eq false, OR( [c3] `salary` lt 6000, [c4] `salary` gt 40000 ) ) |

The Hebrew descriptions of examples 1 to 4 are the assignment's own sentences (architecture Appendix A).

**Ministries**: 1 משרד הבריאות, 2 משרד החינוך, 3 משרד האוצר, 4 משרד התחבורה והבטיחות בדרכים (all active),
5 משרד הפיתוח (inactive).

**Departments** (16):

| Id | Ministry | Active | Role in the seed |
|---|---|---|---|
| 101, 102 | 1 | yes | baseline |
| 103 | 1 | no | example 3: two active employees (planted), one inactive |
| 104 | 1 | yes | example 5 planted: only inactive employees |
| 201, 202 | 2 | yes | baseline |
| 203 | 2 | no | boundary for 3 and 5: only inactive employees |
| 204 | 2 | yes | example 5 planted: no employees |
| 301, 302 | 3 | yes | baseline |
| 303 | 3 | yes | example 5 boundary: one active and one inactive employee |
| 401 | 4 | yes | baseline |
| 402 | 4 | no | example 3: two active employees (planted), one inactive |
| 403 | 4 | yes | example 5 planted: only inactive employees |
| 501 | 5 | yes | example 6 rows |
| 502 | 5 | no | rows flagged by example 3, one of them by example 6 as well |

**Employees** (about 85; the id ranges are guidance, the comments and the example files are the record):

| Group | Ids | Rows |
|---|---|---|
| baseline | 1001–1040 | adults born 1961 to 2004 in the baseline departments, complete data, salaries 6,500 to 38,000, about eight inactive with a termination date on or after the hire date. Two active outliers (5,500 and 45,000) are boundary rows for example 6: their ministry is active |
| example 1 | 1051–1058 | planted: three born 2010 or later with a salary above 15,000 (one at 15,000.01). Boundary: born 2008-11-01 with 18,000 (18 on the run date, flagged on 2026-10-31); born 2008-10-31 with 18,000; a minor at exactly 15,000; a minor at 9,000; a minor with a NULL salary (also planted for example 4) |
| example 2 | 1061–1065 | planted: three inactive with the termination date before the hire date (one by a single day). Boundary: termination on the hire date; termination one day after it |
| example 3 | 1071–1078 | the employees of 103, 203 and 402 as in the department table; every inactive one has a termination date |
| example 4 | 1081–1090 | planted: active with a NULL email; with an empty one; with spaces only; with a NULL salary; with no department; with a NULL email and a NULL salary [c1, c2, c3]; inactive with no termination date [c5, c6]; inactive with no termination date and an empty email (still [c5, c6]: c2 is true and does not contribute). Boundary: inactive with an empty email and a termination date; inactive with a NULL salary and a termination date |
| example 5 | 1101–1106 | the employees of 104, 303 and 403 as in the department table |
| example 6 | 1111–1118 | in 501: active at 4,500 [c1, c2, c3] and at 52,000 [c1, c2, c4] (planted); active at exactly 6,000 and exactly 40,000 (boundary); active with a NULL salary (boundary here, planted for example 4); inactive at 3,000 with a termination date. In 502: active at 3,000 (planted for 3 and 6), active at 12,000 (planted for 3 only) |

Expected totals that follow from the blueprint: 3 (4 on 2026-10-31), 3, 6, 10, 3, 3. Rules for every row: no
birth date on 29 February; national ids are invented nine-digit numbers that fail the control-digit check, so none
can belong to a real person; emails are ASCII at `example.org`; a row outside an example's group must not be
flagged by it unless the table above says so.

**Oracle queries** (`sql/checks/<id>.sql`): static, hand-written, schema-qualified, one row per violating record
with the key and a 0/1 column per condition id that is 1 only when the condition contributes (decision 8). The run
date arrives as the sqlcmd variable `$(RUN_DATE)`, read from the example file. "Under 18" is
`birth_date > DATEADD(YEAR, -18, run date)`; "empty" is NULL or equal to `N''` (SQL Server ignores trailing spaces).

### E. HTTP APIs (`contracts/api.md`)

Common to both: JSON, camelCase; `Accept-Language`: a language the glossary lists, anything else its default (`he`); `X-Correlation-Id` created by
the api when missing, forwarded to the engine and returned; timestamps in ISO 8601 UTC, dates as `YYYY-MM-DD`.
Every error is problem details: `{ type: "about:blank", title: <code>, status, code, params, errors?,
correlationId }`, with no prose. A definition error is `{ code, path, nodeId?, params }`, `path` being a JSON
Pointer into the definition.

Shared shapes: `Violation { key, display { fieldKey: value }, matched [id], reasons [{ conditionId, reasonKey,
params, text }], reasonText }`. Reason `params` are `{ left, actual, value | values | right, rightActual }`, or
`{ relationship }` for the two related keys. `display` holds the root entity's identifying fields. `Page<T>` is
`{ items, total, page, pageSize }` (page from 1; pageSize 25 by default, 200 at most).

**Engine**:

| Method and path | Request | 200 response | Errors |
|---|---|---|---|
| `GET /health` | | `{ status, database, glossaryVersion, engineVersion }` | 503 `DATABASE_UNAVAILABLE` |
| `GET /glossary` | | the glossary without `table`, `keyColumn`, `column`, `computed` or `join`, hidden fields and entities removed, every field with its resolved `operators` | |
| `POST /validate` | `{ definition }` | `{ valid: true, sentence, conditions: [{ id, sentence }] }` | 422 `DEFINITION_INVALID` |
| `POST /run` | `{ definition, runDate?, rowCap? }` | `{ runDate, totalCount, returnedCount, capExceeded, durationMs, engineVersion, glossaryVersion, sentence, conditions: [{ id, sentence, count }], violations }` | 422 · 504 `QUERY_TIMEOUT` · 503 `DATABASE_UNAVAILABLE` |
| `POST /suggest` | `{ rootEntity?, max? }` | `{ items: [{ name, description, rationale, evidence: [{ key, params, text }], definition, sentence }] }` | 503 |
| `POST /debug/compile` | `{ definition, runDate? }` | `{ sql, params }` | 404 `DEBUG_DISABLED` · 422 |

`conditions[].count` is the number of violations in which that condition is matched (decision 8), over all
violations and not only the returned page. `runDate` defaults to today in Asia/Jerusalem; `rowCap` is clamped to
the engine's configured maximum.

**Application API** (`/api/v1`):

| Method and path | Request | Response |
|---|---|---|
| `GET /health` | | 200 `{ status: "ok" \| "degraded", database, engine, version }` |
| `GET /glossary` | | 200, the engine's public glossary unchanged |
| `GET /controls` | `search`, `rootEntity`, `active=true \| false \| all`, `page`, `pageSize` | 200 `Page<ControlSummary>` |
| `POST /controls` | `{ name, description?, definition }` | 201 `Control` · 422 |
| `GET /controls/{id}` | | 200 `Control` · 404 `CONTROL_NOT_FOUND` |
| `PUT /controls/{id}` | `{ name, description?, definition, concurrencyToken }` | 200 `Control` · 409 `CONCURRENCY_CONFLICT` · 422 |
| `DELETE /controls/{id}` | | 204 (archives; a repeat is also 204) |
| `GET /controls/{id}/versions` | | 200 `[{ version, createdAt, definitionHash }]` |
| `GET /controls/{id}/versions/{version}` | | 200 `{ version, createdAt, definition }` · 404 `VERSION_NOT_FOUND` |
| `POST /controls/validate` | `{ definition }` | 200 as the engine's `/validate` · 422 |
| `POST /controls/{id}/runs` | `{ runDate? }` | 201 `Run`, also when the run failed · 404 · 409 `CONTROL_ARCHIVED` |
| `GET /controls/{id}/runs` | `page`, `pageSize` | 200 `Page<Run>`, newest first |
| `GET /runs/{id}` | | 200 `Run` · 404 `RUN_NOT_FOUND` |
| `GET /runs/{id}/results` | `page`, `pageSize`, `search`, `condition`, `sort=key \| display`, `dir=asc \| desc` | 200 `Page<Violation with seq>` |
| `POST /suggestions` | `{ rootEntity?, max? }` | 200 as the engine's `/suggest` |
| `POST /suggestions/accept` | `{ items: [{ name, description?, definition }] }` | 201 `{ items: [Control] }`, all or nothing · 422 naming the failing index |

`Control { id, name, description, rootEntity, version, isActive, createdAt, updatedAt, concurrencyToken,
definition }`. `ControlSummary` is the same without `definition` and `concurrencyToken`, plus `lastRun { id,
startedAt, status, totalCount } | null`. `Run { id, controlId, controlName, controlVersion, rootEntity, runDate,
language, startedAt, finishedAt, status, totalCount, storedCount, capExceeded, durationMs, sentence, conditions,
error { code, params } | null, previousRun { id, startedAt, totalCount } | null }`. `search` matches
`display_text` or `reason_text`; `condition` keeps the records in which that condition id is matched. Runs are
synchronous: the POST returns when the run has finished.

### F. Error catalogue (`contracts/errors.md`)

Three tables, each row starting with the code in backticks so tests can read the file with one regular expression.

**Codes** (`code` of a problem response, or `error.code` of a failed run):

| Code | Status | From | Params |
|---|---|---|---|
| `REQUEST_INVALID` | 400 | both | `errors` |
| `DEFINITION_INVALID` | 422 | both | `errors` (definition errors) |
| `CONTROL_NOT_FOUND`, `RUN_NOT_FOUND`, `VERSION_NOT_FOUND` | 404 | api | `id`, `version` |
| `NOT_FOUND` | 404 | both | |
| `DEBUG_DISABLED` | 404 | engine | |
| `CONTROL_ARCHIVED`, `CONCURRENCY_CONFLICT` | 409 | api | `id` |
| `ENGINE_UNAVAILABLE` | 503 | api | |
| `DATABASE_UNAVAILABLE` | 503 | both | |
| `GLOSSARY_MISMATCH` | 503 | engine (startup log and `/health`) | `table`, `column` |
| `QUERY_TIMEOUT` | 504 | both | `timeoutSeconds` |
| `INTERNAL_ERROR` | 500 | both | |
| `CONTROL_DEFINITION_OUTDATED` | run error only | api | `errors` (a saved control that no longer validates) |
| `ROW_CAP_EXCEEDED` | informational | client, when `capExceeded` | `total`, `stored` |

**Definition error codes**: `SCHEMA_VIOLATION`, `UNSUPPORTED_SCHEMA_VERSION`, `UNKNOWN_ENTITY`,
`ENTITY_NOT_ROOTABLE`, `UNKNOWN_FIELD` (also for a hidden field), `UNKNOWN_RELATIONSHIP`, `PATH_NOT_REACHABLE`,
`PATH_NOT_TRAVERSABLE` (a one-to-many relationship in a path), `PATH_TOO_LONG`, `RELATIONSHIP_NOT_QUANTIFIABLE`,
`OPERATOR_NOT_ALLOWED`, `OPERAND_MISMATCH`, `VALUE_TYPE_MISMATCH`, `UNKNOWN_ENUM_VALUE`,
`FIELD_COMPARISON_NOT_ALLOWED`, `FIELD_TYPE_MISMATCH`, `RANGE_INVALID`, `TOO_DEEP`, `TOO_MANY_CONDITIONS`,
`TOO_MANY_VALUES`, `DUPLICATE_NODE_ID`. Each row lists its params.

**Reason keys**: one per operator key, plus `related_any` and `related_none`, each with its params. The file then
states the matched rule (decision 8), the NULL rule, the definition of `age`, and the rendering rules of Design B
(variant lookup, placeholders, formats), and says that the text lives in the glossary.

**Invalid fixtures** (`contracts/examples/invalid/<name>.json`): `{ layer: "schema" | "semantic", expected {
code, path }, definition }`. Schema layer, about five: an unknown node type, a missing operator, a value given
with `is_null`, a path of three hops, `between` with one value. Semantic layer, about seven: an unknown field, an
operator not allowed for the type, a value of the wrong type, an unknown enum value, a one-to-many relationship in
a path, a `related` node on a many-to-one relationship, a duplicate id.

### G. Contracts check (`scripts/contracts-check.py`)

A single file with inline dependencies (`jsonschema`, pinned), run by `uv run`. It prints one line per failure,
starting with the file path, and exits 1 on any. The Stop hook shows the last twelve lines of a failed check, so
failures come last.

1. The schema is a valid draft 2020-12 schema.
2. Glossary integrity: unique keys; relationships name existing entities; identifying fields exist; operator
   overrides name existing operators; every label and template has a text for every language of `languages`; templates use only the
   placeholders of Design B.
3. Agreement: the schema's operator enum equals the glossary's operator keys; the schema's list and path limits
   equal `limits`.
4. Examples: the wrapper shape; `definition` validates against the schema; every entity, field, relationship and
   operator exists in the glossary and the operator is allowed for the field's type; `expected.total` equals the
   number of violations; ids are unique.
5. Invalid fixtures: every schema-layer one fails validation, every semantic-layer one passes it, and every
   expected code is a row of `contracts/errors.md`.

`--render` prints, for each example, the rule sentence and one reason per condition in every language the glossary lists with a
plain placeholder substitution. It is a reading aid for the copy review, not the specification of the renderer.

### H. Amendments from dc-engine planning (2026-11-10, decisions 26 to 29)

H wins where it differs from B to F. `dev/completed/dc-engine/plan.md` (Design J) lists the same shapes as what the
engine assumes; a change here after that task starts is a contract change.

**H1. Suggestion data** (decision 26; glossary in phase 2, examples and seed in phase 3, `errors.md` in phase 4)

- Entity, optional: `lifecycle { field, active }`. `field` is a bool or enum field of that entity and `active` the
  value that means active. Seed glossary: employee `{ "field": "status", "active": "active" }`; department and
  ministry `{ "field": "is_active", "active": true }`.
- Field, optional: `required`, one of `"always"`, `"active"`, `"inactive"` (the last two only where the entity has
  a `lifecycle`). Seed glossary: employee `email`, `salary` and `department_assignment` are `"active"`,
  `termination_date` is `"inactive"`, and nothing else is marked. No threshold, range or other rule parameter goes
  into the glossary.
- Top level: `suggestions { kinds, evidence }`, every leaf keyed by language. `kinds.<kind>` has `name`, `description`
  and `rationale`:

  | Kind | The engine proposes | Placeholders |
  |---|---|---|
  | `missing_required` | per entity, one control: a required field is missing in the state that requires it | `{entity}` |
  | `date_order` | two date fields of one entity in the wrong order | `{entity}`, `{earlier}`, `{later}` |
  | `active_under_inactive` | an active record whose parent, through a many-to-one path, is inactive | `{entity}`, `{relationship}` |
  | `active_without_active_children` | an active record with no active child through a one-to-many relationship | `{entity}`, `{relationship}` |
  | `missing_optional` | a nullable field that is not `required` and is missing in a few records | `{entity}`, `{field}` |

  `{entity}` is the root entity's plural label, `{relationship}` the label of the last relationship on the path,
  the others field labels. `evidence.<key>` is one template each:

  | Evidence key | Params | Says |
  |---|---|---|
  | `violations_found` | `count`, `total` | records the control flags now, out of all records of the root entity |
  | `field_missing` | `field`, `count` | records in which that required field is missing |
  | `date_order_split` | `count`, `total` | of the records holding both dates, how many have them in the wrong order |

  `contracts/errors.md` gets a fourth table, "Evidence keys", with these rows. In the API `params.field` is a
  field key; the label is in the text.
- Examples: `heuristic: true` in the wrapper of examples 2, 3, 4 and 5. The engine must reproduce each of those
  definitions node for node, so they follow its conventions: ids `c1..` and `r1..` in document
  order, fields in glossary order (`email` before `salary` before `department_assignment`), the active branch
  before the inactive one, a root that is always a group, "inactive" as `eq false` on a bool and `eq inactive` on
  the two-valued status. The table of Design D already has that shape; do not reshape those four without a line to
  the engine session. Example 1 is not marked: its thresholds are business knowledge.
- Seed sanity, stated in `sql/README.md`: among the employees who have both dates, at least 80% have the
  termination date on or after the hire date (the blueprint gives about 21 of 24), and nobody is hired or
  terminated on or before the birth date. The engine's `date_order` generator relies on it to propose example 2
  and nothing else.
- `scripts/contracts-check.py`, check 2: `lifecycle.field` exists and is bool or enum, and `active` is one of its
  values; `required` holds a legal value and, for `active` and `inactive`, the entity has a `lifecycle`; every kind
  and evidence key above is present in every language and uses only its placeholders. Check 4 accepts `heuristic`.
  `--render` also prints the three texts of each kind.

**H2. Sentence and reason parts** (decision 27; `api.md` and `errors.md` in phase 4)

- `TextPart { text, nodeId?, role? }`. Concatenating the `text` of a list of parts gives the plain string exactly.
  `nodeId` is set on every part of the clause of one node (a condition, or the phrase of a `related` node; the
  conditions inside a `related` sub-tree carry their own ids). `role` names the placeholder a part came from:
  `field`, `value`, `actual`, `other`, `otherActual`, `relationship`; template text has none.
- The engine returns `sentenceParts` beside every `sentence`: at the top level of `/validate` and `/run`, in each
  item of their `conditions`, and in each item of `/suggest`. Every reason has `textParts` beside `text`.
- The application API passes them on: `Run.sentenceParts`, `Run.conditions[].sentenceParts`,
  `Violation.reasons[].textParts`, and the items of `POST /suggestions`. Storage needs no new column:
  `dq.Run.summary` and `dq.RunResult.reasons` are JSON and hold the parts as received.
- `errors.md` lists the roles. The need comes from the last section of `docs/design.md`.

**H3. Total-values limit and the `comparable` flag** (decision 28; glossary in phase 2, `errors.md` in phase 4)

- `limits.maxTotalValues: 500`: the number of literal values in a whole definition (a `value` counts one, each
  item of `values` one, sub-trees of `related` nodes included). `TOO_MANY_VALUES` covers both limits: params
  `{ limit: "list" | "total", max, actual }`, `path` the `values` array or `/where`.
- Field flag `comparable`, default true; `false` on `age`, `department_assignment` and `manager_assignment`. Such
  a field may be neither side of a field-to-field comparison: `FIELD_COMPARISON_NOT_ALLOWED` with `{ field }`
  (or `{ operator }` when the operator is not `fieldComparable`). The public glossary serves the flag, so the
  editor leaves those fields out of the "compare to another field" picker. Check 2 asserts that every computed
  field has `comparable: false`.

**H4. Clarifications** (decision 29)

- a. Schema (phase 2): node types are told apart by `if`/`then` on `type`, after an `enum` on `type`, not by
  `oneOf`; the same for operand shapes per operator. A violation is then reported once, at one instance location,
  by Python `jsonschema` and by JsonSchema.Net. `errors.md`: the `path` of `SCHEMA_VIOLATION` is the instance
  location of the failing keyword (the node for a missing or an extra property, the property for a wrong value),
  one error per distinct path, in document order. The schema-layer fixtures' `expected.path` follows that rule.
- b. `errors.md` (phase 4): depth is the number of `group` nodes on the longest chain from the root group down
  (the root counts 1, and so does the `where` group of a `related` node); the condition count is every `condition`
  node plus every `related` node, anywhere in the tree.
- c. `api.md` (phase 4): `conditions[]` in `/validate` and `/run` lists the nodes that can be matched, in document
  order: conditions outside any `related` sub-tree, and `related` nodes.
- d. `api.md` (phase 4): `POST /debug/compile` answers `{ sql, params, countSql, countParams }`, the page and the
  count statement, with placeholders in the text and values only in the params.

### I. Addendum from dc-api planning (2026-11-10)

Written by the `/task-plan dc-api` session on Kfir's word. It pins what Designs E and F leave open, so that
`contracts/api.md`, `contracts/errors.md` and the invalid fixtures are written with it; the api plan
(`dev/completed/dc-api/plan.md`, Design H) assumes exactly these lines. I adds to E and F and changes nothing in H.
Where I and H touch the same point, the path of a `SCHEMA_VIOLATION`, **H4a is the rule that holds**: I1 only says
what the api does to follow it and what the schema must avoid so that the two validators agree.

**Decided by Kfir in the dc-api interview**

- **Counts under the cap stay exact**, as Design E says: `conditions[].count` covers all violations, also when
  only the capped rows are stored, and `api.md` says so beside `Run.conditions`. The States table of
  `docs/design.md` says the opposite ("the breakdown counts the shown rows"); that line is the one that changes,
  in the web task.
- **An archived control is read-only**: `PUT /controls/{id}` answers 409 `CONTROL_ARCHIVED`. GET, the versions and
  the past runs still answer. There is no un-archive in v1 (it joins the extensions).

**I1. `SCHEMA_VIOLATION` from two validators** (the schema in phase 2; fixtures and `errors.md` in phase 4)

The engine validates with Python `jsonschema`, the api with JsonSchema.Net 8.0.5 (the last MIT release; from 9.0.0
the package ships under a maintenance-fee EULA, so decision 10's "JsonSchema.Net" means that version). Both were
run on a miniature of the schema on 2026-11-10 (`dev/completed/dc-api/research/schema-probe.md`). With node types and
operand shapes by `if`/`then` they agree on a missing member (the object) and on a wrong value, a wrong `type` and
an array of the wrong length (the member). They differ in three ways:

- JsonSchema.Net lists the `if` tests that did not match as errors. The api drops them.
- A `false` subschema (`additionalProperties: false`, or `properties: { "value": false }` in a `then`) is reported
  by Python at the object, with no keyword name, and by JsonSchema.Net at the member. The api lifts it to the
  object, which is H4a's "the node for an extra property".
- A failed `not` has no location in JsonSchema.Net, and a `not` that passes lists what failed inside it. **So the
  schema forbids a member only with `additionalProperties: false` or `properties: { member: false }`, and uses no
  `not`, `anyOf` or `oneOf`.** (Decision 10's subset has neither of the first two, and H4a removes the third.)

Three lines for `errors.md` and the fixtures: one schema-layer fixture is an extra member ("a value given with
`is_null`" is one), so the lift is tested from both sides; `nodeId` on a schema error is the `id` of the nearest
enclosing node that has one; a `schemaVersion` other than 1 is `UNSUPPORTED_SCHEMA_VERSION` before the schema
runs, in both services, and `errors.md` gives its path.

**I2 to I14. Pinned details** (`api.md` and `errors.md` in phase 4)

2. `concurrencyToken` is the base64 of the row version, opaque to the client.
3. `GET /controls`: `active=true` by default; `search` is "the name contains"; ordered by name, then id. The
   versions list is newest first.
4. A bad `page`, `pageSize`, `sort`, `dir` or `active` is 400 `REQUEST_INVALID`. A page past the end is 200 with
   empty `items`.
5. `REQUEST_INVALID.errors` items are `{ path, code, params }` with the codes `REQUIRED`, `TOO_LONG`,
   `OUT_OF_RANGE` and `MALFORMED`, listed in `errors.md`.
6. Results: `sort=key` is the engine's key order (`seq`) and the default; `sort=display` is `display_text`, then
   `seq`. `search` is a substring of `display_text` or `reason_text`, with `%` and `_` taken literally.
7. `Run.durationMs` is the engine's `durationMs` for a succeeded run and the api's elapsed time for a failed one.
8. `previousRun` is the newest earlier succeeded run of the control. `lastRun` is the newest run of any status.
9. The api resolves a missing `runDate` itself (today in Asia/Jerusalem) and always sends `runDate` and `rowCap`
   to the engine, because the run row needs the date before the engine answers.
10. The `error.code` of a failed run: engine 422 is `CONTROL_DEFINITION_OUTDATED`, with the engine's errors; 504
    is `QUERY_TIMEOUT` with the status `timed_out`; 503 is `DATABASE_UNAVAILABLE`; an engine that is not
    reachable, a call that times out and an open circuit are `ENGINE_UNAVAILABLE`; anything else is
    `INTERNAL_ERROR`.
11. `POST /suggestions/accept`, 422: `params.index` is the first failing item and the error paths are relative to
    that item's definition. At most 20 items.
12. 201 responses carry `Location`. `GET /api/v1/health` is always 200.
13. `api.md` states the engine's worst-case time. The engine plan gives 30 s per statement and two statements per
    run, so about 60 s for `/run`. The api's attempt timeout, 75 s by default, sits above it.
14. A name has 1 to 200 characters and a description at most 1000 (the column sizes). Names are not unique.

Seen while planning, for the web task: the States table of `docs/design.md` names `GLOSSARY_MISMATCH` for a
control whose field left the glossary. In Design F that state is the run error `CONTROL_DEFINITION_OUTDATED`;
`GLOSSARY_MISMATCH` is the engine refusing to start.

## Risks

- **Hebrew through sqlcmd**: a missing `N` prefix or a wrong code page turns names into `?`. The `hebrew` section
  of db-check is the test; if `-f 65001` is not honoured by the Linux sqlcmd, find the working flag before seeding.
- **Seed and examples drift apart**: db-check compares them on every run, and a seed edit changes the example in
  the same commit.
- **A contract change after the freeze** costs three sessions. The Gate's read-through and the reviews of phases
  2 and 4 are the place to object; afterwards it is one commit to `contracts/` on main plus one line per session.
- **`--reset` deletes every session's `dq` rows**, and a seed edit needs it. Announce it to the other sessions first.
- **Worktrees have no `.env`** (it is ignored), so db-check and both services fail there until it is copied.
- **Port 1433 or the SA password policy**: a local SQL Server on the grader's machine takes the port (`DB_PORT`
  moves it); a weak password makes the container exit at once (`docker compose logs db` says why).
- **CLAUDE.md has six lines of room** under its 100-line test; the new rows must fit.
- **Time**: if the day runs out, cut in this order and record it in notes: `--render`, the semantic-layer invalid
  fixtures, `manager_assignment`, `sql/cleanup_runs.sql` (it can move to dc-api). The gate items are never cut.
- **The stability window ends 2027-12-31**, when the youngest planted minor approaches 18. `sql/README.md` says so.
- **The amendments of Design H add about an hour and a half**, most of it templates. If the day runs out,
  `missing_optional` and its texts go first. The dc-engine and dc-web plans are built on `lifecycle`, `required`,
  `maxTotalValues` and the parts in `api.md`, so those are not candidates for a cut.

## Out of scope

- Engine, api and web code, their Dockerfiles and their compose services (tasks 2 to 5).
- The §17 documents other than the README skeleton and `sql/README.md`; trimming `docs/architecture.md`; the
  manual-path instructions (all dc-delivery).
- `docs/design.md` (kickoff §4; needed before dc-web starts, in any session).
- A `department.manager` relationship, relative date values such as "today", a "rule must hold" mode, CI.
- English texts, an LLM step in the suggestions, an offline bundle (decisions 37 to 39).
