# dc-delivery: one command per path, the documents and the gate
Created: 2026-11-10 · Branch: feat/delivery (cut from main right after the dc-contracts merge; it lives in the main tree)
Amended: 2026-11-10 after the hand-backs of dc-web, dc-api and dc-engine (decisions 28 to 34; the Log in `notes.md` says what changed)

## Goal

After this task a grader who receives the repository link or one zip file runs the system the first time they try,
in one of two ways. With Docker: one script creates `.env`, builds the containers and serves the app on
http://localhost:5000. Without Docker and without internet, on Windows: one script from the offline bundle needs
only a local SQL Server, its ODBC driver and a Python from 3.12 to 3.14. Either way the controls list opens with the
six example controls ready to run, and the README, the documents of architecture §17, a one-page Hebrew cover and
the ticked §18 checklist say what was built and how to see it. This is the last task before the submission of
2026-11-15. It is planned before tasks 1 to 4 are executed, so that what it needs from them reaches their sessions
in time. The graders most likely have Windows and SQL Server and no Docker (§14), so the manual path is the one
most of them will take, and it gets the larger share of the work.

## Decisions

From the interview (Kfir, 2026-11-10, four rounds):

1. **Two lanes.** Lane A writes the documents that depend only on `contracts/`. It starts when dc-contracts has
   merged and runs in the main tree while the three worktrees run; there is no fourth worktree. Lane B (compose,
   manual path, README, gate) starts when engine, api and web have merged. (The last day keeps integration and
   proof only; rejected: everything after the merges, documents written by the three tasks.)
2. **The manual path is a hybrid bundle.** The api is published self-contained for win-x64 with the Angular build
   inside, so the grader needs no .NET and no Node. The engine runs on the grader's own Python and installs from a
   bundled wheelhouse with no network. `run-all.ps1` drives it on Windows; `run-all.sh` runs from source on Linux
   and macOS. (Kfir's design; rejected: an embedded Python, a framework-dependent publish, building on the
   grader's machine.)
3. **The wheelhouse covers CPython 3.12, 3.13 and 3.14** for win_amd64. 3.12 stays the development and Docker
   version, and the engine suite runs once under 3.13 and 3.14 before the gate. (python.org has shipped no 3.12
   installer since April 2025; rejected: 3.12 only, with a bundled installer or with a message.)
4. **Clean machines.** Docker path: a fresh clone on WSL with the dev stack removed. Manual path: Kfir's Windows 10
   host, which on 2026-11-10 has no .NET, no Python, no SQL Server and only the legacy ODBC driver. Kfir installs
   SQL Server 2022 Express there once and makes the final run with the network off. (Rejected: WSL only, GitHub
   Actions, a rented VM.)
5. **The six examples are loaded through the application API on first start**, by one stdlib-Python script that
   also verifies each run against the example's expected records and writes the generated part of
   `docs/examples.md`. `LOAD_EXAMPLES=false` turns the loading off. (Only the api writes `dq`, so there is no SQL
   seed of controls; rejected: an opt-in command, an empty list.)
6. **Loaded, never run.** The list opens with six controls that have no run, and the first result on screen comes
   from the grader's own click. The README lists the count each example gives.
7. **`.env` is generated on first start**, with random passwords, by the start script of each path. No password is
   in the repository and `.env.example` holds placeholders. The by-hand route stays documented. (Rejected: working
   demo values in the example file, placeholders alone.)
8. **Documents are English, plus one Hebrew cover page**, `docs/submission.he.md`, linked first in the README: the
   assignment's seven deliverables in its own words, where each one is, and the run commands. (Rejected: English
   only, a full Hebrew README.)
9. **`docs/architecture.md` is trimmed in place and keeps its section numbers**, because CLAUDE.md, four skills and
   the reviewers link to them. §18 stays as the ticked checklist with one piece of evidence per item, and the
   README carries the one-screen overview. (Rejected: a new short document with the old one renamed, leaving it
   as it is.)
10. **Branch `feat/delivery` lives in the main tree, and this task may make docs-only commits.** That is a recorded
    exception to the CLAUDE.md rule, for this task only, because the documents are its subject. A contract change
    during lane A still lands on main: `git switch main`, commit, `git switch feat/delivery`, `git merge main`.
11. **AI tools, as Kfir states them** (the basis of `docs/ai-usage.md`). Claude Code with this harness did the work
    inside the repository. The claude.ai chat was used throughout: the architecture brainstorm, the check against
    the assignment's requirements, and as a second reviewer of Claude Code's plans, interview answers and gate
    reports during the build. Two third-party Claude Code skills, design-taste-frontend and impeccable, gave the
    design direction, critique and polish.
12. **Host ports.** The app on 5000 (`APP_PORT`); the database on `127.0.0.1:14330` (`DB_PORT`), so a grader can
    open it in SSMS beside a local SQL Server on 1433; the engine on no host port. Kfir's `.env` keeps
    `DB_PORT=1433`, so the harness, the worktrees and the tests do not change. (Rejected: the app port alone with a
    developer override file, all three on their usual ports.)
13. **Reviews.** `/phase-review` per phase as usual, and one `security-auditor` pass on opus over the whole merged
    repository at the gate. A late finding in engine or api is fixed only when critical; the rest go to the
    limitations document.

Settled here, inside the architecture and the answers above (object before lane B starts):

14. Delivery writes the api's Dockerfile, `.dockerignore` and the compose services (dc-contracts decision 17,
    dc-api decision 23). The engine's image is dc-engine's Phase 7, the third item on its cut list: delivery uses
    it when it exists and writes it per Design A when that phase was cut. `engine/requirements.txt` exists either
    way: dc-engine exports it in its phase 1.
15. One zip serves both ways of submitting (kickoff §2 leaves it open): a snapshot of the tracked source plus
    `prebuilt/`. It is a release asset when the graders get the repository, and the whole submission when they ask
    for a file.
