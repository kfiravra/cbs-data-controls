# dc-api: the application API (.NET 10)
Created: 2026-11-10 · Branch: feat/api (worktree `../cbs-api`, cut from origin/main once dc-contracts is merged; kickoff §5)
Amended: 2026-11-10 by the dc-contracts session on Kfir's scope decision, with the lines from the merged contracts (the two sections before the Phases)

## Goal

After this task the .NET API answers every call of `contracts/api.md` under `/api/v1`. It serves the glossary it
caches from the engine, keeps controls with immutable versions and optimistic concurrency in `dq`, checks a
definition against the shared JSON Schema and then through the engine before anything is saved, runs a control
through the engine once and stores the snapshot, and answers every page, search, filter and sort of the results
from that snapshot. Every error is problem details with a code and parameters and no prose. dc-web builds against
this surface while the engine is built in parallel, so the api is tested against a stubbed engine shaped by the
contract and proves itself against the real one at its gate. It is the only component that writes, and it writes
only `dq`. Budget: a day and a half of execution; the submission is due 2026-11-15.

## Decisions

From the interview (Kfir, 2026-11-10):

1. **Persistence tests run against the shared `DataControls` database as `dq_app`, through the real app.** Every
   control a test creates carries the marker `zz-dc-api-test-` in its name; the suite deletes marked rows before
   and after it runs. Tests fail, never skip, when SQL Server is down. (Rejected: a test database of its own,
   which needs a database-name parameter in dc-contracts and a second init from the main tree; a rolled-back
   transaction, which rewires the DbContext, still sees other sessions' rows and holds locks on them.)
2. **One project with module folders**: `DataControls.Api` and `DataControls.Api.Tests`. (Rejected: Api /
   Application / Infrastructure projects; the compiler-enforced layering costs half a phase and adds no behaviour.)
3. **JsonSchema.Net 8.0.5, pinned**, behind one interface. It is the last MIT release; from 9.0.0 the package
   ships under a maintenance-fee EULA. (Rejected: 9.x and its licence question for the bureau; Corvus.JsonSchema
   and its build-time code generation.)
4. **Three extras are in**: Swagger UI at `/api/docs`, `api/requests.http`, and opt-in tests against the real
   engine. (Rejected: a runnable stub engine for dc-web; it is thrown away when the engine lands.)
5. **The contract gaps go to dc-contracts** as Design I of its plan, "Addendum from dc-api planning". Design H
   below is the same list, and Phase 1 starts by comparing it with the contract as written.
6. **Per-condition counts stay exact over all violations** (dc-contracts Design E). The line of `docs/design.md`
   that says the breakdown counts the shown rows is the one that changes.
7. **An archived control is read-only**: `PUT` answers 409 `CONTROL_ARCHIVED`. No un-archive in v1.
8. **No retention code in the api.** `sql/cleanup_runs.sql` is the cleanup command (§4.2, §16).
9. **Rendered text also travels as parts** (`TextPart { text, nodeId?, role? }`; dc-contracts Design H2,
   "Amendments from dc-engine planning"): `sentenceParts` beside every `sentence`, `textParts` beside every
   reason's `text`. The api passes them through (`Run.sentenceParts`, `Run.conditions[].sentenceParts`,
   `Violation.reasons[].textParts`, the `/controls/validate` and `/suggestions` bodies) and stores them in
   `Run.summary` and `RunResult.reasons` as received; the web renders from them.

Settled here, inside the architecture:

10. **One retry, only for failures that come back fast**: a connection error or a 408, 429, 502 or 503. Never
    after an attempt timeout, a 504 or a 500, which would only double the wait for the same answer. A user waits
    for one attempt timeout at most. (§7 asks for "a single retry".)
11. **The circuit breaker counts connection errors, attempt timeouts, 502 and 503**, and opens at 5 calls with
    half of them failed. A 504 is one control's slow query, not an unhealthy engine. (The library defaults need
    100 calls in 30 seconds and would never open here.) Narrowed in the Phase 2 review (notes, unattended
    decision 12): a 503 that carries the engine's own problem document is not counted, and a health probe is
    neither retried nor counted.
12. **A run outlives its request.** Once the run row exists the engine call ignores the client's disconnect, so a
    closed tab does not leave a `running` row; host shutdown still cancels it. A run cut by a crash stays
    `running` and the next run of the control supersedes it in the list (a stated limitation, no sweeper).
13. **The api owns the run date.** It resolves a missing `runDate` to today in `Runs:TimeZone` and always sends
    `runDate` and `rowCap`, because the run row needs the date before the engine answers.
14. **What the api does not interpret stays raw JSON end to end**: the glossary, the `/validate` and `/suggest`
    bodies, a violation's `display` and `reasons`, a run's `conditions` and `sentenceParts`, an engine error's
    `errors`. No typed DTO sits on those paths, so a member the engine adds is never dropped.
15. **A definition is stored minified in the order it was sent; its hash is SHA-256 over a canonical form**
    (keys sorted ordinally, no whitespace). A new version is written only when the hash changes (dc-contracts
    decision 16), and only then is the engine asked to validate, so a rename works while the engine is down.
16. **On `PUT` the stale-token check runs before validation.** An editor that must reload is not asked to fix a
    definition first. The save still carries the client's token, so a race after the check is a 409 as well.
17. **Configuration**: defaults that are not secret in `appsettings.json`, overrides as `Section__Key`
    environment variables. The connection string is built from the variables `DB_HOST`, `DB_PORT` and
    `DQ_APP_PASSWORD` (the names of the database block of `.env`, read from the environment in every
    environment) unless `ConnectionStrings__Dq` is set, so the password lives in one place. In Development
    only, a small source also reads the repository's `.env`; real environment variables still win.
18. **One `DqDbContext` and the four entities live in `Persistence/`; entities and `DbSet`s are `internal`.**
    Controllers, services and DTOs are public, so a service signature cannot leak an entity.
19. **xUnit 2.9.3 as the SDK template gives it, plain `Assert`.** No FluentAssertions, AutoMapper or MediatR:
    their licences changed in 2025 and nothing here needs them.
20. **Microsoft packages are pinned to 10.0.x.** .NET 11 packages are on NuGet since this month and a bare
    `dotnet add package` takes them.
