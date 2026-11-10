# dc-api notes

## State
Phase 1 not started. The plan was written on Fable on 2026-11-10 in the main tree (branch `feat/contracts`) and
updated the same evening with three asks from dc-delivery (plan.md decisions 25 to 27, Design I). Execution is
for Opus in the worktree `../cbs-api` on `feat/api`, which does not exist yet. `contracts/`, `sql/` and the
database do not exist yet either: the plan was written against `dev/active/dc-contracts/plan.md` (Design A, E and
F, the engine session's Design H and this session's Design I), and Phase 1 opens by comparing Design C and Design
H of this plan with what dc-contracts actually merged.

## Next
1. Wait for the dc-contracts gate and its merge to main.
2. On Kfir's word, from the main tree: `git worktree add ../cbs-api -b feat/api origin/main`,
   `cp .env ../cbs-api/.env`, `mkdir -p ../cbs-api/dev/active && mv dev/active/dc-api ../cbs-api/dev/active/`
   (task folders are untracked, so a new worktree has none).
3. In `../cbs-api`, on Opus: `/resume dc-api`, then Phase 1, starting with the contract diff.

## Blockers
- dc-contracts is not merged: no `contracts/`, no `sql/`, no database.
- Docker Desktop was not running on 2026-11-10 19:44; the database must be up from the main tree before any test.

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
