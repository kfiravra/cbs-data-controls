# `.claude/`: the Claude Code harness of this repository

Adapted on 2026-11-09 from the harness of an earlier project by the same developer. The dated incident names in the
hook tests (2026-05-28 stash, 2026-05-31 hollow typecheck, 2026-11-01 bypass-mode edits, ...) come from there and
record why each rule exists. Architecture §15 describes how the harness is used; it is part of the submission.

Design in one line: instructions carry only what the code cannot tell you; every rule that cannot bend is a hook, an
`ask`/`deny` rule or a setting; skills load on their own by path; verification is silent on success and loud on
failure; no dependencies beyond bash, jq, git and node.

## Inventory

| Path | Purpose | Loaded when |
|---|---|---|
| `CLAUDE.md` | map, verify matrix, gotchas, git policy, doc pointers (at most 100 lines) | every session, as [.claude/CLAUDE.md](CLAUDE.md) |
| `settings.json` | hooks, `deny`/`ask` rules, `attribution: false`, subagent model default | every session |
| `rules/csharp.md`, `typescript.md`, `python.md`, `sql.md` | judgment conventions per language, path-scoped | when a matching file is read or edited |
| `skills/dc-sql`, `dc-engine`, `dc-api`, `dc-web` | repo facts per area (stack, verify, facts that bite, what to read), `paths:` triggered | when a file of the area is touched, or by reading the file |
| `skills/task-plan`, `resume`, `handoff` | task lifecycle on `dev/active/<task>/plan.md` + `notes.md` | user-invoked |
| `skills/check` | the verify matrix for the touched parts, through `hooks/lib/pkgmap.sh` | model or user |
| `skills/phase-review`, `ship` | by-area review on two axes; pre-PR gate | user-invoked |
| `skills/diagnose`, `tdd` | feedback-loop debugging; red/green loop | model or user |
| `skills/guard` | `/guard off` stands the git guard down (writes `state/guard-off`), `/guard on` restores it | user-invoked |
| `skills/impeccable`, `agents/impeccable-*.md` | upstream [impeccable](https://impeccable.style) 4.8.0 design passes, one `reference/` file per command; the four agents are pinned to opus; the engine binary under `scripts/bin/` is gitignored and downloaded on first use | user-invoked, or on UI design requests |
| `agents/reviewer.md`, `security-auditor.md` | read-only reviewers on opus | spawned by skills or on demand |
| `hooks/git-guard.sh` | PreToolUse Bash, per command segment: blocks stash, reset --hard/--merge/--keep, checkout --/./<path>/-f, switch --discard-changes, clean, restore, force-push, deleting main, worktree remove -f, update-ref -d; asks for push, rebase, PRs and container stops or recreates; scans `bash -c "..."`; ignores heredoc prose; fails closed without jq | every Bash call |
| `hooks/guard-ctl.sh` | backs `/guard` | on demand |
| `hooks/post-edit.sh` | records touched files (Edit/Write, and files a Bash command wrote via `sed -i`, `>`/`>>`, `tee`); `eslint --fix` in `web/`, `ruff format` in `engine/` | every Edit/Write and every Bash call |
| `hooks/stop-check.sh` | runs pkgmap's default checks on the touched files (falls back to the dirty tree once per tree state); keeps file:line for MSBuild, ngc, esbuild, pyright, eslint, ruff and print-guard output; blocks the stop once on real errors | every Stop |
| `hooks/print-guard.sh` | flags `Console.Write*` (api), `console.log` (web) and `print(` (engine) outside tests; `--staged` reads the index | Stop, `/check`, git pre-commit |
| `hooks/git/pre-commit` | runs `print-guard.sh --staged` | every commit, once `git config core.hooksPath .claude/hooks/git` is set |
| `hooks/session-start.sh` | branch, dirty count, guard state, the hooksPath reminder, active tasks, state GC | startup, resume, clear, compact |
| `hooks/lib/pkgmap.sh` | the one map from paths to checks (Stop hook, `/check`, `/ship`) | called by the above |
| `hooks/tests/*.test.mjs` | `node --test`, zero dependencies, temp state root | `node --test .claude/hooks/tests/*.test.mjs` |
| `standards/CODING-STANDARDS.md` | judgment rules for reviewers | read by `/phase-review` and `/ship` only |
| `standards/linter-followups.md` | linter rules to adopt once the projects exist | never loaded |
| `state/` (gitignored) | per-session touched lists, error and tree hashes, `red` marker, `git-override`, `guard-off` | runtime |

## The check map (`hooks/lib/pkgmap.sh`)

| Part | Default (Stop hook, `/check`) | `--tests` adds |
|---|---|---|
| sql: `sql/`, `scripts/db-*.sh`, `docker-compose.yml` | nothing | `sql-init` (main tree only), `sql-check` |
| contracts: `contracts/**`, `scripts/contracts-check.py` | `uv run scripts/contracts-check.py` (a skip line without `uv`) | the same |
| engine: `engine/` | `ruff check .`, `pyright` | `pytest` |
| api: `api/` | `dotnet build -warnaserror`, `dotnet format --verify-no-changes` | `dotnet test` |
| web: `web/` | `ngc -p tsconfig.app.json --noEmit`, eslint on touched files | `ng test --watch=false`, `ng build` |
| `contracts/**/*.json` | the contracts row, then the engine, api and web rows | the same |
| service source | `print-guard.sh` | |
| `.claude/hooks/` | the hook tests | |

A part whose directory does not exist yet emits nothing; one without its manifest or tool emits a `skip` line with
the reason. Playwright stays outside the map and runs at the web gate.

## Layout notes

- Only [.claude/CLAUDE.md](CLAUDE.md) loads as a memory file; there is no root `CLAUDE.md`, and SessionStart warns if
  one appears.
- `.mcp.json` at the repository root is tracked: context7 for library documentation, playwright for browser checks.
- `settings.local.json` (the impeccable hooks, local permissions) and `state/` are ignored by `.claude/.gitignore`.
- The worktrees of the parallel tasks (`../cbs-engine`, `../cbs-api`, `../cbs-web`) carry the `.claude/` of their
  branch; `core.hooksPath` lives in the shared git config, so the pre-commit runs in all of them.

## Tests and maintenance

- `node --test .claude/hooks/tests/*.test.mjs`. Also run by the Stop hook whenever a hook file was edited, and by
  `/ship`.
- `/doctor prompt-audit` for stale or conflicting instructions, `/skill-doctor` for unused skills, `/checkup` for the
  setup as a whole, `claude plugin validate .claude/skills` for frontmatter.
- `DC_STOP_DEADLINE` (seconds, default 240) caps the Stop check; `DC_STOP_DRY_RUN=1` prints its commands.

## Known limits

- `CLAUDE_CODE_SUBAGENT_MODEL=opus` is a default: it covers Agent calls that set no model. An explicit `sonnet` still
  works; Plan and `fork` inherit the main model, so `/task-plan` passes `model: opus` explicitly.
- Skill names avoid the bundled `/debug`, `/verify` and `/review`; `resume` deliberately shadows the built-in session
  picker (`claude -r` still works).
- The print guard is a grep: a debug call after code on the same line as a comment, or inside a multi-line string,
  can slip past or be flagged. [standards/linter-followups.md](standards/linter-followups.md) lists the linter rules
  that replace it.
- Commits made with `--no-verify` skip the pre-commit; the Stop check still runs the guard on the touched files.

## Changelog

- 2026-11-09: adapted to this repository. New: the `dc-sql`, `dc-engine`, `dc-api` and `dc-web` skills; rules for
  C#, TypeScript, Python and T-SQL; pkgmap rebuilt on the verify matrix (worktree-aware `sql-init`, skip lines for
  parts not built yet); `print-guard.sh` with the tracked git pre-commit; stop-check parsing for the .NET, Angular and
  pyright formats; the leftover scan in the infra tests. Removed: the previous stack's skills, rules, docker service
  names, doc links and its database MCP server.
- 2026-11-12 (dc-delivery): `CLAUDE.md` gains the compose stack in its Map, the documents of the submission in
  "Where to read" and the Hebrew cover page in the Hebrew gotcha; `dc-sql` records the five compose services and
  the two port defaults; the doc-link test also covers `README.md`, `docs/*.md`, `sql/README.md` and
  `web/README.md`. The four finished task folders moved to `dev/completed/`.