21. **Glossary cache**: one entry, fresh for ten minutes, served stale when a refresh fails, dropped when a run
    reports another `glossaryVersion`. The warm-up at startup never blocks or fails the host.
22. **An unknown `/api/...` path and a wrong method on a known one are both 404 `NOT_FOUND`**, from one catch-all
    mapped ahead of the SPA fallback.
23. **The Dockerfile and the compose service stay with dc-delivery** (dc-contracts decision 17). This task keeps
    the api container-ready: configuration from the environment only, no HTTPS redirect, `wwwroot` optional.
24. **`SCHEMA_VIOLATION` paths follow dc-contracts H4a, the engine's rule**: the instance location of the failing
    keyword, the object for a missing or an extra member, one error per path, in document order. JsonSchema.Net
    needs three corrections to say what Python's jsonschema says (Design F), found with a probe of both
    validators on 2026-11-10 (`research/schema-probe.md`). (Replaced: this plan's first idea of lifting every
    error to its node, which is coarser than the editor needs.)

From dc-delivery, carried by Kfir (2026-11-10, after that task's plan was written):

25. **The published api stands alone.** `dotnet publish src/DataControls.Api -c Release` must give a working app
    that reads nothing from the repository at run time: dc-delivery's image and its from-source instructions both
    start the published app. Design I says what makes it so. (The win-x64 self-contained publish and its trial on
    the Windows host went with the offline bundle: the scope decision below.)
26. **Documentation has an owner.** This task writes the api section of `README.md`, the api block of
    `.env.example` and its own harness lines (`.claude/skills/dc-api/SKILL.md`). The §17 documents
    (`docs/architecture.md` among them), `docs/submission.he.md` and the rest of the README are dc-delivery's
    and are never edited here. A difference between them and what this task built goes into `notes.md` under
    "Docs for dc-delivery" when it is noticed, and into the PR body under that heading at `/ship`.
27. **The notes Log is evidence**: `docs/ai-usage.md` is built from it. A review's Log line says what was read
    (the diff range), the number of findings per axis and severity, each critical and warning by file in a few
    words, what the fix commit changed, what was left and why, and what Kfir rejected or rewrote. A review that
    found nothing is logged as that, with its range. No verdict stands in for the findings.

## Scope decision (Kfir, 2026-11-10; written in by the dc-contracts session, which carried it through all five plans)

Applied to the text of this plan. Where a line still disagrees with this section, this section holds.

1. **Hebrew only.** The glossary lists `he` alone. The mechanism stays: `Accept-Language` is resolved against the
   glossary's `languages`, a language that is not listed gets `defaultLanguage`, the resolved value is forwarded
   and stored with the run. No test asks for English text; one asks for an unlisted language and gets Hebrew.
2. **Suggestions are heuristics only.** The engine's `/suggest` answers `{ items }`: the `source` member is gone
   from `contracts/api.md`. No timeout figure for a keyed `/suggest` remains.
3. **No offline Windows bundle.** No win-x64 self-contained publish and no trial on the Windows host. The publish
   is framework-dependent, for the image and for the from-source instructions; the rules of Design I stay,
   because both still start a published app from a folder that is not the repository.

## Lines from dc-contracts as it merges (2026-11-10)

`contracts/` wins over this plan (Phase 1 opens with the diff). These points were pinned there, most of them in
the review of the branch:

- **A run whose snapshot cannot be stored** after the engine answered is closed `failed` with `INTERNAL_ERROR` and
  no rows (`api.md`, `Run`). It is never left `running`; only a crash of the process does that.
- **`Run.rootEntity`** is the `rootEntity` of the version's stored definition. No column holds it, and the
  control's `root_entity_key` is the current version's.
- **Requests**: a body over 1 MB answers 413 and a body that is not JSON 415, both as a `Problem` with
  `REQUEST_INVALID` and no `errors`; `page` is 1 to 1,000,000; a `definition` that is not a JSON object is 400
  `MALFORMED`; a record key has at most 64 characters, as the column.
- **Results search** takes `%`, `_` and `[` literally, is trimmed first, and an empty one filters nothing.
- **Suggestions**: the api checks `rootEntity` and `max` and sends the engine exactly those two members (the
  engine rejects a member it does not know).
- **`NETWORK_ERROR`** is a code the client derives; the api never sends it. Every other code of `errors.md`
  keeps one status, except `REQUEST_INVALID` (400, 413, 415).
- **The public glossary** has a shape table in `api.md` now, with `identifier` and `visible` among the field
  members; the api passes it through unchanged.
- **The standards** now word the boundary rule as the contract does: an error crosses as a code and params;
  rendered sentences and reasons are the one text that crosses, and the api stores and serves them untouched.
- **`dq.Run.language`** still accepts `he` and `en` in its CHECK constraint (`sql/` was not changed); the api
  writes only what the glossary lists.

## Phases

Every phase ends the same way: tick each step as it finishes and update `notes.md` State and Next, run
`/check --tests`, save the verify output under `gates/phase-N.txt`, `/phase-review api`, one
`fix(api): review fixes` commit, and a Log line in `notes.md` written as decision 27 asks:
`<date> Phase N review (diff <sha>..<sha>): standards c/w/i, plan c/w/i. <file>: <finding>; … Fixed in <sha>: …
Left: … (why). Kfir rejected or rewrote: …`. State the spend before a review (one reviewer agent, opus) and
before the live pass (minutes against live services), then wait for the word. Before every
`dotnet test`: `pgrep -fa "pytest|dotnet test|ng test|vitest|playwright"` (the `playwright-mcp` servers match
the pattern and are not suites). Work test-first at the seams of Design G (`/tdd`). The Design section is the
specification each step builds from. Where `contracts/api.md` or `contracts/errors.md` says otherwise, the
contract wins and the plan line is corrected in the same step.

### Before Phase 1 (nothing here is this session's work)
- [x] dc-contracts has passed its gate and is merged: `contracts/` and `sql/` exist on main (`f9928bf`, #1).
- [x] SQL Server is up and initialised from the main tree (`data-controls-db-1`, healthy on 2026-11-11).
- [x] The worktree `../cbs-api` on `feat/api` exists with its `.env`; the task folder came with git (task folders
      are tracked since `bce225b`, so the `mv` step fell away).

### Phase 1: skeleton, request pipeline, persistence model
- [x] Contract diff: read `contracts/api.md`, `contracts/errors.md` and `sql/30_dq_tables.sql` as merged and
      compare them with Design C and Design H. Correct the plan where they differ. Anything the api needs that
      the contract still leaves open goes to `notes.md` Blockers and to Kfir before code depends on it.
- [x] `api/` skeleton per Design A: solution, the two projects, `Directory.Build.props`,
      `Directory.Packages.props`, `.editorconfig`, launch profile on `http://localhost:5000`, the content root
      fixed to the app's own folder (Design I). Remove the template's weather sample, HTTPS redirect,
      authorization call and `.http` file.
- [x] Configuration per Design B: options classes with validation and `ValidateOnStart()`, the Development
      `.env` source, the api block of `.env.example`.
- [x] Errors per Design D: `ApiException`, `ErrorCodes`, the problem writer, the `IExceptionHandler`, the
      model-state mapping, the `/api/{**rest}` catch-all.
- [x] Correlation id and language middleware per Design D.
- [x] Persistence per Design C: entities with their behaviour, configurations, the UTC converter, `DqDbContext`.
- [x] `GET /api/v1/health` with the database probe (the engine probe arrives in Phase 2).
- [x] Test support per Design G: `ApiFactory`, a minimal `EngineStub`, the marker and its sweep, the
      "SQL Server is not reachable" failure message.
- [x] Tests: the problem shape for an unknown api path, a malformed body and a missing required member; the
      correlation id echoed and generated; language resolution; health with the database up; `ErrorCodes`
      against `contracts/errors.md`; one row of each `dq` table written and read back through the model.
- [x] `.claude/skills/dc-api/SKILL.md`: replace "the task plan picks" with decision 1, and add the package pins.

Verify: `/check --tests` (`cd api && dotnet build -warnaserror && dotnet format --verify-no-changes && dotnet test`)
Review: `/phase-review api`
Commit: `feat(api): host skeleton, problem details and the dq persistence model`

### Phase 2: engine client, glossary, validation
- [x] `EngineClient`, the forwarding handler and the resilience pipeline per Design E.
- [x] The engine error map per Design E, one table, tested against `contracts/errors.md`.
- [x] Engine fixtures under `tests/.../Fixtures/engine/`, shaped by `contracts/api.md` as written, with
      `sentenceParts` and `textParts` where the contract puts them.
- [x] Glossary cache, `GET /glossary`, the startup probe, the engine half of `/health` (Design F).
- [x] `DefinitionSchemaValidator` over the embedded schema with paths per dc-contracts H4a (Design F, H1), and
      `POST /controls/validate`. Re-run the probe of `research/schema-probe.md` on the real schema first.
- [x] Tests: calls reaching the stub per failure kind (connection error 2, 503 2, 504 1, 422 1, 500 1, attempt
      timeout 1); timeout and connection error answer 503 `ENGINE_UNAVAILABLE`; the breaker opens and fails
      fast (its own factory); correlation id and language forwarded; the glossary fetched once for two reads,
      served stale when the engine is down, 503 when it was never fetched; every schema-layer fixture of
      `contracts/examples/invalid/` rejected with its code and path without a call to the engine; two faults in
      one definition come back as two errors in document order; every semantic-layer fixture relayed with the
      engine's code and path; the six examples pass the schema; the `/validate` body, `sentenceParts` included,
      returned byte for byte.

Verify: `/check --tests`
Review: `/phase-review api`
Commit: `feat(api): engine client, glossary cache and definition validation`

### Phase 3: controls
- [x] `DefinitionHasher` and the `Control` and `ControlVersion` behaviour (create, rename, add version, archive).
- [x] `ControlService` and `ControlsController`: create, read, update, archive, list, versions (Design F).
- [x] Tests: create answers 201 with `Location` and version 1; a Hebrew name comes back intact and is found by
      `search`; read and both 404s; an update with a changed definition writes version n+1; a rename keeps the
      version and works with the engine down; a stale token is 409 and a malformed one 400; `PUT` on an archived
      control is 409; archive is 204 twice; list filters, order, paging, a page past the end and bad paging
      values; `lastRun` null before any run; the versions list and one version; 422 from the schema and from
      the engine; 503 on save when the engine is down.

Verify: `/check --tests`
Review: `/phase-review api`
Commit: `feat(api): controls with versions, optimistic concurrency and archive`

### Phase 4: runs and the snapshot
- [x] `Run` and `RunResult` behaviour, `RunService.StartAsync` (Design F): the run row, the engine call, the
      snapshot and the close in one `SaveChanges`, each failure kind closed with its code.
- [x] The results query, run history, `GET /runs/{id}` with `previousRun`, and `lastRun` in the controls list.
- [x] Tests: a run answers 201 with `Location`, counts and summary; `sentenceParts` and each reason's
      `textParts` come back exactly as the stub sent them; for each of the six examples the keys and matched
      ids of `expected` come back in order; total above stored sets `capExceeded`; engine 422 closes the run
      as `CONTROL_DEFINITION_OUTDATED`, 504 as `timed_out` with `QUERY_TIMEOUT`, 503 as `DATABASE_UNAVAILABLE`,
      a connection error as `ENGINE_UNAVAILABLE`, a body that is not the contract as `INTERNAL_ERROR`, all with
      201; an archived control is 409; a missing `runDate` at 22:30 UTC is tomorrow's date in Jerusalem (fake
      clock); a malformed `runDate` is 400; 60 violations page as 25, 25, 10; `sort` and `dir`; `search` finds
      Hebrew text and treats `%` and `_` literally; `condition` filters; `previousRun`; run history newest
      first.
- [x] Measure one 5,000-violation snapshot and write the time into `gates/phase-4.txt`.

Verify: `/check --tests`
Review: `/phase-review api`
Commit: `feat(api): runs, result snapshots and the results query`

### Phase 5: suggestions, OpenAPI, static hosting
- [ ] `POST /suggestions` and `POST /suggestions/accept` (Design F), the accept through `ControlService`.
- [ ] OpenAPI: document title and version, a response type per status on every action, `MapOpenApi()` in every
      environment; Swagger UI at `/api/docs` over `/openapi/v1.json`.
- [ ] Static hosting per Design D: static files, `index.html` not cached, the SPA fallback behind the api
      catch-all; CORS from `Cors:AllowedOrigins`.
- [ ] `api/requests.http`: one request per row of the application table in `contracts/api.md`.
- [ ] The conformance test: every method and path of that table is mapped, and nothing else is under `/api/v1`.
- [ ] `LiveEngineTests` per Design G, skipped unless `DC_LIVE=1`.
- [ ] `README.md`: the api section only (run, configure, test, `/api/docs`, the publish command). Nothing else
      in the README and no file under `docs/` (decision 26).
- [ ] The published app started once from another directory, per Design I, after the tests of this phase are
      green and before its review, so a fix it calls for lands in this phase.
- [ ] Tests: `/suggestions` forwards the body and the language and returns the engine's body; accept creates
      all or none and names the failing index; the OpenAPI document lists every contract path; `/api/docs`
      answers; `/` and an unknown client path return `index.html`; an unknown api path is a 404 problem; a
      preflight passes only for a configured origin.

Verify: `/check --tests`
Review: `/phase-review api`
Commit: `feat(api): suggestions, openapi and static hosting`

### Gate
- [ ] `/check all --tests` from the worktree; the output saved as `gates/final.txt`.
- [ ] `dotnet list api package --include-transitive` shows JsonSchema.Net 8.0.5, JsonPointer.Net 6.0.1 and
      Json.More.Net 2.2.0, and no Microsoft package at 11.x.
- [ ] Live pass, if the engine worktree answers `GET /health`: state the minutes and wait, then
      `DC_LIVE=1 dotnet test --filter Category=Live`, and walk `api/requests.http` once. If the engine is not up,
      write the hand-off to dc-delivery into `notes.md`; the tests are ready to run there.
- [ ] `notes.md` holds the Log line of the start from another directory (Design I) and a Log line per review in
      the form of decision 27.
- [ ] `/ship`. In its docs-drift step, edit only what decision 26 gives this task; everything else goes, item by
      item, into the PR body under a fifth heading, "Docs for dc-delivery", taken from the list in `notes.md`
      and from the step's own table. Then the PR and the merge on Kfir's word.

## Design

### A. Layout and build

```
api/
  DataControls.slnx
  Directory.Build.props      net10.0, nullable, implicit usings, TreatWarningsAsErrors, EnforceCodeStyleInBuild
  Directory.Packages.props   every package version, pinned
  .editorconfig              C# style: file-scoped namespaces, _camelCase fields, sorted usings
  requests.http
  src/DataControls.Api/
    Program.cs               composition only
    Hosting/                 correlation id, language, Development .env source, startup probe, static files
    Errors/                  ApiException, ErrorCodes, problem writer, exception handler, model-state mapping
    Persistence/             DqDbContext, the four entities, their configurations, the UTC converter
    Engine/                  EngineClient, EngineOptions, forwarding handler, EngineException, the error map
    Glossary/ Controls/ Runs/ Suggestions/ Health/     a controller, a service and DTOs each
  tests/DataControls.Api.Tests/
    Support/                 ApiFactory, EngineStub, TestData (marker, examples), the sweep
    Fixtures/engine/         canned engine responses
```

Scaffold with `dotnet new sln -n DataControls` (writes `.slnx` on .NET 10), `dotnet new webapi --use-controllers
--no-https`, `dotnet new xunit`, `dotnet new buildprops`, `dotnet new packagesprops`, `dotnet new editorconfig`.

| Package | Version | Note |
|---|---|---|
| Microsoft.AspNetCore.OpenApi, Microsoft.EntityFrameworkCore.SqlServer, Microsoft.AspNetCore.Mvc.Testing | newest 10.0.x (10.0.15 on 2026-11-10) | never 11.x |
| Microsoft.Extensions.Http.Resilience | 10.11.0 | versioned apart from the runtime |
| JsonSchema.Net | 8.0.5 exactly | brings JsonPointer.Net 6.0.1 and Json.More.Net 2.2.0, both MIT; do not raise any of the three |
| Swashbuckle.AspNetCore.SwaggerUI | 10.3.1 | the UI package alone; the document is the built-in one |
| xunit 2.9.3, xunit.runner.visualstudio 3.1.4, Microsoft.NET.Test.Sdk 17.14.1 | as the template | drop `coverlet.collector` |

Facts that bite here:
- `-warnaserror` also promotes NuGet's audit warnings. Keep NU1900 to NU1904 as warnings in
  `Directory.Build.props`, or an advisory published this week, or a restore without network, turns the gate red.
- The schema is embedded from `..\..\..\contracts\control-definition.schema.json` with a `Link`, and the test
  project copies `contracts/**` to its output, so neither depends on the working directory.
- MVC only discovers public controllers, and a public constructor cannot take an internal type: services and
  DTOs are public, entities and `DbSet` properties internal, `InternalsVisibleTo` for the tests.
- `System.Text.Json` escapes Hebrew as `\uXXXX` by default. Give both option sets (`AddJsonOptions` for
  controllers, `ConfigureHttpJsonOptions` for problem details) and the code that writes JSON columns an encoder
  that leaves Hebrew as it is, camelCase names and snake_case string enums (`timed_out`).
- `publish` shares `obj/` with `build`, `test` and `format`: never beside one of them. Its output lands under
  `bin/`, which `.gitignore` already covers. The project keeps no `wwwroot` of its own in git: the web build is
  copied into the published folder by dc-delivery, and tests use a temporary web root.

### B. Configuration

| Key (environment form) | Default | Checked at start |
|---|---|---|
| `DQ_APP_PASSWORD`, `DB_HOST`, `DB_PORT` (the database block of `.env`) | none, `localhost`, `1433` | the password is present unless the override is set |
| `ConnectionStrings__Dq` | unset | replaces the built string |
| `Engine__BaseUrl` | `http://localhost:8000` | an absolute http or https URL |
| `Engine__AttemptTimeout` | `00:01:15` | between 100 ms and 10 minutes |
| `Engine__BreakerMinimumThroughput`, `Engine__BreakerBreakDuration` | `5`, `00:00:15` | at least 2; at least 500 ms |
| `Runs__RowCap` | `5000` | 1 to 100000 |
| `Runs__TimeZone` | `Asia/Jerusalem` | resolves on this machine |
| `Runs__DefaultLanguage` | `he` | a language the glossary lists; it stands in for the glossary's `defaultLanguage` until the glossary is loaded |
| `Glossary__CacheMinutes`, `Glossary__WarmUpOnStart` | `10`, `true` | not negative |
| `Cors__AllowedOrigins__0` and on | none | absolute origins, never `*` |

The built connection string is `Server=tcp:<host>,<port>;Database=DataControls;User ID=dq_app;Password=…;
Encrypt=True;TrustServerCertificate=True`: SqlClient encrypts by default and the container's certificate is
self-signed. Compose passes the three variables; dc-delivery's from-source instructions pass
`ConnectionStrings__Dq` instead for a named instance with no port, so nothing but the builder of that string may assume a host and a
port. The Development `.env` source finds the file by walking up from the app's base directory (the content
root, Design I), reads `KEY=value` lines, maps `__` to `:` and is added below the environment variables; outside
Development it does not exist. A missing password fails the start with a message that names `DQ_APP_PASSWORD`
and `.env`. Port 8000 may belong to another project's container on this machine; `Engine__BaseUrl` points
elsewhere. `ng serve` proxies `/api`, so the CORS list is empty by default.

