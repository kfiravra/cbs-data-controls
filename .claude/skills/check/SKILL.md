---
name: check
description: Run this repo's verify matrix (sql, engine, api, web, print guard, harness) for the parts touched in the working tree, or for everything with `all`. Use before a commit, at the end of a phase, or when asked to verify the work. This is the repo-specific runner, not the bundled /verify.
argument-hint: "[all] [--tests] [path ...]"
allowed-tools: Bash(bash .claude/hooks/lib/pkgmap.sh *), Bash(bash *print-guard.sh *), Bash(dotnet build *), Bash(dotnet format *), Bash(dotnet test*), Bash(npx *), Bash(node --test *), Bash(*/bin/ruff *), Bash(*/bin/pyright*), Bash(.venv/bin/python -m pytest*), Bash(docker compose up -d db), Bash(scripts/db-init.sh*), Bash(scripts/db-check.sh*), Bash(pgrep *)
---

Changed files in the working tree:

!`git status --porcelain 2>/dev/null | awk '{print $NF}' | head -200 || true`

Arguments: $ARGUMENTS

## Steps

1. Scope. `all` → every part that exists. Explicit paths → those. Otherwise the changed files above. Add `--tests`
   when the user asked for tests or the phase is ending; without it you get what the Stop hook runs (typecheck,
   lint, format, print guard), because the suites take minutes.
2. Get the command list, one check per line (`label`, `cwd`, `command`):
   `bash .claude/hooks/lib/pkgmap.sh [--all] [--tests] <paths...>`
3. Before the first test label, `pgrep -fa "pytest|dotnet test|ng test|vitest|playwright test"`: if another session or
   worktree is running a suite, wait or say so. Never two suites at once.
4. Run the checks one at a time from their `cwd`, in the order given. Stop early only when `sql-init` fails:
   everything after it reads the database.
5. Report failures only: the label, then the error lines with `file:line`. All green → one line,
   `check: <n> checks green`. Name every `skip` line with its reason.
6. Fix what you broke, then re-run only the failed labels.

## The matrix (what pkgmap emits)

| Part (touched) | Default | `--tests` adds |
|---|---|---|
| sql (`sql/`, `scripts/db-*.sh`, `docker-compose.yml`) | nothing | `sql-init`: `docker compose up -d db && scripts/db-init.sh` (main tree only) · `sql-check`: `scripts/db-check.sh` |
| engine (`engine/`) | `engine-ruff`: `ruff check .` · `engine-pyright`: `pyright` (venv first) | `engine-test`: `.venv/bin/python -m pytest` |
| api (`api/`) | `api-build`: `dotnet build -warnaserror` · `api-format`: `dotnet format --verify-no-changes` | `api-test`: `dotnet test` |
| web (`web/`) | `web-ngc`: `npx ngc -p tsconfig.app.json --noEmit` · `web-eslint`: eslint on the touched files (`ng lint` with `all`) | `web-test`: `npx ng test --watch=false` · `web-build`: `npx ng build` |
| `contracts/**/*.json` | the engine, api and web rows | the same |
| service source (`.py`, `.cs`, `.ts`) | `print-guard` on those files | |
| `.claude/hooks/` | `hooks`: `node --test .claude/hooks/tests/*.test.mjs` | |

A part whose directory does not exist yet emits nothing; one that exists without its manifest or tool emits a
`skip` line that says what is missing.

Playwright is not in the map. At the web gate run `npx playwright test` from `web/` (screenshots at 390 and 1440);
it needs the api on :5000 with the engine and the db, and it costs minutes, so state it first.

The Stop hook runs the default column on the files you edited this session, so a green `/check` means a silent stop.