16. In compose each container receives only its own connection settings: `environment:` per service, never
    `env_file`, and `.env` is in no image. (CLAUDE.md: never hand a service the other's string or `sa`.) On the
    manual path both services run as one user on one machine with `.env` beside them, and the engine reads that
    file itself; the run-all scripts still hand each child only its own variables, and the limitations document
    says what that does not protect.
17. The manual path keeps the two SQL logins, so the instance must allow SQL Server authentication. `run-all.ps1`
    detects Windows-only mode and stops with the two-step fix; it changes the server setting only under
    `-EnableMixedMode`. (A Windows-login fallback would run both services as the grader's sysadmin account and
    erase §2 principle 4.)
18. `run-all.ps1` creates the database when `DataControls` is missing, as the grader's Windows login through
    `sqlcmd`, in the order and with the variables of `scripts/db-init.sh`. It never drops a database on its own:
    `-ResetDb` asks for the database name to be typed. The SSMS route stays in `sql/README.md`.
19. The start scripts poll the app's health themselves. `docker compose up --wait` is not used: it has been
    reported to return an error when a one-shot service exits 0.
20. PowerShell scripts run on Windows PowerShell 5.1, are ASCII only, and are started through `.cmd` wrappers with
    `-ExecutionPolicy Bypass`. (The client default policy is Restricted, and 5.1 reads a file without a BOM in the
    ANSI code page, which is the Hebrew one on the graders' machines.)
21. The loader posts each example's Hebrew name and description (the default language; `--lang en` posts the
    English ones) and skips a control whose exact name already exists, an archived one included.
22. `docs/examples.md` is a hand-written frame around a generated region. The rule sentences and the reasons in it
    are the engine's own output, copied from a real run and never rendered again.
23. A bug the gate finds in engine, api or web is fixed on this branch as its own `fix(<area>): …` commit with a
    regression test. One that needs more than an hour goes to Kfir first.
24. Lane A touches neither `README.md` nor `.claude/`: the engine and api sessions write their README sections and
    all three edit their skill files. `docs/architecture.md` has no other editor once dc-contracts has merged (the
    three tasks list their drift instead of editing it), so lane A does the parts of Design J that need no
    knowledge of what was built, and B4 does the rest. (Changed on 2026-11-10: the first version kept the whole
    file for B4, because the three sessions were then expected to edit it.)
25. Images: the api on `sdk:10.0` and `aspnet:10.0` (Ubuntu 24.04 in .NET 10, with no curl or wget; it keeps
    tzdata, which the api's start check needs), with a `node:22` stage for the Angular build. The engine's image is
    dc-engine's design (`python:3.12-slim` with `msodbcsql18`); B1 pins the Debian release only if the build needs it.
26. The app binds to 127.0.0.1 on both paths (`APP_BIND` opens it to the network): v1 has no sign-in (§10).
27. README screenshots are the five the gate specs write on the composed stack: list, editor, results and
    suggestions at 1440 (`web/e2e/screenshots/desktop/gate-{list,editor,results,suggestions}.png`) and the results
    at 390 (`web/e2e/screenshots/mobile/gate-results.png`). That folder is ignored by git; B4 copies the five into
    `docs/screenshots/`.

From the hand-backs of dc-web, dc-api and dc-engine (carried by Kfir on 2026-11-10; their amended plans were read
again at 21:45). Decisions 31 and 32 are calls the web plan left open: the defaults below stand until Kfir says
otherwise.

28. **The gate specs run as dc-web wrote them**: `--workers=1`, on a stack whose engine has no `ANTHROPIC_API_KEY`
    (with a key the suggestions spec is one paid `/suggest` call per project, up to 25 s each, and that is said
    first). The specs act only on controls they create, each named with a tag (`e2e-` and six characters) and
    found by its id; they never touch the six loaded examples, and they leave about eighteen archived, tagged
    controls per run. Those stay where they are: a gate stack is thrown away, and a grader's database starts
    without them.
29. **On Windows the engine gets its connection by parts and the api gets one string.** Engine (dc-engine decision
    20): `ENGINE_DB_HOST` is the instance; `ENGINE_DB_PORT` is absent, which means no port; `ENGINE_DB_DRIVER` is
    absent, and the engine takes Driver 18, else 17, whichever is installed. The script writes `.env` without the
    port lines instead of passing an empty value, because cmd and Windows PowerShell delete a variable that is set
    to nothing. Api (dc-api Design B and I): `ConnectionStrings__Dq` alone, composed in memory. The server name
    lives in `.env` as `DB_HOST`, a name the database block already has. (Replaces the `DB_SERVER` variable of the
    first version of this plan: no new name is invented.)
30. **The offline install uses the committed `engine/requirements.txt`**, dc-engine's export of the lock with
    hashes and markers, against the wheelhouse: `pip install --no-index --find-links`. pip evaluates the markers
    on the grader's machine, so the bundle carries no requirement list of its own. Pins per Python version exist
    only inside `make-bundle.sh`, to know which wheels to download. (Replaces the three per-version lists of the
    first version.)
31. **The README shows the gate's five shots as they are.** Two of them, the editor and the results, carry the
    test's tag in the control's name; the caption says that the images come from the automated end-to-end run.
    (The other way costs five minutes in B4: those two screens shot by hand on the loaded example.)
32. **The suggestions repeat four loaded controls, and the README says so.** With no key the engine proposes the
    rules of examples 2 to 5, which decision 5 has already loaded; creating one adds a second control with the
    same rule. The walkthrough presents that as what it is: the engine derived the same rules from the glossary
    and the data. "Mark a suggestion that already exists" goes to the extensions, because it needs the api to
    compare definition hashes, which is a contract change. (dc-web raised it as Kfir's call.)
33. **A Log line about a review lists what the review found**, as the three tasks now write it (dc-engine decision
    25, dc-api 27, dc-web 24): what was read, the findings per severity, each critical and warning with its file,
    and what happened to each (fixed in which commit, left and why, rejected or rewritten by Kfir). No verdict
    word stands in for the findings, and no line says what Kfir read or approved unless he said so.
34. **Document edits the three tasks no longer make are made here.** None of them edits a §17 document now: each
    keeps a list "Docs for dc-delivery" in its notes and in its PR body. B0 collects the three lists and B4
    applies them; the first known items are the suggestion lines of architecture §6 and §19 (dc-engine decision 1:
    with no key the engine yields examples 2 to 5, not "the four assignment controls"). The row for
    `docs/design.md` in CLAUDE.md is written here too (dc-web decision 26). `docs/design.md` itself stays
    dc-web's: this task links it and checks that it is tracked.

## Asks to the other tasks, and their answers

Kfir carried four lines to the three sessions on 2026-11-10; each session amended its own plan. Nothing in their
folders was edited from here.

| To | Ask | Answer (their plan as amended) | Used in |
|---|---|---|---|
| dc-engine | Reach a named instance over shared memory with ODBC Driver 17 or 18 | Decision 20: `ENGINE_DB_DRIVER` (unset: the first of Driver 18 and 17 that is installed) and `ENGINE_DB_PORT` (unset or empty: no port in `Server=`). No variable holds a whole connection string: the login stays `dq_engine_ro`. The process environment wins over `.env` | Decision 29, Design F |
| dc-engine | `requires-python >=3.12`; Windows wheels for 3.12 to 3.14 | Decision 21: yes; a wheels-only resolve was run at planning with `anthropic` included, and runs again whenever the lock changes and at its gate. `anthropic>=1,<2` joins the lock only in its phase 6, the first item on its cut list | Decision 30, Design E |
| dc-engine | Every file read names UTF-8 | Decision 22, enforced by Ruff's `PLW1514` | Design F keeps `PYTHONUTF8=1` as a second guard |
| dc-engine | A start command that needs no uv | Decision 23: from `engine/`, `python -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port <port>`; `engine/requirements.txt` belongs to its phase 1 | Decision 14, Design F and G |
| dc-engine | Cuts and the image are in its notes | Its gate: the State of its `notes.md` holds what B0 reads first | Phase B0 |
| dc-api | The win-x64 self-contained publish stands alone | Decision 25, Design I: the content root is the app's own folder, so the executable starts from any directory; `wwwroot` must be inside the publish folder before the start; `ConnectionStrings__Dq` alone is enough, with no `DQ_APP_PASSWORD`; no `.env` is read outside Development. Tried once in its Phase 5: its notes say "ran" or "published, not started" | Design E and F |
| dc-api | The hand-off of the live tests | Its Gate and Risks, as before | Phase B2 |
| dc-web | The gate passes on a list that holds the six examples | Decisions 22 and 25, Design O: own tagged controls only, found by id; one worker; no key | Decision 28, B1, G1 |
| dc-web | Base URL, screenshot folder | Design O; decision 27 adds a suggestions spec so that the fourth shot exists | Decisions 27 and 31 |
| dc-web | (its own decision 26) | `docs/design.md` stays with dc-web; its CLAUDE.md row is left to this task | Decision 34, B4 |
| all three | One owner per document; factual Logs | dc-engine 24 and 25, dc-api 26 and 27, dc-web 23 and 24 | Decisions 33 and 34, B0, Design K |

An answer that was planned and not built is fixed in Phase B0 per decision 23.

## Phases

Every phase ends the same way: tick the steps as they finish, run the Verify block and save its output under
`gates/<phase>.txt`, `/phase-review` for the areas named with its report saved under `reviews/`, one
`fix(<scope>): review fixes` commit, and a Log line in `notes.md` in the form of decision 33. State the spend
before every image pull or build, every Playwright run, every review fan-out, the bundle build and the interpreter
downloads, then wait for the word. Recreating or removing containers goes through the git guard's question. The
Design section below is the specification each step builds from.

### Lane A: documents that need nothing built (starts when dc-contracts has merged; main tree; the three worktrees are running)

#### Phase A0: branch (no commit)
- [ ] Preconditions: dc-contracts is merged to main. `docs/PRODUCT.md` and `docs/design.md` are Kfir's (his
      docs+infra commit, which dc-web waits for): tracked by now, or still untracked and then left out, because
      this task stages its files by name.
- [ ] `git switch -c feat/delivery main`.

#### Phase A1: the contract documents and the settled parts of the architecture
- [ ] `docs/control-definition.md` per Design H.
- [ ] `docs/glossary.md` per Design H, with the `department.manager` walkthrough written as steps a reader can
      follow.
- [ ] `docs/assumptions-limitations-extensions.md` per Design H.
- [ ] `docs/ai-usage.md` as a skeleton per Design K: every section present, the per-task table empty.
- [ ] `docs/architecture.md`, the rows of Design J marked "lane A": the title and purpose, the four decision
      records of §3.2, the pointers of §15 and §20. Nothing else in the file.
- [ ] A throwaway check under `tools/` (not committed): every backticked token of the first two documents is an
      operator key, an entity, field or relationship key, a limit name, an error code or an existing path. The
      list of unknown tokens is empty or explained in `gates/A1.txt`.

Verify: `uv run scripts/contracts-check.py` (unchanged, still green) · the `tools/` check · every relative link in
the five files resolves · `node --test .claude/hooks/tests/*.test.mjs` (the harness links into the architecture)
Review: `/phase-review infra` (the brief: check every statement against `contracts/` and architecture §2 to §5)
Commit: `docs: control definition, glossary guide, assumptions, ai-usage skeleton and decision records`

Lane A ends here. A contract change that lands on main while it waits is merged into the branch and the two
contract documents are corrected in the same sitting.

### Lane B: integration (starts when engine, api and web have merged to main)

#### Phase B0: reconcile with what was built (no commit of its own)
- [ ] `git merge main` into `feat/delivery` (a merge, not a rebase).
- [ ] Kfir's `.env` holds `DB_PORT=1433` and `ENGINE_DB_PORT=1433` explicitly, before the defaults move in B1.
- [ ] Read what the three tasks left for this one. Their folders moved into the worktrees
      (`../cbs-engine/dev/active/dc-engine/`, or `dev/completed/` there after `/ship`; the same for api and web):
      - dc-engine, `notes.md` State: the variables as built, the start command, the Python versions its suite ran
        under, which phases were cut (phase 6: no `anthropic`, no key; phase 7: no image);
      - dc-api, `notes.md`: the Log line of the publish trial ("ran" or "published, not started"), and whether the
        live tests ran or are handed over;
      - dc-web, `notes.md` "Hand-over to dc-delivery" and `web/README.md`: the cuts taken with the sentence to
        write about each, whether the gate ran on a pre-loaded list and on the build the api hosts, and what it
        left in the dev `dq` (the six examples of its phase 7);
      - the three lists "Docs for dc-delivery", from the notes and from the PR bodies.
- [ ] Record "As built" in `notes.md`, ten lines at most. Design A to G use the names the plans gave on
      2026-11-10; what was built wins.
- [ ] Each answer in the asks table holds in the code: the driver choice and the port-less URL (the engine's own
      tests), the published api's content root (its trial line). One that does not is fixed here per decision 23.
- [ ] `git diff <A1 sha>..main -- contracts/ docs/` and the three "Docs for dc-delivery" lists: correct the lane-A
      documents. The corrections ride in the B4 commit.
- [ ] No session is serving from a worktree and no suite is running: `ss -ltn`, and
      `pgrep -fa "pytest|dotnet test|ng test|vitest|playwright test"` (a bare `playwright` also matches the MCP
      servers every session starts).

#### Phase B1: compose end to end
- [ ] `.dockerignore` per Design A.
- [ ] `engine/Dockerfile`: dc-engine's, built once as it stands; written per Design A only if its Phase 7 was cut.
- [ ] `api/Dockerfile` per Design A.
- [ ] `docker-compose.yml`: services `engine`, `api` and `examples`, ports and per-service environment per Design A
      and B.
- [ ] `.env.example` per Design B.
- [ ] `scripts/examples.py` per Design C.
- [ ] `scripts/lib/env.sh` and `scripts/start.sh` per Design D (executable).
- [ ] `.claude/skills/dc-sql/SKILL.md`: the facts this phase changed (services, ports, who reaches whom).

Verify (the stack's `.env` holds no `ANTHROPIC_API_KEY` for this run; if Kfir's does, say the paid calls first or
blank the line on his word):
```
bash -n scripts/start.sh scripts/lib/env.sh
docker compose config -q
docker compose build                 # base images and packages, several minutes: say so and wait
scripts/start.sh                     # recreates containers: the guard asks
docker compose ps -a                 # db-init and examples exited 0; db, engine and api healthy
docker compose exec engine env       # no dq_app and no sa password; ANTHROPIC_API_KEY empty or absent
docker compose exec api env          # no dq_engine_ro and no sa password
python3 scripts/examples.py verify --base-url http://localhost:5000        # six PASS lines
scripts/db-check.sh
curl -s 'http://localhost:5000/api/v1/controls?active=all&pageSize=100' \
  | jq -c '.items[] | select(.name | test(" e2e-[0-9a-z]{6}") | not) | [.id, .name, .version, .isActive, .lastRun.id]' \
  > dev/active/dc-delivery/gates/B1-untagged-before.txt
cd web && E2E_BASE_URL=http://localhost:5000 npx playwright test e2e/gate --project=mobile --project=desktop --workers=1
                                     # minutes against the live stack: say so and wait
# the listing again into B1-untagged-after.txt: the two files are equal (the gate changed nothing it did not create)
```
`verify` runs before the gate on purpose: the list shot then shows every example with its last run. Keep
`web/e2e/screenshots/` of this run for B4.
Review: `/phase-review sql engine api infra` (the Dockerfiles sit in `engine/` and `api/`)
Commit: `feat(compose): full stack with engine, api and example loader`

#### Phase B2: run-all from source (Linux, macOS)
- [ ] `engine/requirements.txt` is dc-engine's: `cd engine && uv export --no-dev --format requirements-txt | diff -
      requirements.txt` prints nothing.
- [ ] `scripts/run-all.sh` per Design G (executable).

Verify (on WSL, the database in its container, the `engine` and `api` containers stopped through the guard; the
host needs `msodbcsql18`, which the engine task had Kfir install; port 8000 belongs to another project here, so
`ENGINE_PORT` and `Engine__BaseUrl` point elsewhere):
```
bash -n scripts/run-all.sh
scripts/run-all.sh                   # engine and api as host processes against localhost:1433
python3 scripts/examples.py verify --base-url http://localhost:5000
cd api && DC_LIVE=1 dotnet test --filter Category=Live     # only if the api's notes hand the live tests over
# Ctrl+C, then: ss -ltn shows no listener on 5000 or on the engine's port
```
Commit: `feat(scripts): run-all from source for the manual path` (reviewed together with B3)

#### Phase B3: the Windows bundle
- [ ] `.gitattributes`: `*.ps1` and `*.cmd` with `eol=crlf`. `.gitignore`: `/out/`.
- [ ] `scripts/make-bundle.sh` per Design E (executable).
- [ ] `scripts/lib/env.ps1`, `scripts/run-all.ps1` and `run-all.cmd` per Design F.
- [ ] `scripts/start.ps1` and `start.cmd` per Design D.
- [ ] The engine suite on the merged tree under 3.13 and then under 3.14, as dc-engine's gate ran it:
      `cd engine && uv run --isolated --locked --python 3.13 python -m pytest` (uv downloads the interpreters and
      the wheels of each version: say so). What breaks is fixed per decision 23.
- [ ] Rehearsal on the Windows host, network on. Kfir installs SQL Server 2022 Express (the Basic install) and one
      Python from python.org; the session drives the rest from WSL through `powershell.exe`. Record in `notes.md`
      what the machine holds after the SQL Server install: the ODBC drivers, the `sqlcmd` path, the authentication
      mode, the enabled protocols, the instance name. These facts become the README's prerequisites. If the api's
      trial line says "published, not started", this is the first start of the published api anywhere.
- [ ] The Docker path from a Windows folder: `start.cmd` with Docker Desktop, then `examples.py verify`.

Verify:
```
bash -n scripts/make-bundle.sh
LC_ALL=C grep -nP '[^\x00-\x7F]' scripts/*.ps1 scripts/lib/*.ps1 *.cmd      # prints nothing
powershell.exe -NoProfile -Command "<parse each .ps1 with [Parser]::ParseFile; print the errors>"   # none
scripts/make-bundle.sh               # web build, win-x64 publish, wheel downloads: say so and wait
# on Windows, from the extracted bundle: run-all.cmd → examples.py verify → Ctrl+C → a second run-all.cmd
```
Review: `/phase-review infra --since <B1 sha>` (B2 and B3 together)
Commit: `feat(scripts): offline windows bundle, run-all.ps1 and start scripts for windows`

#### Phase B4: README, architecture as built, cover page, checklist
- [ ] `README.md` per Design I, every command in it copied from a run of B1 to B3 (tick them in
      `gates/readme-commands.md`).
- [ ] `docs/screenshots/`: the five files of decision 27, copied from the B1 run, with the caption of decision 31.
- [ ] `docs/examples.md`: the frame, then `python3 scripts/examples.py docs` for the generated region.
- [ ] `docs/architecture.md`, the rows of Design J marked "B4": what differs from what was built in §1 to §14, the
      suggestion lines of §6 and §19, the tree of §16, the index of §17, the result column of §19, and §18 ticked
      with its evidence.
- [ ] The three lists "Docs for dc-delivery": every line applied to its document or answered in `gates/B4.txt`.
- [ ] `docs/ai-usage.md` completed per Design K from the notes Logs of the five tasks, the plans' Decisions and
      `git log`.
- [ ] `docs/submission.he.md` per Design L.
- [ ] `docs/assumptions-limitations-extensions.md`, `docs/control-definition.md`, `docs/glossary.md`: the as-built
      corrections of B0 and the limits learned in B1 to B3 (tested versions, the Python range, the row cap value,
      the cuts the three tasks recorded, the extension of decision 32).
- [ ] `sql/README.md`: the Windows init as `run-all.ps1` does it, and the host port.
- [ ] `docs/design.md` is tracked (`git ls-files docs/design.md`) and is not edited: it is dc-web's. If it is not
      tracked, ask Kfir.
- [ ] `.claude/CLAUDE.md`: rows for the §17 documents, `docs/design.md` among them (dc-web left its row to this
      phase), and for the cover page; the Hebrew gotcha naming `docs/submission.he.md` and `docs/examples.md`; the
      map line for the compose services; without the "As they land" line; at most 100 lines. `.claude/README.md`:
      a changelog line.
- [ ] `.claude/hooks/tests/infra.test.mjs`: the link test also covers `README.md`, `docs/*.md` and `sql/README.md`.
- [ ] The `docs/glossary.md` walkthrough is carried out once exactly as written, on a scratch copy of the glossary:
      the engine starts, `/validate` accepts a definition that uses the new relationship, the editor offers it.
      Result in `gates/glossary-walkthrough.txt`; nothing of the scratch copy is committed.

Verify: `node --test .claude/hooks/tests/*.test.mjs` · `python3 scripts/examples.py docs --check` (the generated
region matches a fresh run) · `gates/readme-commands.md` has no unticked line
Review: `/phase-review infra`
Commit: `docs: readme, examples, architecture as built, hebrew cover and ai usage`

### Gate
- [ ] **G1 Docker path, clean (WSL).** In the main tree: `docker compose down -v --rmi local` (the guard asks: it
      deletes the development database, so only after the three merges). Then
      `git clone --branch feat/delivery <main tree> <scratch>/dc-clean` and the README followed to the letter:
      `scripts/start.sh`; the app in a browser, where the first screen shows six controls and no run on any
      (decision 6); `examples.py verify`; the gate specs with the command of B1, one worker, on the generated
      `.env`, which has no key; the untagged listing equal before and after. Output in `gates/G1-docker-wsl.txt`.
- [ ] **G2 Docker path, Windows host.** The same from a Windows folder with `start.cmd`, without the gate specs.
- [ ] **G3 Manual path, Windows host, offline.** The bundle built from the committed HEAD; copied to Windows and
      given the Mark of the Web; extracted with Explorer to a short path; the network off. Kfir follows the README
      alone (Claude Code does not run offline): `run-all.cmd`, then by hand in the browser the six examples
      (3, 3, 6, 10, 3, 3), a reason on every record, search and filter, one new control created and run, the
      suggestions dialog with one suggested control created, the language switch. He fills
      `gates/G3-manual-windows.md`, a ten-line checklist the session prepares. Network back on:
      `examples.py verify` on the same installation.
- [ ] **G4 run-all.sh** from the fresh clone of G1, as in B2.
- [ ] **G5 Security audit.** One `security-auditor` on opus over the merged repository (say it first): logins and
      grants, the compose network and ports, the per-service environment, error bodies, CORS, secrets, the LLM
      boundary. The report is saved as `reviews/security.md`. Critical findings are fixed (decision 23); the rest
      are added to the limitations document; the Log line lists both.
- [ ] **G6 Checklist.** Every item of §18 is ticked and its evidence exists. An item that cannot be ticked
      honestly is a blocker for Kfir, not a tick.
- [ ] **G7 Kfir reads** `docs/ai-usage.md` and `docs/submission.he.md` (both speak in his name) and the first
      screen of the README. The Log says what he changed or rejected, in his words where he gave them.
- [ ] **G8** `/check all --tests`, then `/ship dc-delivery`; the PR and the merge on Kfir's word.
- [ ] **G9 After the merge**, each on Kfir's word: tag `v1.0.0`; `scripts/make-bundle.sh` at the tag; a fresh
      `git clone` from GitHub with `scripts/start.sh` as the last sanity check; the release asset or the zip
      hand-over; the graders as collaborators.

## Design

### A. Images and compose

**`.dockerignore`** (repository root, the build context of both images): `.git`, `.env*` except `.env.example`,
`dev/`, `out/`, `prebuilt/`, `**/node_modules`, `**/.venv`, `**/bin`, `**/obj`, `**/dist`, `**/.angular`,
`docs/screenshots`. Both images build from the root because both read `contracts/`.

**`engine/Dockerfile`** is dc-engine's (its Phase 7: `python:3.12-slim`, `msodbcsql18` and `unixodbc`,
`pip install -r requirements.txt`, a non-root user, the root as build context, `ENGINE_DB_DRIVER` set to the driver
the image installs, the start command on `0.0.0.0:8000`). If that phase was cut, write it here the same way, on
`python:3.12-slim-bookworm` with Microsoft's Debian 12 repository (key under `/usr/share/keyrings`,
`ACCEPT_EULA=Y`), with `engine/` as the working directory and
`python -m uvicorn app.main:create_app --factory --host 0.0.0.0 --port 8000` as the command. The health check lives
in compose either way: a one-line `python -c` that opens `/health`, with a start period longer than the engine's
30-second wait for the database.

**`api/Dockerfile`**, three stages: `node:22-bookworm-slim` runs `npm ci` and `npx ng build`;
`mcr.microsoft.com/dotnet/sdk:10.0` publishes `api/src/DataControls.Api` without a runtime identifier;
`mcr.microsoft.com/dotnet/aspnet:10.0` receives the publish output with the Angular build as the `wwwroot` inside
it, runs as `$APP_UID` and listens on 8080. The runtime image has no curl or wget: install curl in the last stage
for the health check on `/api/v1/health`; a bash `/dev/tcp` probe is the fallback if that apt step is unreliable.
The api checks at start that `Asia/Jerusalem` resolves: if the image lacks tzdata, the same stage installs it.

**Compose** (the `db` and `db-init` services stay as dc-contracts wrote them, except the port default):

| Service | Starts after | Host port | Receives |
|---|---|---|---|
| `db` | | `127.0.0.1:${DB_PORT:-14330}:1433` | the sa password |
| `db-init` (one-shot) | `db` healthy | | sa and the two login passwords |
| `engine` | `db-init` completed successfully | none | `ENGINE_DB_HOST=db`, `ENGINE_DB_PORT=1433`, `DQ_ENGINE_RO_PASSWORD`, the other `ENGINE_*` settings that `.env` sets, and `ANTHROPIC_API_KEY` when the engine's phase 6 was built and `.env` sets it |
| `api` | `engine` healthy | `${APP_BIND:-127.0.0.1}:${APP_PORT:-5000}:8080` | `DB_HOST=db`, `DB_PORT=1433` (the container's port, never the host's `DB_PORT`), `DQ_APP_PASSWORD`, `Engine__BaseUrl=http://engine:8000` |
| `examples` (one-shot) | `api` healthy | | `LOAD_EXAMPLES`, the api URL |

`examples` runs the stock `python:3.12-slim-bookworm` image with `scripts/examples.py` and `contracts/examples/`
mounted read-only, and the command `load`. No service has a restart policy: an engine that refuses to start on a
glossary mismatch must stay visibly stopped. The mssql image is x86-64 only, which the README says for Apple
Silicon (§14).

### B. Environment file

`.env.example` keeps the three blocks of dc-contracts and gains a fourth. All password values are empty, and so is
`ANTHROPIC_API_KEY`; the header says the start scripts fill the passwords, and gives the by-hand rule (8 or more
characters with upper case, lower case and a digit; no quotes, `$`, `;` or spaces). Two lines that other tasks
wrote change here: `DB_PORT` in the database block and `ENGINE_DB_PORT` in the engine block both become `14330`,
because three readers must agree on the host port (compose publishes on the first, the api's Development source
reads the first, an engine run by hand reads the second). A comment says that this repository's own developers
keep 1433 in both; Kfir's `.env` already does. The new block: `APP_PORT=5000`, `APP_BIND=127.0.0.1`,
`LOAD_EXAMPLES=true`. Compose and the run-all scripts map the names the two tasks chose and invent none: on the
Windows path the server name is the database block's `DB_HOST` (decision 29).

### C. `scripts/examples.py`

Standard library only, Python 3.12 or later, every file opened as UTF-8, ASCII on stdout (ids and counts, never
Hebrew names: a Windows console may not encode them). It speaks only to the application API of `contracts/api.md`.

- `load [--base-url URL] [--dir contracts/examples] [--lang he|en]`: waits for `/api/v1/health` (two minutes at
  most); exits 0 at once when `LOAD_EXAMPLES` is `false`; for each example file in the folder (not `invalid/`)
  looks for a control with exactly that name (`GET /controls?search=…&active=all`, then an exact comparison) and
  posts it when there is none. It never starts a run. Any other answer than 2xx prints the code and the
  correlation id and exits 1. Two consequences that dc-web's gate relies on: an example somebody archived is not
  loaded again, and a control named `<example name> e2e-xxxxxx` is never taken for the example.
- `verify`: loads what is missing; fails an example whose existing control holds another definition than the file
  (it reports and does not overwrite); then for each example starts a run with the example's `runDate`, reads
  every page of `/runs/{id}/results` and compares with `expected`: the total, the set of keys, and the matched ids
  per record. `alternateRuns` the same way. It also fails when a display value consists of question marks (the
  Hebrew did not survive). One `PASS` or `FAIL` line per example, exit 1 on any failure. It leaves runs behind: it
  is a test tool, and the README says so.
- `docs [--out docs/examples.md] [--check]`: runs each example as `verify` does, once per language, and writes the
  region between the two generated-region markers: names, the Hebrew description (for examples 1 to 4 the
  assignment's own sentence), the rule sentence in both languages, the definition JSON, the expected count, and
  the table of flagged records with their display fields, matched ids and the Hebrew reason text, plus one English
  reason as a sample. `--check` writes nothing and exits 1 when the file differs.

### D. Start scripts (the Docker path)

`scripts/start.sh` for Linux, macOS and WSL; `scripts/start.ps1` behind `start.cmd` for Windows. Same steps:
1. Docker answers (`docker info`); otherwise one line that says to start Docker Desktop.
2. `.env`: when it is missing, copy `.env.example` and fill each empty password with 24 random characters from
   letters and digits without look-alikes, re-drawn until upper case, lower case and a digit are all present.
   Nothing else is filled: `ANTHROPIC_API_KEY` stays empty. An existing `.env` is never changed. The passwords are
   not printed; the script says where they are.
3. `docker compose up -d --build`.
4. Poll `http://localhost:<APP_PORT>/api/v1/health` for up to five minutes. On a timeout print
   `docker compose ps -a` and the last lines of the service that is not healthy, and exit 1.
5. Print the address, the database address for SSMS, and the commands that stop (`docker compose down`) and wipe
   (`docker compose down -v`).

`scripts/lib/env.sh` and `scripts/lib/env.ps1` hold the `.env` creation and a loader that returns the variables as
a map; start and run-all share them.

### E. The bundle (`scripts/make-bundle.sh`, run on WSL)

```
data-controls-<version>/
  …                    the tracked source, as `git archive HEAD` gives it (no .env, no dev/active);
                       engine/requirements.txt, run-all.cmd and start.cmd are part of it
  prebuilt/
    wwwroot/           the Angular production build (for run-all.sh without Node)
    api-win-x64/       the self-contained publish, with the same build as the wwwroot inside it
    wheels/            win_amd64 wheels for CPython 3.12, 3.13 and 3.14, and the pure ones
    VERSION            commit, build date, tool versions
```

Steps: refuse a dirty tree (the bundle must equal a commit); version from `git describe --tags --always`; extract
`git archive` into `out/stage/`; `npm ci && npx ng build`; `dotnet publish api/src/DataControls.Api -c Release
-r win-x64 --self-contained true` and the Angular build copied into the `wwwroot` of that folder. Wheels, per
Python version: resolve `engine/requirements.txt` for Windows and that version with the engine's own check
(`uv pip compile requirements.txt --python-version <v> --python-platform x86_64-pc-windows-msvc --only-binary :all:`,
kept as a pin list under `out/`), then `pip download --no-deps --only-binary=:all: --platform win_amd64
--python-version <v>` of that list into the one `wheels/` folder. The pins are resolved per platform because pip
evaluates environment markers for the machine it runs on and would leave out the Windows-only packages.

Checks before zipping: `engine/requirements.txt` equals a fresh export of the lock; for each of the three versions
the same resolve passes again with `--no-index --find-links prebuilt/wheels`, so the folder alone satisfies the
file; `prebuilt/api-win-x64/` holds `DataControls.Api.exe`, `appsettings.json`, `Microsoft.Data.SqlClient.SNI.dll`
and `wwwroot/index.html`; no `.env` and no secret pattern of `/ship` §2 in the stage; the size is printed. The
archive is written with `python3 -m zipfile` (this machine has no `zip`) to
`out/data-controls-<version>-win-x64.zip`, and its SHA-256 is printed.

### F. `run-all.ps1` (Windows, the bundle)

`run-all.cmd` is one line: `powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-all.ps1" %*`.
Parameters: `-Server`, `-SqlAdminUser` and `-SqlAdminPassword` (default: the Windows login), `-SkipDbInit`,
`-ResetDb`, `-EnableMixedMode`, `-NoExamples`, `-NoBrowser`, `-AppPort`, `-EnginePort`.

1. `Unblock-File` over the bundle folder (a downloaded zip marks every file). Without `prebuilt\` the script says
   that it runs the offline bundle and where the from-source steps are.
2. Preflight, every failure collected and printed together with its fix, exit 1 on any:
   a 64-bit Windows; a real CPython 3.12, 3.13 or 3.14 (`py -3.x` first, then `python`; the Microsoft Store stub
   does not count); "ODBC Driver 18 for SQL Server" or 17 installed (the engine chooses between them itself; the
   script only says early when neither is there); `sqlcmd` on PATH or under the SQL Server folders, needed only
   for the database step; one local instance found in the registry, or `-Server` when there are none or several;
   the two ports free, naming the process that holds one; the bundle path short enough for pip.
3. `.env` created as in Design D when missing: the two login passwords filled, `DB_HOST` set to the instance
   (`.\SQLEXPRESS`, without quotes), and the `DB_PORT` and `ENGINE_DB_PORT` lines removed: a local instance over
   shared memory has no port, and to the engine a missing port means none. An existing `.env` that still carries
   `ENGINE_DB_PORT` while `DB_HOST` names an instance stops the preflight with that one-line fix; the script does
   not try to pass an empty variable to a child (decision 29).
4. Database: `SERVERPROPERTY('IsIntegratedSecurityOnly')` = 1 stops with the fix, or applies it under
   `-EnableMixedMode` (elevation and a service restart). When `DataControls` is missing, run `sql\NN_*.sql` in
   order with `sqlcmd -b -f 65001 -v …`. Then each login connects and reads one row of its own schema.
5. Engine: a venv in `engine\.venv`; `pip install --no-index --find-links prebuilt\wheels -r
   engine\requirements.txt`; then, with `engine\` as the working directory,
   `python -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port <EnginePort>`. Its environment adds
   `ENGINE_DB_HOST` (the value of `DB_HOST`), `DQ_ENGINE_RO_PASSWORD` and `PYTHONUTF8=1`, and holds neither a port
   nor a driver variable. The engine also reads the bundle's `.env` itself, which it finds from its own location;
   the process environment wins. Log to `logs\engine.log`; wait for `/health`.
6. Api: start `prebuilt\api-win-x64\DataControls.Api.exe`, from any directory (its content root is its own
   folder), with `ConnectionStrings__Dq` composed in memory from `DB_HOST` and the `dq_app` password
   (`Server=<DB_HOST>;Database=DataControls;User ID=dq_app;Password=…;Encrypt=True;TrustServerCertificate=True`),
   `Engine__BaseUrl=http://127.0.0.1:<EnginePort>`, `ASPNETCORE_ENVIRONMENT=Production` and
   `ASPNETCORE_URLS=http://127.0.0.1:<AppPort>`. It gets no `DQ_APP_PASSWORD` and reads no `.env`. Log to
   `logs\api.log`; wait for `/api/v1/health`.
7. `examples.py load` with the venv's Python, unless `-NoExamples` or `LOAD_EXAMPLES=false`.
8. Print the address and open the browser. Ctrl+C or closing the window stops both children; a second run finds a
   leftover listener in the preflight and names it.

A second run reuses `.env`, the database and the venv. Children are started with their own environment block, not
with the script's. Everything Windows-side is run from WSL during development (`powershell.exe -NoProfile
-ExecutionPolicy Bypass -File <C:\ path>`, from a `/mnt/c` working directory); installs and anything behind a UAC
prompt are Kfir's.

### G. `run-all.sh` (Linux and macOS, from source)

Needs Python 3.12 or later, the .NET 10 SDK, ODBC Driver 18 or 17 (`odbcinst -q -d`), and Node 22 unless
`prebuilt/wwwroot` exists. Steps: preflight as in F; `.env`; `--init-db` runs `scripts/db-init.sh` in its host
mode when `sqlcmd` is on PATH, and otherwise says how to initialise (compose's `db-init`, or SSMS per
`sql/README.md`). Engine: a venv from `uv sync --frozen --no-dev` when uv is there and from
`pip install -r engine/requirements.txt` when it is not, then from `engine/`
`python -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port ${ENGINE_PORT:-8000}`, with
`ENGINE_DB_HOST=localhost` and `ENGINE_DB_PORT` equal to the host's `DB_PORT`. Api: `dotnet publish
api/src/DataControls.Api -c Release` without a runtime identifier, the Angular build copied into the `wwwroot` of
the publish folder before the start, then the published api with the three database variables and
`Engine__BaseUrl`. Each child gets only its own variables. Then `examples.py load`, the address printed, and a trap
that stops both children on exit. `engine/requirements.txt` is dc-engine's export of the lock, committed for people
without uv; `make-bundle.sh` and B2 compare it with a fresh export.

### H. The contract documents (lane A)

- **`docs/control-definition.md`**: what a definition is and where it lives (the JSON is the truth, SQL is derived
  and never stored); the node types with one table each (definition, group, condition, related, field reference,
  operand shapes); operators per type with arity and whether the right side may be a field; semantics (the
  condition describes the violation; matched means contributing; NULL never matches, the four explicit operators;
  `age` on the run date; empty versus null); the limits and who enforces each; versioning (`schemaVersion`, a new
  version only when the hash changes); the three validation layers; the definition error codes with one
  problem-details body; example 4 annotated node by node.
- **`docs/glossary.md`**: what the glossary is and who reads it; the file's structure key by key; what the public
  glossary leaves out; the startup validation and what a mismatch looks like. Then how to add a field, an entity
  (with its `sql/` change), a relationship, a computed-field kind (the one case that needs engine code: the closed
  list, with its as-built location filled in B4) and a language. The worked example adds the `department.manager`
  relationship, a glossary-only change (dc-contracts decision 24). A closing list of what does not change in any
  of these cases: the compiler, the api, the client.
- **`docs/assumptions-limitations-extensions.md`**: the three lists of the §17 row, each item with one sentence of
  reason. Added from the plans: the run date and the Asia/Jerusalem day; the examples' stability window to
  2027-12-31; record keys as strings; SQL authentication required; the tested SQL Server and Python versions; the
  app bound to localhost with no sign-in. Extensions from §20, and in B4 the one of decision 32 and whatever the
  three tasks cut.

### I. `README.md`

In this order: the link to the Hebrew cover; what the system is in three paragraphs with the list screenshot; the
diagram of §3 as text; **Run with Docker** (one command per OS, what appears, the counts to expect, stop and wipe,
ports and their variables, the Apple Silicon note, three troubleshooting lines: port taken, Docker not running,
macOS AirPlay on 5000); **Run on Windows without Docker** (what must be installed, as measured in the B3
rehearsal; `run-all.cmd`; what it does to the machine and what it never does; mixed mode; the SSMS route; stopping
and removing); **Run from source on Linux or macOS**; the demo walkthrough (run the six examples, create a control
of one's own, read reasons, search and filter, suggestions, the language switch, a phone-width window);
configuration as one table from `.env.example`; tests, one command per project, plus `examples.py verify` and
`db-check.sh`; operations (reset, retention cleanup, the debug endpoint, `/api/docs`); the repository map; the
document index of §17.

The engine and api sections that the two tasks wrote, and `web/README.md`, are kept: the README is assembled around
them, and their commands are not rewritten. The screenshots are the five of decision 27, with one caption line for
decision 31: the images come from the automated end-to-end run, which is why two control names end in a tag.

The suggestions step says what was built (decision 32). With no key the engine proposes the controls it can derive
from the glossary and the data: the rules of examples 2 to 5, which the list already holds, so creating one adds a
second control with the same rule. Example 1 needs thresholds that only the LLM path supplies, and
`ANTHROPIC_API_KEY` adds Claude's proposals. If the engine's phase 6 was cut, the README names no key and the
limitations document lists the adapter as an extension.

### J. `docs/architecture.md`, trimmed in place

| Part | Change | When |
|---|---|---|
| Title and purpose | Rewritten for a reader of the submission; the deadline and position lines go | lane A |
| §3.2 | Gains the four records §17 promises: glossary as a file, snapshot paging, no SQL over the wire, English code with Hebrew from data | lane A |
| §15 | Two sentences and a link to `docs/ai-usage.md` | lane A |
| §20 | One line and a link to the assumptions document | lane A |
| §1 to §12 | Only statements that differ from what was built, the three "Docs for dc-delivery" lists among them | B4 |
| §6, §19 | The suggestion lines as dc-engine built them: with no key the engine yields examples 2 to 5, and thresholds come only through the LLM path | B4 |
| §13, §14 | As built, short; §14 points to the README for commands | B4 |
| §16 | The tree as built | B4 |
| §17 | Stays as the index, with links and a row for the cover page | B4 |
| §18 | Every item ticked, each with one piece of evidence: a file, a test, a screen or a README step | B4 |
| §19 | Keeps its five-row table, with a result column (PR and gate) in place of the gate text; the parallel rules shrink to one line | B4 |
| Appendix A | Unchanged | |

No heading is renumbered or removed.

### K. `docs/ai-usage.md`

1. A table: tool, what it was used for, how its output was checked. Rows: Claude Code and the models the logs
   show; the harness (CLAUDE.md, skills, rules, hooks, plans with gates, the reviewer and security-auditor agents);
   the claude.ai chat, in the words of decision 11; the two third-party design skills; the context7 and Playwright
   servers.
2. Where no AI runs: the definition-to-SQL path is deterministic code; the optional LLM of the suggestions sees
   the glossary and aggregates only, and its output goes through the validator and compiler.
3. How the work was organised: five tasks, a plan interview before each, gates, reviews, `contracts/` as the only
   channel between parallel sessions, asks carried between plans by the developer. Numbers from `git log` and the
   notes Logs.
4. Per task: what was generated, what the reviews found, what the developer rejected or rewrote (for example
   dc-contracts decision 4, where Kfir replaced the model's recommendation with his own design).
5. The decisions the developer made himself, with a pointer for each.

Sources: the five plans and notes Logs (dc-contracts here; the other three in their worktrees under `dev/active/`
or `dev/completed/`), the saved review reports, `git log` and the PRs. Section 4 is built from the review lines of
the Logs, which all five tasks write in the form of decision 33; a review that a Log records only as a verdict is
reported as "not recorded", not as clean. The document is self-contained: plans and notes are local files and are
quoted, never linked. Nothing in it is written about what Kfir reviewed that the Logs or Kfir do not say.

### L. `docs/submission.he.md`

One page in Hebrew, in the voice of `docs/PRODUCT.md` (action nouns, no gendered address): what the system is in
three sentences; how to run it (the two commands); a table of the seven "תוצרים להגשה" in the assignment's own
wording with the file or folder for each; the assignment's four example controls and the names they carry in the
system; one line on the AI tools with a link. Check how GitHub renders the lists and the table right to left, and
wrap the page in `<div dir="rtl">` if they flip.

## Risks

- **The three tasks build something else than their plans said on 2026-11-10** (variable names, start command,
  folders), or cut a phase. B0 reads their hand-over notes before anything is composed, and what was built wins
  over Design A to G.
- **Time.** Lane B has one working day (14 Nov) and the gate the morning after. If the merges slip, cut in this
  order and record it in `notes.md`: the macOS claims of `run-all.sh` (the README then says "tested on Linux"); the
  390 screenshot; the editor part of the glossary walkthrough (keep `/validate`); G2, in which case `start.ps1`
  and `start.cmd` are removed and the README gives the two commands by hand; the 3.13 and 3.14 wheels (3.12 with a
  clear message). Never cut: G1, G3, the six examples, the run instructions, `docs/ai-usage.md`, the §18 ticks.
- **Unknowns of the Windows host**, all settled by the B3 rehearsal and none before it: whether the SQL Server
  install brings an ODBC 17 or 18 driver and `sqlcmd`; a named instance over shared memory with TCP off (dc-engine
  checked on Linux that the URL becomes `Server=.\SQLEXPRESS`; nothing was run on Windows); mixed mode off after
  the Basic install; Defender and SmartScreen on an unsigned executable from a marked zip.
- **SQL Server 2022 on Windows 10 Home** is not confirmed by a source read during planning. If the installer
  refuses, use SQL Server 2019 Express and write the tested version into the README.
- **Hebrew code pages on Windows.** PowerShell 5.1 and Python both default to the ANSI code page: scripts are
  ASCII, Python gets `PYTHONUTF8=1` beside the engine's explicit encodings, sqlcmd gets `-f 65001`, and `verify`
  fails on question marks.
- **A key on the gate stack** turns the suggestions spec into paid calls. The generated `.env` has none; Kfir's
  may, and B1 runs on his.
- **Gate leftovers.** Every gate run adds about eighteen archived, tagged controls, and a killed run can leave
  active ones. They do not disturb a later run or the loader. The README shots come from a run on a list that
  holds only the six examples besides them.
- **A late dependency without a Windows wheel.** `anthropic` joins the engine's lock only in its phase 6. Its
  wheels were checked at planning, and the engine's check runs again whenever the lock changes; the bundle's own
  offline resolve is the last guard, and a failure there drops that Python version from the wheelhouse, with the
  README saying so.
- **Builds need the network** (Microsoft's apt repository, PyPI, npm, NuGet, MCR). G1 builds without a cache once;
  base images are pinned by tag.
- **The gate deletes the development database** (`down -v`). It runs after the three merges only, and the fresh
  clone's generated passwords do not match the main tree's `.env`: the dev stack is rebuilt from the main tree
  afterwards if more work follows.
- **`docker` on this machine is Docker Desktop's CLI** reached through `/mnt/c`, and the daemon was not running on
  2026-11-10. A variable set in the WSL shell may not reach it, so every setting of a verify step goes through
  `.env`. dc-contracts meets this CLI first; whatever it settles on, the gate uses.
- **The documents of lane A drift** from what the three tasks build. B0 diffs `contracts/` since the lane-A commit
  and reads the three drift lists, and the walkthrough of `docs/glossary.md` is carried out, not only read.
- **`.claude/CLAUDE.md` has a 100-line test.** The §17 rows are merged into two and the "As they land" line goes.
- **The bundle is about 80 MB**, too large for mail. It travels as a release asset or a shared link; a source-only
  `git archive` zip of a few MB is the fallback, and it runs the Docker path.
- **`docs/ai-usage.md` and the cover page speak in Kfir's name.** G7 is his read, and nothing is claimed about his
  reviews beyond what the Logs and he say.
- **Port 5000 is AirPlay's on macOS**, and a local SQL Server may hold a grader's 1433. `APP_PORT` and the 14330
  default answer both; the README names them.

## Out of scope

- CI workflows, images pushed to a registry, HTTPS and certificates, sign-in.
- An embedded Python, a macOS or Linux prebuilt bundle, the manual path on a machine without any Python.
- Changes to engine, api or web behaviour beyond the fixes the gate forces (decision 23). Marking or hiding a
  suggestion that already exists is one of them (decision 32).
- `docs/design.md` (dc-web's) and `docs/PRODUCT.md` (the design session's): linked, never edited here.
- Removing what the gate specs leave behind: the api deletes nothing, and no script here reaches into `dq`.
- A generator for the tables of `docs/control-definition.md` and `docs/glossary.md`: the contracts are frozen, and
  the review checks the tables against them.
- Loading the examples by SQL, running them at install, or seeding any row of `dq`.