`Runs:TimeZone` is resolved once at start. `Asia/Jerusalem` resolves on Linux with tzdata and on Windows through
ICU (Windows 10 1903 and later); a Windows without ICU knows only Windows ids. So the check tries the configured
id, then `TimeZoneInfo.TryConvertIanaIdToWindowsId`, then, for the default alone, `Israel Standard Time`, and
fails the start only when all three fail, with a message that names the setting.

### C. Persistence (schema `dq`, owned by `sql/`; no migrations, no `EnsureCreated`)

| Entity → table | Members → columns |
|---|---|
| `Control` → `dq.Control` | `Id` `id` identity · `Name` `name` 200 · `Description` `description` 1000, null · `RootEntityKey` `root_entity_key` 64 · `CurrentVersion` `current_version` · `IsActive` `is_active` · `CreatedAt`, `UpdatedAt` · `RowVersion` `row_version`, `IsRowVersion()` |
| `ControlVersion` → `dq.ControlVersion` | key (`ControlId` `control_id`, `Version` `version`) · `Definition` `definition` · `DefinitionHash` `definition_hash` 64 · `CreatedAt` |
| `Run` → `dq.Run` | `Id` · `ControlId` · `VersionNumber` `control_version` (FK with `ControlId` to `ControlVersion`) · `RunDate` `run_date` as `DateOnly` · `Language` · `StartedAt` · `FinishedAt` · `Status` as its four strings · `TotalCount`, `StoredCount`, `DurationMs` · `Summary` · `ErrorCode` · `ErrorParams` · `EngineVersion` · `CorrelationId` |
| `RunResult` → `dq.RunResult` | `Id` bigint · `RunId` · `Seq` · `RecordKey` · `RecordDisplay` · `DisplayText` 400 · `MatchedConditionIds` as a primitive collection, `nvarchar(max)` · `Reasons` · `ReasonText` |

