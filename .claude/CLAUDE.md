# Data Controls

Generic data-quality controls for business users (CBS take-home, due 2026-11-15). A user builds a rule from
business terms in a Hebrew UI, the engine compiles it into one parameterized SELECT, and the violating records
come back with a reason each. Read-only toward organization data. Design: [docs/architecture.md](../docs/architecture.md);
setup, task order and parallel rules: [dev/briefs/cbs-kickoff.md](../dev/briefs/cbs-kickoff.md).

## Map

`web/` Angular :4200 → `api/` .NET 10 :5000 → `engine/` FastAPI :8000 → SQL Server :1433 (schema `hr` holds the
organization data, schema `dq` the controls store). `contracts/` (definition schema, glossary, examples, `api.md`,
`errors.md`) is the only channel between the services: no service imports another's code, and no SQL text crosses
a boundary. `sql/` creates and seeds the database; `scripts/db-init.sh` and `scripts/db-check.sh` drive it. Only
the api writes, and only to `dq`; only the engine reads `hr`.

## Verify (`/check` picks the right subset for the parts you touched)

- sql: `docker compose up -d db && scripts/db-init.sh`, then `scripts/db-check.sh` (the violating records per example)
- engine (`cd engine`): `.venv/bin/python -m pytest` · `.venv/bin/ruff check .` · `pyright` (the venv's, else PATH)
- api (`cd api`): `dotnet build -warnaserror` · `dotnet test` · `dotnet format --verify-no-changes`
- web (`cd web`): `npx ng lint` · `npx ng test --watch=false` · `npx ng build` · Playwright e2e (`npx playwright test`) with screenshots at 390 and 1440
- harness: `node --test .claude/hooks/tests/*.test.mjs`
- Never two suites at once, across every session and worktree: `pgrep -fa "pytest|dotnet test|ng test|vitest|playwright"` first.
- One SQL Server container per machine, started and initialised from the main tree. Worktrees connect to localhost:1433
  and never run `db-init.sh` (pkgmap skips it there); a database change lands on main and is re-initialised from there.

## Gotchas (what the code does not tell you)

- Text is `NVARCHAR` under the database collation `Hebrew_CI_AS`. Hebrew literals in SQL are `N'…'`, and the engine
  types text columns `Unicode`, because SQLAlchemy binds a `String` as VARCHAR through the code page.
- Identifiers only from the glossary, values only bound, exactly one SELECT per compile. Never format a value or a
  name into SQL text: not in tests, not in `/debug/compile`.
- The engine checks every glossary table and column against the database at startup and refuses to start on a
  mismatch: a `contracts/glossary.json` edit without the matching `sql/` change (or the reverse) is a dead engine.
- Two logins, two connection strings: `dq_app` (api: DML on `dq`, nothing on `hr`) and `dq_engine_ro` (engine:
  SELECT on `hr`, nothing else). Never hand a service the other's string or `sa`; a permission error means the code
  sits in the wrong service.
- `dir="rtl"` for Hebrew, the default language, and logical CSS only (`margin-inline-start`, `inset-inline-end`,
  `text-align: start`); a physical `left` or `right` is an RTL bug.
- English-only code, identifiers, logs, comments and tests. Hebrew text lives only in `web/src/assets/i18n/*.json`
  and `contracts/glossary.json` (seed values in `sql/` are data and may be Hebrew). Only keys and parameters cross
  a service boundary; the client renders the text.
- A contract change is one commit to `contracts/` on main plus one line pasted into the other sessions; nothing
  else coordinates the worktrees.
- Port 8000 may be held by another project's container on this machine (`docker ps`); ask before stopping it.
- `gh` works only as `env -u GITHUB_TOKEN gh ...` (the exported token is invalid).
- The print guard flags `Console.Write*` (api), `console.log` (web) and `print(` (engine) outside tests, at Stop,
  in `/check` and at commit. The pre-commit needs `git config core.hooksPath .claude/hooks/git` once per clone
  (worktrees share it; SessionStart says when it is missing).

## Git

- Work on feature branches; local commits at green phase boundaries need no approval.
- push, PR create/merge and rebase happen only on Kfir's word: an explicit verb in the current turn ("push", "ship", "rebase").
  "Continue", "go ahead" and "finish it" are not that word; the hook and the ask rules enforce it.
- stash, reset --hard, checkout --, restore and clean are blocked by the hook; `git stash` is banned outright (2026-05-28 near-loss). `/guard off` is the user's switch, not yours.
- `dev/active/` is untracked and is never staged: no `git add dev/active`, no `-A` or `.` while a task folder is dirty.
  Task folders are local working memory, not history; `.gitignore` covers them but the rule holds even where it does not.
- No docs-only commits: documentation rides with the code commit it describes.
  If only docs changed, leave them uncommitted for the next code commit, or ask.
- Conventional commits (`type(scope): description`), one logical change per commit, one green phase = one commit. Attribution trailers are disabled by setting; never add them by hand.

## Working conventions

- Task state lives in `dev/active/<task>/plan.md` + `notes.md`; it is local and never committed (`/task-plan`, `/resume`, `/handoff`).
- After every completed plan step, tick its checkbox in `plan.md` and update `notes.md` State/Next; at every phase end add a Log line and the gate path. Never batch these to the end of a phase.
- Phase end: `/phase-review` by area, then one review-fix commit.
- Spend is stated before any run that costs money or minutes: `/suggest` runs with an LLM key (model), agent fan-outs (count, model), e2e against live services.
  One line, then wait for the word; never start it in the same breath.
- Models: Fable for planning sessions, Opus for execution, Sonnet only for named mechanical lanes (a lane the plan lists by name).
  Subagents default to opus (`CLAUDE_CODE_SUBAGENT_MODEL`) and never inherit the session model; at most 6 at once.
- Reviewers read [.claude/standards/CODING-STANDARDS.md](standards/CODING-STANDARDS.md); per-language conventions live in `.claude/rules/` and load only when a matching file is touched.

## Where to read

| Topic | Doc |
|---|---|
| Components, responsibilities, prohibitions, why this split | [architecture.md §3](../docs/architecture.md) |
| `hr`, `dq`, the business glossary | [architecture.md §4](../docs/architecture.md) |
| Control definition, validation layers, `contracts/` | [architecture.md §5](../docs/architecture.md) |
| Engine modules and endpoints, error codes | [architecture.md §6](../docs/architecture.md) |
| Api modules and surface | [architecture.md §7](../docs/architecture.md) |
| Client screens, i18n, RTL, reusable components | [architecture.md §8](../docs/architecture.md) |
| Save, run, view, suggest, startup flows | [architecture.md §9](../docs/architecture.md) |
| Security layers, performance | [architecture.md §10–11](../docs/architecture.md) |
| Errors the user sees, testing strategy | [architecture.md §12–13](../docs/architecture.md) |
| Compose, manual path, configuration | [architecture.md §14](../docs/architecture.md) |
| Assignment checklist, the five tasks and their gates | [architecture.md §18–19](../docs/architecture.md), [kickoff](../dev/briefs/cbs-kickoff.md) |

As they land, `contracts/api.md`, `contracts/errors.md`, `docs/design.md` and the §17 documents get rows here.

## Skills

`/task-plan [name]` plan a task · `/resume [task]` pick it up · `/handoff` save state before clearing · `/check [all]` verify touched parts · `/phase-review` by-area review · `/ship` pre-PR gate · `/guard off|on` the user's switch for the git guard · `/impeccable [command]` design passes on web UI (shape, critique, audit, polish). `dc-sql`, `dc-engine`, `dc-api` and `dc-web` load on their own when a file of their area is touched; `/diagnose` and `/tdd` load when relevant. Maintenance: `/doctor prompt-audit`, `/skill-doctor`, `/checkup`, `node --test .claude/hooks/tests/*.test.mjs`.
