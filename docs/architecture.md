# Dynamic Data Controls System: architecture

**Purpose of this document.** This is the long reference of the system: what it is, the responsibilities and
boundaries of every component, the contracts between them, the decisions and the reasons for them, and the
assignment's checklist with the evidence for each item (§18). It was written before the build, as the master
plan that five tasks were cut from, and corrected after the build to what was built; §19 keeps the plan of
those tasks and adds what each one delivered. It avoids implementation syntax: paths, payloads and codes are in
`contracts/`, and commands are in the [README](../README.md).

The short version, one to two pages with the controls mechanism and the design of the AI suggestions, is
[summarize-architecture.md](summarize-architecture.md). The visual design of the client is
[design.md](design.md). The assignment itself is Appendix A.

**Context.** A one-week take-home assignment from the Israel Central Bureau of Statistics (CBS, למ"ס): received
8 Nov 2026, submitted by **15 Nov 2026**. Position: CBS tender 59-2026 (call 2000028645), software developer,
Jerusalem. Stack of the position: .NET / .NET Core, Angular or React, REST API design, Python, databases, Git,
cloud (GCP preferred).

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
8. **English code, Hebrew from data.** Source code, identifiers, keys, logs, comments and tests are English only. Hebrew exists in exactly two kinds of data files: the client's translation file (`web/src/assets/i18n/he.json`) and the glossary (every label and reason template is keyed by language: `{ "he": … }`). The mechanism is multilingual and v1 ships Hebrew alone: another language is one more translation file and one more value under each text. Everything that crosses a service boundary is a **key** (field keys, operator keys, error codes, reason keys) plus parameters; text is rendered from data at the edge, in the requested language, Hebrew by default. Seed data values (ministry names, people) are data and may be Hebrew.
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

The **business glossary** is a versioned JSON file, `contracts/glossary.json` (not a database table). The Python service loads it at startup, validates it against the real database structure, and serves its public form (no table or column names) to the .NET API through an endpoint.

The three services agree on their shared shapes through one folder, `contracts/` (§5.1), written first and changed only deliberately.

### 3.1 Responsibilities and prohibitions per component

**Angular client**
- Owns: one page, the controls list, with the control editor, the run results and the suggestions opening in a panel over it; building the control definition JSON from user choices; presenting results, reasons and errors; responsive layout, mobile first.
- Receives the glossary from the API and renders all pickers from it, using the glossary's labels in the active language.
- Must never: contain field or table names in code; contain Hebrew strings in code (only keys resolved from `i18n/*.json`); send SQL; render a rule sentence or a reason itself (they arrive rendered by the engine, as text and as parts); be trusted for validation (its validation is UX only).

**.NET 10 (LTS) Web API (application layer)**
- Owns: control lifecycle (create, read, update, delete/archive, versions, optimistic concurrency); structural validation of definitions; orchestration of runs; persistence of runs and result snapshots; paging, filtering, sorting and search over stored results; the suggestions approval flow; uniform error responses (code + parameters, no prose); OpenAPI; serving the built Angular app.
- Reads the glossary from the engine and caches it in memory. Forwards the client's language (`Accept-Language`) to the engine.
- Must never: build or execute dynamic SQL; access schema `hr`; execute SQL text received from any other component; hard-code user-facing text.

**Python FastAPI service (control engine)**
- Owns: the glossary (file, loader, startup validation against the database); semantic validation of definitions; compilation of a definition into a parameterized SELECT; execution under the read-only login with row cap and timeout; computing per-condition flags and rendering reasons from glossary templates in the requested language; the compile cache; the suggestions module (data statistics, heuristics).
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

Four more decisions that shape the system:

- **The glossary is a file, not a table.** It is reviewed and versioned with the code that depends on it, it is the same file in every environment, and the engine can refuse to start when it disagrees with the database. A table would need an administration screen, migrations and its own validation, and would let the vocabulary drift from the contracts. The cost is a restart of the engine for every change; a database-backed glossary is an extension (§20).
- **Results are a snapshot, and paging is served from it.** A run stores its count, its sentences and every flagged record with its reasons. Paging, search, filtering and sorting read the snapshot, so the organization's data is touched once per run, the pages of one run agree with each other while the data changes, and a run can be read again later, next to the version of the rule that produced it. Paging by running the query again was rejected: it reads `hr` on every click and gives pages that do not belong to the same moment.
- **No SQL crosses a service boundary.** The api sends a definition and receives records and reasons. It never receives SQL to execute, and the engine never accepts SQL or identifiers. This removes the endpoint a security reviewer would attack first ("run this SQL"), and it keeps dynamic SQL in exactly one process, whose login can only read. The one place SQL text leaves the engine is the developer endpoint `/debug/compile`, off by default and not exposed by the api.
- **English code, Hebrew from data.** Code, keys, logs and tests are English; every Hebrew word is data, in two kinds of files (the client's translation file and the glossary). Everything that crosses a boundary is a key with parameters, and text is rendered at the edge. A second language is then a translation file and one more value under each text of the glossary, with no code change; and no service can drift from another in wording, because only one of them, the engine, renders sentences and reasons.

---

## 4. Data model

### 4.1 Schema `hr` — sample organization data
Three related tables so that relationships of two hops can be demonstrated: **Ministry → Department → Employee**.
- Ministry: id, name, is_active.
- Department: id, ministry_id (FK), name, is_active, manager_employee_id (nullable).
- Employee: id, department_id (FK), national_id, first_name, last_name, email, birth_date, hire_date, termination_date (nullable), salary, status (active/inactive).
- Text columns are `NVARCHAR` (Unicode); the database collation is `Hebrew_CI_AS`. Seed values are Hebrew where a real CBS user would expect Hebrew (ministry and department names, people's names); column and table names are English.
- Seed data: 5 ministries, 16 departments and 85 employees, all invented. For every example control there are several rows that pass and several that fail, each planted violation marked with a comment in the seed script. Include boundary cases (an employee who turns 18 on the run date, NULL salaries, NULL termination dates, an employee with no department, an active employee with an empty email, an inactive employee with no termination date).
- Indexes: on every FK column, on the columns the example controls filter by (birth_date, status, salary), and on `hr.Employee (department_id, status)` for rules about related records (§11).

### 4.2 Schema `dq` — controls store (written only by .NET)
- **Control**: id, name, description, root_entity_key, current_version, is_active, created/updated timestamps, concurrency token.
- **ControlVersion**: control_id, version number, definition JSON, definition hash, created timestamp. Immutable; an edit that changes the definition creates a new version, an edit of the name or the description alone does not.
- **Run**: id, control_id, control_version, run date, language, started/finished timestamps, status (running / succeeded / failed / timed out), total violation count, stored row count, duration, a summary (JSON: the rule sentence and, per condition, its sentence and its count, so the results screen never needs the engine), error code and parameters if failed, engine version, correlation id.
- **RunResult**: run_id, a sequence number (the stable page order), record key (a string, so a non-integer key needs no contract change), record display fields (JSON), display text (the identifying values joined by a space, for search and sort), matched condition ids, structured reasons (JSON: reason key, parameters and rendered text per matched condition), rendered reason text in the run's language (`NVARCHAR`, searchable). One row per stored violation. Indexed by run_id.
- Retention policy (configurable): keep the last N runs per control or the last X days; implemented as a cleanup command, documented.

### 4.3 Business glossary — a versioned JSON file, loaded by the engine
Describes `hr` in business language. Contents:
- **Entities**: key (e.g. `employee`), physical table, key column, display names (one text per language, singular and plural), description, which fields identify a record in result tables (e.g. first name + last name + employee number), whether it may be a root entity, visibility, and optionally a `lifecycle`: the field that says a record is active and the value that means it.
- **Fields** per entity: key, display name per language, description, data type (number, text, date, bool, enum), physical column **or** a computed kind from a closed whitelist implemented in the engine (e.g. `age_years` derived from birth_date), nullable, visible (technical columns such as surrogate keys are hidden), allowed operators (derived from type unless overridden), unit, enum values with labels per language, `required` (always, while active or while inactive: what the suggestion heuristics read) and `comparable` (false for a computed field and for a field that only says whether a link exists; such a field is never a side of a field-to-field comparison) and `identifier` (a number that names a record, such as an employee number, is written digit for digit and never with a thousands separator).
- **Relationships**: key (e.g. `employee.department`), from entity, to entity, join columns, cardinality (many-to-one, one-to-one, one-to-many), label per language as seen by the user ("המחלקה של העובד").
- **Operators**: key, arity, applicable types, whether the right side may be another field, and three texts with named placeholders (field label, actual value, threshold): the `label` in the picker, the `sentence` clause of the rule and the `reason` of a violation. Each text holds variants, every variant keyed by language, chosen by the field's type and by whether the right side is a field (`<type>.field`, `field`, `<type>`, `default`), so Hebrew can say "לפני" for a date and "מתחת ל־" for a number. No text agrees with the gender of the field: the comparisons use prepositions, and the rest use the colon style ("שכר: חסר").
- **Limits**: nesting depth 4, 30 conditions, 100 values in a list, 500 values in a definition, paths of 2 hops. They live in the glossary because the schema cannot express depth or totals; the schema repeats the two it can express and `scripts/contracts-check.py` asserts that they agree.
- **Formats and phrases**: per language, the date pattern and the number format, and the words that join clauses (and, or, the list separator, a field reached through a relationship, "at least one" and "none" of the related records).
- **Suggestion texts**: the name, description and rationale of each kind of proposed control and the text of its evidence, per language. The glossary holds meaning only: no threshold, range or other rule parameter.
- **Languages**: the list of languages the texts are written in, and the default one. v1 lists Hebrew alone; a request for a language that is not listed is answered in the default.
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
2. **.NET**: structural — JSON Schema conformance, size limits. The system boundary. Its schema layer evaluates a tree of at most 240 nodes and 10,000 JSON values; anything larger is answered by the engine alone, with the error of the limit it breaks. A body with a string that is not Unicode text is refused before any layer, and a definition reaches the engine and the store as the text it was sent in.
3. **Python**: semantic and authoritative — field exists and is visible, operator allowed for the type, value type matches, relationship path reachable, enum values exist. Runs on every compile. On save, .NET calls the engine's validate endpoint (a dry compile) so semantic errors are caught before persisting. Validation errors are returned as a code, a JSON path and parameters; never as prose.

### 5.1 The `contracts/` folder — the only channel between the services

Written and committed **before** the engine, API and client tasks start; they run in parallel against it.

| File | What it fixes |
|---|---|
| `contracts/control-definition.schema.json` | The definition JSON (§5): node types, operators, limits |
| `contracts/glossary.json` | The glossary (§4.3): entity, field, relationship and operator **keys**, labels per language, the sentence and reason templates, limits, formats and suggestion texts. It is the one source of reason and rule-sentence text. The engine loads this very file |
| `contracts/examples/*.json` | The four assignment controls plus two more, each with the record keys it must flag in the seed data and the condition ids matched per record (the engine's integration tests and the client's e2e both use them). `invalid/` holds definitions that must be rejected, each with its layer, expected code and JSON pointer |
| `contracts/api.md` | Both HTTP APIs on one page: path, method, request JSON, response JSON, error codes with parameters. Engine endpoints (§6) and application API (§7). Where it differs from this document, `api.md` wins |
| `contracts/errors.md` | The closed list of error codes, definition error codes, reason keys, evidence keys and part roles with their parameters, and the rules they share (what "matched" means, NULL, depth and count, rendering). `he.json` carries the text of the error codes only; reasons and sentences are rendered by the engine from the glossary |

A change to any of these after the parallel tasks have started is one commit to `contracts/` plus one line pasted into the other sessions. No other coordination exists.

---

## 6. Python control engine — internal design

Modules (one service, clear internal boundaries):
- **glossary**: loads the JSON file, exposes typed lookups, performs the startup check against the database.
- **validator**: validates a definition against the schema and the glossary; returns errors as code + JSON path + parameters.
- **compiler**: turns a validated definition into a parameterized SELECT using a SQL builder library (identifiers only from the glossary, values only as bound parameters); resolves relationship paths into joins (many-to-one) or EXISTS / NOT EXISTS sub-queries (one-to-many); emits one flag column per node that can be a reason (a condition outside a related node, and a related node itself), with "matched" computed from the flags in the outer statement; rewrites computed fields into index-friendly predicates (e.g. age thresholds become birth-date ranges based on the run date).
- **executor**: runs two statements under the read-only login — an exact count and a capped, deterministically ordered page of rows — with a per-statement timeout.
- **explainer**: produces the rule sentence and, per violation, the structured reasons (reason key + parameters per matched condition) and the rendered reason text in the requested language, from the glossary's templates and labels and the actual values. A condition is matched for a record when it is true and every group above it up to the root is true, so a true condition on a failed branch is not a reason. Every rendered text also comes as parts that carry the node id and the role of each piece (field, value, actual value), so a client can mark the conditions without rendering anything itself: the engine is the only renderer.
- **cache**: in-memory map from hash(definition JSON + glossary version + engine version) to the compiled statement. Saves validation and compilation for unchanged definitions. It never caches results; every run queries the database.
- **suggestions**: profiles each rootable entity with one aggregate SELECT (the row count, the missing count of each optional field, the order of each pair of date fields), derives heuristic control suggestions with five generators (`missing_required`, `date_order`, `active_under_inactive` over one and two hops, `active_without_active_children`, `missing_optional`), validates every suggestion through the validator and compiler, counts it on today's date, drops one that flags nothing, and returns the rest as control definitions with name, description, rationale and evidence in the requested language. No generator writes a number into a definition, so the first assignment example (its thresholds are business knowledge) is never proposed. **Designed and not built**: a separate advisor service in which a language model proposes such rules through the same validator and compiler, with no database access and no record values in a prompt. The design is in [summarize-architecture.md](summarize-architecture.md#the-optional-task-ai-that-proposes-controls) and the plan in `dev/active/dc-ai-suggestions/plan.md`.

Endpoints (all JSON, errors as problem details with stable codes; the language comes from `Accept-Language`, default `he`):
- `GET /health` — service and database connectivity.
- `GET /glossary` — the glossary for UI consumption (keys, labels in every language of the glossary, types, operators, relationships), and its version.
- `POST /validate` — dry compile; returns validation errors, or the preview sentence of the rule and one sentence per condition in the requested language.
- `POST /run` — input: a definition, the run date (default today, Asia/Jerusalem), the row cap; output: total count, the rule sentence, a sentence and a count per condition, violations with display fields, matched condition ids, structured reasons and rendered reason text, duration. Stateless.
- `POST /suggest` — returns suggested definitions.
- `POST /debug/compile` — developer-only (a POST, because it carries a definition): returns the two statements a definition would produce, with placeholders in the text and the values beside it. Disabled by default, enabled by configuration. Nothing in the normal flow transfers SQL text.

Engine error codes (mapped by .NET to HTTP statuses; text comes from the client's translation files): `DEFINITION_INVALID`, `GLOSSARY_MISMATCH`, `QUERY_TIMEOUT`, `DATABASE_UNAVAILABLE`. `ROW_CAP_EXCEEDED` is informational and is not sent: the client derives it from the run's counts. The closed list is `contracts/errors.md`.

---

## 7. .NET API — internal design

Modules:
- **Glossary**: fetches from the engine at startup and on demand, caches in memory, exposes it to the client.
- **Controls**: CRUD with versions. Create and update validate structurally, then call the engine's validate endpoint, then persist a new immutable version when the definition changed. Delete archives (soft delete); an archived control is read-only, and there is no un-archive. Optimistic concurrency returns a conflict on stale edits: two saves that race are a 409 whether the row version or the version number collides, and an archive that meets a concurrent save is applied to the row as it is then. The list reads each control's last run in a second query for the page's controls, and sorts by name, root entity, last run or last count on the server.
- **Runs**: starts a run record, loads the current definition version, calls the engine `run` with the client's language, persists the snapshot (count, the summary with the rule sentence and the per-condition counts, rows, structured reasons, rendered text), closes the run with status and duration. Once the control is found, nothing listens to the client: the run row is opened and closed without a cancellation token, and the snapshot and the closed run are stored in one save. A host that stops during the engine call, and a snapshot that cannot be stored, both close the run `failed` with `INTERNAL_ERROR`. Serves run history per control and the paged, filterable, searchable, sortable results of a run from the snapshot (by key, by the identifying text, by any identifying field, or by the number of reasons). Never calls the engine for paging.
- **Suggestions**: proxies the engine's suggestions to the client; an "accept" creates ordinary controls through the Controls module.
- **EngineClient**: typed HTTP client with an attempt timeout (75 s) longer than the engine's worst case for a run (two statements of 30 s), a single retry after 500 ms (runs are read-only, so retry is safe) only for a connection error or a 408, 429, 502 or 503 and never for a health probe, a circuit breaker, a correlation id and the language forwarded on every call, and mapping of engine error codes to application errors. The breaker opens at 5 calls with half of them failed inside two attempt timeouts; it counts a refused connection, an attempt timeout, a 502 and a 503 that is not a problem document, and does not count a 504, the engine's own 503 problem (its database is down) or a health probe. After a failed glossary refresh the engine is not asked again for 30 seconds.
- **Error handling**: one uniform problem-details response shape for all errors, with a stable code, parameters, and a JSON path for validation errors so the editor can highlight the offending condition. No user-facing prose in the API; the client renders the code through its translation files. Internal details (stack traces, SQL) never reach the client.
- **OpenAPI** documentation for all endpoints.
- **Static hosting** of the Angular production build, so graders run one web process. The api serves the `wwwroot` beside the published app, which must be there before the start; a path with a file extension that names no file is a 404 problem, and every other path outside `/api` is `index.html`, served with `Cache-Control: no-cache`. Swagger UI is at `/api/docs` over `/openapi/v1.json`, in every environment.

API surface (resource-oriented, versioned under `/api/v1`):
- glossary: read.
- controls: list (filter by name, entity, active; sort by name, root entity, last run or violations), create, read, update, archive, versions.
- controls/validate — dry validation with preview (no id in the path: a new control has none yet).
- controls/{id}/runs — start a run (the answer is the run, also when it failed: the failure is its status and error); list runs.
- runs/{id} — summary; runs/{id}/results — paged, filtered (by condition), searched, sorted snapshot.
- suggestions — request; suggestions/accept — create controls from accepted suggestions.
- health.

---

## 8. Angular client — internal design

The client is one page. The controls list is the parent route, and the editor, the results and the suggestions open in a panel over it (`/`, `/controls/<id>` with `new` for a control not saved yet, `/runs/<id>`, `/controls/<id>/runs`). Closing the panel returns to the list with its search, tab, order and page as they were.

1. **Controls list** (home): name, description, root entity, last run time, last violation count, and the actions run, edit, duplicate and archive. Search by name, a filter by root entity, two tabs with counts (active, archive), and a sort by any column, done by the server. The details of a row open the results of its last run (or its state before a first run). No separate dashboard.
2. **Control editor**: name, description, and the root entity chosen as the answer to "what to check" from one card per entity, with a chain that shows how the entities connect (fed from the glossary). The condition builder is a flat list with one "all / at least one" switch; nested groups and conditions on related records are behind "advanced". A condition row has a field picker grouped by entity and relationship label, an operator picker filtered by type, and a value input by type, including "compare to another field". The rule in words is the engine's sentence from `POST /controls/validate`, asked 400 ms after the last edit; the last valid sentence stays, dimmed, while a row is incomplete. Validation messages are attached to the offending row. A new control is offered up to three of the engine's suggestions for the chosen entity. Save, or save and run.
3. **Run results**: the rule in words, then one block with the total, the run's facts (entity, duration, the previous run's count) and the count per condition, which is also the filter; then the violations table with a reason per matched condition and the offending values marked, search, sort by any column, and paging, all served from the snapshot. A picker moves between the control's runs (the 50 newest). Clear states for zero violations, cap exceeded, timeout, a failed run, and a definition that no longer fits the glossary (the run error `CONTROL_DEFINITION_OUTDATED`, with the condition named). An archived control's runs are read the same way, with no run and no edit.
4. **Suggestions**: the engine's proposals with rationale and evidence; select, open in editor, create selected.

Design constraints:
- **i18n**: a translation service with JSON files (`he.json`; the service is keyed by language, v1 ships Hebrew alone and has no language switch); every user-facing string is `t('key')`; glossary labels are read from the glossary in the active language; error codes from the APIs resolve to text here. Rule sentences, reasons and suggestion texts arrive rendered by the engine, as text and as parts, and the client only draws them: it has no sentence renderer. No Hebrew literal anywhere in code or templates.
- **RTL**: document direction follows the language (`dir="rtl"` for Hebrew), logical CSS properties only, Hebrew locale for dates and numbers.
- **Responsive, mobile first**: every screen works from 390 px (table rows as cards, editor stacked) up to 1440. Verified by screenshots at 390 and 1440 at every gate.
- Visual design (palette, type, components, motion) comes from `docs/design.md`, produced before the client task with the design skills; this document does not decide it.
- State: signals for editor and screen state; services for server communication and glossary caching. No global state library.
- Reusable components: condition group (recursive), condition row, field picker, operator picker, value input, related-records node, the rule in words (drawn from the engine's parts), entity cards and entity chain, results table, run overview (the summary and the count per condition), sort header, the panel, error banner, confirm dialog. Every table is one design, and a status has one colour everywhere (violations red, clean green, stopped amber, never ran and archived grey). The editor and the suggestions reuse the same components.
- Errors: an interceptor converts problem-details responses (code + parameters) into translated messages; validation errors map to editor rows by JSON path.
- Accessibility basics: labels, keyboard navigation, focus states, sufficient contrast.

---

## 9. Key flows

**Save a control.** Client builds the definition JSON → .NET validates structure → .NET asks the engine to validate (dry compile) → .NET persists a new immutable version → client shows the preview sentence.

**Run a control.** Client requests a run (synchronous: the request answers when the run has finished) → .NET loads the current version and opens a run record → .NET sends the full definition JSON, the run date and the language to the engine → engine validates, hits or fills the compile cache, compiles, executes count + capped page under the read-only login → engine returns violations, matched condition ids, structured and rendered reasons, and the total → .NET stores the snapshot and closes the run → client shows the summary; all subsequent paging, search and filtering are served from the snapshot by .NET. Organization data is touched exactly once per run.

**View results.** Every page, filter and search is a query on `dq.RunResult` for that run. Python is not involved.

**Suggestions.** Client requests suggestions → .NET calls the engine → engine computes statistics, applies heuristics, validates each suggestion through the compiler, drops invalid ones → client shows them as drafts → user accepts some → .NET creates ordinary controls (new versions) → they are run like any other control. Nothing is saved or run automatically.

**Startup.** Engine loads the glossary, validates it against the database, fails fast on mismatch. .NET fetches the glossary, verifies database connectivity, exposes health.

---

## 10. Security model (four independent layers)

1. **Identifiers only from the glossary.** Table and column names never come from any caller; the client sends glossary keys, the engine resolves them. Unknown or hidden keys are rejected.
2. **Values only as bound parameters.** No string concatenation of user values, ever. Operators come from a closed list.
3. **Read-only execution.** The engine's login can only SELECT on `hr`. Even a compiler bug cannot modify data. Only a single SELECT statement is ever compiled; stacked statements are impossible by construction and additionally rejected.
4. **Bounded execution.** Row cap, statement timeout, nesting and size limits, deterministic ordering.

Additional: the .NET login cannot read `hr`; configuration and secrets come from environment variables, never from code; error responses never leak SQL or stack traces; CORS restricted; no authentication/authorization in v1 (internal tool; listed as an extension, along with audit of who ran what), which is why compose publishes the app, and the database, on 127.0.0.1 only and the engine on no host port at all. In compose each container receives only its own settings by name, so the engine never holds the `sa` or `dq_app` password and the api never holds the `sa` or `dq_engine_ro` one. The engine and the api each had a security audit, and the whole repository one more at the delivery gate; the findings left open, each a deployment decision, are listed in [assumptions-limitations-extensions.md](assumptions-limitations-extensions.md).

---

## 11. Performance and scale

- **Compile cache** (engine memory) keyed by definition hash + glossary version + engine version: unchanged definitions skip validation and compilation.
- **Result snapshot per run**: paging, filtering and search never re-query organization data and are consistent across pages.
- **Row cap per run** (configurable, e.g. 5,000): stored violations are capped, the total count is exact; the UI tells the user to narrow the control when the cap is exceeded.
- **Index-friendly predicates**: computed fields are compiled into range predicates on stored columns; indexes on FK and filtered columns are part of the seed.
- **No row multiplication**: many-to-one via joins, one-to-many via EXISTS/NOT EXISTS.
- **Retention**: cleanup of old run results by policy.
- Extensions (documented, not built): asynchronous runs with polling for long controls; scheduling; export of results; horizontal scaling of the stateless engine.

**Measured on 200,000 employees.** `scripts/scale-test.sh` builds a scratch database (`DataControlsScale`: the seed's organization multiplied to 5 ministries, 2,000 departments and 200,005 employees, with the same keys and indexes; the seeded database is only read), points a second engine at it and runs the six examples. On the development machine (SQL Server in Docker Desktop under WSL 2), the engine's own time for a run, which is the count statement and the capped page, the median of five runs:

| Example | Root records | Violations found | Rows returned | Engine time (ms) |
|---|---|---|---|---|
| `minor-high-salary` | 200,005 employees | 7,059 | 5,000 | 387 |
| `termination-before-hire` | 200,005 employees | 7,059 | 5,000 | 217 |
| `active-in-inactive-department` | 200,005 employees | 14,118 | 5,000 | 400 |
| `missing-mandatory-data` | 200,005 employees | 23,530 | 5,000 | 418 |
| `department-without-active-employees` | 2,000 departments | 375 | 375 | 35 |
| `inactive-ministry-salary-out-of-range` | 200,005 employees | 7,059 | 5,000 | 550 |

All six stay under 0.6 seconds, with the count exact and the page cut at the row cap. The first measurement found one that did not: "a department with no active employee" compiles to `NOT EXISTS` over the employees of each department with a status test, and with the department and the status indexed separately it took 9.2 seconds. The index `hr.Employee (department_id, status)` was added to `sql/50_indexes.sql` for it, and the table above is the run after that. The lesson holds beyond the sample data: a rule about related records needs an index on the child table's foreign key together with the field it tests, and in an organization's own database that index belongs to its administrators.

---

## 12. Error handling (what the business user sees)

Every error has a stable code, an HTTP status, parameters, and a translated message written for a non-technical user, for example: definition invalid (highlight the row, say what to fix), control references a field that no longer exists in the glossary (edit the control), query timed out (narrow the conditions or contact the administrator), engine unavailable (try again later), no violations (positive confirmation, not an empty table), cap exceeded (how many were found, how many are shown). The codes live in `contracts/errors.md`; the text lives in the client's translation files. Technical details are logged with the correlation id and never shown. One difference between the two services, where the contract has one sentence: a body sent as JSON that does not parse is 400 `REQUEST_INVALID` in the api (415 there is a media type that is not JSON) and 415 in the engine.

---

## 13. Testing strategy (proportional to one week)

- **Engine (highest value)**: golden tests — each example definition produces the expected SQL and parameters (`engine/tests/golden/*.sql`, `*.params.json`) and the expected Hebrew text (`*.text.json`); validation tests for every rejection path (unknown field, wrong operator for type, type mismatch, unreachable path, depth and size limits); injection attempts as values are bound and return nothing; NULL semantics; integration tests against the seeded database asserting the exact violating record ids for each example in `contracts/examples/`, including boundary rows; `/suggest` against the examples marked `heuristic`. 521 tests, also run under Python 3.13 and 3.14.
- **.NET**: the real app against the shared database as `dq_app`, with its rows marked and removed before and after; the engine is a stub at the HTTP handler whose fixtures are generated from `contracts/`. Structural validation, status codes, the concurrency conflict, engine client behaviour for timeout and unavailability, snapshot paging and filtering, and a test that the app answers every row of `contracts/api.md`. Three tests against the real engine are opt-in (`DC_LIVE=1`).
- **Angular**: focused unit tests (adding and removing conditions and groups, the validate loop behind the rule in words, mapping of validation errors to rows), and Playwright in two folders: `e2e/mocked` on route fixtures with no service, and `e2e/gate` on the real stack, which builds each of the six examples in the editor, saves, runs and reads it, with screenshots at 390 and 1440.
- **Database and contracts**: `scripts/db-check.sh` (structure, the permissions of the two logins, the glossary against the tables, Hebrew, each example by a hand-written query) and `scripts/contracts-check.py` (the schema, the glossary, the examples and the invalid fixtures agree).
- **The whole system**: `scripts/examples.py verify` runs the six examples through the running app and compares the flagged records and matched conditions with the example files. The delivery task ran both paths from a clean clone.
- All tests runnable with one command per project, documented in the README.

---

## 14. Deployment and running

- **Docker Compose**: SQL Server 2022 (`db`), a one-shot init container running the SQL scripts (`db-init`), the Python engine (`engine`, no host port), the .NET API serving the built Angular app (`api`, 127.0.0.1:5000), and a one-shot loader that posts the six example controls through the api (`examples`). Health checks and startup ordering: the engine starts after the init has completed, the api after the engine is healthy, the loader after the api is healthy. No service restarts on its own, so an engine that refuses a glossary mismatch stays visibly stopped. `scripts/start.sh` and `start.cmd` create `.env` with random passwords when there is none, start everything and wait.
- **Manual path (no Docker)**: short from-source instructions in the README. Run the SQL scripts in SSMS or sqlcmd on a local SQL Server; install the engine's locked dependencies into a local Python environment and start it; build the Angular app, publish the .NET API with the build as its `wwwroot`, and start it. No bundle and no prebuilt binaries.
- Configuration by environment variables, listed in `.env.example` one block per component. The engine takes no connection string: it reads `ENGINE_DB_HOST`, `ENGINE_DB_PORT`, `ENGINE_DB_NAME`, `ENGINE_DB_DRIVER` and `DQ_ENGINE_RO_PASSWORD`. The api builds its connection string from `DB_HOST`, `DB_PORT` and `DQ_APP_PASSWORD` unless `ConnectionStrings__Dq` replaces it whole; in Development it reads only its own keys from `.env`, and the published app reads no `.env`. Also: the engine URL, row cap, timeouts, default language, time zone (Asia/Jerusalem), the debug endpoint flag. No secrets are committed: the example file holds no password.
- The suggestions feature is heuristics alone: it needs no key and makes no call outside the system.
- The SQL Server 2022 image is x86-64 only; on Apple Silicon it runs under Docker Desktop's Rosetta emulation, and the manual path is the fallback. Stated in the README.
- Commands, ports and troubleshooting: the [README](../README.md).

---

## 15. AI-assisted development policy (required by the assignment)

AI coding tools were used throughout the build, for scaffolding, code, tests, documentation drafts and refactoring: Claude Code with a project harness (`CLAUDE.md`, skills, rules, hooks, task plans with gates and review passes), which lives in the repository (`.claude/`) and is part of the submission, so the graders see how the work was organised; the claude.ai chat, used to analyse the assignment's requirements, to review and revise the architecture and the work plan, to word the briefs and instructions the developer gave the sessions, as a second opinion on their plans and reports, and to draft the submission documents in Hebrew; and two third-party design skills. Runtime SQL generation is deterministic code, never an AI call, and no AI runs anywhere in the product.

The code was written by Claude Code under plans the developer approved. Every phase was checked by tests, and the work was reviewed by separate review agents, with three security audits (the engine, the api, the whole repository). The developer directed the build through the plan interviews, his decisions and repeated reads of the rendered output and the running app; he did not review every diff line by line. He owns and must be able to explain every design decision in this document.

Which tool was used for what, how its output was checked and what the developer decided himself are in [ai-usage.md](ai-usage.md).

---

## 16. Repository layout

```
data-controls/
  README.md
  start.cmd             the Docker path on Windows
  docker-compose.yml    db, db-init, engine, api, examples
  .env.example          configuration template; no password in it
  contracts/            control-definition.schema.json, glossary.json, examples/ (and invalid/), api.md, errors.md
  sql/                  schema, logins, indexes, seed data, checks, cleanup
  engine/               Python FastAPI service (app/: glossary, validator, compiler, executor, explainer, cache, suggestions)
  api/                  .NET 10 Web API (src/DataControls.Api, tests/DataControls.Api.Tests)
  web/                  Angular app (src/app, src/assets/i18n/he.json, e2e/mocked, e2e/gate)
  scripts/              start.sh and start.ps1, db-init.sh, db-check.sh, examples.py, contracts-check.py
  docs/                 the documents of §17, and screenshots/
  submission-he/        the submission documents in Hebrew, one for each deliverable of the assignment
  .claude/              Claude Code harness: CLAUDE.md, skills, rules, hooks, agents (committed)
  dev/                  briefs, and the plan and notes of every task (completed/, active/)
```

---

## 17. Documentation deliverables

| File | Content |
|---|---|
| [`README.md`](../README.md) | What the system is, the architecture diagram, running with Docker, running from source, a walk through the system, configuration, tests, operations, links to the documents below |
| [`submission-he/README.he.md`](../submission-he/README.he.md) | The submission documents in Hebrew: a cover page with the assignment's deliverables in its own words, and a short document for each |
| [`docs/summarize-architecture.md`](summarize-architecture.md) | The short document the assignment asks for: the architecture and the controls mechanism (definition, validation, one parameterized SELECT, reasons), and the design of the AI suggestions |
| [`docs/architecture.md`](architecture.md) | This document: components and responsibilities, boundaries and prohibitions, data model, flows, security layers, performance decisions, decision record, the assignment checklist |
| [`docs/design.md`](design.md) | The visual design decisions for the client (direction, tokens, components, responsive rules) |
| [`docs/control-definition.md`](control-definition.md) | The JSON contract: structure, node types, operators per type, NULL semantics, limits, versioning, validation layers, error codes |
| [`docs/glossary.md`](glossary.md) | How the business glossary is structured, how to add an entity, field, relationship, computed field or language, startup validation |
| [`docs/examples.md`](examples.md) | The four assignment controls plus two more, each with its Hebrew description, its JSON definition, the records it flags in the seed data and why |
| [`docs/assumptions-limitations-extensions.md`](assumptions-limitations-extensions.md) | Assumptions, limitations (the open items of the reviews and audits among them), what was not proven, extensions |
| [`docs/ai-usage.md`](ai-usage.md) | AI tools used in development and what each was for, how their output was checked, where no AI runs, the developer's own decisions |
| [`sql/README.md`](../sql/README.md) | Order of scripts, what each creates, the planted violations and the expected results per example control |
| [`contracts/api.md`](../contracts/api.md), [`contracts/errors.md`](../contracts/errors.md) | Both HTTP APIs, and the closed lists of codes and keys |
| [`web/README.md`](../web/README.md) | The client: structure, commands, the end-to-end specs |

---

## 18. Assignment requirements — complete checklist

Translated from the assignment; the original Hebrew is in the appendix. Every item is ticked with one piece of evidence: a file, a test, a screen or a README step.

**General**
- [x] Done independently, with AI tools, and the submission states which tools and for what purposes. *Evidence: [ai-usage.md](ai-usage.md).*
- [x] The candidate understands the solution and can explain the decisions. *Evidence: the decision records of §3.2, and the Decisions section of each task plan under `dev/`.*

**Data structure**
- [x] A sample database with several related tables, filled with valid and invalid sample data. *Evidence: `sql/20_hr_tables.sql`, `sql/60_seed_hr.sql` (5 ministries, 16 departments, 85 employees; every planted row is marked), [sql/README.md](../sql/README.md).*
- [x] The mechanism works generically on the data structure and does not rely on field and table names fixed in code. *Evidence: table and column names appear only in `contracts/glossary.json`; the engine's tests include a synthetic glossary with other names; [glossary.md](glossary.md) adds a relationship without a code change.*

**Control definition**
- [x] A UI for a business user to create a new control, without knowing the database structure or writing SQL. *Evidence: the editor (README, "A walk through the system", step 3; `docs/screenshots/editor.png`).*
- [x] Name and description; selection of the business data; logical conditions including combinations; save and edit; reuse. *Evidence: the editor's fields, the entity cards, the builder with "and", "or" and nested groups; a change of the conditions creates a version (`ControlUpdateTests.cs` in the api's tests); create, save and run in the editor, and duplicate, run and archive from the list (`web/e2e/gate/examples.spec.ts`, `list.spec.ts`).*
- [x] A friendly presentation of the data and the relationships in business terms. *Evidence: every picker is drawn from the glossary's Hebrew labels; fields of a related entity appear under the relationship's label; the entity chain in the editor.*

**Query generation and execution**
- [x] A generic mechanism translating the definition into SQL. *Evidence: `engine/app/compiler/`; the golden SQL per example in `engine/tests/golden/`.*
- [x] Running a control over all relevant data and receiving the violating records. *Evidence: `POST /api/v1/controls/{id}/runs`; `python3 scripts/examples.py verify` (six examples, exact keys).*
- [x] Dynamic query generation. *Evidence: one statement is compiled per definition at run time; nothing is stored (§2 principle 2).*
- [x] Complex conditions and relationships between tables. *Evidence: examples 4 (nested groups), 3 and 6 (one and two hops), 5 (`NOT EXISTS` over a one-to-many relationship) in [examples.md](examples.md).*
- [x] Separation between control definition and query implementation. *Evidence: the api stores JSON and cannot read `hr`; the engine compiles and cannot write (§3.1, `sql/40_logins.sql`, `scripts/db-check.sh permissions`).*
- [x] Prevention of dangerous commands or data modification. *Evidence: §10; the engine's injection tests; the read-only login proven by `db-check.sh` (a denied write fails with error 229).*
- [x] Error handling with appropriate messages. *Evidence: `contracts/errors.md`; the Hebrew texts of every code in `web/src/assets/i18n/he.json`; a validation error marks its row.*
- [x] No fixed query per control. *Evidence: no SQL text outside `engine/app/compiler/` and `sql/`; the examples are data files.*

**Results display**
- [x] The list of defined controls; running a control from the list; the number of violating records; the records in a table; the reason per record; filtering and search. *Evidence: the list and the results panel (`docs/screenshots/list.png`, `results.png`; `web/e2e/gate/`).*
- [x] Clear, convenient, responsive UI. *Evidence: [design.md](design.md); screenshots at 390 and 1440 from every gate (`docs/screenshots/results-mobile.png`).*

**Advanced (optional)**
- [x] A design of a capability where AI analyzes the database structure and proactively proposes controls. *Evidence: the design in [summarize-architecture.md](summarize-architecture.md#the-optional-task-ai-that-proposes-controls) and the plan in `dev/active/dc-ai-suggestions/plan.md`. Built today, without a model: heuristic suggestions from the glossary and a data profile (`engine/app/suggestions/`).*

**Technology — Backend**
- [x] .NET Web API. *Evidence: `api/` (.NET 10).*
- [x] Python. *Evidence: `engine/` (FastAPI).*
- [x] Orderly architecture with separation of responsibilities. *Evidence: §3; `contracts/` as the only shared thing.*
- [x] SQL Server. *Evidence: `sql/`, `docker-compose.yml`.*
- [x] Appropriate mechanisms for secure dynamic SQL. *Evidence: §10: SQLAlchemy Core as the only builder, bound parameters, identifiers from the glossary, a read-only login, limits.*

**Technology — Frontend**
- [x] Angular. *Evidence: `web/` (Angular 21).*
- [x] Hebrew UI with RTL direction. *Evidence: `dir="rtl"`, logical CSS only, `he.json`.*
- [x] Reusable components. *Evidence: §8; `web/src/app/shared/` and the builder's components.*
- [x] UX suited to business users. *Evidence: [design.md](design.md), `docs/PRODUCT.md`; the rule in words under every rule.*

**Technology — Database**
- [x] SQL Server; sample data tables; a mechanism for storing control definitions; data demonstrating success and failure cases. *Evidence: schema `hr` and schema `dq` (`sql/30_dq_tables.sql`); the planted and boundary rows per example in [sql/README.md](../sql/README.md).*

**Deliverables**
- [x] Full source code of client and server. *Evidence: `web/`, `api/`, `engine/`.*
- [x] Scripts to create the database and load sample data. *Evidence: `sql/`, `scripts/db-init.sh`.*
- [x] Installation and run instructions. *Evidence: [README](../README.md), "Run with Docker" and "Run from source, without Docker".*
- [x] A short document describing the architecture and the controls mechanism. *Evidence: [summarize-architecture.md](summarize-architecture.md).*
- [x] Examples of controls that can be defined and run. *Evidence: `contracts/examples/`, loaded into the list at the first start; [examples.md](examples.md).*
- [x] A short description of working assumptions, limitations and possible extensions. *Evidence: [assumptions-limitations-extensions.md](assumptions-limitations-extensions.md).*
- [x] A description of the AI tools used and the purpose of each. *Evidence: [ai-usage.md](ai-usage.md).*

**Evaluation focus (what graders look at)**
- Genericity: how far new controls can be added without code changes. *See §2 principle 1, [glossary.md](glossary.md).*
- Architectural thinking: correct separation between control definition, translation to query, and execution. *See §3, §9.*
- Business thinking and UX: accessibility of the solution to a non-technical user. *See §8, [design.md](design.md).*
- Backend quality: API design, code structure, security, error handling. *See `contracts/api.md`, §6, §7, §10, §12.*
- Frontend quality: component organization, state management, user experience. *See §8, [web/README.md](../web/README.md).*
- SQL: handling data, relationships between tables, performance. *See §4, §11, `sql/50_indexes.sql`.*
- Code quality: readability, maintainability, tests, edge cases. *See §13.*

---

## 19. Work plan — five tasks, three of them in parallel

The plan as it was written before the build, with what each task delivered. Each task had its own plan, gates and review passes; the plan and the notes of each are under `dev/completed/` and `dev/active/`.

| Task | Ships | Gate | Runs | Result |
|---|---|---|---|---|
| **1 `dc-contracts`** | repository skeleton, harness, Docker Compose with SQL Server + init container, `sql/` (hr, dq, two logins, Hebrew seed with planted violations, indexes), the whole `contracts/` folder (§5.1), `docs/architecture.md` (this document), README skeleton | `docker compose up db` + init on a clean container; a check script prints the expected violating records per example; the schema validates all six examples | first, alone; nothing else starts before its gate | PR #1, merged 2026-11-10 (`f9928bf`) |
| **2 `dc-engine`** | glossary loader + startup check, validator, compiler, executor, explainer, cache, suggestions (heuristics), all endpoints, the image | golden tests for the six examples; every rejection path; injection values bound; integration against the seed returns the exact planted ids; `/suggest` yields the examples marked `heuristic` (2 to 5) from the seed | parallel, own worktree | PR #2, merged 2026-11-11 (`0e07fca`). `/suggest` yields examples 2 to 5 node for node, and three more proposals on the seed |
| **3 `dc-api`** | glossary cache, controls + versions + concurrency, runs + snapshot, paging/filter/search/sort, suggestions proxy + accept, engine client with resilience and error mapping, problem details, OpenAPI, static hosting | tests for validation, status codes, conflict, timeout/unavailable mapping, snapshot paging; the API answers every call in `contracts/api.md` | parallel, own worktree | PR #3, merged 2026-11-11 (`eec007d`). The live pass against the real engine ran twice |
| **4 `dc-web`** | i18n shell (Hebrew, RTL), controls list, editor (builder, pickers, entity chain, the rule in words, errors by JSON path), results with all states, suggestions, per `docs/design.md` | Playwright: create → save → run → read results on the six examples; screenshots at 390 and 1440; the design skills' critique and polish applied | parallel, own worktree; starts on what needs no API (shell, i18n, components) and wires to the real API as it lands | PRs #4 and #5, merged 2026-11-11 (`612b2b7`, `d66670d`). The second PR made the client one page with a new look |
| **5 `dc-delivery`** | compose end to end from a fresh clone, the from-source instructions of the manual path, all docs in §17, `docs/ai-usage.md`, the §18 checklist ticked | a clean machine runs both paths first time; six examples run from the UI | last, short | the branch `feat/delivery`; its gate is in `dev/active/dc-delivery/gates/` |

Parallel rules: one SQL Server container on the machine, started from the main tree and shared by every session; never two test suites at once; a contract change goes through `contracts/` plus one line to the other sessions; nothing is pushed or merged without the developer's word; one PR per task.

---

## 20. Out of scope for v1 (listed as extensions in the docs)

Authentication, authorization and per-user audit; scheduling of runs; asynchronous long-running runs; export of results; glossary administration UI and database-backed glossary; "rule must hold" semantics mode; templated controls applied across several entities; marking violations as handled; notifications; the AI advisor service.

Each is listed with its reason, beside the assumptions and the limitations, in [assumptions-limitations-extensions.md](assumptions-limitations-extensions.md).

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