- JSON columns are strings holding the JSON text. Only `MatchedConditionIds` is typed (`List<string>`), so
  `Contains(id)` becomes an `OPENJSON` predicate and the `condition` filter stays LINQ.
- `datetime2` values come back with `Kind` unspecified and would serialise without `Z`: one converter in
  `ConfigureConventions` marks every `DateTime` as UTC. Timestamps are cut to milliseconds when taken from
  `TimeProvider`, so a response equals a later read.
- The definition hash: SHA-256, lower-case hex, over the definition rewritten with object keys sorted ordinally,
  no whitespace, strings and numbers as their own tokens.
- `concurrencyToken` is the base64 of `row_version`. On update the client's token becomes the property's
  original value, so the `UPDATE` carries it in its `WHERE`.
- Entities change through methods (`Control.Create`, `Rename`, `AddVersion`, `Archive`; `Run.Start`, `Succeed`,
  `Fail`), not public setters. No explicit transaction anywhere: each unit of work is one `SaveChanges`.
- No SQL text: no `FromSql*`, `ExecuteSql*`, `SqlQuery*`, `SqlCommand`. The EF command log category is set to
  Warning so statements do not reach Information logs.

### D. Request pipeline and errors

Order: exception handler · correlation id and language · status-code pages · CORS when origins are configured ·
static files · controllers, `/openapi/v1.json`, `/api/docs` · the `/api/{**rest}` catch-all · the fallback to
`index.html`.

