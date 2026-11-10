# dc-api notes

## State
All five phases are built; 1 to 4 are reviewed and fixed, Phase 5 is green (344 tests pass, the 3 live tests are
skipped without `DC_LIVE=1`) and its review is next. Phase 5 added suggestions and accept, the OpenAPI document
with a response per status, Swagger UI at `/api/docs`, static hosting with the fallback to `index.html`, CORS
from configuration, `api/requests.http`, the conformance tests against the contract's table, the live tests,
the api section of the README, and the one start of the published app from another directory. The run is
unattended (Kfir's word of 2026-11-11, below).

## Next
1. Phase 5 review, one `fix(api): review fixes` commit, the Log line.
2. The gate: `/check all --tests`, the package list, the `/ship` steps that need no other task.
3. Waiting for the merge of `feat/engine` (no engine answers on this machine): the live pass, then push and PR.

## Blockers
- None for the build. The live pass of the gate needs the engine (`feat/engine`, not merged): it waits, and this
  session starts no service from another worktree.

## Unattended run (Kfir, 2026-11-11, pasted before going to sleep)
Run the task to its final gate without questions. At each phase end: review, fix, commit, tick, continue. A
decision is taken and written here. Steps that need another task's running service wait for the merge and are
listed. The SQL Server container is shared and is never stopped, recreated or reset. `contracts/` is frozen: a
doubt is noted and the api is built to the contract. Scope is the plan as it stands. Gate passed: push the
branch and open the PR (his word for both, given in that message), no merge. Gate blocked only by steps that
wait for a merge: commit, no push.

## Decisions taken unattended
1. **The session ran on Fable, not Opus.** The plan gives execution to Opus; a session cannot change its own
   model and nobody was there to switch it. Reviewer agents ran on opus as the harness sets them.
2. **Request checks are explicit, not attribute messages** (plan Design D, corrected). The contract counts
   characters after trimming and wants `max`, `min` as params; `RequestCheck` collects `REQUIRED`, `TOO_LONG`
   and `OUT_OF_RANGE` with exact pointers, and the model-state mapping only turns binder failures into
   `MALFORMED`.
3. **A body that is not JSON is 415, by its media type or by its text** (first taken the other way, then turned
   by the Phase 1 review). `contracts/api.md` says "a body that is not JSON 415". The first reading took that as
   the media type only and answered unparsable text sent as `application/json` with 400 `MALFORMED` at `""`; the
   reviewer held it against the contract's wording, and the contract is built to as written. A guard in front of
   the binders now reads a JSON body once and answers 415 without `errors` when its text does not parse, so a
   binder failure always means a well-formed body with a member of the wrong type (400, `MALFORMED` at the
   member). A JSON value that is not an object (`[]`, `5`) is well-formed and stays 400 `MALFORMED` at `""`.
4. **JSON is read strictly**: member names are case-sensitive (`Name` is an unknown member, ignored) and a number
   is never read from a string (`"5"` for `max` is `MALFORMED`). The web defaults of System.Text.Json accept both.
5. **The encoder is `JavaScriptEncoder.Create(UnicodeRanges.All)`**: Hebrew and `₪` are written as they are;
   `<`, `>`, `&`, `'` and `+` are still written as `\uXXXX`, which is the same JSON.
6. **`Runs:DefaultLanguage` is checked by form at start** (two or three lower-case letters). Design B asks for "a
   language the glossary lists", but the glossary is the engine's and the host never waits for the engine
   (decision 21); once the glossary is read its own `defaultLanguage` is used.
7. **A test-only controller at `/_probe`** (in the test assembly, outside `/api/v1`) shows what the pipeline does
   with a body, a query value and a failure. Phase 1 has no endpoint with a body, and the plan's Phase 1 tests
   need one.
8. **Build settings beyond Design A**: `GenerateDocumentationFile` with CS1591 off, because IDE0005 (unused
   usings) is only reported in such a build; every private field is `_camelCase`, static ones included; the
   template's `appsettings.Development.json` is removed (the one filter it would carry is set in code); the api's
   version is 1.0.0 and `/health` reports the assembly version.

9. **The engine fixtures are generated from the contract, not written by hand** (`Fixtures/engine/`): `run.json`
   and the 422 problem are the two examples of `contracts/api.md` §5 as they stand, `validate.json` is the same
   sentence without counts, and `glossary.json` is `contracts/glossary.json` made public by the rules of
   `GET /glossary` (no `table`, `keyColumn`, `column`, `computed` or `join`; every field's operators resolved).
   If the glossary or the example changes, the fixtures are regenerated; nothing checks that automatically.
10. **Glossary tests and the breaker test start a host of their own**, because the cache and the breaker live as
    long as their host. The shared host sets `Engine:BreakerMinimumThroughput` to 100000 so that failure tests
    never open its breaker, and `Engine:AttemptTimeout` to half a second.
11. **A success body that is not a JSON object is `INTERNAL_ERROR`** for every engine call, `/validate`
    included; beyond that the api checks only the members it reads (the glossary's version, languages and
    identifying fields).

12. **The breaker does not count an answer from a living engine** (decision 11, narrowed after the Phase 2
    review). A 503 with the engine's own problem document (`DATABASE_UNAVAILABLE`) is still retried once but is
    not counted, and `/health` is a probe that is neither retried nor counted. As planned, three failed runs or
    three health polls while `hr` was down would have opened the breaker and answered `ENGINE_UNAVAILABLE` for
    `/validate` and every save, which need no database, from an engine that was up. What still counts: a refused
    connection, an attempt timeout, a 502, and a 503 that is not a problem document (something in front of the
    engine).
13. **After a failed glossary refresh the engine is left alone for 30 seconds** (a constant, not a setting). In
    that time the held copy is served, or the same failure is answered when there is none. Without it every
    reader queued behind the one refresh made a full attempt of its own, one at a time.
14. **The engine's body has a time limit of its own**, one more attempt timeout after the headers, because the
    pipeline's limits end at the headers; a body that stalls is `ENGINE_UNAVAILABLE`.
15. **A `nodeId` comes only from a node**: the root group, a child of a group, or the `where` of a related node.
    An `id` on the definition itself or inside a field reference is ignored, as the engine's own rule has it
    (the reviewer read it on `feat/engine`).

16. **The controls list trims `search` and an empty one filters nothing**, as the contract says for the results
    search; for the controls list the contract only says "the name contains it".
17. **An archive that meets a concurrent save is applied to the row as it is now** (up to three tries). `DELETE`
    carries no token and its contract knows no conflict, so a 409 or a 500 there would be an answer the contract
    does not list.
18. **Response types are named `ControlResponse`, `ControlSummaryResponse` and so on**, because the contract's
    names (`Control`, `ControlVersion`) are the entities' names; the JSON members are the contract's.

19. **An id or a version in the path is a positive integer of any size up to 64 bits.** `contracts/api.md` answers
    404 `NOT_FOUND` only for a segment "that is not a positive integer", so `99999999999` is an id no control has
    (`CONTROL_NOT_FOUND` with that id), not an unknown path. A number of more than 19 digits no longer fits the
    route's type and is `NOT_FOUND`.
20. **`lastRun` is read in a second query, for the page's controls only**, instead of the correlated subquery of
    Design F. EF turns that subquery into a ROW_NUMBER over the whole of `dq.Run`; restricted to the page's ids
    it enters the index on `(control_id, started_at DESC)` once per control. The id stays as the tie-break of two
    runs started in the same millisecond.
21. **Two saves that race to add the same version number are a 409 as well**: the second insert meets the first
    one's key, and that is answered `CONCURRENCY_CONFLICT`, not 500.

22. **A run's request is checked before its control is read**: a malformed `runDate` is 400 also for an unknown or
    archived control, as the contract orders the checks of `PUT`. Design F named the control first.
23. **The snapshot's rows reach the context through the run's own collection and one `SaveChanges`**, which is
    one change-detection pass over them. Design F asks for "change detection off"; switched off, the context
    would not see the run's own closing either. Measured: a run of 5,000 violations is stored and answered in
    1.8 to 2.0 s (three runs, `gates/phase-4.txt`), so the batch size is the provider's default.
24. **Without a glossary the display values keep the engine's order.** `display_text` is ordered by the root
    entity's `identifyingFields`; if the glossary cannot be had right after a run (rare: the engine has just
    answered) the rows are stored in the order the engine wrote the values, and a warning is logged.
25. **A run answer outside the contract closes the run `INTERNAL_ERROR`**: a member missing or of another type, a
    record key that is empty or longer than 64 characters, fewer violations counted than returned. An engine
    version longer than its column makes the save fail, which is the "snapshot cannot be stored" case: `failed`,
    `INTERNAL_ERROR`, no rows.

26. **A run that the host cuts off is closed, not left `running`.** Decision 12 lets the host's stop cancel the
    engine call; the row is then closed `failed` with `INTERNAL_ERROR` and the request is still answered 201.
    After the row exists no write of it takes a cancellation token, the client's or the host's, so a run stays
    `running` only when the process dies or the database is gone at the moment of closing.

27. **`UseDefaultFiles` is left out.** The fallback route answers `/` with `index.html` itself, and the
    default-files middleware does nothing once an endpoint has matched, so it would be dead.
28. **CORS is always in the pipeline, with a policy built from `Cors:AllowedOrigins`**; with no origin it allows
    none. Design D says "CORS when origins are configured"; the outcome is the same, and the settings are read
    when first needed, not while the host is being composed.
29. **`max` of a suggestions request has a lower bound only** (`OUT_OF_RANGE` with `min`); the engine caps what it
    returns. A null item of `accept` is read as an empty one (`REQUIRED` at its name and its definition).
30. **The README gets one section, "The api (.NET 10)"**, before the repository map. The two sentences elsewhere
    in the README that say "filled by dc-api" (Configuration, Running the tests) are dc-delivery's to reword
    (decision 26), and are in the list below.
31. **A test holds `api/requests.http` to the contract's table**, one request per row, like the mapped
    endpoints and the OpenAPI document.

## Last reviewed
`f54d6c2` (Phase 4), fixes in `90a5db1`; `96bc1e9` (Phase 3), fixes in `a619323`; `b89bd0b` (Phase 2), fixes in `638787d`; `8e80f74` (Phase 1), fixes in `a781c91`

## Docs for dc-delivery
Kept as the work goes (plan.md decision 26) and copied into the PR body under this heading at `/ship`. The
entries below come from the plan, before any code: confirm each against what was built, drop what did not
happen, add what did.

- `docs/architecture.md` §7, EngineClient: one retry, and only after a connection error or a 408, 429, 502 or
  503; the breaker opens at 5 calls with half of them failed and does not count a 504 (decisions 10 and 11).
- `docs/architecture.md` §7 and §9, runs: a run ignores the client's disconnect once its row exists, and a run
  cut by a crash of the api stays `running` (decision 12). The second is also a limitation for
  `docs/assumptions-limitations-extensions.md`.
- `docs/architecture.md` §13: the api's persistence tests run against the shared database, with rows marked
  `zz-dc-api-test-` that the suite deletes; the tests against the real engine are opt-in (`DC_LIVE=1`).
- `docs/architecture.md` §14 and the README's configuration part: the api's variables are those of plan.md
  Design B; its connection string is built from `DB_HOST`, `DB_PORT` and `DQ_APP_PASSWORD` unless
  `ConnectionStrings__Dq` is set; the published api reads no `.env`, and its content root is its own folder.
- `docs/assumptions-limitations-extensions.md`: no un-archive (an extension); control names are not unique; the
  JSON Schema validator is JsonSchema.Net 8.0.5, pinned as its last MIT release; a synchronous run waits for the
  engine for at most the attempt timeout (75 s by default).
- README outside the api section: `/api/docs` and `/openapi/v1.json` are served in every environment; `dotnet
  test` in `api/` needs the database up, and writes and deletes marked rows in `dq`.
- `docs/architecture.md` §12 or `contracts/api.md` §1, wording only: "a body that is not JSON 415" is built as
  both a media type that is not JSON and JSON text that does not parse (decision 3 of the unattended run). If
  the engine reads it differently, the two services disagree on one status and the line needs a second sentence.
- `docs/architecture.md` §7, EngineClient: the breaker does not count a 503 that is the engine's own problem
  document, and a health probe is neither retried nor counted (unattended decision 12); the response body has
  a limit of one more attempt timeout (decision 14); after a failed glossary refresh the engine is not asked
  again for 30 seconds (decision 13).
- `docs/architecture.md` §7 and §9, runs: the row is opened and closed without any cancellation token; a host
  that stops during the engine call closes the run `failed` with `INTERNAL_ERROR` (decision 26). The limitation
  for `docs/assumptions-limitations-extensions.md` narrows to: a run stays `running` only after a crash, or
  when `dq` cannot be reached at the moment the run is closed.
- `README.md`, Configuration and Running the tests: the two sentences "filled by dc-engine and dc-api" and
  "one command each, filled by ..." can now point to the section "The api (.NET 10)", which holds the api's
  variables, its test command and the publish command.
- `docs/architecture.md` §8 and §14: the api serves the client's build from the `wwwroot` beside the published
  app, which must be there before the start (a folder added later is not seen until a restart); a path with a
  file extension that names no file is a 404 problem, every other path outside `/api` is `index.html`, served
  with `Cache-Control: no-cache`. Swagger UI is at `/api/docs` (its page is `/api/docs/index.html`).
- `docs/ai-usage.md`: the Log below.

## Log
The times of 2026-11-11 are the times of the commits (`git log`): a first draft of these lines carried
estimated times that ran up to two hours ahead of the clock, and they were corrected at 01:15.
A review's line follows plan.md decision 27: the diff range, findings per axis and severity, each critical and
warning by file, what the fix changed, what was left and why, what Kfir rejected or rewrote.

- 2026-11-10 created plan. Interview in two rounds, eight questions. Kfir took the recommended option in each
  (plan.md Decisions 1 to 8) and left one optional extra unselected, the runnable stub engine.
- 2026-11-10 three corrections by Kfir during the session. (1) Before the addendum was written: re-read the
  contracts plan, write a separate section, and make the two sections agree on the `SCHEMA_VIOLATION` path.
  (2) The rendered-text parts are named `sentenceParts` and `textParts` and take their shape from the engine
  session's section; that section was not on disk when he said so (the file was unchanged since 15:12), the
  session waited, and it landed at 19:54. (3) The three asks from dc-delivery, below.
- 2026-11-10 one rule of this plan was replaced after reading the engine session's section: its H4a (the path is
  the failing keyword's location) is more precise than this plan's first rule (the nearest node), so H4a holds
  and plan.md decision 24 says what the api does to follow it.
- 2026-11-10 wrote into `dev/active/dc-contracts/plan.md`, on Kfir's word: Design I "Addendum from dc-api
  planning" (two decisions and 14 pinned details), one step in its phase 2 (the schema half of I1) and one in its
  phase 4, and a Log line in its notes.
- 2026-11-10 probed Python jsonschema 4.25.1 against JsonSchema.Net 8.0.5 on a miniature schema
  (`research/schema-probe.md`): they agree after three corrections on the api side, and only if the schema uses
  no `not`, `anyOf` or `oneOf`. That constraint is I1 in the contracts plan; Phase 2 repeats the probe on the
  real schema.
- 2026-11-10 read `dev/active/dc-engine/plan.md` and `dev/active/dc-web/plan.md` as they stood at 19:52 and 19:59.
  Engine: 30 s per statement and two statements per run (about 60 s, although its decision 18 says "exceed 30 s
  for a run"), `/suggest` up to 25 s with a key, 404 and 405 both `NOT_FOUND`, the same language rule as here; its
  gate sends this session one line with the timeouts and its contract differences. Web: it read this plan and
  agrees on the archived 409, the `sort` meanings and the `index.html` fallback; its two open asks to
  dc-contracts (the Hebrew date pattern, `identifyingFields` with the name first) change nothing here, because
  `display_text` follows the glossary's order; it already corrects the two `docs/design.md` lines noted below.
- 2026-11-10 21:16 updated the plan on Kfir's word with three asks from dc-delivery: the win-x64 self-contained
  publish must stand alone and is tried once before the gate (decision 25, Design I, a step in Phase 5);
  documents outside the api's own section are dc-delivery's and drift goes to the PR body (decision 26, the list
  above); the Log is kept factual (decision 27). Read `dev/active/dc-delivery/plan.md` as of 21:10: its
  `run-all.ps1` starts `prebuilt\api-win-x64\DataControls.Api.exe` from the script's directory with
  `ConnectionStrings__Dq` (a named instance, no port), `Engine__BaseUrl`, `ASPNETCORE_ENVIRONMENT=Production` and
  `ASPNETCORE_URLS`; compose passes `DB_HOST`, `DB_PORT`, `DQ_APP_PASSWORD` and `Engine__BaseUrl`; its
  `.env.example` will carry `DB_PORT=14330` for graders while Kfir's `.env` keeps 1433.
- 2026-11-10 21:20 scratch probe for decision 25 (a template web api and a test project, not kept):
  `ContentRootPath = AppContext.BaseDirectory` in `WebApplicationOptions` works under `WebApplicationFactory`
  (two tests passed; the content root was the test output folder, the app's `appsettings.json` was read there,
  `UseWebRoot` served `/` and a deep link from a temporary folder), and the built app started from another
  directory ran in Production and read the `appsettings.json` beside it. The win-x64 publish itself was not
  run: that is the Phase 5 trial.
- 2026-11-10 found while orienting:
  - `Skill(dc-api)` is path-scoped and not loadable before a file under `api/` exists; read the `SKILL.md` file.
  - NuGet, checked today: JsonSchema.Net 8.0.5 is the last MIT release (9.0.0 and later ship `OSMFEULA.txt`);
    its dependencies JsonPointer.Net 6.0.1 and Json.More.Net 2.2.0 are MIT, Json.More.Net 3.0.0 is not. .NET 11
    packages are published (EF Core and ASP.NET Core 11.0.0), the 10.0 line is at 10.0.15, the local SDK is
    10.0.114 with runtime 10.0.14.
  - Templates on this machine: `dotnet new sln` writes `.slnx`; `dotnet new webapi --use-controllers` gives
    `AddOpenApi`, `MapOpenApi` in Development only, `UseHttpsRedirection` and a random port; `dotnet new xunit`
    gives xunit 2.9.3.
  - `docs/design.md` (States table) names `GLOSSARY_MISMATCH` for a control whose field left the glossary (in
    dc-contracts Design F that is the run error `CONTROL_DEFINITION_OUTDATED`) and says the breakdown counts the
    shown rows under the cap (Kfir kept Design E: exact counts). Both are the web task's lines (its decisions 15
    and 16).
  - The suite guard's `pgrep` pattern also matches the `playwright-mcp` servers every session starts; they are
    not suites.
  - The Windows host (Windows 10 Home, build 19045) is reachable from WSL through `cmd.exe` and
    `powershell.exe` from a `/mnt/c` working directory and had no .NET on 2026-11-10, so it is where the publish
    trial shows whether the folder is self-contained.
- 2026-11-11 00:05 resumed in `../cbs-api` on `feat/api` (level with main at `f9928bf`), unattended on Kfir's
  word. Contract diff of Phase 1: `sql/30_dq_tables.sql` matches Design C column for column; Design H holds except
  three lines, corrected in the plan: request errors need params and trimmed lengths (Design D), `active` also
  takes `all` (H3), and a bad query value is `OUT_OF_RANGE` or `MALFORMED` by kind (H4). Nothing the api needs is
  left open by the contract, so no blocker was raised.
- 2026-11-11 00:20 Phase 1 gate green: build with `-warnaserror`, format, 64 tests, print guard
  (`gates/phase-1.txt`). NuGet on 2026-11-11: the three Microsoft packages at 10.0.15 (11.0.0 exists),
  Resilience 10.11.0, SwaggerUI 10.3.1 (11.0.0 exists), JsonSchema.Net 8.0.5 pinned (9.6.0 exists).
- 2026-11-11 00:30 Phase 1 review (diff `f9928bf..8e80f74`, one reviewer on opus): standards 0 critical, 2
  warning, 4 info; plan 0, 2, 2. Warnings: `Errors/ModelStateErrors.cs` passes a key without `$` as a query
  name, so MVC's implicit `[Required]` on a non-nullable member would answer `MALFORMED` under the C# name;
  `Errors/ProblemShapeTests.cs` shows decision 3 against the contract's "a body that is not JSON 415";
  `Health/HealthTests.cs` derives the expected status from the response's own `engine` member;
  `Hosting/DotEnvConfigurationProvider.cs` loads every key of `.env`, the sa and the engine passwords included.
  Fixed in `a781c91`: implicit required switched off, with the probe's `Name` made non-nullable to prove it; a
  body guard answers 415 for JSON text that does not parse (decision 3 rewritten) and holds an undeclared
  length to 1 MB; the health test asserts fixed values; the `.env` source takes the three database keys and
  `Section__Key` keys only. Info fixed in the same commit: the two foreign keys that have no ON DELETE are
  mapped `NoAction`, one public type per file in four test files, six test names given a condition, the
  `Run.Succeed` comment. Changed without a finding: Hebrew literals in test code replaced by the example's
  Hebrew name read from `contracts/examples/`. Left: `SupportedLanguages` copies its set to a local (info),
  because Phase 2 makes the set replaceable; decision 1 (Fable for execution, info) cannot be changed from
  inside the session. Kfir rejected or rewrote: nothing; he was not present.
- 2026-11-11 00:27 schema probe repeated on the real schema before Phase 2 (`research/schema-probe.md`): the two
  corrections put all five schema-layer fixtures on their expected path. Two facts found on the way:
  `JsonSchema.FromText` refuses to register the same `$id` twice in one process ("Overwriting registered schemas
  is not permitted"), so the built schema is held statically; and 40,000 evaluations of one schema instance on
  16 threads gave no mismatch and no exception, so evaluation is not locked.
- 2026-11-11 00:36 Phase 2 gate green: build, format, 159 tests, print guard (`gates/phase-2.txt`). Transitive
  packages as pinned: JsonSchema.Net 8.0.5, JsonPointer.Net 6.0.1, Json.More.Net 2.2.0, Resilience 10.11.0.
- 2026-11-11 00:50 Phase 2 review (diff `a781c91..b89bd0b`, one reviewer on opus): plan 1 critical, 3 warning, 0
  info; standards 0 critical, 1 warning, 4 info. Critical: `Engine/EngineModule.cs` retried and counted every
  503, so the engine's own `DATABASE_UNAVAILABLE` and three `/health` polls would open the one breaker and
  `/validate` would answer `ENGINE_UNAVAILABLE` from an engine that was up. Warnings: `Glossary/GlossaryService.cs`
  no back-off after a failed refresh, readers queue for an attempt each; `Controls/DefinitionDocument.cs` any
  object on the path gave a `nodeId`, the definition and a field reference included; `Engine/EngineModule.cs` no
  limit on the body read after the headers; `Health/HealthTests.cs` the 2-second probe limit and the 503 retry
  were not actually tested. Fixed in the commit `fix(api): review fixes` after `b89bd0b`: probes marked and
  skipped by both predicates, a problem-document 503 not counted (decision 12, plan decision 11 and Design E
  amended); a 30-second back-off with the failure remembered (decision 13); `ResponseHeadersRead` with a body
  limit of one attempt timeout (decision 14); node positions tracked along the pointer (decision 15); health
  tests assert one call and the two seconds on a host with a one-minute attempt timeout; four breaker tests, four
  glossary tests, a stalled-body test, node-id cases. Info fixed: the `!` in `DefinitionSchemaValidator`, the
  correlation id in its warning, the startup probe's filter on the stopping token. Left: `EngineErrorMap` knows
  `RunStatus` and `RunFailure` and its run column has no caller until Phase 4 (info), because the plan asks for
  one table. Kfir rejected or rewrote: nothing; he was not present.
- 2026-11-11 00:52 Phase 3 gate green: build, format, 239 tests, print guard (`gates/phase-3.txt`).
- 2026-11-11 01:03 Phase 3 review (diff `638787d..96bc1e9`, one reviewer on opus): standards 0 critical, 3
  warning, 3 info; plan 0, 2, 2. Warnings: `Controls/ControlUpdateTests.cs` a hand-typed copy of an example's
  definition and hard-coded entity keys in three test files (genericity); `Controls/DefinitionHasherTests.cs` no
  case with a string spelled by an escape; `Controls/ControlService.cs` `ListAsync` 61 lines in five phases;
  `ControlService.cs` the `lastRun` subquery is not served by the index as Design F says;
  `Controls/ControlsController.cs` an id beyond 32 bits answered `NOT_FOUND` where the contract's wording gives
  `CONTROL_NOT_FOUND`. Fixed in the commit `fix(api): review fixes` after `96bc1e9`: the reordered definition is
  built from the example and entity keys are read from the examples; the escape case is in the file (the
  finding was right: the escape had been decoded on its way into the file, so the case was a duplicate of the
  reference); `ListAsync` split into filter, page, last runs and mapping; last runs read for the page's ids
  with four columns (decision 20; the SQL was printed with `ToQueryString` and read: ROW_NUMBER partitioned by
  control, restricted by `control_id IN (...)`; `LIKE @p ESCAPE '\'` for the search; `OPENJSON` for the
  condition filter); ids and versions bound as 64-bit (decision 19). Info fixed: the redundant
  `OriginalValue = token` removed (the check before it already proved the token is the loaded row version);
  five test names given a condition; the wildcard search test now searches by its own test id; a duplicate
  version key in a race answers 409 (decision 21), with a test of two racing definition changes. Left:
  `LastRunResponse` uses `Persistence.RunStatus` on the wire (info), because the enum's four names are the
  contract's and the column's, and a second enum would only be converted to and from the first. Kfir rejected
  or rewrote: nothing; he was not present.
- 2026-11-11 01:06 Phase 4 gate green: build, format, 290 tests, print guard (`gates/phase-4.txt`). One run of
  5,000 violations (the stub's answer of about 3 MB, parsed, 5,000 rows inserted with the provider's default
  batch size, the run read back): 2011 ms, 1813 ms and 1880 ms in three runs of the test alone.
- 2026-11-11 01:20 Phase 4 review (diff `a619323..f54d6c2`, one reviewer on opus): plan 0 critical, 2 warning, 1
  info; standards 0 critical, 3 warning, 1 info. Warnings: `Runs/RunService.cs` a host that stops during the
  engine call left the run `running` and answered 500; `RunService.cs` the catch around the snapshot save took
  only two exception types, so a raw `SqlException` skipped the close; `Runs/RunResultsTests.cs` the display
  sort never tied (the tie-break was not exercised) and one "not the contract" case failed before the check it
  named; `Runs/DisplayText.cs` and five behaviours without a test (the value rules, the glossary version drop,
  the no-glossary order, the client's disconnect, the row cap, the same-millisecond order);
  `Support/RunAnswers.cs` chose a value's type by a field name's ending and the tests named two fields. Fixed in
  the commit `fix(api): review fixes` after `f54d6c2`: the run is closed on a host stop and no write of the row
  takes a token (decision 26); any failed snapshot save tries the close; `RunAnswers` reads the identifying
  fields and their types from the glossary fixture and takes display values by position; six `DisplayText`
  unit tests with literal expectations; `RunLifetimeTests` (client leaves, host stops, cap below the answer,
  another glossary version, no glossary); a tie in the display sort; three answers outside the contract, each
  failing on the check it names; three runs at one pinned instant. Info fixed: the insert of the run row no
  longer listens to the client (found on the implementer's own re-read before the review arrived, as was the
  wider catch); `DisplayTextOf`, which repeated the join, is gone: the order test now searches for two
  adjacent values in the glossary's order and in the order written. Found without a finding: two fake
  passwords in `ConfigurationTests` tripped the secrets scan of `/ship` and became one named placeholder; the
  host-stop test goes through `RunService` with a lifetime the test signals, because the test server is torn
  down at once where Kestrel drains its requests. Kfir rejected or rewrote: nothing; he was not present.
- 2026-11-11 01:21 the start of the published app from another directory (plan Design I), once, on WSL.
  Command: `cd api && dotnet publish src/DataControls.Api -c Release -o <dir outside the repository>/published-api`,
  a one-line `index.html` put into its `wwwroot`, then from the working directory `<dir>/run-from-here`, with
  an environment emptied but for `PATH`, `HOME`, `DB_HOST=localhost`, `DB_PORT` and `DQ_APP_PASSWORD` (read
  from `.env` into the child only), `Engine__BaseUrl=http://127.0.0.1:59999` (nothing listens there),
  `ASPNETCORE_ENVIRONMENT=Production` and `ASPNETCORE_URLS=http://127.0.0.1:5087`:
  `dotnet <dir>/published-api/DataControls.Api.dll`. The folder held 67 files, no schema file and no `.env`.
  Requests: `GET /api/v1/health` 200 (`database` ok, `engine` unavailable, `degraded`); `POST
  /api/v1/controls/validate` with the fixture `value-with-is-null.json` 422 `SCHEMA_VIOLATION` (the embedded
  schema, no engine); `GET /openapi/v1.json` 200; `GET /api/docs/index.html` 200; `GET /` and `GET /runs/1` 200
  with the index page; `GET /api/v1/controls?pageSize=1` 200; `GET /api/v1/glossary` 503 `ENGINE_UNAVAILABLE`;
  `GET /api/v1/nothing-here` 404 `NOT_FOUND`. The log: "Hosting environment: Production", "Content root path:"
  the published folder, no SQL statement, no password, one `fail:` line, which is the resilience library's own
  record of the refused connection. The process was stopped and the copied folder deleted. The same script had
  been tried once before on a scratch copy of `api/` at 01:13, with the same answers.
- 2026-11-11 01:22 Phase 5 gate green: build, format, 344 tests passed and 3 skipped (the live tests), print
  guard (`gates/phase-5.txt`).
