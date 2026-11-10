# dc-engine notes

## State
Phase 0 not started. The plan was written on Fable on 2026-11-10 in the main tree, before `contracts/` exists: it
is built on `dev/active/dc-contracts/plan.md` Designs B to H (H holds the amendments this planning added there).
Execution is for Opus, in the worktree `../cbs-engine` on `feat/engine`, after dc-contracts merges. This folder
moves into that worktree in phase 0.

The plan was amended the same day for dc-delivery's asks (plan.md decisions 20 to 25): the connection is set by
`ENGINE_DB_DRIVER` and an optional `ENGINE_DB_PORT`; Python 3.12 or later with Windows wheels for 3.12 to 3.14;
UTF-8 by name on every file; `requirements.txt` moved from phase 7 to phase 1; this task writes no document but
the README's engine section; the Log records what each review found.

## Next
1. Wait for the dc-contracts gate and its merge. Then, on Kfir's word, from the main tree:
   `git worktree add ../cbs-engine -b feat/engine origin/main`, `cp .env ../cbs-engine/.env`,
   `mkdir -p ../cbs-engine/dev/active && mv dev/active/dc-engine ../cbs-engine/dev/active/`.
2. Open Claude Code in `../cbs-engine`, switch to Opus, run `/resume dc-engine`.
3. Phase 0: `odbcinst -q -d` must list `ODBC Driver 18 for SQL Server` (it does since 2026-11-10 20:57); then
   read `contracts/` against plan.md Design J and record every difference in this file before writing code.

## Blockers
- dc-contracts has not started, and nothing in this task starts before its gate (architecture §19).

## Docs for dc-delivery
One line per item, added in the step that makes it true (plan.md decision 24): the file and section, what it
says, what is true now. The list goes into the PR body under this heading at `/ship`.

(none yet. The plan already knows of two: architecture §19 and §6 on suggestions, when phase 5 lands; the engine's
variables in architecture §14 and in the README's configuration table, when phase 1 lands.)

## Last reviewed
(none)

## Log
- 2026-11-10 created plan. Interview in two rounds (plan.md Decisions 1 to 5). Kfir chose `lifecycle` and
  `required` as the only suggestion knowledge in the glossary and moved example 1 to the LLM path; Claude Sonnet
  5.5 as the default model; only-violated suggestions; 1.5 days with the LLM adapter as the first cut; all four
  groups of contract additions, written the same day into the dc-contracts plan (its decisions 26 to 29, Design H).
- 2026-11-10 machine facts: Python 3.12.3, uv 0.11.26, pyright on PATH, no ruff on PATH, no host `sqlcmd`, no
  `.env` yet, Docker Desktop not running at planning time (nothing listened on 1433 or 8000). The `pgrep` pattern
  for running suites also matches the Playwright MCP servers.
- 2026-11-10 verified on SQLAlchemy 2.0.57 with a scratch script (plan.md Design D, "Verified at planning"):
  `autoescape=True` does not escape `[`; `.limit(int)` renders `TOP` as a literal and a bound limit becomes a
  `ROW_NUMBER()` wrapper; `col == False` is rendered inline. The `dc-engine` skill and the security-auditor brief
  say otherwise about `[` and about `.label(condition_id)`; phase 3 corrects them.
- 2026-11-10 `Skill(dc-engine)` is unknown until a file of its area exists; read
  `.claude/skills/dc-engine/SKILL.md` directly (the same finding as in dc-contracts).
- 2026-11-10 amended on Kfir's word for dc-delivery's four asks and its line to all three tasks: plan.md
  decisions 20 to 25, Design A (connection, start command, tooling, portability, the wheel check), Designs E, F
  and I, phases 0, 1 and 4 to 7, the gate, Risks and Out of scope. Chosen: `ENGINE_DB_DRIVER` plus an optional
  port, not a connection-string variable. The architecture edit of phase 5 became a "Docs for dc-delivery" line.
  The blocker on `msodbcsql18` was removed: version 18.7.1 was found installed (`/etc/odbcinst.ini` dated 20:57).
- 2026-11-10 verified for that amendment, in the scratchpad (plan.md Design A, "Verified at planning"): a
  wheels-only resolve of the planned pins for win_amd64 exits 0 on 3.12, 3.13 and 3.14, the same 32 pins on each;
  the list imports under 3.13.14 and 3.14.6 on Linux; pip 24.0 accepts the uv export; SQLAlchemy 2.0.57 builds
  `Server=.\SQLEXPRESS` from a host with no port; pydantic-settings 2.16.2 needs `env_ignore_empty` off for an
  empty port to win over `.env`; Ruff 0.17.4 has `PLW1514` only in preview; an open `anthropic` requirement
  resolves to 2.8.0, which is why the plan now says `>=1,<2`; `-o /dev/null` fails in `uv pip compile`. Nothing
  ran on Windows.
- 2026-11-10 side effect of that check: uv downloaded CPython 3.13.14 and 3.14.6 into `~/.local/share/uv/python/`
  (104 MB and 110 MB). uv now builds a project that has no `.python-version` on 3.14.