- **Problem shape**, from one writer: `{ type: "about:blank", title: <code>, status, code, params, errors?,
  correlationId }` as `application/problem+json`. No `detail`, no `instance`, and the `traceId` that
  `AddProblemDetails` adds by default is removed.
- **`ApiException`** is the one domain failure type: status, code, params, optional errors, built by named
  factories (`ApiException.ControlNotFound(id)`). The `IExceptionHandler` writes it; it maps a connection-level
  `SqlException` to 503 `DATABASE_UNAVAILABLE`, a request aborted by the client to no response, and everything
  else to 500 `INTERNAL_ERROR`, logged with the correlation id and never echoed.
- **Request errors** (corrected by the contract diff of Phase 1): 400 `REQUEST_INVALID` with `errors: [{ path,
  code, params }]`. `REQUIRED`, `TOO_LONG` (with `max`) and `OUT_OF_RANGE` (with `min` and `max`) come from one
  explicit check per request (`RequestCheck`), because the contract counts characters after trimming and wants
  the bounds as params, which a validation attribute's message cannot carry. A binder failure (a member of the
  wrong JSON type, a query value that is not an integer, text that does not parse) goes through
  `InvalidModelStateResponseFactory` and is always `MALFORMED`, at the JSON Pointer made from the binder's JSON
  path or under the query parameter's name. Bodies are capped at 1 MB (413); a media type that is not JSON is
  415; both are `REQUEST_INVALID` without `errors`.
