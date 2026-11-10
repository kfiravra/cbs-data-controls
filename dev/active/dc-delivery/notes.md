# dc-delivery notes

## State
Lane A not started. The plan was written on Fable on 2026-11-10, before any of tasks 1 to 4 was executed, and
amended the same evening after the hand-backs of dc-web, dc-api and dc-engine (plan.md decisions 28 to 34). Every
ask this task made is answered in the other plans; none is open. Branch `feat/delivery` does not exist: it is cut
from main after the dc-contracts merge and lives in the main tree. Nothing of this task is in the repository.

## Next
1. When dc-contracts has merged: switch the session to Opus, `/resume dc-delivery`, Phase A0
   (`git switch -c feat/delivery main`).
2. Phase A1: the four contract documents (plan.md Design H and K) and the rows of Design J marked "lane A", then
   `/phase-review infra`.
3. When engine, api and web have merged: Phase B0, which starts with the three hand-over notes in the worktrees.

## Blockers
- Lane A waits for the dc-contracts merge. Lane B waits for the engine, api and web merges.
- Before the Phase B3 rehearsal Kfir installs on the Windows host: SQL Server 2022 Express (Basic install) and one
  Python from 3.12 to 3.14 (the python.org installer, not the Store stub).
- Waiting for Kfir's objection, and standing without it: decisions 14 to 27 (the planner's), decision 31 (the
  README shows the gate's shots with the test tag in two control names) and decision 32 (with no key the
  suggestions repeat four loaded controls, and the README says so). The last two are calls the dc-web plan left
  open.

## Last reviewed
(none)

## As built
(filled in Phase B0: variable names of `.env.example`, engine start command, api project and assembly, web output
folder, Playwright projects and screenshot folder, lock files, health paths)

## Log
- 2026-11-10 created plan. Interview in four rounds, thirteen decisions by Kfir (plan.md Decisions 1 to 13). Kfir
  changed two recommended options: the early lane runs in the main tree (no fourth worktree), and the bundle is a
  hybrid (self-contained api, the grader's own Python with a wheelhouse, no embedded Python).
- 2026-11-10 21:10 reconciled with the dc-engine, dc-api and dc-web plans, which appeared on disk during the
  interview (read-only; nothing in their folders was edited). Four lines of asks went to the three sessions
  through Kfir. Found open then: the engine fixed ODBC Driver 18 and built its URL from host and port.
- 2026-11-10 21:45 amended after the hand-backs (Kfir's message; the three amended plans read again, nothing in
  their folders edited). What changed in plan.md:
  - engine connection on Windows by parts (`ENGINE_DB_HOST`, no port line, no driver variable), the api by
    `ConnectionStrings__Dq` alone; the server name is `DB_HOST`, and the `DB_SERVER` variable of the first version
    is gone (decision 29);
  - the offline install uses the committed `engine/requirements.txt` against the wheelhouse; the three per-version
    requirement lists of the first version are gone from the bundle (decision 30);
  - `engine/requirements.txt` is dc-engine's from its phase 1, so only the image depends on its Phase 7 (decision
    14); the engine start command is the `create_app --factory` one, from `engine/`;
  - the gate command has `--workers=1` and runs on a stack with no `ANTHROPIC_API_KEY`; B1 and G1 compare the
    untagged controls before and after it (decision 28);
  - the five README shots are named, with the tag caption (decisions 27 and 31);
  - `docs/design.md` is dc-web's; its CLAUDE.md row, and every architecture edit the three tasks dropped, are
    this task's (decision 34);
  - lane A now also does the architecture rows that need nothing built, because no other task edits that file any
    more (decision 24, changed);
  - the Log form of decision 33.
  Found in the web plan and not in Kfir's three lines: the two open calls listed under Blockers.
- 2026-11-10 machine facts. WSL: Docker 29.9.2 and compose v5.6.1 are Docker Desktop's CLI through `/mnt/c` (a
  shell function), and the daemon was not running; uv 0.11.26, Python 3.12.3, .NET SDK 10.0.114, Node 22.16,
  Angular CLI 21.2.29, jq 1.7, gh 2.87; no `zip`, no `pwsh`, no host `sqlcmd`; 11 GB of memory; interop on
  (`powershell.exe` runs from WSL; start it from a `/mnt/c` directory). Windows host: Windows 10 Home 19045,
  PowerShell 5.1, Git and Docker Desktop; no SQL Server service, no .NET, no Node, `python.exe` is the Store stub,
  ODBC lists only the legacy "SQL Server" driver, no Windows Sandbox (Home edition).
- 2026-11-10 platform facts read during planning, with their sources: `research/facts.md`. Not confirmed there and
  left to the B3 rehearsal: what a SQL Server 2022 Express install adds to a machine (ODBC driver, sqlcmd), its
  support on Windows 10 Home, and whether `docker compose up --wait` still fails on one-shot services in v5.6.
