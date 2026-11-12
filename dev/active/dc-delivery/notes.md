# dc-delivery notes

## State
All phases and the gate items G1, G2, G3, G5 and G6 are done on `feat/delivery`, and PR #6 is open. On 2026-11-12
Kfir gave nine decisions (Log, 08:50) and they are carried out: the index, the contract wording, the one-page
`docs/ai-usage.md`, the chat's role, §15. Later that day Kfir moved the Hebrew documents to their own folder
(seven documents, one per deliverable; Log, 11:03), which replaces decision 8 of the plan; he read them (G7 is
done), revised them by hand and named the folder `submission-he/` (Log, 14:21). G8 was started at 15:52 on
Kfir's word and stopped before `/ship`: one api test was red once, from the machine's clock (Log, 15:59 and
17:30). It ran again at 17:31 and is green: the full check, the gate specs and `/ship` (Log, 17:37). Left, on
Kfir's word of 17:27: the push, the squash merge of PR #6, G9 on a fresh clone of main, and the tag `v1.0.0`.

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

## Decisions taken unattended (2026-11-11)
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

8. Kfir, in a message during the evening (about 22:45): `gh pr` asks him every time. The bodies of PRs 1 to 5
   were fetched once and saved as `gates/pr-1.md` to `pr-5.md`; this session and every agent read those, and
   no `gh pr` command runs again before the final PR.

9. The start scripts wait on the containers' health and on the loader's exit code (`docker inspect`), where
   Design D polls the health address from the host: the compose health check already reads the body of that
   address inside the container, the wait then needs no curl, and a failed loader is seen. Both scripts end
   with one request to the address from the host.
10. The order of `docs/examples.md` is read from the table of the document itself, so `scripts/examples.py`
    names no example (the B1 review's first warning).

11. Change f, the scale test: built and run in about 25 minutes (`scripts/scale-test.sh`,
    `sql/scale/load_scale.sql`). It found that `department-without-active-employees` takes 9.2 s on 2,000
    departments and 200,005 employees, and 36 ms with an index on `hr.Employee (department_id, status)`. The
    index was NOT added: the brief says the seed and its assertions stay untouched (`db-check.sh` asserts the
    exact index list), the run still ends inside the 30 s statement timeout, and plan decision 13 sends a late
    finding that is not critical to the limitations document. Adding it is one statement in
    `sql/50_indexes.sql`, one name in `scripts/db-check.sh` and a row in `sql/README.md`: Kfir's call.

12. G5 found the open item `AllowedHosts: *` to reach further than the documents said (medium). It is NOT
    closed: decision 13 of the plan, and a host list would answer a grader who reaches the app under another
    name with a bare 400. The limitations document now states its true reach. The fix is one line in the `api`
    service of `docker-compose.yml`: Kfir's call.

## Next
1. Push `feat/delivery`, then the squash merge of PR #6 (the branch stays).
2. G9 on a fresh clone of main from GitHub: `scripts/start.sh`, `python3 scripts/examples.py verify`; the record
   as one commit on main; the tag `v1.0.0` on the head of main. No collaborators: the repository is public.
3. Still Kfir's: the branch `feat/contracts`, which holds `43745cc` with three former passwords; it stays until
   after the merge (his word, 2026-11-12).

## Blockers
- None. The machine's clock is Kfir's to watch (Log, 17:30): a suite that fails is rerun up to three times.

## Last reviewed
`0d9767f`: the documents (`reviews/docs.md`) and the security audit of the whole repository (`reviews/security.md`). Before it: `b35d72a` (B1), `reviews/B1.md`.

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
- 2026-11-11 22:25 resumed on Fable 5.2 with the night brief. Found: all five PRs merged (main at `d66670d`),
  the notes stale (lane A never started, both waits over, the Windows-host blocker removed by the scope
  decision). The web worktree's api and engine were serving on 5000 and 8000 and were stopped (`pkill`, as the
  brief says). `feat/delivery` cut from main. The four finished task folders moved to `dev/completed/`.