- **Correlation id**: `X-Correlation-Id` is taken when it matches `^[A-Za-z0-9._-]{1,64}$`, else a new GUID in
  `N` form. It is put on the response, in a log scope, in every problem and on every engine call.
- **Language**: the primary subtag of the first range of `Accept-Language` when the glossary's `languages` list
  it, else the glossary's `defaultLanguage` (the engine's rule, word for word; `Runs:DefaultLanguage` until the
  glossary is loaded). The glossary lists `he` alone, so every request resolves to Hebrew.
- **Static hosting**: `UseDefaultFiles` and `UseStaticFiles` over the `wwwroot` beside the executable (it is
  missing in development and in a bare publish; dc-delivery copies the web build there before the start),
  `index.html` answered with `Cache-Control: no-cache`, the catch-all before `MapFallbackToFile("index.html")`.
- An empty body is allowed where the contract makes it optional (`POST …/runs`, `POST /suggestions`):
  `[FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)]`.

### E. Engine client

One typed client, `EngineClient`: `GetHealthAsync`, `GetGlossaryAsync`, `ValidateAsync`, `RunAsync`,
`SuggestAsync`. It returns raw JSON for what the api passes on and typed members only for what the api reads.

- **Pipeline** (`AddStandardResilienceHandler`, `HttpClient.Timeout` infinite): attempt timeout
  `Engine:AttemptTimeout`; total timeout twice that plus 5 seconds; one retry after 500 ms for an
  `HttpRequestException` or a 408, 429, 502 or 503; breaker on `HttpRequestException`, a timeout rejection, 502
  and 503, minimum throughput 5, failure ratio 0.5, sampling duration twice the attempt timeout, break 15 s.
  The options validator rejects a sampling duration under twice the attempt timeout and a total timeout under
  the attempt timeout.
- **Forwarding**: a `DelegatingHandler` reading `IHttpContextAccessor` adds the correlation id and the resolved
  language (the resolved one, not the raw header). Outside a request it sends a new id and the default language.
- **Failures** become one `EngineException` with a code: the engine's own code and status when the body is a
  problem; `ENGINE_UNAVAILABLE` for a connection error, a timeout rejection and an open circuit;
  `INTERNAL_ERROR` for any other status or a body that is not the contract.
- **The error map**, one table that follows `contracts/errors.md`:

| Engine answer | In a request (validate, save, suggest) | In a run |
|---|---|---|
| 422 `DEFINITION_INVALID` | 422 `DEFINITION_INVALID`, the engine's `errors` unchanged | `failed`, `CONTROL_DEFINITION_OUTDATED` with those errors |
| 504 `QUERY_TIMEOUT` | 504 `QUERY_TIMEOUT` | `timed_out`, `QUERY_TIMEOUT` with `timeoutSeconds` |
| 503 `DATABASE_UNAVAILABLE` | 503 `DATABASE_UNAVAILABLE` | `failed`, `DATABASE_UNAVAILABLE` |
| not reachable, timeout, circuit open | 503 `ENGINE_UNAVAILABLE` | `failed`, `ENGINE_UNAVAILABLE` |
| anything else | 500 `INTERNAL_ERROR` | `failed`, `INTERNAL_ERROR` |

- The breaker's state belongs to the host: a test that opens it uses a factory of its own.
- `/health` asks the engine through the same client with a 2-second cancellation. The call is marked as a
  probe, and the pipeline neither retries nor counts a probe, whatever its outcome.
- The body is read after the headers under a limit of its own, one more attempt timeout: the pipeline's limits
  end when the headers arrive.

### F. Behaviour by module (what the contract's tables do not spell out)

**Glossary.** `GET /glossary` returns the cached engine body byte for byte. One entry, one fetch at a time; a
failed refresh serves the stale entry and logs a warning; no entry and no engine is 503 `ENGINE_UNAVAILABLE`. The
api reads two things from it: `glossaryVersion` and each entity's `identifyingFields`. The startup probe tries
the glossary and the database once, logs what it found, and never stops the host; tests switch the warm-up off.

**Definition check.** A `schemaVersion` other than 1 is `UNSUPPORTED_SCHEMA_VERSION`, checked before the schema
(as the engine does). Then JsonSchema.Net evaluates with `OutputFormat.List`
(`JsonSchema.FromText`, `Evaluate(JsonElement, options)`; each unit has `InstanceLocation`, `EvaluationPath` and
`Errors`). To report what dc-contracts H4a asks and Python's jsonschema reports, the units with errors are
corrected in three ways, each seen in the probe:
1. A failed `if` is listed as an error. Drop every unit whose evaluation path has an `if` segment.
2. A `false` subschema (`additionalProperties: false`, or `properties: { "value": false }` inside a `then`) is
   reported at the member; Python reports it at the object. Lift it to the parent, which is H4a's "the node for
   an extra property".
3. A failed `not` has no located error, and a passing `not` lists its inner failures. Drop units under a `not`,
   `anyOf` or `oneOf` segment; H1 asks the schema to use none of them. If a definition is invalid and no unit
   is left, answer one `SCHEMA_VIOLATION` at the root and log a warning: the schema then breaks H1.

What is left is one `SCHEMA_VIOLATION` per distinct path, sorted by the position of the path in the document,
with the `id` of the nearest enclosing node as `nodeId`. The engine is not called for a definition that fails here.

**Controls.**
- Create: request check, schema, engine `/validate`, then one `SaveChanges` inserting the control and version 1.
  201 with `Location`.
