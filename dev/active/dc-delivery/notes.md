# dc-delivery notes

## State
Running unattended in the night of 2026-11-11 to 12, on Kfir's night brief (below). Both lanes run back to back
on `feat/delivery`, cut from main at `d66670d` with all five PRs merged. Phase A0 is done; the phases in progress
are named in the last Log lines.

## The night brief (Kfir, 2026-11-11, pasted before going to sleep; it wins over plan.md where they differ)
- Run to the end, no questions, decide and write it here. Stay on Fable 5.2. The guard is off for the session:
  never stash, restore, reset, clean, `checkout --`, rebase or force-push; stage by name; containers only as the
  plan's steps say. His word covers every build, image pull, browser run, review and audit of this task, the
  recreation and removal of the containers and of the dev database as the plan says, the non-secret engine and
  api lines in `.env`, and at the end the push and the PR. No merge, no tag.
- Gate: G1, G3, G5, G6 here; G2 tried through `cmd.exe`, else left for the morning with the reason; G7 is his.
- a. The short architecture document is a new file, `docs/summarize-architecture.md` (one to two pages, one
  diagram). `docs/architecture.md` stays as the long reference, corrected to what was built and not trimmed.
  This replaces Design J's "trimmed in place" and decision 9's trimming.
- b. The optional AI task is answered by a design and a plan: a section in `docs/summarize-architecture.md`, and
  `dev/active/dc-ai-suggestions/plan.md` and `notes.md`, marked "planned, not started", written from his brief
  without an interview.
- c. `docs/assumptions-limitations-extensions.md` also lists the four items dc-web left open, the six open items
  of the api's security audit, and what the three tasks marked not proven.
- d. Close the other tasks: tick the boxes that are now true in the four finished plans (Kfir read the Hebrew
  interface on 2026-11-11; the engine's lines reached the api through its notes) and move the four folders to
  `dev/completed/` in this PR.
- e. The README screenshots are taken with the new look from a clean list: the six examples only, no test tag
  in any shot. This replaces decision 31.
- f. Last and skippable past 30 minutes: a script that loads about 200,000 employees into a separate scratch
  database, and a table of the six examples' timings on it.

## Decisions taken unattended (2026-11-11 to 12)
1. Four opus sub-agents draft beside the compose work, each on files nobody else touches: the two contract
   documents, `docs/ai-usage.md`, the plan of dc-ai-suggestions, and the ticks of the four finished plans. The
   brief's word names builds, pulls, browser runs, reviews and audits; drafting agents are my call, taken to
   finish in one night. Everything they return is read against the sources before it is committed.
2. The four finished task folders moved to `dev/completed/` first (`git mv`), so that every document written
   tonight links to the final path. The move is committed with the ticks, as its own commit (change d).
3. The README shots need a list that holds only the six examples. The dev `dq` turned out to hold exactly
   those six (see "As built"), so no database was removed for it: the shots were taken in B1 by
   `tools/readme-shots.cjs`, after `examples.py verify` and before the gate specs ran. The script refuses a list
   that holds anything else.
4. The api image's health check reads the body of `/api/v1/health` with bash's `/dev/tcp`, the fallback Design A
   names, in place of installing curl: the image then needs no apt step, and the check must read the body
   anyway, because the endpoint is always 200.
5. The `examples` service runs `python:3.12-slim-trixie`, the engine image's own base, in place of the
   `bookworm` tag of Design A: one pull fewer on a first start.
6. `examples.py verify` and `docs` run an example's alternate dates first and its own date last, so the list
   shows the documented count as the control's last run.
7. Docker on this machine reaches Docker Hub through a Windows credential helper, and WSL's link to Windows
   was failing tonight (`UtilAcceptVsock: accept4 failed 110`). Every docker command of this night ran with
   `DOCKER_CONFIG` pointing at an empty config in the scratchpad: all images are public. Nothing in the
   repository depends on it.

8. Kfir, in a message during the night (about 01:00): `gh pr` asks him every time. The bodies of PRs 1 to 5
   were fetched once and saved as `gates/pr-1.md` to `pr-5.md`; this session and every agent read those, and
   no `gh pr` command runs again before the final PR.

## Next
1. Phase B2 (the from-source path, run once as the README writes it), then B4 and the Gate.

## Blockers
- None for the night. G2 and G7 are named in the brief.

## Last reviewed
(none)

## As built
(Phase B0, 2026-11-11; what was built wins over the names plan.md gave on 2026-11-10)
- Engine: `engine/Dockerfile` exists (dc-engine's phase 7; `python:3.12-slim-trixie`, Driver 18, uid 10001,
  port 8000 fixed). From source, from `engine/`: `.venv/bin/python -m uvicorn app.main:create_app --factory
  --host 127.0.0.1 --port 8000`; it reads the repository's `.env` itself. Health: `GET /health`.
- Engine variables: `DQ_ENGINE_RO_PASSWORD`, and the thirteen `ENGINE_*` of `.env.example`; empty means default.
- Api: project `api/src/DataControls.Api`, assembly `DataControls.Api.dll`; the connection is built from
  `DB_HOST`, `DB_PORT`, `DQ_APP_PASSWORD`, or taken whole from `ConnectionStrings__Dq`; `Engine__BaseUrl`;
  the published app reads no `.env`, its content root is its own folder, and it serves the `wwwroot` beside it.
  Health: `GET /api/v1/health`, always 200, with `status` `ok` or `degraded` in the body.
- Web: `npx ng build` writes `web/dist/web/browser`; lock file `web/package-lock.json`; Node 22.
- Playwright: projects `mobile` (390x844) and `desktop` (1440x900); the gate is `npm run e2e:gate` with
  `E2E_BASE_URL`; 9 tests per project; its shots go to `web/e2e/screenshots/<project>/gate-*.png` (ignored).
- Lock files: `engine/uv.lock` with `engine/requirements.txt` exported from it; `api/Directory.Packages.props`.
- The main tree had no `web/node_modules` and no `engine/.venv` (both were built in the worktrees): `npm ci`
  and `uv sync` ran here on 2026-11-11.
- The dev `dq` held exactly the six examples when lane B started (Kfir had reset it after the merges), not the
  246 controls the web notes describe.

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
- 2026-11-11 23:50 resumed on Fable 5.2 with the night brief. Found: all five PRs merged (main at `d66670d`),
  the notes stale (lane A never started, both waits over, the Windows-host blocker removed by the scope
  decision). The web worktree's api and engine were serving on 5000 and 8000 and were stopped (`pkill`, as the
  brief says). `feat/delivery` cut from main. The four finished task folders moved to `dev/completed/`.
- 2026-11-12 00:55 Phase B0 and B1 done. Built: `.dockerignore`, `api/Dockerfile`, the `engine`, `api` and
  `examples` services, `.env.example` (ports 14330, the app block), `scripts/examples.py`, `scripts/start.sh`
  with `lib/env.sh`, `scripts/start.ps1` with `lib/env.ps1`, `start.cmd`. Gate: `gates/B1.txt` (five services
  in their expected states; no foreign password in either service's environment; `examples.py verify` seven
  PASS lines; `db-check.sh` 27 passed; the gate specs 18 of 18 with the untagged listing equal before and
  after). The first build failed on the credential helper (decision 7); the second took the images to 261 MB
  (engine) and 461 MB (api). The README shots were taken on the six-example list (`docs/screenshots/`).
