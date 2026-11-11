# dc-delivery: one command per path, the documents and the gate
Created: 2026-11-10 · Branch: feat/delivery (cut from main right after the dc-contracts merge; it lives in the main tree)
Amended: 2026-11-10 after the hand-backs of dc-web, dc-api and dc-engine (decisions 28 to 34; the Log in `notes.md` says what changed)
Amended: 2026-11-10 by the dc-contracts session on Kfir's scope decision (the section after the Decisions says what went)

## Goal

After this task a grader who receives the repository link runs the system the first time they try, in one of two
ways. With Docker: one script creates `.env`, builds the containers and serves the app on http://localhost:5000.
Without Docker: a short README section runs the system from source against a local SQL Server, with Python 3.12
or later, the .NET 10 SDK and Node 22. Either way the controls list opens with the six example controls ready to run, and
the README, the documents of architecture §17, a one-page Hebrew cover and the ticked §18 checklist say what was
built and how to see it. This is the last task before the submission of 2026-11-15. It is planned before tasks 1
to 4 are executed, so that what it needs from them reaches their sessions in time.

## Decisions

From the interview (Kfir, 2026-11-10, four rounds):

1. **Two lanes.** Lane A writes the documents that depend only on `contracts/`. It starts when dc-contracts has
   merged and runs in the main tree while the three worktrees run; there is no fourth worktree. Lane B (compose,
   manual path, README, gate) starts when engine, api and web have merged. (The last day keeps integration and
   proof only; rejected: everything after the merges, documents written by the three tasks.)
2. **The manual path is short from-source instructions** in the README: the database by `scripts/db-init.sh` or by
   hand in SSMS, the engine in a Python virtual environment from `engine/requirements.txt`, the api by the .NET SDK
   with the Angular build as its `wwwroot`. No bundle, no prebuilt binaries and no start-everything script.
   (Scope decision of 2026-11-10; it replaces the hybrid Windows bundle and its wheelhouse, the first decisions 2
   and 3.)
3. (Removed by the scope decision: the wheelhouse for CPython 3.12 to 3.14. The engine still checks that every
   pin has a Windows wheel for those versions: its decision 21.)
4. **Clean machines.** Docker path: a fresh clone on WSL with the dev stack removed, and once from a Windows folder
   with Docker Desktop. Manual path: the README's from-source section followed to the letter on that fresh clone.
   (Rejected: GitHub Actions, a rented VM. The offline run on the Windows host went with the bundle.)
5. **The six examples are loaded through the application API on first start**, by one stdlib-Python script that
   also verifies each run against the example's expected records and writes the generated part of
   `docs/examples.md`. `LOAD_EXAMPLES=false` turns the loading off. (Only the api writes `dq`, so there is no SQL
   seed of controls; rejected: an opt-in command, an empty list.)
6. **Loaded, never run.** The list opens with six controls that have no run, and the first result on screen comes
   from the grader's own click. The README lists the count each example gives.
7. **`.env` is generated on first start**, with random passwords, by the start script of the Docker path. No
   password is in the repository and `.env.example` holds placeholders. The from-source instructions give the
   by-hand route: copy the example and set the three passwords. (Rejected: working
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
    dc-api decision 23). The engine's image is dc-engine's Phase 7, the second item on its cut list: delivery uses
    it when it exists and writes it per Design A when that phase was cut. `engine/requirements.txt` exists either
    way: dc-engine exports it in its phase 1.
15. The submission is the repository. When the graders ask for a file, it is a `git archive` of the tag: source
    only, a few MB, and both paths run from it.