- Update: 404 · 409 when archived · the token (400 when malformed, 409 when it is not the row's) · schema · hash.
  A changed hash asks the engine, adds version n+1 and sets `current_version` and `root_entity_key`. Name and
  description are trimmed and stored. Nothing changed: 200 with the row as it is and no write.
- Archive: sets `is_active` to 0; 204 on a repeat; 404 for an unknown id.
- List: `active=true` unless asked, `search` on the name, `rootEntity` exact, ordered by name then id; `lastRun`
  (newest `started_at`, any status) from a second query restricted to the page's control ids, which is what
  lets the index on `(control_id, started_at DESC)` serve it (corrected in the Phase 3 review: the correlated
  subquery this line first asked for is translated to a ROW_NUMBER over the whole table).
- Versions: newest first. `POST /controls/validate`: schema, then the engine's 200 body unchanged, or 422.

**Runs.**
- Start: the control through `ControlService` (404, 409 archived); the run date (decision 13; 400 when
  malformed); insert the run as `running` with the language and the correlation id; call the engine with the
  definition, `runDate` and `Runs:RowCap`; then one `SaveChanges` that inserts the rows and closes the run. 201
  with `Location`, whatever the outcome of the run (dc-contracts decision 22).
- A snapshot row: `seq` from 1 in the engine's order; `record_key`; `record_display` and `reasons` as the
  engine's JSON text; `matched_condition_ids`; `reason_text`; `display_text` built from the `display` values in
  the order of the root entity's `identifyingFields`, joined by a space and cut to 400.
- `Run.summary` holds the engine's `sentence`, `sentenceParts` and `conditions`, copied without being read.
- `total_count` is the engine's total; `stored_count` the rows stored; `capExceeded` is derived, total above
  stored. `durationMs` is the engine's on success and the api's elapsed time on failure (H7).
- Rows are added with change detection off and saved in one call. If 5,000 rows take more than a few seconds,
  raise the batch size first; `SqlBulkCopy` needs Kfir's word.
- Results: filter by run, then `search` (`Contains` on `display_text` or `reason_text`; EF escapes the wildcards)
  and `condition` (`MatchedConditionIds.Contains`); order by `seq` for `sort=key`, by `display_text` then `seq`
  for `sort=display`; count, then skip and take. Each item is the stored JSON plus `seq`.
- `previousRun` is the newest earlier succeeded run of the control; history is newest first.

**Suggestions.** `POST /suggestions` forwards the body and returns the engine's. Accept takes 1 to 20 items;
each passes the schema and the engine, the first failure answers 422 with `params.index`, and all controls are
inserted in one `SaveChanges` or none are.

**Health.** Always 200: `database` and `engine` are `ok` or `unavailable`, `status` is `degraded` when either is
not ok, `version` is the assembly's.

### G. Tests

Seams: a controller through `WebApplicationFactory<Program>` with the engine stubbed at its primary
`HttpMessageHandler` (the resilience pipeline stays real); persistence against the shared SQL Server; pure
functions directly (the hasher, the three corrections of schema errors, the language rule, the error map).

- **`ApiFactory`** swaps only the engine's primary handler and a few options (short timeouts, warm-up off, a
  temporary web root). Nothing else is replaced: the DbContext, the connection string and the pipeline are the
  production ones. `Program` is not declared (.NET 10 generates it).
- **`EngineStub`** answers from `Fixtures/engine/` by default, can be told to answer, delay or throw per route,
  and records each request's path, headers and body.
- **Marker and sweep**: names start with `zz-dc-api-test-` and a per-test id. One collection fixture deletes
  runs, versions and controls of marked controls with `ExecuteDeleteAsync` before the first test and after the
  last. All database tests share that collection, so they run one at a time. List tests always pass their own
  id as `search`.
- **Database down**: the fixture fails every test with one sentence that says how to start SQL Server from the
  main tree. A skipped database test is a red gate.
- **Expected values** come from `contracts/examples/*.json` (keys and matched ids), `contracts/examples/invalid/`
  (code and path), `contracts/api.md` (methods and paths) and `contracts/errors.md` (codes), never from the code
  under test. For an example run the stub builds the engine response from the example's `expected`.
- **Names**: `Action_result_when_condition`. Assertions go through HTTP responses, not through a query on `dq`.
- **`LiveEngineTests`** (`[Trait("Category", "Live")]`, a fact attribute that skips unless `DC_LIVE=1`): the
  real `EngineClient` against `Engine:BaseUrl`. For each example: create, run on the example's `runDate`, read
  every page, compare keys and matched ids with `expected` and with `alternateRuns`; each semantic-layer invalid
  fixture answers 422 with its code and path; the glossary is served.
- While a test is deliberately red: `touch .claude/state/red`, and remove it when the slice is green.

### H. Contract assumptions (sent to dc-contracts as its Design I; Phase 1 checks each against the contract)

1. `SCHEMA_VIOLATION.path` follows dc-contracts H4a. For JsonSchema.Net and Python's jsonschema to agree, the
   schema forbids a member only with `additionalProperties: false` or `properties: { member: false }` and uses
   no `not`, `anyOf` or `oneOf`; one schema-layer fixture is an extra member; `nodeId` is the `id` of the nearest
   enclosing node; a `schemaVersion` other than 1 is `UNSUPPORTED_SCHEMA_VERSION` in both services.
2. `concurrencyToken` is the base64 of the row version, opaque to the client.
3. `GET /controls`: `active` is `true` (the default), `false` or `all`; `search` is "name contains"; ordered by
   name, then id. The versions list is newest first.
4. A bad `page`, `pageSize`, `sort`, `dir` or `active` is 400 `REQUEST_INVALID`: `OUT_OF_RANGE` for a number
   outside its range (`page` 1 to 1,000,000, `pageSize` 1 to 200), `MALFORMED` for a value that is not an integer
   or not one of the words. A page past the end is 200 with empty `items`.
5. `REQUEST_INVALID.errors` items are `{ path, code, params }` with the codes `REQUIRED`, `TOO_LONG`,
   `OUT_OF_RANGE`, `MALFORMED`.
6. Results: `sort=key` is the engine's key order (`seq`) and the default; `sort=display` is `display_text`, then
   `seq`; `search` is a substring of `display_text` or `reason_text` with wildcards literal.
7. `Run.durationMs` is the engine's `durationMs` for a succeeded run and the api's elapsed time for a failed one.
8. `previousRun` is the newest earlier succeeded run of the control; `lastRun` is the newest run of any status.
9. The api resolves a missing `runDate` itself (today in Asia/Jerusalem) and always sends `runDate` and `rowCap`.
10. Failed-run codes: the right-hand column of the table in Design E.
11. `suggestions/accept` 422: `params.index` is the first failing item and the error paths are relative to its
    definition; 20 items at most.