- 2026-11-11 22:46 Phase B0 and B1 done. Built: `.dockerignore`, `api/Dockerfile`, the `engine`, `api` and
  `examples` services, `.env.example` (ports 14330, the app block), `scripts/examples.py`, `scripts/start.sh`
  with `lib/env.sh`, `scripts/start.ps1` with `lib/env.ps1`, `start.cmd`. Gate: `gates/B1.txt` (five services
  in their expected states; no foreign password in either service's environment; `examples.py verify` seven
  PASS lines; `db-check.sh` 27 passed; the gate specs 18 of 18 with the untagged listing equal before and
  after). The first build failed on the credential helper (decision 7); the second took the images to 261 MB
  (engine) and 461 MB (api). The README shots were taken on the six-example list (`docs/screenshots/`).
- 2026-11-11 22:49 Phase B2 done, in a scratch clone at `b35d72a` (`gates/B2-manual.md`): `requirements.txt`
  equals a fresh export; the engine from a pip-installed virtual environment and the published api with the
  client in its `wwwroot` ran as host processes against the container's database; `examples.py verify` seven
  PASS lines; `docs/examples.md` generated and its `--check` green. Not run as a host command: `db-init.sh`
  against a host SQL Server (no `sqlcmd` on this machine). The stop command killed its own shell once (`pkill
  -f` matched the shell's command line); the engine's host process was then stopped by its pid.
- 2026-11-11 22:50 change d: the sub-agent ticked the 8 open boxes of the four finished plans (contracts 2,
  engine 3, api 1, web 2), none left open, and wrote State, Next, a Log line and the ARCHIVED line in each
  notes file. Two ticks rest on thin evidence and it says so in those Logs: engine plan line 315 (Kfir's read
  of the Hebrew, on the brief's word alone) and web plan line 526 (the last two commits of PR #5 had the
  client's checks and the mocked specs only). Before the "no gh" message reached it, it had run read-only
  `gh pr view` for PRs 1 to 5.
- 2026-11-11 22:59 Phase B1 review (`reviews/B1.md`): two opus `reviewer` agents read `d66670d..b35d72a`.
  Compose and the api image: 0 critical, 1 warning, 4 info. The warning (`docker-compose.yml`: the engine's row
  cap and time zone were passed from `.env` and the api's were not, so changing them did nothing) is fixed; of
  the info findings two are fixed (the database-name passthrough, a tolerant image build), one is left with
  its reason (`DB_HOST` in the example file) and one waits for G1 (the first-start path). Scripts: 0 critical,
  2 warnings, 7 info. Both warnings fixed (`scripts/examples.py` named the six example ids; a Hebrew literal
  in `tools/readme-shots.cjs`); six info findings fixed and one fixed in part (`start.cmd`'s pause keeps
  firing for a `cmd /c` caller; `DC_NO_PAUSE=1` skips it). After the fixes: the stack rebuilt and restarted by
  `scripts/start.sh`, `examples.py verify` six PASS lines, `docs --check` green. Fix commit: `fix(compose):
  review fixes`.
- 2026-11-11 23:00 Phase A1 and B4 done, written as built in one pass (lanes A and B ran back to back).
  Sub-agents on opus drafted `docs/control-definition.md` and `docs/glossary.md` (one agent), `docs/ai-usage.md`
  (one) and the plan of dc-ai-suggestions (one `Plan` agent); this session wrote
  `docs/summarize-architecture.md`, `docs/assumptions-limitations-extensions.md`, `docs/submission.he.md`, the
  README, the frame of `docs/examples.md` and the corrections of `docs/architecture.md`. Checked: the token
  check over the two contract documents (507 tokens, 6 unknown, each explained in `gates/A1.txt`); the worked
  example of `docs/glossary.md` carried out on a scratch stack, every predicted answer as printed
  (`gates/glossary-walkthrough.txt`); the harness tests 227 of 227 with the new link test; `examples.py docs
  --check` green; the three "Docs for dc-delivery" lists applied or answered (`gates/B4.txt`). What the
  contract-documents agent found in the sources and the documents now say: adding a language needs two lines
  of client code and, beyond `he` and `en`, a change of the check on `dq.Run.language`; a computed-field kind
  touches the compiler; `maxTotalValues` cannot go above 500 without engine code; the engine answers a tree
  more than eight times past a limit with that limit's error alone, which `contracts/errors.md` does not say.
  In `docs/ai-usage.md` two statements were corrected by this session against tonight's facts (architecture
  §15 no longer holds the sentence it quoted; the push of `9b5f79a` was on Kfir's recorded word). Its last
  section lists, from the records, where no read by Kfir is recorded: that section is his to read (G7).
- 2026-11-11 23:06 change f done: `scripts/scale-test.sh` and `sql/scale/load_scale.sql`; the table is in
  architecture §11 and the finding in the limitations document (unattended decision 11). The scratch database
  and the second engine were removed after the run; `DataControls` was only read.
- 2026-11-11 23:10 `/check all --tests`, first pass, before the gate: 15 checks green (db-check 27, contracts 5,
  engine 521, api 389 with the 3 live tests skipped, client 390, harness 227).
- 2026-11-11 23:13 review of the documents (`reviews/docs.md`): two opus `reviewer` agents on `5639436` and
  `db92c3d`. Contract documents: 0 critical, 4 warnings, 4 info, all in `docs/glossary.md`'s "how to add"
  recipes (the db-check lists and the live test's version assertion follow an addition; the order of a new
  relationship; what a new computed kind really touches) and all fixed; nothing false in the tables. README and
  the other documents: 1 critical, 5 warnings, 7 info. The critical (`README.md`: "each step was run as written
  on Linux" was false for the host form of `db-init.sh`) is fixed: the sentence says which steps ran. Warnings
  fixed: which of the three passwords is the server's own `sa`; the from-source publish without
  warnings-as-errors; the audit's result stated before the audit had run; wrong evidence for "an edit creates
  a version" in §18; and the unmeasured start times, replaced by G1's. Info fixed: all seven, among them the
  two lines and the two §15 sentences that the "not trimmed" brief wanted kept, now back.
- 2026-11-11 23:14 G5, the security audit of the whole repository (`reviews/security.md`): one opus
  `security-auditor`. 0 critical, 0 high, 1 medium, 2 low, 3 info. Medium: `AllowedHosts: *`, an open item of
  the api's audit, reaches further than the documents said (a rebinding page can create and run a control and
  so read `hr`); the limitations document is corrected, the setting is left (unattended decision 12). Low: one
  compose network for all five services (to the limitations); a second engine on 127.0.0.1:8009 seen during
  the audit (this session's scale test, already removed). Info, for Kfir: his local `.env` is mode 0644;
  `43745cc` with the three former passwords is only on the branch `feat/contracts`, not in main's history.
- 2026-11-11 23:20 the clock. Every Log time above this line was first written from a guess and stood hours
  ahead (up to "04:05", and tomorrow's date in several files); `date` at the start of G1 showed 23:15. The
  times above are now the commit times of `git log` (the resume and the first-pass check are within five
  minutes), and the date in every file written tonight is 2026-11-11. From here on a time is read from `date`.
- 2026-11-12 07:18 the night stalled. The G1 command of 23:15 listed the clone with `ls`, an alias of `eza` on
  this machine; that process hung and `scripts/start.sh` never began. Kfir found it in the morning; the process
  was ended by pid and the start ran from there. Nothing ran between 23:15 and 07:18. From here on a command
  uses `command ls`.
- 2026-11-12 07:27 G1 (`gates/G1-docker-wsl.txt`), on a fresh clone at `c9eca2a` after `down -v --rmi local`:
  `scripts/start.sh` exit 0 in 115 s (base images present, pulls not timed); `.env` mode 600; five services in
  the expected states; six LOAD lines; six controls with `lastRun` null; `examples.py verify` six PASS; gate
  specs 18 of 18; untagged listing equal before and after. Found: a second `scripts/start.sh` after
  `docker compose stop` failed (db-init exit 1, error 904: the database was still recovering while master
  answered). Fixed in `scripts/db-init.sh` (its wait reads an existing DataControls); three stop/start rounds
  and two `compose start` rounds then came back healthy with the controls and runs intact. README: the
  unmeasured "about 8 minutes" is replaced by what was measured (2 minutes with the images present, about half
  a minute later).
- 2026-11-12 07:28 a fresh clone showed one modified file: the vendored `.claude/skills/impeccable/scripts/impeccable.cmd`
  was stored with CRLF under the `*.cmd eol=crlf` rule. Re-stored with LF (`ccdc3b3`); a new clone then reports
  nothing. In the scratch clone only, `git checkout -- scripts/db-init.sh` put back the file that was copied in
  to test the fix; Kfir's tree was not touched by it.
- 2026-11-12 07:30 G3 (`gates/G3-manual.txt`), the README's from-source section on the clone at `10ab7eb`, the
  volume removed first and the compose `db` alone as the server on 14330: `db-init.sh` through its container
  (no host `sqlcmd`), the engine from a pip venv, `npm ci`, `ng build`, `dotnet publish` with the README's
  switch, the api's start line, `examples.py load` six LOAD lines, `verify` six PASS; in a browser "קטינים בשכר
  גבוה" was run from the list and its page showed three records with a reason on each. Not covered: the host
  `sqlcmd` command and the PowerShell forms.
- 2026-11-12 07:33 G2 (`gates/G2-docker-windows.txt`): `set DC_NO_PAUSE=1&& start.cmd` through `cmd.exe` from
  `C:\Users\Public\dc-g2`, a Git for Windows clone at `ccdc3b3` (CRLF for `.cmd` and `.ps1`, LF for `.sh` and
  `.sql`): exit 0 in 117 s with the images present; `.env` created with three passwords; five services in the
  expected states; six LOAD lines; health ok through the Windows `curl.exe`; `verify` six PASS from WSL (the
  host has no Python). Not seen: a double-click and the pause after it. The stack, the folder and the bundle
  were then removed.
- 2026-11-12 07:34 the dev stack is back from the main tree on Kfir's `.env` (database on 1433): `scripts/start.sh`
  exit 0 in 42 s, `verify` six PASS. The dev `dq` is new: six examples and the runs of that verify.
- 2026-11-12 07:36 G6: §18 of `docs/architecture.md` has 35 ticked items and none open; every path and link named
  as evidence exists (checked by a script). Gate boxes G1, G2, G3, G5 and G6 ticked in `plan.md`.
- 2026-11-12 07:38 G8, first half: `/check all --tests` at `76cc249`, 15 checks exit 0 (`gates/final.txt`: engine 521,
  api 389 and 3 live skipped, web 390, hooks 227, db-check 27, contracts 5). `/ship dc-delivery`: no file under
  `web/` changed on this branch, so the full Playwright run is not part of it (the gate specs ran in G1); the
  secrets scan of `git diff main...HEAD` has one hit, a `DQ_APP_PASSWORD=...` placeholder in a table, and the
  six generated and local password values occur in no tracked file; the folder stays in `dev/active` because
  G7, G8's merge and G9 are open. The G8 box stays unticked until the merge, which is Kfir's.
- 2026-11-12 08:42 pushed `feat/delivery` at `6cbbaa9` and opened PR #6 on the word of the night brief
  (`gates/pr-6.md` holds the body). No merge, no tag. This Log line and `pr-6.md` are one local commit after
  the push; it goes up with Kfir's next push.
- 2026-11-12 08:50 Kfir's decisions, pasted (the guard is back on; his word covers the container steps and the
  push): 1 add the index `hr.Employee (department_id, status)`, re-run the scale test, update the table and the
  limitation, re-run db-check and the engine tests; 2 `AllowedHosts` stays `*` ("the app is published to this
  machine only, and a grader may open it under another host name"), kept in the limitations; 3 decisions 10 to
  23 of dc-ai-suggestions stand; 4 contracts as built: 400 for a JSON body that does not parse in the api, 415
  only for a wrong media type, say what the engine answers, add the "eight times past a limit" rule to
  `errors.md`; 5 the two thin ticks stay, worded as what happened; 6 `docs/ai-usage.md` rewritten to about one
  page, the long document moved unchanged to `dev/completed/ai-usage-record.md` and linked once; 7 the chat's
  role in three documents; 8 §15 says what item 6 says; 9 `/check all --tests`, G1 once more, push to PR #6.
- 2026-11-12 08:58 items 1 to 8, five commits (`9154dae` to `c36732f`). The index is
  `IX_Employee_department_id_status`, in `sql/50_indexes.sql`, the scale script and db-check's expected list;
  `IX_Employee_department_id` is kept, although the new index's first column now serves that foreign key too.
  Scale test on 200,005 employees: `department-without-active-employees` 35 ms (was 9,198), the other five 217
  to 550 ms. Contracts, each line first read from the running services: the api answers a JSON body that does
  not parse (broken syntax, not UTF-8, deeper than 64 levels, which is 31 nested groups) with 400 and one
  `MALFORMED` at `""`, and a wrong or absent media type with 415; the engine answers both with 415 and no
  `errors`. The oversize check is step 2 of "Order of checks" in `errors.md`, with the api's own bound (240
  nodes, 10,000 JSON values) and the one case found where the two services differ (30 lists of 134 values).
- 2026-11-12 09:01 `/check all --tests` at `c36732f`: 15 checks exit 0 (`gates/final.txt`).
- 2026-11-12 09:14 G1 a second time on a fresh clone at `c36732f`: start exit 0 in 118 s, six LOAD lines, no run on
  any control, the new index present, `verify` six PASS, gate specs 18 of 18, untagged listing equal. Then the
  dev stack's own start on a new volume failed: db-init, "DataControls exists with a collation other than
  Hebrew_CI_AS". Cause, seen in a watch of a fresh server: it answers for a moment under its default collation
  before it changes to `MSSQL_COLLATION`, and the health check asked only `SELECT 1`. About one new volume in
  seven today. Fixed in `docker-compose.yml` (`e18da5e`): the db is healthy only under its final collation;
  the check fails by hand on a wrong name; five new volumes in a row then initialised.
- 2026-11-12 09:30 G1 a third time, on a fresh clone at `e18da5e` after `down -v --rmi local`: start exit 0 in 50 s,
  `verify` six PASS, gate specs 18 of 18, untagged listing equal (`gates/G1-docker-wsl.txt`). The dev stack is
  back on Kfir's `.env`: `verify` six PASS, db-check 27 passed. The full check was not repeated after `e18da5e`:
  that commit changes one health check line of compose, which the third G1 and the infra tests (30) exercise.
- 2026-11-12 09:35 two wordings of item 6 follow the records and not the brief's sentence, for Kfir's read (G7):
  the brief says "two security audits", the records hold three (the engine, the api, the whole repository in
  G5), and the page says three; the brief says every phase was reviewed by review agents, and the records show
  that dc-contracts had one review at its end and dc-web's phase 13 none, so the page says the work was
  reviewed "at the phase ends of four of the tasks and once at the end of the first" and points to the record
  for the few commits that had no agent review. The chat's "how it was checked" cell is my wording of what
  item 7 implies (its output reached the repository only through him); he should confirm it.
- 2026-11-12 11:03 Kfir's decision of 2026-11-12, replacing decision 8 (one Hebrew cover page): "the Hebrew
  documents live in their own folder, submission/ in the repo root, one document per deliverable of the
  assignment. Every English document stays in docs/." He supplied the finished files in a zip; they were copied
  byte for byte (`cmp` equal, the U+200E marks counted in place), not written or edited here. Placed:
  `submission/README.he.md` (the cover), `install.he.md`, `summarize-architecture.he.md`, `examples.he.md`,
  `assumptions-limitations-extensions.he.md`, `ai-usage.he.md`, `ai-suggestions.he.md`; and his versions of
  `README.md`, `docs/architecture.md`, `docs/ai-usage.md` and `.claude/CLAUDE.md`, each differing from `1e3d776`
  in three places (the link to the cover, the new folder in the repository map, the chat drafting the Hebrew
  documents). Removed: `docs/submission.he.md`. His untracked `dev/active/dc-ai-suggestions/brief.he.md` was
  already gone from the tree. In `dev/completed/ai-usage-record.md` the three relative link targets now resolve
  from that folder; nothing else in it changed (two link texts still show the old paths). Checked: harness
  tests 227 pass; 62 relative targets in `submission/*.md` and the record all resolve; no `submission.he.md`
  left in `README.md`, `docs` or `.claude`. The services' suites were not run: no code changed. `.env` is now
  mode 600. His answers to the report of 09:35: the three wordings (three security audits; reviews at the phase
  ends of four of the tasks and once at the end of the first; the chat's output reached the repository only
  through him) "are accurate and stay as they are"; `IX_Employee_department_id` stays; `feat/contracts` stays
  until after the merge.
- 2026-11-12 14:21 G7 done, on Kfir's word ("I finished reading the Hebrew documents (G7 is done)"). After his
  read the Hebrew documents were revised by hand, by him: tables as HTML with an explicit direction, six PNG
  diagrams in `diagrams/` in place of Mermaid, and ai-usage, examples and assumptions shortened. The thirteen
  files match the sha256 sums he gave. During this step he renamed the folder from `submission/` to
  `submission-he/`; the references to it in `README.md`, `docs/architecture.md`, `docs/ai-usage.md` and
  `.claude/CLAUDE.md` follow the new name (the path only, twelve occurrences, no other wording). Checked:
  harness tests 227 pass; 26 Markdown targets and 34 `href`/`src` attributes in `submission-he/*.md` all resolve;
  nothing under the folder but the seven documents and the six pictures. The services' suites were not run: no
  code changed.
- 2026-11-12 15:59 G8, `/check all --tests` at `992b957`: 14 of 15 checks green at the first pass (db-check 27,
  contracts 5, engine 521, web 390 in 37 files, hooks 227, both builds, lint, format, print guard); `api-test`
  red: 388 passed, 1 failed, 3 skipped. The failure:
  `RunTests.Run_carries_the_previous_succeeded_run_and_the_history_is_newest_first`, the failed run's
  `previousRun` was null where the first run (started 13:54:20.945Z) was expected. The journal has
  "Time jumped backwards" at 15:54:20 local, the same second, and 99 such lines since 15:04 (about one every 30
  seconds): the second run got a start time earlier than the first, and the api orders runs by `started_at`.
  `api-test` run three more times, one after the other: 389 passed each time. No code changed since the green
  run at `c36732f`. Stopped before `/ship`, the e2e run, the merge and G9, as Kfir's brief says for a red check.
  Not done: nothing was fixed or changed; the test and the api are as they were.
- 2026-11-12 17:30 the clock, corrected: the Log line of 15:59 and the Next of that hour say the clock steps back
  "since 15:04", and that is wrong. The journal keeps 100 files and every jump starts a new one, so it only ever
  shows the last 48 minutes or so. Syslog has the jumps on every day back to 2026-10-11, the oldest log kept,
  about 1,900 a day: every earlier green run happened under them, and 15:54 was the one time a step fell between
  two runs of one test. Shown on demand by a temporary test, deleted afterwards and never committed: the test
  clock pinned at 09:00:00 for the first run and at 08:59:58 for the second gives the second run a null
  `previousRun`; pinned at 09:00:02 it gives the first run. A sampler outside the repository saw 11 backward
  steps in three minutes (16:49), in pairs every 30 s, and the WSL clock ran about 5% fast against internet time.
  Cause as measured: two time-keepers in WSL. One pulls the Linux clock to the Windows clock (the kernel's tick
  rewritten to about 10,500 every 8 s, a step onto Windows time every 30 s; its process was not identified);
  `systemd-timesyncd` steps it back to internet time. The Windows clock stood 0.96 s ahead: it gains about
  1.15 s a day, and its time service steps only above 1 s. The jump lines of 2026-11-11 stop at 21:32:13, one
  second after that day's Windows sync. Nothing happened at 15:04: no sleep, wake or time change in the Windows
  System log. What was tried, each on Kfir's word: `wsl --shutdown` (his, 16:22; no effect), "Sync now" (his; no
  sync took place), `net start w32time` and `w32tm /resync /force` elevated (17:21; success reported, the clock
  not stepped), then `Set-Date -Adjust` by -968 ms elevated (17:28): the Windows clock was then within 30 ms of
  internet time. The `w32time` service is left running. The sampler was not run after the step: Kfir's word of
  17:27 is to go on whatever the clock shows, with one rule for the closing run, a suite that fails is rerun up
  to three times and a failure that repeats three times is real.
- 2026-11-12 17:37 G8 again, at `992b957`, after the dev stack came back by `scripts/start.sh` (exit 0 in 55 s):
  `/check all --tests`, 15 checks exit 0 at the first pass, no rerun (`gates/final.txt`: db-check 27, contracts
  5, engine 521, api 389 and 3 live skipped, web 390 in 37 files, hooks 227). The gate specs on that stack: 18
  of 18, the untagged listing of six controls equal before and after. `/ship dc-delivery`: no file under `web/`
  changed on this branch; the secrets scan of `git diff main...HEAD` and the working tree has placeholders only,
  and the three password values of the local `.env` occur in no tracked file; no document to update. The
  folder stays in `dev/active` and the G8 box unticked until the merge.
