# dc-api notes

## State
Phase 1 is built and green (64 tests): the `api/` skeleton, configuration, the problem pipeline, correlation id
and language, the `dq` model, `GET /api/v1/health` with the database probe, and the test support. Its review is
next. The run is unattended (Kfir's word of 2026-11-11, below): no stop at phase gates, decisions are taken and
written under "Decisions taken unattended".

## Next
1. Phase 1 review (`/phase-review api`, one reviewer, opus), one `fix(api): review fixes` commit, the Log line.
2. Phase 2: the engine client and its resilience pipeline, the error map, the glossary cache, the schema
   validator (repeat `research/schema-probe.md` on the real schema first), `POST /controls/validate`.
3. Phases 3 to 5 and the gate, in the plan's order.

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
3. **415 is a media type that is not JSON; JSON text that does not parse is 400.** `contracts/api.md` says "a
   body that is not JSON 415". Read as the media type, which is what 415 means in HTTP; a body sent as
   `application/json` whose text does not parse answers 400 `REQUEST_INVALID` with `MALFORMED` at `""`. The two
   cannot be told apart reliably after the binder (a syntax error and a wrong-typed member are the same
   exception), and both readings answer `REQUEST_INVALID`. For dc-delivery's review of the contract wording.
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

## Last reviewed
(none)

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
- `docs/ai-usage.md`: the Log below.

## Log
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