12. 201 responses carry `Location`. `GET /health` is always 200.
13. `contracts/api.md` states the engine's worst-case time: the engine plan gives 30 s per statement and two
    statements per run, so about 60 s for `/run`. The api's attempt timeout (75 s by default) sits above it.
14. A name has 1 to 200 characters and a description at most 1000; names are not unique.

From the interview: counts are exact under the cap (decision 6); `PUT` on an archived control is 409 (decision
7); rendered text carries `sentenceParts` and `textParts` (decision 9).

### I. The published api (decision 25)

`cd api && dotnet publish src/DataControls.Api -c Release` writes
`src/DataControls.Api/bin/Release/net10.0/publish/`. dc-delivery copies the Angular build into that folder's
`wwwroot` and starts the app from it, in the image and in the from-source instructions, with
`ConnectionStrings__Dq` (or the three database variables), `Engine__BaseUrl`,
`ASPNETCORE_ENVIRONMENT=Production` and `ASPNETCORE_URLS`.

What makes the folder stand alone:
- **The content root is the app's own folder, not the working directory**:
  `WebApplication.CreateBuilder(new WebApplicationOptions { Args = args, ContentRootPath =
  AppContext.BaseDirectory })`. Checked on a scratch app on 2026-11-10 (not kept): started from another
  directory it runs in Production and loads the `appsettings.json` beside it; under `WebApplicationFactory` the
  content root becomes the test output folder, where the app's `appsettings.json` arrives through the project
  reference, and `UseWebRoot` still applies. Without this line a script that starts the executable from
  elsewhere gets an app with no settings file and no `wwwroot`.
- **At run time the app opens its own folder, the database and the engine, and nothing else.** The schema is an
  embedded resource; the `.env` source exists only in Development; no path is built from the working directory
  or from the repository's layout; nothing is written to disk (logs go to the console).
- **Production configuration** is the environment plus the `appsettings.json` beside the executable. The filter
  that keeps EF's statements out of Information logs is set in code, so it does not depend on that file.
- The time zone check of Design B, so a Windows without ICU still starts.

The start from another directory (Phase 5, once, on WSL):
1. Publish. Copy the folder to a place outside the repository and put a one-line `index.html` into its `wwwroot`.
2. Start the app from a working directory that is not its folder, on a free port that is not 5000, with the
   variables above; the password travels in the child's environment and is never echoed or logged.
3. Ask it: `/api/v1/health` is 200; a schema-layer fixture posted to `/api/v1/controls/validate` is 422
   `SCHEMA_VIOLATION` (with no engine reachable this proves the embedded schema); `/openapi/v1.json` is 200; `/`
   and `/runs/1` return the index. With the database up, `database` is `ok` and a `GET /api/v1/controls` is 200.
4. Stop the process and delete the copied folder.
5. The Log line: the date, the command, the directory it was started from, each request with its status, or the
   exact error text if it did not start.

## Risks

- **The contract is written after this plan.** Phase 1 opens with the diff; the contract wins.
- **Hand-written engine fixtures drift from the real engine.** They are built from `contracts/examples/` and the
  contract's shapes, and the live tests are the check. If the engine is not up at the gate, that check moves to
  dc-delivery and `notes.md` says so.
- **The EF model drifts from `sql/30_dq_tables.sql`.** The Phase 1 round trip touches every column. A `dq`
  change is a main-tree change and a re-init, and `--reset` deletes every session's `dq` rows.
- **Shared database.** Marked rows are visible to other sessions for the length of a test, and a killed run
  leaves them until the next run's sweep. Never two suites at once (`pgrep` first).
- **Timeout budget.** The engine plan sets 30 s per statement and runs two per run, and says "the api must
  exceed 30 s for a run": the real ceiling is about 60 s. The 75-second attempt timeout covers it and is
  configuration; H13 asks the contract to state the figure, and the engine's gate sends one line if it changes.
- **The schema is written by another session.** If it uses `not`, `anyOf` or `oneOf` after all, a schema error
  can lose its location in JsonSchema.Net. The Phase 2 probe on the real schema and the shared fixtures show it
  before any code depends on it; the answer is a contract line, not a workaround in the api.
- **JsonSchema.Net is pinned to a release that gets no fixes.** The schema uses a conservative keyword subset
  and the fixtures are the regression test; the validator is one class behind an interface.
- **A dependency bump crosses the licence line.** Central package versions, and the gate lists the transitive
  packages.
- **Snapshot insert time** for 5,000 rows is measured in Phase 4, not assumed.
- **Machine**: Docker Desktop was not running on 2026-11-10 19:44, and the database must be up from the main
  tree before any test. A new worktree has no `.env`; the api then fails at start with a message that says so.
- **A Windows without ICU, or with a blocked port.** The time zone fallback covers the first; the second is
  `ASPNETCORE_URLS`. Both are named in the api section of the README.
- **A document this task does not own goes stale** (architecture §7, §13 and §14, the assumptions). The list in
  `notes.md` is kept as the work goes, not rebuilt at `/ship`.
- **Time.** Cut in this order and record it in notes: the CORS list, Swagger UI, `requests.http`, the live
  tests (they move to dc-delivery). The §19 gate items and the two notes lists are never cut.

## Out of scope

- The api's Dockerfile and compose service, copying the web build into `wwwroot`, the from-source instructions
  (all dc-delivery). What they need from here: the build reads `contracts/control-definition.schema.json`
  (so the image builds from the repository root) and the run reads nothing of the repository (Design I); the app
  listens where `ASPNETCORE_URLS` or the image says; Linux needs tzdata for `Asia/Jerusalem`.
- Retention inside the api (decision 8), a sweeper for runs left `running` (decision 12), un-archive (decision 7).
- A stub engine process for dc-web (decision 4).
- Authentication, authorization, audit, rate limiting, asynchronous runs, scheduling, export (§10, §20).
- A self-contained or win-x64 publish, English text, anything for an LLM step (the scope decision).
- EF migrations: `sql/` owns the schema.
- The §17 documents, `docs/submission.he.md` and the README outside the api section (dc-delivery, decision 26):
  not edited here, even when a line in them is wrong; the line goes to "Docs for dc-delivery".