16. In compose each container receives only its own connection settings: `environment:` per service, never
    `env_file`, and `.env` is in no image. (CLAUDE.md: never hand a service the other's string or `sa`.) On the
    manual path both services run as one user on one machine with `.env` beside them, and the engine reads that
    file itself; the instructions still start each service with only its own variables, and the limitations
    document says what that does not protect.
17. The manual path keeps the two SQL logins, so the instance must allow SQL Server authentication. The
    instructions say how to see that it does and where the setting is; nothing changes a server setting for the
    grader. (A Windows-login fallback would run both services as the grader's sysadmin account and erase §2
    principle 4.)
18. On the manual path the database is created by `scripts/db-init.sh` in its host mode, or by hand in SSMS as
    `sql/README.md` describes. Nothing in this task drops a database.
19. The start scripts poll the app's health themselves. `docker compose up --wait` is not used: it has been
    reported to return an error when a one-shot service exits 0.
20. PowerShell scripts run on Windows PowerShell 5.1, are ASCII only, and are started through `.cmd` wrappers with
    `-ExecutionPolicy Bypass`. (The client default policy is Restricted, and 5.1 reads a file without a BOM in the
    ANSI code page, which is the Hebrew one on the graders' machines.)
21. The loader posts each example's name and description in the glossary's default language (Hebrew, the only
    one the examples carry) and skips a control whose exact name already exists, an archived one included.
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

28. **The gate specs run as dc-web wrote them**: `--workers=1`. The specs act only on controls they create, each named with a tag (`e2e-` and six characters) and
    found by its id; they never touch the six loaded examples, and they leave about eighteen archived, tagged
    controls per run. Those stay where they are: a gate stack is thrown away, and a grader's database starts
    without them.
29. **Against a local named instance the engine gets its connection by parts and the api gets one string.** Engine
    (dc-engine decision 20): `ENGINE_DB_HOST` is the instance; `ENGINE_DB_PORT` is absent, which means no port;
    `ENGINE_DB_DRIVER` is absent, and the engine takes Driver 18, else 17, whichever is installed. Api (dc-api
    Design B): `ConnectionStrings__Dq` alone. The from-source instructions give both forms, for a default
    instance on a port and for a named one.
30. **The from-source install uses the committed `engine/requirements.txt`**, dc-engine's export of the lock with
    hashes and markers: `pip install -r engine/requirements.txt` in a virtual environment, for a reader without
    uv. B2 compares the file with a fresh export.
31. **The README shows the gate's five shots as they are.** Two of them, the editor and the results, carry the
    test's tag in the control's name; the caption says that the images come from the automated end-to-end run.
    (The other way costs five minutes in B4: those two screens shot by hand on the loaded example.)
32. **The suggestions repeat four loaded controls, and the README says so.** The engine proposes the
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
    applies them; the first known item is the result column of architecture §19 (the suggestion lines of §6 and
    §19 already say that the engine yields examples 2 to 5 from heuristics alone). The row for
    `docs/design.md` in CLAUDE.md is written here too (dc-web decision 26). `docs/design.md` itself stays
    dc-web's: this task links it and checks that it is tracked.

## Scope decision (Kfir, 2026-11-10; written in by the dc-contracts session, which carried it through all five plans)

Four cuts, each already applied to the text of this plan. Where a line above or below still disagrees with this
section, this section holds.

1. **Hebrew only.** The language mechanism stays as designed (texts keyed by language, `languages` and
   `defaultLanguage` in the glossary, `Accept-Language`, the run's language); only the English values went. The
   loader has no `--lang`, `examples.py docs` writes Hebrew alone, the walkthrough has no language switch, and no
   screenshot or check is in English. The documents of this task stay in English, with the Hebrew cover.
2. **Suggestions are heuristics only.** There is no LLM lane in the engine: no SDK, no key, no model setting. No
   stack carries `ANTHROPIC_API_KEY`, the security audit has no LLM boundary to read, and the documents describe
   the LLM step as a design that is not built (architecture §6).
3. **Two paths: Docker, and short from-source instructions.** The offline Windows bundle is gone: no wheelhouse,
   no self-contained publish, no `make-bundle.sh`, no `run-all.ps1`, no `run-all.sh`, no rehearsal on the Windows
   host, and no second run of the engine suite under 3.13 and 3.14 here. Kept: `scripts/start.sh`, and `start.ps1`
   behind `start.cmd`, because they are the Docker path; `engine/requirements.txt`, for a reader without uv; the
   engine's driver and port settings (decision 29), because a grader's local SQL Server is often a named
   instance; and, in the engine's own gate, the Windows wheel check and the suite under 3.13 and 3.14, because a
   grader installs with pip on the Python they have.
4. **Screenshots at 390 and 1440 only**, as decision 27 already has them.

## Lines from dc-contracts as it merges (2026-11-10)

- **`README.md` was left as it is** by the scope decision, on Kfir's word, so two of its lines are stale until B4
  rewrites it: the comment beside `--render` says "he and en", and nothing in it says that the texts are Hebrew
  alone.
- **`.env.example` holds no password** since the dc-contracts review, and `db-init.sh` and `db-check.sh` refuse a
  password with spaces, quotes, `$`, `;` or a backslash. The generator of Design D draws from letters and digits,
  which passes. The two login passwords reach sqlcmd through the environment, never on a command line.
- **`scripts/db-check.sh` needs `jq`** on the host for three of its five sections; the from-source prerequisites
  name it where the reader runs that script.
- **`sql/` was not changed by the scope decision**: `dq.Run.language` still accepts `he` and `en`.
- **For the limitations document**: the LLM step of the suggestions is a design that is not built (architecture
  §6); every predicate of the Hebrew templates outside the colon style is masculine singular, which holds while
  every field label is masculine; the from-source path was run on Linux only.

## Asks to the other tasks, and their answers

Kfir carried four lines to the three sessions on 2026-11-10; each session amended its own plan. Nothing in their
folders was edited from here.

| To | Ask | Answer (their plan as amended) | Used in |
|---|---|---|---|
| dc-engine | Reach a named instance over shared memory with ODBC Driver 17 or 18 | Decision 20: `ENGINE_DB_DRIVER` (unset: the first of Driver 18 and 17 that is installed) and `ENGINE_DB_PORT` (unset or empty: no port in `Server=`). No variable holds a whole connection string: the login stays `dq_engine_ro`. The process environment wins over `.env` | Decision 29, Design G |
| dc-engine | `requires-python >=3.12`; Windows wheels for 3.12 to 3.14 | Decision 21: yes; a wheels-only resolve runs whenever the lock changes and at its gate, and its suite runs once under 3.13 and once under 3.14 | Design G: the from-source install with pip, on the grader's Python |
| dc-engine | Every file read names UTF-8 | Decision 22, enforced by Ruff's `PLW1514` | Design G: a from-source run on Windows needs no `PYTHONUTF8` |
| dc-engine | A start command that needs no uv | Decision 23: from `engine/`, `python -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port <port>`; `engine/requirements.txt` belongs to its phase 1 | Decision 14, Design G |
| dc-engine | Cuts and the image are in its notes | Its gate: the State of its `notes.md` holds what B0 reads first | Phase B0 |
| dc-api | The published api stands alone, outside the tree | Decision 25, Design I: the content root is the app's own folder; `wwwroot` must be inside the publish folder before the start; `ConnectionStrings__Dq` alone is enough, with no `DQ_APP_PASSWORD`; no `.env` is read outside Development | Design G |
| dc-api | The hand-off of the live tests | Its Gate and Risks, as before | Phase B2 |
| dc-web | The gate passes on a list that holds the six examples | Decisions 22 and 25, Design O: own tagged controls only, found by id; one worker | Decision 28, B1, G1 |
| dc-web | Base URL, screenshot folder | Design O; decision 27 adds a suggestions spec so that the fourth shot exists | Decisions 27 and 31 |
| dc-web | (its own decision 26) | `docs/design.md` stays with dc-web; its CLAUDE.md row is left to this task | Decision 34, B4 |
| all three | One owner per document; factual Logs | dc-engine 24 and 25, dc-api 26 and 27, dc-web 23 and 24 | Decisions 33 and 34, B0, Design K |

An answer that was planned and not built is fixed in Phase B0 per decision 23.

## Phases

Every phase ends the same way: tick the steps as they finish, run the Verify block and save its output under
`gates/<phase>.txt`, `/phase-review` for the areas named with its report saved under `reviews/`, one
`fix(<scope>): review fixes` commit, and a Log line in `notes.md` in the form of decision 33. State the spend
before every image pull or build, every Playwright run and every review fan-out, then wait for the word. Recreating or removing containers goes through the git guard's question. The
Design section below is the specification each step builds from.

### Lane A: documents that need nothing built (starts when dc-contracts has merged; main tree; the three worktrees are running)

#### Phase A0: branch (no commit)
- [x] Preconditions: dc-contracts is merged to main. `docs/PRODUCT.md` and `docs/design.md` are Kfir's (his
      docs+infra commit, which dc-web waits for): tracked by now, or still untracked and then left out, because
      this task stages its files by name.
- [x] `git switch -c feat/delivery main`.

#### Phase A1: the contract documents and the settled parts of the architecture
- [x] `docs/control-definition.md` per Design H.
- [x] `docs/glossary.md` per Design H, with the `department.manager` walkthrough written as steps a reader can
      follow.
- [x] `docs/assumptions-limitations-extensions.md` per Design H.
- [x] `docs/ai-usage.md` as a skeleton per Design K: every section present, the per-task table empty.
- [x] `docs/architecture.md`, the rows of Design J marked "lane A": the title and purpose, the four decision
      records of §3.2, the pointers of §15 and §20. Nothing else in the file.
- [x] A throwaway check under `tools/` (not committed): every backticked token of the first two documents is an
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
- [x] `git merge main` into `feat/delivery` (a merge, not a rebase).
- [x] Kfir's `.env` holds `DB_PORT=1433` and `ENGINE_DB_PORT=1433` explicitly, before the defaults move in B1.
- [x] Read what the three tasks left for this one. Their folders moved into the worktrees
      (`../cbs-engine/dev/active/dc-engine/`, or `dev/completed/` there after `/ship`; the same for api and web):
      - dc-engine, `notes.md` State: the variables as built, the start command, which phases were cut (the image);
      - dc-api, `notes.md`: whether the live tests ran or are handed over;
      - dc-web, `notes.md` "Hand-over to dc-delivery" and `web/README.md`: the cuts taken with the sentence to
        write about each, whether the gate ran on a pre-loaded list and on the build the api hosts, and what it
        left in the dev `dq` (the six examples of its phase 7);
      - the three lists "Docs for dc-delivery", from the notes and from the PR bodies.
- [x] Record "As built" in `notes.md`, ten lines at most. Design A to G use the names the plans gave on
      2026-11-10; what was built wins.
- [x] Each answer in the asks table holds in the code: the driver choice and the port-less URL (the engine's own
      tests), the published api's content root. One that does not is fixed here per decision 23.
- [x] `git diff <A1 sha>..main -- contracts/ docs/` and the three "Docs for dc-delivery" lists: correct the lane-A
      documents. The corrections ride in the B4 commit.
- [x] No session is serving from a worktree and no suite is running: `ss -ltn`, and
      `pgrep -fa "pytest|dotnet test|ng test|vitest|playwright test"` (a bare `playwright` also matches the MCP
      servers every session starts).

#### Phase B1: compose end to end
- [x] `.dockerignore` per Design A.
- [x] `engine/Dockerfile`: dc-engine's, built once as it stands; written per Design A only if its Phase 7 was cut.
- [x] `api/Dockerfile` per Design A.
- [x] `docker-compose.yml`: services `engine`, `api` and `examples`, ports and per-service environment per Design A
      and B.
- [x] `.env.example` per Design B.
- [x] `scripts/examples.py` per Design C.
- [x] `scripts/lib/env.sh` and `scripts/start.sh` per Design D (executable).
- [x] `scripts/lib/env.ps1`, `scripts/start.ps1` and `start.cmd` per Design D, for the Docker path from a Windows
      folder. `.gitattributes`: `*.ps1` and `*.cmd` with `eol=crlf`.
- [x] `.claude/skills/dc-sql/SKILL.md`: the facts this phase changed (services, ports, who reaches whom).

Verify:
```
bash -n scripts/start.sh scripts/lib/env.sh
LC_ALL=C grep -nP '[^\x00-\x7F]' scripts/*.ps1 scripts/lib/*.ps1 *.cmd      # prints nothing
powershell.exe -NoProfile -Command "<parse each .ps1 with [Parser]::ParseFile; print the errors>"   # none
docker compose config -q
docker compose build                 # base images and packages, several minutes: say so and wait
scripts/start.sh                     # recreates containers: the guard asks
docker compose ps -a                 # db-init and examples exited 0; db, engine and api healthy
docker compose exec engine env       # no dq_app and no sa password
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

#### Phase B2: the manual path, from source
- [x] `engine/requirements.txt` is dc-engine's: `cd engine && uv export --no-dev --format requirements-txt | diff -
      requirements.txt` prints nothing.
- [x] The from-source steps of Design G written out as the commands the README will carry, in
      `gates/B2-manual.md`, and carried out once exactly as written.

Verify (on WSL, the database in its container, the `engine` and `api` containers stopped through the guard; the
host needs `msodbcsql18`, which the engine task had Kfir install; port 8000 belongs to another project here, so
the engine's port and `Engine__BaseUrl` point elsewhere):
```
# the commands of gates/B2-manual.md, one by one: engine and api as host processes against localhost:1433
python3 scripts/examples.py verify --base-url http://localhost:5000
cd api && DC_LIVE=1 dotnet test --filter Category=Live     # only if the api's notes hand the live tests over
# stop both, then: ss -ltn shows no listener on 5000 or on the engine's port
```
Review: `/phase-review infra --since <B1 sha>`
No commit of its own: the commands ride into the README in B4.

#### Phase B4: README, architecture as built, cover page, checklist
- [x] `README.md` per Design I, every command in it copied from a run of B1 and B2 (tick them in
      `gates/readme-commands.md`).
- [x] `docs/screenshots/`: the five files of decision 27, copied from the B1 run, with the caption of decision 31.
- [x] `docs/examples.md`: the frame, then `python3 scripts/examples.py docs` for the generated region.
- [x] `docs/architecture.md`, the rows of Design J marked "B4": what differs from what was built in §1 to §14, the
      suggestion lines of §6 and §19, the tree of §16, the index of §17, the result column of §19, and §18 ticked
      with its evidence.
- [x] The three lists "Docs for dc-delivery": every line applied to its document or answered in `gates/B4.txt`.
- [x] `docs/ai-usage.md` completed per Design K from the notes Logs of the five tasks, the plans' Decisions and
      `git log`.
- [x] `docs/submission.he.md` per Design L.
- [x] `docs/assumptions-limitations-extensions.md`, `docs/control-definition.md`, `docs/glossary.md`: the as-built
      corrections of B0 and the limits learned in B1 and B2 (tested versions, the row cap value, the cuts the
      three tasks recorded, the extension of decision 32, the LLM step as a design that is not built).
- [x] `sql/README.md`: the host port.
- [x] `docs/design.md` is tracked (`git ls-files docs/design.md`) and is not edited: it is dc-web's. If it is not
      tracked, ask Kfir.
- [x] `.claude/CLAUDE.md`: rows for the §17 documents, `docs/design.md` among them (dc-web left its row to this
      phase), and for the cover page; the Hebrew gotcha naming `docs/submission.he.md` and `docs/examples.md`; the
      map line for the compose services; without the "As they land" line; at most 100 lines. `.claude/README.md`:
      a changelog line.
- [x] `.claude/hooks/tests/infra.test.mjs`: the link test also covers `README.md`, `docs/*.md` and `sql/README.md`.
- [x] The `docs/glossary.md` walkthrough is carried out once exactly as written, on a scratch copy of the glossary:
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
      `.env`; the untagged listing equal before and after. Output in `gates/G1-docker-wsl.txt`.
- [ ] **G2 Docker path, Windows host.** The same from a Windows folder with `start.cmd`, without the gate specs.
- [ ] **G3 Manual path, from source.** On the fresh clone of G1, with the `engine` and `api` containers stopped:
      the README's from-source section followed to the letter, then `examples.py verify`, and by hand in the
      browser one example run with a reason on every record. Output in `gates/G3-manual.txt`.
- [ ] **G5 Security audit.** One `security-auditor` on opus over the merged repository (say it first): logins and
      grants, the compose network and ports, the per-service environment, error bodies, CORS, secrets. The report is saved as `reviews/security.md`. Critical findings are fixed (decision 23); the rest
      are added to the limitations document; the Log line lists both.
- [ ] **G6 Checklist.** Every item of §18 is ticked and its evidence exists. An item that cannot be ticked
      honestly is a blocker for Kfir, not a tick.
- [ ] **G7 Kfir reads** `docs/ai-usage.md` and `docs/submission.he.md` (both speak in his name) and the first
      screen of the README. The Log says what he changed or rejected, in his words where he gave them.
- [ ] **G8** `/check all --tests`, then `/ship dc-delivery`; the PR and the merge on Kfir's word.
- [ ] **G9 After the merge**, each on Kfir's word: tag `v1.0.0`; a fresh `git clone` from GitHub with
      `scripts/start.sh` as the last sanity check; the graders as collaborators.

## Design

### A. Images and compose

**`.dockerignore`** (repository root, the build context of both images): `.git`, `.env*` except `.env.example`,
`dev/`, `**/node_modules`, `**/.venv`, `**/bin`, `**/obj`, `**/dist`, `**/.angular`,
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
| `engine` | `db-init` completed successfully | none | `ENGINE_DB_HOST=db`, `ENGINE_DB_PORT=1433`, `DQ_ENGINE_RO_PASSWORD` and the other `ENGINE_*` settings that `.env` sets |
| `api` | `engine` healthy | `${APP_BIND:-127.0.0.1}:${APP_PORT:-5000}:8080` | `DB_HOST=db`, `DB_PORT=1433` (the container's port, never the host's `DB_PORT`), `DQ_APP_PASSWORD`, `Engine__BaseUrl=http://engine:8000` |
| `examples` (one-shot) | `api` healthy | | `LOAD_EXAMPLES`, the api URL |

`examples` runs the stock `python:3.12-slim-bookworm` image with `scripts/examples.py` and `contracts/examples/`
mounted read-only, and the command `load`. No service has a restart policy: an engine that refuses to start on a
glossary mismatch must stay visibly stopped. The mssql image is x86-64 only, which the README says for Apple
Silicon (§14).

### B. Environment file

`.env.example` keeps the three blocks of dc-contracts and gains a fourth. All password values are empty; the
header says the start scripts fill the passwords, and gives the by-hand rule (8 or more
characters with upper case, lower case and a digit; no quotes, `$`, `;` or spaces). Two lines that other tasks
wrote change here: `DB_PORT` in the database block and `ENGINE_DB_PORT` in the engine block both become `14330`,
because three readers must agree on the host port (compose publishes on the first, the api's Development source
reads the first, an engine run by hand reads the second). A comment says that this repository's own developers
keep 1433 in both; Kfir's `.env` already does. The new block: `APP_PORT=5000`, `APP_BIND=127.0.0.1`,
`LOAD_EXAMPLES=true`. Compose maps the names the two tasks chose and invents none; on the manual path the server
name is the database block's `DB_HOST` (decision 29).

### C. `scripts/examples.py`

Standard library only, Python 3.12 or later, every file opened as UTF-8, ASCII on stdout (ids and counts, never
Hebrew names: a Windows console may not encode them). It speaks only to the application API of `contracts/api.md`.

- `load [--base-url URL] [--dir contracts/examples]`: waits for `/api/v1/health` (two minutes at
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
- `docs [--out docs/examples.md] [--check]`: runs each example as `verify` does and writes the region between
  the two generated-region markers: the name, the Hebrew description (for examples 1 to 4 the assignment's own
  sentence), the rule sentence, the definition JSON, the expected count, and the table of flagged records with
  their display fields, matched ids and the reason text, all as the engine rendered them in Hebrew. `--check`
  writes nothing and exits 1 when the file differs.

### D. Start scripts (the Docker path)

`scripts/start.sh` for Linux, macOS and WSL; `scripts/start.ps1` behind `start.cmd` for Windows. Same steps:
1. Docker answers (`docker info`); otherwise one line that says to start Docker Desktop.
2. `.env`: when it is missing, copy `.env.example` and fill each empty password with 24 random characters from
   letters and digits without look-alikes, re-drawn until upper case, lower case and a digit are all present.
   Nothing else is filled. An existing `.env` is never changed. The passwords are not printed; the script says
   where they are.
3. `docker compose up -d --build`.
4. Poll `http://localhost:<APP_PORT>/api/v1/health` for up to five minutes. On a timeout print
   `docker compose ps -a` and the last lines of the service that is not healthy, and exit 1.
5. Print the address, the database address for SSMS, and the commands that stop (`docker compose down`) and wipe
   (`docker compose down -v`).

`scripts/lib/env.sh` and `scripts/lib/env.ps1` hold the `.env` creation for the two start scripts. The PowerShell
side follows decision 20.

### E and F. (removed with the Windows bundle)

The bundle layout, `scripts/make-bundle.sh` and `run-all.ps1` were Designs E and F. The scope decision removed
them; the letters stay unused so that the references to Designs G to L keep their meaning.

### G. The manual path: from-source instructions

A README section of about a screen, for a reader with a local SQL Server and no Docker. Prerequisites: SQL Server
2019 or 2022 with SQL Server authentication allowed, ODBC Driver 18 or 17, Python 3.12 or later (the engine's
gate ran its suite under 3.12, 3.13 and 3.14), the .NET 10 SDK, Node 22.
The steps, each a command the reader pastes:

1. `.env`: copy `.env.example`, set the three passwords, set `DB_HOST` (and `DB_PORT`, or neither port line for a
   named instance: decision 29).
2. Database: `DB_HOST=… scripts/db-init.sh` where `sqlcmd` and bash exist, else the scripts by hand in SSMS as
   `sql/README.md` describes.
3. Engine: a virtual environment in `engine/`, `pip install -r requirements.txt` (or `uv sync --frozen --no-dev`),
   then from `engine/` `python -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000`, with
   `ENGINE_DB_HOST` and `DQ_ENGINE_RO_PASSWORD`.
4. Client and api: `npm ci && npx ng build` in `web/`; `dotnet publish api/src/DataControls.Api -c Release`; the
   Angular build copied into the `wwwroot` of the publish folder; the published api started with
   `ConnectionStrings__Dq`, `Engine__BaseUrl` and `ASPNETCORE_URLS`.
5. `python scripts/examples.py load`, then the address in a browser.

Each service is started with only its own variables. The section says what the path does not do: it creates no
database user beyond the two logins, changes no server setting, and installs nothing outside the repository
folder. B2 carries the commands out once on WSL; a Windows shell differs in how a variable is set, and the section
shows that form beside the bash one for the two start commands.

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
macOS AirPlay on 5000); **Run from source, without Docker** (Design G: what must be installed, the five steps,
what the path never does, SQL Server authentication, the SSMS route, stopping); the demo walkthrough (run the six
examples, create a control of one's own, read reasons, search and filter, suggestions, a phone-width window);
configuration as one table from `.env.example`; tests, one command per project, plus `examples.py verify` and
`db-check.sh`; operations (reset, retention cleanup, the debug endpoint, `/api/docs`); the repository map; the
document index of §17.

The engine and api sections that the two tasks wrote, and `web/README.md`, are kept: the README is assembled around
them, and their commands are not rewritten. The screenshots are the five of decision 27, with one caption line for
decision 31: the images come from the automated end-to-end run, which is why two control names end in a tag.

The suggestions step says what was built (decision 32). The engine proposes the controls it can derive from the
glossary and the data: the rules of examples 2 to 5, which the list already holds, so creating one adds a second
control with the same rule. Example 1 is not proposed: its thresholds are business knowledge that no heuristic
invents. The LLM step that could propose such rules is a design that is not built; the limitations document lists
it as an extension.

### J. `docs/architecture.md`, trimmed in place

| Part | Change | When |
|---|---|---|
| Title and purpose | Rewritten for a reader of the submission; the deadline and position lines go | lane A |
| §3.2 | Gains the four records §17 promises: glossary as a file, snapshot paging, no SQL over the wire, English code with Hebrew from data | lane A |
| §15 | Two sentences and a link to `docs/ai-usage.md` | lane A |
| §20 | One line and a link to the assumptions document | lane A |
| §1 to §12 | Only statements that differ from what was built, the three "Docs for dc-delivery" lists among them | B4 |
| §6, §19 | The suggestion lines as dc-engine built them: the engine yields examples 2 to 5 from heuristics; the LLM step stays in §6 as a design that is not built | B4 |
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
2. Where no AI runs: nowhere in the product. The definition-to-SQL path is deterministic code and the
   suggestions are heuristics over the glossary and aggregates; the LLM step is a design that is not built.
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
  order and record it in `notes.md`: the 390 screenshot; the editor part of the glossary walkthrough (keep
  `/validate`); G2, in which case `start.ps1` and `start.cmd` are removed and the README gives the two commands by
  hand. Never cut: G1, G3, the six examples, the run instructions, `docs/ai-usage.md`, the §18 ticks.
- **The from-source path on Windows is written, not run.** B2 and G3 run it on WSL. What differs on Windows is
  named in the section (how a variable is set, a named instance without a port, SQL Server authentication off
  after a Basic install) and the limitations document says that this path was tested on Linux.
- **Gate leftovers.** Every gate run adds about eighteen archived, tagged controls, and a killed run can leave
  active ones. They do not disturb a later run or the loader. The README shots come from a run on a list that
  holds only the six examples besides them.
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
- **`docs/ai-usage.md` and the cover page speak in Kfir's name.** G7 is his read, and nothing is claimed about his
  reviews beyond what the Logs and he say.
- **Port 5000 is AirPlay's on macOS**, and a local SQL Server may hold a grader's 1433. `APP_PORT` and the 14330
  default answer both; the README names them.

## Out of scope

- CI workflows, images pushed to a registry, HTTPS and certificates, sign-in.
- An offline bundle, prebuilt binaries, a wheelhouse, a start-everything script for the manual path, a run of it
  on a Windows host: the manual path is from source, by the README (the scope decision).
- English texts, a language switch, an LLM step in the suggestions (the scope decision).
- Changes to engine, api or web behaviour beyond the fixes the gate forces (decision 23). Marking or hiding a
  suggestion that already exists is one of them (decision 32).
- `docs/design.md` (dc-web's) and `docs/PRODUCT.md` (the design session's): linked, never edited here.
- Removing what the gate specs leave behind: the api deletes nothing, and no script here reaches into `dq`.
- A generator for the tables of `docs/control-definition.md` and `docs/glossary.md`: the contracts are frozen, and
  the review checks the tables against them.
- Loading the examples by SQL, running them at install, or seeding any row of `dq`.
