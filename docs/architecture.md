# Dynamic Data Controls System — Architecture & Work Plan

**Purpose of this document.** This is the master architecture document for a one-week take-home assignment from the Israel Central Bureau of Statistics (CBS, למ"ס). It defines what we build, why, the responsibilities and boundaries of every component, the contracts between them, and the deliverables. It is written for Claude Code sessions that will break it into tasks and implement it. It deliberately avoids implementation syntax; the technical details are decided during implementation, within the boundaries set here. The visual design is decided in a separate design document (`docs/design.md`) that drives the client task.

**Deadline:** received 8 Nov 2026, submit by **15 Nov 2026**.
**Position:** CBS tender 59-2026 (call 2000028645), software developer, Jerusalem. Stack of the position: .NET / .NET Core, Angular or React, REST API design, Python, databases, Git, cloud (GCP preferred).

---

## 1. What we are building

A generic **data-quality controls** system for business users who do not know SQL and do not know the database structure.

- A **control** is a named, saved business rule that detects problematic records, e.g. "employees under 18 earning more than 15,000".
- A business user defines a control in a Hebrew UI by choosing business terms (entities, fields, relationships), operators and values, combined with AND/OR, without seeing table or column names.
- The system translates the saved definition into a safe SQL query, runs it against the organization's data, and returns the **violations**: the records that match the control's condition, each with the **reason** it failed.
- Controls are generic: adding a new control requires no code change. Adding a new business entity requires only a change to the business glossary, not to the engine.
- The system is **read-only** toward organization data. It detects and reports; it never fixes, updates or deletes.

Vocabulary used throughout (keep these names in code, docs and UI):

| Term | Hebrew | Meaning |
|---|---|---|
| Control | בקרה | A saved rule: name, description, root entity, condition tree |
| Violation | חריגה | A record of the root entity that matches the control's condition |
| Run | הרצה | One execution of one control version at one point in time, with its stored results |
| Root entity | ישות ראשית | The business entity whose records are the result rows (e.g. Employee). It defines the grain of the result |
| Business glossary | מילון המונחים | The metadata describing entities, fields and relationships in business language, mapped to physical tables and columns |
| Condition tree | עץ תנאים | Nested AND/OR groups of conditions that define when a record is a violation |

---

## 2. Guiding principles (these decide every open question)

1. **Generic through data, not code.** A control is a row of data (JSON). The engine never contains a rule-specific branch. New entities enter through the glossary.
2. **Definition is separate from implementation.** The definition (JSON) is the source of truth and lives in the controls store. SQL is a derived artifact, produced at run time by the engine, never stored as the source of truth and never executed from storage.
3. **Deterministic core.** No LLM in the definition-to-SQL path. The same definition and the same data always produce the same result.
4. **Least privilege by construction.** The component that produces dynamic SQL (Python engine) can only read organization data. The component that writes (the .NET API) cannot touch organization data at all. Two database logins enforce this.
5. **One root entity per control.** Every control starts from one entity; related entities join through declared relationships. This fixes the grain of the result so counts and per-record reasons are well defined. A control scans **all** records of its root entity.
6. **The condition describes the violation.** Records matching the condition are the exceptions ("find employees who..."). This matches the assignment's examples. NULL comparisons do not match (SQL three-valued logic); missing data is detected explicitly with "is empty / is null" operators.
7. **Business users never see technical names.** Display names from the glossary everywhere; technical names appear only in logs and developer documentation.
8. **English code, Hebrew from data.** Source code, identifiers, keys, logs, comments and tests are English only. Hebrew exists in exactly two kinds of data files: the client's translation files (`web/src/assets/i18n/he.json`, with `en.json` beside it) and the glossary (every label and reason template carries `{ "he": …, "en": … }`). Everything that crosses a service boundary is a **key** (field keys, operator keys, error codes, reason keys) plus parameters; text is rendered from data at the edge, in the requested language, Hebrew by default. Seed data values (ministry names, people) are data and may be Hebrew.
9. **Every failure is explained in plain language.** Both violations ("why this record failed") and system errors ("what went wrong, what to do"), rendered through the same translation data.

---

## 3. System overview

Four components, one database with two schemas, two database logins.

```
Angular SPA (Hebrew default, RTL, i18n)
   │  JSON over HTTPS
   ▼
.NET 10 (LTS) Web API — "application layer"        DB login: dq_app  → read/write schema dq only
   │  JSON over HTTP (internal)
   ▼
Python FastAPI — "control engine"           DB login: dq_engine_ro → SELECT only on schema hr
   │  parameterized SELECT, read-only
   ▼
SQL Server 2022
   ├─ schema hr : sample organization data (Ministry → Department → Employee)
   └─ schema dq : controls, control versions, runs, run results
```

The **business glossary** is a versioned JSON file inside the Python service (not a database table). It is loaded at startup, validated against the real database structure, and served to the .NET API through an endpoint.

The three services agree on their shared shapes through one folder, `contracts/` (§5.1), written first and changed only deliberately.

### 3.1 Responsibilities and prohibitions per component

**Angular client**
- Owns: the three screens (controls list, control editor, run results) and the suggestions dialog; building the control definition JSON from user choices; presenting results, reasons and errors through the translation service; responsive layout, mobile first.
- Receives the glossary from the API and renders all pickers from it, using the glossary's labels in the active language.
- Must never: contain field or table names in code; contain Hebrew strings in code (only keys resolved from `i18n/*.json`); send SQL; be trusted for validation (its validation is UX only).

**.NET 10 (LTS) Web API (application layer)**
- Owns: control lifecycle (create, read, update, delete/archive, versions, optimistic concurrency); structural validation of definitions; orchestration of runs; persistence of runs and result snapshots; paging, filtering, sorting and search over stored results; the suggestions approval flow; uniform error responses (code + parameters, no prose); OpenAPI; serving the built Angular app.
- Reads the glossary from the engine and caches it in memory. Forwards the client's language (`Accept-Language`) to the engine.
- Must never: build or execute dynamic SQL; access schema `hr`; execute SQL text received from any other component; hard-code user-facing text.

**Python FastAPI service (control engine)**
- Owns: the glossary (file, loader, startup validation against the database); semantic validation of definitions; compilation of a definition into a parameterized SELECT; execution under the read-only login with row cap and timeout; computing per-condition flags and rendering reasons from glossary templates in the requested language; the compile cache; the suggestions module (data statistics, heuristics, optional LLM).
- Stateless: holds no persistent state, writes nothing anywhere. Can be restarted at any time.
- Must never: write to any database; store results; execute anything other than a single SELECT it compiled itself; accept identifiers from callers (only glossary keys); hard-code user-facing text.

**SQL Server**
- `hr`: sample organization data with planted valid and invalid rows. Created once by the seed scripts; never written by the running system.
- `dq`: controls, versions, runs, run results. Written only by `dq_app`.
- Logins: `dq_app` (.NET) — SELECT/INSERT/UPDATE/DELETE on `dq`, nothing on `hr`. `dq_engine_ro` (Python) — SELECT on `hr` only.

### 3.2 Why this split (decision record)

- The assignment names `.NET Web API` and `PYTHON` as mandatory backend technologies and grades "separation between control definition and query implementation". Giving .NET the definition lifecycle and Python the query implementation turns that sentence into a service boundary.
- Alternatives rejected: (a) .NET does everything and Python only serves the optional AI feature — Python becomes optional and looks bolted on; (b) Python compiles SQL and .NET executes it — executable SQL would travel between services and .NET would become a "run this SQL" endpoint, which is exactly what a security reviewer will attack; (c) .NET as a thin gateway with Python owning CRUD — .NET shows nothing gradeable, and dynamic SQL would sit in the same process as write permissions.
- One Python service with two internally separated modules (engine, suggestions) rather than two services: they share the glossary and the compiler (suggestions are validated through the compiler), and a second deployable adds operational risk for the graders without adding architectural value. Splitting later is a packaging change, not a code change.

---

## 4. Data model

### 4.1 Schema `hr` — sample organization data
Three related tables so that relationships of two hops can be demonstrated: **Ministry → Department → Employee**.
- Ministry: id, name, is_active.
- Department: id, ministry_id (FK), name, is_active, manager_employee_id (nullable).
- Employee: id, department_id (FK), national_id, first_name, last_name, email, birth_date, hire_date, termination_date (nullable), salary, status (active/inactive).
- Text columns are `NVARCHAR` (Unicode); the database collation is `Hebrew_CI_AS`. Seed values are Hebrew where a real CBS user would expect Hebrew (ministry and department names, people's names); column and table names are English.
- Seed data: ~5 ministries, ~15 departments, ~60–100 employees. For every example control there are several rows that pass and several that fail, each planted violation marked with a comment in the seed script. Include boundary cases (an employee who turns 18 on the run date, NULL salaries, NULL termination dates, an employee with no department, an active employee with an empty email, an inactive employee with no termination date).
- Indexes: on every FK column and on the columns the example controls filter by (birth_date, status, salary).

### 4.2 Schema `dq` — controls store (written only by .NET)
- **Control**: id, name, description, root_entity_key, current_version, is_active, created/updated timestamps, concurrency token.
- **ControlVersion**: control_id, version number, definition JSON, definition hash, created timestamp. Immutable; every edit creates a new version.
- **Run**: id, control_id, control_version, run date, language, started/finished timestamps, status (succeeded / failed / timed out), total violation count, stored row count, duration, error code and parameters if failed, engine version, correlation id.
- **RunResult**: run_id, record key, record display fields (JSON), matched condition ids, structured reasons (JSON: reason key + parameters per matched condition), rendered reason text in the run's language (`NVARCHAR`, searchable). One row per stored violation. Indexed by run_id.
- Retention policy (configurable): keep the last N runs per control or the last X days; implemented as a cleanup command, documented.

### 4.3 Business glossary — a versioned JSON file in the Python service
Describes `hr` in business language. Contents:
- **Entities**: key (e.g. `employee`), physical table, key column, display names (`{he, en}`, singular and plural), description, which fields identify a record in result tables (e.g. first name + last name + employee number), whether it may be a root entity, visibility, and optionally a `lifecycle`: the field that says a record is active and the value that means it.
- **Fields** per entity: key, display name `{he, en}`, description, data type (number, text, date, bool, enum), physical column **or** a computed kind from a closed whitelist implemented in the engine (e.g. `age_years` derived from birth_date), nullable, visible (technical columns such as surrogate keys are hidden), allowed operators (derived from type unless overridden), unit, enum values with labels `{he, en}`, `required` (always, while active or while inactive: what the suggestion heuristics read) and `comparable` (false for a computed field and for a field that only says whether a link exists; such a field is never a side of a field-to-field comparison).
- **Relationships**: key (e.g. `employee.department`), from entity, to entity, join columns, cardinality (many-to-one, one-to-one, one-to-many), label `{he, en}` as seen by the user ("המחלקה של העובד").
- **Operators**: key, arity, applicable types, whether the right side may be another field, and three texts with named placeholders (field label, actual value, threshold): the `label` in the picker, the `sentence` clause of the rule and the `reason` of a violation. Each text holds variants, every variant `{he, en}`, chosen by the field's type and by whether the right side is a field (`<type>.field`, `field`, `<type>`, `default`), so Hebrew can say "מוקדם מ" for a date and "קטן מ" for a number.
- **Limits**: nesting depth 4, 30 conditions, 100 values in a list, 500 values in a definition, paths of 2 hops. They live in the glossary because the schema cannot express depth or totals; the schema repeats the two it can express and `scripts/contracts-check.py` asserts that they agree.
- **Formats and phrases**: per language, the date pattern and the number format, and the words that join clauses (and, or, the list separator, a field reached through a relationship, "at least one" and "none" of the related records).
- **Suggestion texts**: the name, description and rationale of each kind of proposed control and the text of its evidence, `{he, en}`. The glossary holds meaning only: no threshold, range or other rule parameter.
- **Glossary version**: a version string; part of the compile-cache key.

Rules:
- Only many-to-one and one-to-one relationships may be traversed as field paths from the root, up to two hops ("the ministry of the department of the employee").
- One-to-many relationships are usable only as quantified sub-conditions ("there is at least one / there is none" of the related records matching a sub-tree). This prevents row multiplication.
- At startup the engine checks every physical table and column in the glossary against the database's information schema and refuses to start on a mismatch, with a clear log message.
- Changing the glossary means changing the file and redeploying the engine. A database-backed glossary with an admin UI is listed as an extension.

---

## 5. The control definition contract

A control definition is a JSON document, versioned by `schemaVersion`, containing:
- the root entity key;
- a condition tree: a **group** node has an operator (AND / OR) and children; a child is another group, a **condition** or a **related** node;
- a **condition** has a stable id (used for reasons), a left field reference (optional relationship path + field key), an operator, and either a literal value, a list of values, or a reference to another field of a compatible type (field-to-field comparison, e.g. termination date earlier than hire date);
- a **related** node names a one-to-many relationship, a quantifier (any / none) and its own condition sub-tree evaluated on the related entity.

One illustrative example (the first assignment example):

```json
{
  "schemaVersion": 1,
  "rootEntity": "employee",
  "where": { "type": "group", "op": "and", "children": [
    { "type": "condition", "id": "c1", "left": { "field": "age" }, "operator": "lt", "value": 18 },
    { "type": "condition", "id": "c2", "left": { "field": "salary" }, "operator": "gt", "value": 15000 }
  ] }
}
```

Semantics and limits:
- Semantics are always "violation when": a record matching the tree is a violation.
- NULL behaviour follows SQL: a comparison against NULL does not match; explicit operators `is_null`, `is_not_null`, `is_empty`, `is_not_empty` detect missing data. The UI explains this next to the operator picker.
- Limits enforced by validation: maximum nesting depth, maximum number of conditions, maximum values in a list, relationship paths of at most two hops.
- The JSON Schema for the contract is a single file shared by the .NET API (structural validation) and the Python engine (structural + semantic validation).

Validation layers, each with a different job:
1. **Angular**: user convenience — required fields, type-appropriate inputs. Not trusted.
2. **.NET**: structural — JSON Schema conformance, size limits. The system boundary.
3. **Python**: semantic and authoritative — field exists and is visible, operator allowed for the type, value type matches, relationship path reachable, enum values exist. Runs on every compile. On save, .NET calls the engine's validate endpoint (a dry compile) so semantic errors are caught before persisting. Validation errors are returned as a code, a JSON path and parameters; never as prose.

### 5.1 The `contracts/` folder — the only channel between the services

Written and committed **before** the engine, API and client tasks start; they run in parallel against it.

| File | What it fixes |
|---|---|
| `contracts/control-definition.schema.json` | The definition JSON (§5): node types, operators, limits |
| `contracts/glossary.json` | The glossary (§4.3): entity, field, relationship and operator **keys**, labels `{he, en}`, reason templates. The engine loads this very file |
| `contracts/examples/*.json` | The four assignment controls plus two more, each with the record keys it must flag in the seed data (the engine's integration tests and the client's e2e both use them) |
| `contracts/api.md` | Both HTTP APIs on one page: path, method, request JSON, response JSON, error codes with parameters. Engine endpoints (§6) and application API (§7) |
| `contracts/errors.md` | The closed list of error codes and reason keys with their parameters; `he.json` and `en.json` carry the text for each |

A change to any of these after the parallel tasks have started is one commit to `contracts/` plus one line pasted into the other sessions. No other coordination exists.

---

## 6. Python control engine — internal design

Modules (one service, clear internal boundaries):
- **glossary**: loads the JSON file, exposes typed lookups, performs the startup check against the database.
- **validator**: validates a definition against the schema and the glossary; returns errors as code + JSON path + parameters.
- **compiler**: turns a validated definition into a parameterized SELECT using a SQL builder library (identifiers only from the glossary, values only as bound parameters); resolves relationship paths into joins (many-to-one) or EXISTS / NOT EXISTS sub-queries (one-to-many); emits one computed flag per condition for reasons; rewrites computed fields into index-friendly predicates (e.g. age thresholds become birth-date ranges based on the run date).
- **executor**: runs two statements under the read-only login — an exact count and a capped, deterministically ordered page of rows — with a per-statement timeout.
- **explainer**: produces, per violation, the structured reasons (reason key + parameters per matched condition) and the rendered reason text in the requested language, from the glossary's templates and labels and the actual values.
- **cache**: in-memory map from hash(definition JSON + glossary version + engine version) to the compiled statement. Saves validation and compilation for unchanged definitions. It never caches results; every run queries the database.
- **suggestions**: computes aggregate statistics on `hr` (null rates, ranges, distinct counts, FK orphans, date-pair sanity), derives heuristic control suggestions, optionally asks an LLM (only glossary and aggregates are sent, never row values), validates every suggestion through the validator and compiler, and returns suggestions as control definitions with name, description, rationale and evidence in the requested language. Works without an LLM key (heuristics only). Built from the start, inside the engine task.

Endpoints (all JSON, errors as problem details with stable codes; the language comes from `Accept-Language`, default `he`):
- `GET /health` — service and database connectivity.
- `GET /glossary` — the glossary for UI consumption (keys, labels in both languages, types, operators, relationships), and its version.
- `POST /validate` — dry compile; returns validation errors or the preview sentence of the rule in the requested language.
- `POST /run` — input: a definition, the run date (default today, Asia/Jerusalem), the row cap; output: total count, violations with display fields, matched condition ids, structured reasons and rendered reason text, duration. Stateless.
- `POST /suggest` — returns suggested definitions.
- `GET /debug/compile` — developer-only: returns the SQL a definition would produce. Disabled by default, enabled by configuration. Nothing in the normal flow transfers SQL text.

Engine error codes (mapped by .NET to HTTP statuses; text comes from the client's translation files): `DEFINITION_INVALID`, `GLOSSARY_MISMATCH`, `QUERY_TIMEOUT`, `ROW_CAP_EXCEEDED` (informational), `DATABASE_UNAVAILABLE`.

---

## 7. .NET API — internal design

Modules:
- **Glossary**: fetches from the engine at startup and on demand, caches in memory, exposes it to the client.
- **Controls**: CRUD with versions. Create and update validate structurally, then call the engine's validate endpoint, then persist a new immutable version. Delete archives (soft delete). Optimistic concurrency returns a conflict on stale edits.
- **Runs**: starts a run record, loads the current definition version, calls the engine `run` with the client's language, persists the snapshot (count, rows, structured reasons, rendered text), closes the run with status and duration. Serves run history per control and the paged, filterable, searchable, sortable results of a run from the snapshot. Never calls the engine for paging.
- **Suggestions**: proxies the engine's suggestions to the client; an "accept" creates ordinary controls through the Controls module.
- **EngineClient**: typed HTTP client with timeouts longer than the engine's query timeout, a single retry (runs are read-only, so retry is safe), a circuit breaker, a correlation id and the language forwarded on every call, and mapping of engine error codes to application errors.
- **Error handling**: one uniform problem-details response shape for all errors, with a stable code, parameters, and a JSON path for validation errors so the editor can highlight the offending condition. No user-facing prose in the API; the client renders the code through its translation files. Internal details (stack traces, SQL) never reach the client.
- **OpenAPI** documentation for all endpoints.
- **Static hosting** of the Angular production build, so graders run one web process.

API surface (resource-oriented, versioned under `/api/v1`):
- glossary: read.
- controls: list (filter by name, entity, active), create, read, update, archive, versions.
- controls/{id}/validate — dry validation with preview.
- controls/{id}/runs — start a run; list runs.
- runs/{id} — summary; runs/{id}/results — paged, filtered, searched, sorted snapshot.
- suggestions — request; suggestions/accept — create controls from accepted suggestions.
- health.

---

## 8. Angular client — internal design

Screens:
1. **Controls list** (home): name, description, root entity, last run time, last violation count, actions (run, edit, duplicate). Search and filter. No separate dashboard.
2. **Control editor**: name, description, root entity picker with a small relationship map (Ministry → Department → Employee as labelled chips, fed from the glossary), recursive condition builder (groups with AND/OR, condition rows with field picker grouped by entity and relationship label, operator picker filtered by type, value input by type including "compare to another field", quantified related-records node), live sentence preview, validation messages attached to the offending row, save / save-and-run.
3. **Run results**: summary (total violations, scanned entity, duration, previous run count), per-condition breakdown, violations table with reason column and highlighted offending values, search, filter, sort, paging served from the snapshot; clear messages for zero violations, cap exceeded, timeout, and definitions referencing glossary fields that no longer exist.
4. **Suggestions dialog**: list of suggested controls with rationale and evidence, select, open in editor, create selected.

Design constraints:
- **i18n**: a translation service with JSON files (`he.json` default and fallback, `en.json` beside it); every user-facing string is `t('key')`; glossary labels are read from the glossary in the active language; error codes and reason keys from the APIs resolve to text here. No Hebrew literal anywhere in code or templates.
- **RTL**: document direction follows the language (`dir="rtl"` for Hebrew), logical CSS properties only, Hebrew locale for dates and numbers.
- **Responsive, mobile first**: the three screens work at 390 px (results table as card rows, editor stacked), 1024 and 1440. Verified by screenshots at every gate.
- Visual design (palette, type, components, motion) comes from `docs/design.md`, produced before the client task with the design skills; this document does not decide it.
- State: signals for editor and screen state; services for server communication and glossary caching. No global state library.
- Reusable components: condition group (recursive), condition row, field picker, operator picker, value input, related-records node, rule sentence preview, relationship map, results table, run summary, error banner, confirm dialog. The editor and the suggestions dialog reuse the same components.
- Errors: an interceptor converts problem-details responses (code + parameters) into translated messages; validation errors map to editor rows by JSON path.
- Accessibility basics: labels, keyboard navigation, focus states, sufficient contrast.

---

## 9. Key flows

**Save a control.** Client builds the definition JSON → .NET validates structure → .NET asks the engine to validate (dry compile) → .NET persists a new immutable version → client shows the preview sentence.

**Run a control.** Client requests a run → .NET loads the current version and opens a run record → .NET sends the full definition JSON, the run date and the language to the engine → engine validates, hits or fills the compile cache, compiles, executes count + capped page under the read-only login → engine returns violations, matched condition ids, structured and rendered reasons, and the total → .NET stores the snapshot and closes the run → client shows the summary; all subsequent paging, search and filtering are served from the snapshot by .NET. Organization data is touched exactly once per run.

**View results.** Every page, filter and search is a query on `dq.RunResult` for that run. Python is not involved.

**Suggestions.** Client requests suggestions → .NET calls the engine → engine computes statistics, applies heuristics, optionally queries an LLM with glossary and aggregates only, validates each suggestion through the compiler, drops invalid ones → client shows them as drafts → user accepts some → .NET creates ordinary controls (new versions) → they are run like any other control. Nothing is saved or run automatically.

**Startup.** Engine loads the glossary, validates it against the database, fails fast on mismatch. .NET fetches the glossary, verifies database connectivity, exposes health.

---

## 10. Security model (four independent layers)

1. **Identifiers only from the glossary.** Table and column names never come from any caller; the client sends glossary keys, the engine resolves them. Unknown or hidden keys are rejected.
2. **Values only as bound parameters.** No string concatenation of user values, ever. Operators come from a closed list.
3. **Read-only execution.** The engine's login can only SELECT on `hr`. Even a compiler bug cannot modify data. Only a single SELECT statement is ever compiled; stacked statements are impossible by construction and additionally rejected.
4. **Bounded execution.** Row cap, statement timeout, nesting and size limits, deterministic ordering.

Additional: the .NET login cannot read `hr`; configuration and secrets come from environment variables, never from code; error responses never leak SQL or stack traces; CORS restricted; no authentication/authorization in v1 (internal tool; listed as an extension, along with audit of who ran what).

---

## 11. Performance and scale

- **Compile cache** (engine memory) keyed by definition hash + glossary version + engine version: unchanged definitions skip validation and compilation.
- **Result snapshot per run**: paging, filtering and search never re-query organization data and are consistent across pages.
- **Row cap per run** (configurable, e.g. 5,000): stored violations are capped, the total count is exact; the UI tells the user to narrow the control when the cap is exceeded.
- **Index-friendly predicates**: computed fields are compiled into range predicates on stored columns; indexes on FK and filtered columns are part of the seed.
- **No row multiplication**: many-to-one via joins, one-to-many via EXISTS/NOT EXISTS.
- **Retention**: cleanup of old run results by policy.
- Extensions (documented, not built): asynchronous runs with polling for long controls; scheduling; export of results; horizontal scaling of the stateless engine.

---

## 12. Error handling (what the business user sees)

Every error has a stable code, an HTTP status, parameters, and a translated message written for a non-technical user, for example: definition invalid (highlight the row, say what to fix), control references a field that no longer exists in the glossary (edit the control), query timed out (narrow the conditions or contact the administrator), engine unavailable (try again later), no violations (positive confirmation, not an empty table), cap exceeded (how many were found, how many are shown). The codes live in `contracts/errors.md`; the text lives in the client's translation files. Technical details are logged with the correlation id and never shown.

---

## 13. Testing strategy (proportional to one week)

- **Engine (highest value)**: golden tests — each example definition produces the expected SQL shape and parameters; validation tests for every rejection path (unknown field, wrong operator for type, type mismatch, unreachable path, depth and size limits); injection attempts as values are bound and return nothing; NULL semantics; integration tests against the seeded database asserting the exact violating record ids for each example in `contracts/examples/`, including boundary rows.
- **.NET**: structural validation, controller status codes, concurrency conflict, engine client behaviour for timeout and unavailability, snapshot paging and filtering.
- **Angular**: a few focused tests — adding/removing conditions and groups, preview sentence, mapping of validation errors to rows; Playwright e2e through the six examples with screenshots at 390 and 1440.
- Each task carries its own tests and gate; the delivery task runs the whole system from a clean clone.
- All tests runnable with one command per project, documented in the README.

---

## 14. Deployment and running

- **Docker Compose**: SQL Server 2022, a one-shot init container running the SQL scripts, the Python engine, the .NET API serving the built Angular app. Health checks and startup ordering.
- **Manual path (assume no Docker and possibly no internet at the grader's machine)**: run the SQL scripts in SSMS or sqlcmd on a local SQL Server; start the engine with a local Python environment (ship dependency wheels or a lock file); start the .NET API with the Angular build already in its static folder so Node is not required. One script to start everything.
- Configuration by environment variables: connection strings for the two logins, engine URL, row cap, timeouts, default language, time zone (Asia/Jerusalem), optional LLM key, debug endpoint flag. Example env files provided; no secrets committed.
- The AI suggestions feature must work with heuristics alone when no LLM key is configured.
- The SQL Server 2022 image is x86-64 only; on Apple Silicon it runs under Docker Desktop's Rosetta emulation, and the manual path is the fallback. Stated in the README.

---

## 15. AI-assisted development policy (required by the assignment)

AI coding tools (Claude Code with a project harness: `CLAUDE.md`, skills, rules, hooks, task plans with gates and review passes) are used for scaffolding, boilerplate, tests, documentation drafts and refactoring. The harness lives in the repository (`.claude/`) and is part of the submission, so the graders see how the work was organised. All generated code is reviewed by the developer before merge. The developer owns and must be able to explain every design decision in this document. Runtime SQL generation is deterministic code, never an AI call. This is documented in `docs/ai-usage.md` with tool, purpose and what was reviewed or rewritten.

---

## 16. Repository layout

```
data-controls/
  README.md
  .claude/        Claude Code harness: CLAUDE.md, skills, rules, hooks (committed)
  docs/           architecture, design, control-definition, glossary, examples, assumptions, ai-usage
  contracts/      control-definition.schema.json, glossary.json, examples/, api.md, errors.md
  sql/            schema, security (logins), seed data, indexes, cleanup
  engine/         Python FastAPI service (loads contracts/glossary.json)
  api/            .NET 10 (LTS) Web API
  web/            Angular app (src/assets/i18n/he.json, en.json)
  docker-compose.yml
  scripts/        run-all for the manual path
```

---

## 17. Documentation deliverables

| File | Content |
|---|---|
| `README.md` | What the system is (3 paragraphs), architecture diagram, quick start with Docker, manual run path, configuration, how to run tests, demo walkthrough (create a control, run, read results, try suggestions), links to the docs below |
| `docs/architecture.md` | Components and responsibilities, boundaries and prohibitions, data model, flows, security layers, performance decisions, decision record (why this split, why glossary as file, why snapshot paging, why no SQL over the wire, why English code with Hebrew from data) |
| `docs/design.md` | The visual design decisions for the client (direction, tokens, components, responsive rules), produced before the client task |
| `docs/control-definition.md` | The JSON contract: structure, node types, operators per type, NULL semantics, limits, versioning, validation layers |
| `docs/glossary.md` | How the business glossary is structured, how to add an entity, field, relationship, computed field or language, startup validation |
| `docs/examples.md` | The four assignment controls plus at least two more, each with its Hebrew description, its JSON definition, the records it flags in the seed data and why |
| `docs/assumptions-limitations-extensions.md` | Assumptions (violation semantics, single root entity, two-hop paths, synchronous runs), limitations (row cap, glossary redeploy, no auth), extensions (async runs, scheduling, export, glossary admin UI, authentication and audit, rule-must-hold mode, templated controls across entities) |
| `docs/ai-usage.md` | AI tools used in development, the harness, for what, and the review policy |
| `sql/README.md` | Order of scripts, what each creates, the planted violations and the expected results per example control |

---

## 18. Assignment requirements — complete checklist

Translated from the assignment; the original Hebrew is in the appendix. Every item must be satisfied and demonstrable.

**General**
- Done independently. AI tools must be used during development, and the submission must state which tools and for what purposes. The candidate must understand the solution and be able to explain design and implementation decisions.

**Data structure**
- A sample database with several related tables, filled with valid and invalid sample data.
- The controls mechanism works generically on the data structure; it must not rely on field and table names fixed in code.

**Control definition**
- A UI for a business user to create a new control, without knowing the database structure or writing SQL.
- Name and description; selection of the business data the control applies to; logical conditions including combinations of several conditions; save and edit; reuse of created controls.
- A friendly way to present the data and the relationships between them in business terms, not technical table and field names.

**Query generation and execution**
- A generic mechanism translating the control definition into a suitable SQL query.
- Running a control over all relevant data and receiving the records that do not satisfy the control (the violations).
- Dynamic query generation; support for complex conditions and relationships between tables; separation between control definition and query implementation; prevention of dangerous commands or data modification; error handling with appropriate messages.
- No fixed query per control.

**Results display**
- A screen with: the list of defined controls; running a control from the list; the number of violating records; the violating records in a table; the reason each record failed; filtering and search in results.
- Clear, convenient, responsive UI.

**Advanced (optional)**
- A capability where AI analyzes the database structure and proactively proposes relevant data-quality controls.

**Technology — Backend**
- .NET Web API; Python; orderly architecture with separation of responsibilities between components; SQL Server; appropriate mechanisms for secure dynamic SQL generation.

**Technology — Frontend**
- Angular; Hebrew UI with RTL direction; reusable components; UX suited to business users.

**Technology — Database**
- SQL Server; sample data tables; a mechanism for storing control definitions; data demonstrating success and failure cases.

**Deliverables**
- Full source code of client and server.
- Scripts to create the database and load sample data.
- Installation and run instructions.
- A short document describing the architecture and the controls mechanism.
- Examples of controls that can be defined and run.
- A short description of working assumptions, limitations and possible extensions.
- A description of the AI tools used and the purpose of each.

**Evaluation focus (what graders look at)**
- Genericity: how far new controls can be added without code changes.
- Architectural thinking: correct separation between control definition, translation to query, and execution.
- Business thinking and UX: accessibility of the solution to a non-technical user.
- Backend quality: API design, code structure, security, error handling.
- Frontend quality: component organization, state management, user experience.
- SQL: handling data, relationships between tables, performance.
- Code quality: readability, maintainability, tests, edge cases.

---

## 19. Work plan — five tasks, three of them in parallel

Each task is its own `/task-plan` with a plan, gates and a review pass; Fable plans, Opus executes.

| Task | Ships | Gate | Runs |
|---|---|---|---|
| **1 `dc-contracts`** | repository skeleton, harness, Docker Compose with SQL Server + init container, `sql/` (hr, dq, two logins, Hebrew seed with planted violations, indexes), the whole `contracts/` folder (§5.1), `docs/architecture.md` (this document, trimmed), README skeleton | `docker compose up db` + init on a clean container; a check script prints the expected violating records per example; the schema validates all six examples | first, alone; nothing else starts before its gate |
| **2 `dc-engine`** | glossary loader + startup check, validator, compiler, executor, explainer, cache, suggestions (heuristics + optional LLM), all endpoints | golden tests for the six examples; every rejection path; injection values bound; integration against the seed returns the exact planted ids; `/suggest` yields the four assignment controls from the seed with no key | parallel, own worktree |
| **3 `dc-api`** | glossary cache, controls + versions + concurrency, runs + snapshot, paging/filter/search/sort, suggestions proxy + accept, engine client with resilience and error mapping, problem details, OpenAPI, static hosting | tests for validation, status codes, conflict, timeout/unavailable mapping, snapshot paging; the API answers every call in `contracts/api.md` | parallel, own worktree |
| **4 `dc-web`** | i18n shell (he/en, RTL), controls list, editor (builder, pickers, relationship map, preview, errors by JSON path), results screen with all states, suggestions dialog, per `docs/design.md` | Playwright: create → save → run → read results on the six examples; screenshots at 390 and 1440; the design skills' critique and polish applied once | parallel, own worktree; starts on what needs no API (shell, i18n, components) and wires to the real API as it lands |
| **5 `dc-delivery`** | compose end to end from a fresh clone, the manual path script, all docs in §17, `docs/ai-usage.md`, the §18 checklist ticked | a clean machine runs both paths first time; six examples run from the UI | last, short |

Parallel rules: one SQL Server container on the machine, started from the main tree and shared by every session; never two test suites at once; a contract change goes through `contracts/` plus one line to the other sessions; nothing is pushed or merged without the developer's word; one PR per task.

---

## 20. Out of scope for v1 (listed as extensions in the docs)

Authentication, authorization and per-user audit; scheduling of runs; asynchronous long-running runs; export of results; glossary administration UI and database-backed glossary; "rule must hold" semantics mode; templated controls applied across several entities; marking violations as handled; notifications.

---

## Appendix A — The assignment, verbatim (Hebrew)

```
מבחן Fullstack – מערכת בקרות נתונים דינאמית
טכנולוגיות: PYTHON, .NET, Angular, SQL Server
נושא: פיתוח מערכת גנרית להגדרת בקרות, הרצתן וניתוח חריגות בנתונים.

הנחיות כלליות לביצוע המבחן
המבחן יבוצע באופן עצמאי בלבד. יש להשתמש בכלי AI במהלך הפיתוח ולציין בהגשה באילו כלים
נעשה שימוש ולאילו מטרות. על המועמד להבין את הפתרון שהגיש ולהיות מסוגל להסביר את החלטות
התכנון והמימוש.

רקע
ארגון מחזיק בבסיס נתונים הכולל מידע עסקי רב. על הנתונים נדרשות להתבצע בקרות שונות לצורך
איתור שגיאות, חריגות וחוסר עקביות.
הבקרות משתנות מעת לעת, בהתאם לצרכים העסקיים, ולכן נדרשת מערכת גנרית שתאפשר להגדיר
בקרות חדשות, לעדכן בקרות קיימות ולהריץ אותן, ללא צורך בפיתוח קוד חדש עבור כל בקרה.
המשתמשים במערכת הם משתמשים עסקיים, המכירים את משמעות הנתונים אך אינם מכירים SQL,
את מבנה הטבלאות או את הקשרים ביניהן.
לדוגמה, משתמש עסקי עשוי לבקש:
• איתור עובדים שגילם נמוך מ־18 ושכרם גבוה מ־15,000 ש"ח.
• איתור עובדים שתאריך סיום העסקתם מוקדם מתאריך תחילת העסקתם.
• איתור עובדים פעילים המשויכים למחלקה שאינה פעילה.
• איתור רשומות שבהן חסרים נתונים המחויבים לפי כללים עסקיים.
אלו דוגמאות בלבד. הפתרון צריך לתמוך בהגדרת בקרות נוספות באופן גנרי, ללא פיתוח ייעודי
עבור כל בקרה.

פיתוח מערכת בקרות גנרית
יש לפתח מערכת Web הכוללת צד לקוח, צד שרת ובסיס נתונים.

• מבנה הנתונים
יש ליצור בסיס נתונים לדוגמה המכיל מספר טבלאות בעלות קשרים ביניהן, ולמלא אותו בנתוני
דוגמה תקינים ושגויים.
יש לאפשר למנגנון הבקרות לעבוד על מבנה הנתונים באופן גנרי, ולא להתבסס על שמות שדות
וטבלאות הקבועים בקוד.

• הגדרת בקרה
יש לפתח ממשק המאפשר למשתמש עסקי ליצור בקרה חדשה.
המשתמש אינו נדרש להכיר את מבנה בסיס הנתונים או לכתוב SQL.
על המערכת לאפשר:
• הגדרת שם ותיאור לבקרה.
• בחירת הנתונים העסקיים שעליהם תתבצע הבקרה.
• הגדרת תנאים לוגיים, לרבות שילוב של מספר תנאים.
• שמירה ועריכה של בקרות.
• שימוש חוזר בבקרות שנוצרו.
יש לחשוב על דרך ידידותית להציג למשתמש את הנתונים והקשרים ביניהם, באמצעות מונחים
עסקיים ולא באמצעות שמות טבלאות ושדות טכניים.

• יצירת שאילתות והרצת בקרות
יש לפתח מנגנון גנרי המתרגם את הגדרת הבקרה לשאילתת SQL מתאימה.
המערכת תאפשר להריץ בקרה על כלל הנתונים הרלוונטיים ולקבל את הרשומות שאינן עומדות
בתנאי הבקרה.
דרישות:
• יצירת שאילתות באופן דינאמי.
• תמיכה בתנאים מורכבים ובקשרים בין טבלאות.
• הפרדה בין הגדרת הבקרה לבין מימוש השאילתה.
• מניעת הרצת פקודות מסוכנות או שינוי הנתונים.
• טיפול בשגיאות והצגת הודעות מתאימות.
אין לממש שאילתה קבועה עבור כל בקרה.

• הצגת תוצאות
יש לפתח מסך המאפשר:
• צפייה ברשימת הבקרות שהוגדרו.
• הפעלת בקרה מתוך הרשימה.
• צפייה במספר הרשומות החריגות שהתגלו.
• הצגת הרשומות החריגות בטבלה.
• הצגת הסיבה לכך שרשומה נכשלה בבקרה.
• סינון וחיפוש בתוצאות.
יש להקפיד על ממשק משתמש ברור, נוח ורספונסיבי.

משימה מתקדמת – רשות: תכנון יכולת שבה ה־AI מנתח את מבנה בסיס הנתונים ומציע באופן יזום
בקרות איכות נתונים רלוונטיות.

דרישות טכנולוגיות
Backend
• .NET Web API
• PYTHON
• ארכיטקטורה מסודרת והפרדת אחריות בין רכיבי המערכת.
• עבודה מול SQL Server.
• שימוש במנגנונים מתאימים ליצירת SQL דינאמי מאובטח.
Frontend
• Angular
• ממשק משתמש בעברית ובכיווניות RTL.
• רכיבים לשימוש חוזר.
• חוויית משתמש המתאימה למשתמשים עסקיים.
Database
• SQL Server.
• טבלאות נתונים לדוגמה.
• מנגנון לשמירת הגדרות הבקרות.
• נתונים המדגימים מקרי הצלחה וכישלון.

תוצרים להגשה
• קוד מקור מלא של צד הלקוח וצד השרת.
• סקריפטים להקמת בסיס הנתונים וטעינת נתוני דוגמה.
• הוראות התקנה והרצה.
• מסמך קצר המתאר את הארכיטקטורה ואת מנגנון הבקרות.
• דוגמאות לבקרות שניתן להגדיר ולהריץ.
• פירוט קצר של הנחות העבודה, המגבלות והרחבות אפשריות.
• פירוט כלי ה־AI שבהם נעשה שימוש ומטרת השימוש בכל אחד מהם.

דגשים להערכת הפתרון
ההערכה תתמקד ביכולת לתכנן ולפתח פתרון הניתן להרחבה, ולא רק ביכולת להציג מסכים או
להריץ שאילתות.
ייבחנו במיוחד:
• גנריות: עד כמה ניתן להוסיף בקרות ללא שינוי קוד.
• חשיבה ארכיטקטונית: הפרדה נכונה בין הגדרת בקרה, תרגום לשאילתה והרצה.
• חשיבה עסקית ו־UX: עד כמה הפתרון נגיש למשתמש שאינו טכנולוגי.
• איכות Backend: תכנון API, מבנה הקוד, אבטחה וטיפול בשגיאות.
• איכות Frontend: ארגון רכיבים, ניהול מצב וחוויית משתמש.
• SQL: התמודדות עם נתונים, קשרים בין טבלאות וביצועים.
• איכות קוד: קריאות, תחזוקתיות, בדיקות וטיפול במקרי קצה.
בהצלחה!
```