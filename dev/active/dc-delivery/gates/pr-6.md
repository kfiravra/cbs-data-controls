# PR #6: feat(delivery): one-command start, the examples loader and the submission documents

State: MERGED 2026-11-12 17:41 as the squash commit `c1467de` on main (head `5b2cafb`, the branch kept) · opened 2026-11-12 · branch `feat/delivery` into `main` · https://github.com/kfiravra/cbs-data-controls/pull/6 · body revised 2026-11-12 09:31 after Kfir's decisions

The body:

---

## What

The delivery task: the whole system starts with one command, and the submission's documents are written.

**The composed system**
- `docker-compose.yml` now holds five services: `db`, `db-init`, `engine` (no host port), `api` (serves the built
  client, `127.0.0.1:5000`) and a one-shot `examples` loader. `api/Dockerfile` builds the client and the api into
  one image. Each service gets only its own login's password.
- `scripts/start.sh` and `start.cmd` (with `scripts/start.ps1`): create `.env` with three random passwords when
  there is none, build, start, wait for the app, print the address.
- `scripts/examples.py`: `load` the six examples through the api, `verify` them against the example files
  (exact keys and matched conditions), and generate the tables of `docs/examples.md`.
- `scripts/scale-test.sh` with `sql/scale/load_scale.sql`: the six examples on 200,005 employees in a separate
  scratch database. The seed and its assertions are untouched.
- `scripts/db-init.sh` waits for a database that is still recovering, and the `db` health check waits for the
  server's final collation (both found by the clean-clone runs, below).
- `sql/50_indexes.sql` gains `hr.Employee (department_id, status)`, the index a related-records rule needs: the
  scale test had that rule at 9.2 s on 200,000 employees, and it now takes 35 ms.
- `contracts/api.md` and `contracts/errors.md` say what the services do for a JSON body that does not parse
  (400 in the api, 415 only for a wrong media type; the engine answers both 415) and for a definition more than
  eight times past a limit. No behaviour changes.

**The documents**
- `README.md` rewritten around the two run paths; `docs/summarize-architecture.md` (the short document, with the
  design of the optional AI task); `docs/control-definition.md`; `docs/glossary.md`; `docs/examples.md`;
  `docs/assumptions-limitations-extensions.md`; `docs/ai-usage.md` (one page; the full record of the build is
  `dev/completed/ai-usage-record.md`); `docs/submission.he.md` (the Hebrew cover page); `docs/architecture.md` corrected to what was built, with §18 ticked against evidence; five screenshots.
- `dev/active/dc-ai-suggestions/`: the plan of the advisor service, marked planned and not started.
- The four finished task folders moved to `dev/completed/` with their true boxes ticked.

## Why

The assignment's deliverables beyond the code: installation and run instructions, a short architecture document,
examples, assumptions and limitations, and the description of the AI tools. A grader has to be able to start
the system on a clean machine at the first try.

## How to test

```sh
git clone --branch feat/delivery <this repository> dc && cd dc
scripts/start.sh                      # Windows: start.cmd
python3 scripts/examples.py verify    # six PASS lines
```

Then http://localhost:5000: six example controls, none run yet; run one and read the reason on each record.

What was run for this PR (files under `dev/active/dc-delivery/gates/`):
- `G1-docker-wsl.txt`: fresh clone after `docker compose down -v --rmi local`, three times, the last on the
  final commit of the code; start in 50 to 118 s with the base images present; `verify` green; the client's gate
  specs 18 of 18; the examples unchanged by them.
- `G2-docker-windows.txt`: `start.cmd` through `cmd.exe` from a Windows folder (Git for Windows clone), 117 s;
  `verify` green. A double-click was not tried.
- `G3-manual.txt`: the README's from-source section to the letter on the fresh clone (engine from a pip venv,
  published api serving the client's build), `verify` green, one example run in a browser.
- `final.txt`: `/check all --tests` after the index and the contract wording, 15 checks green (engine 521,
  api 389, web 390, hooks 227, db-check 27).
- `reviews/`: compose and scripts, the documents, and a security audit of the whole repository
  (0 critical, 0 high, 1 medium, 2 low, 3 info).

Not run: `DB_HOST=... scripts/db-init.sh` as a host command (no `sqlcmd` on the development machine; the same
script runs in its container), the PowerShell forms of the from-source path, macOS, and a first start with the
image downloads timed.

## Risks and rollback

- **Found and fixed by the clean-clone runs:**
  - a start straight after `docker compose stop` could fail, because `db-init` ran while SQL Server was still
    recovering the database. `db-init.sh` now waits; five restarts passed after the fix.
  - on a new volume `db-init` could fail on its collation check (about one start in seven): the server answers
    for a moment under its default collation before it changes to Hebrew, and the health check asked only
    `SELECT 1`. The health check now waits for the collation; five new volumes in a row then initialised, and
    the third clean-clone run was made on this commit.
- **Decided by the owner, 2026-11-12:** the index is added; `AllowedHosts` stays `*`, since the app is published
  to this machine only and may be opened under another host name (it stays in the limitations document);
  decisions 10 to 23 of the dc-ai-suggestions plan stand.
- **Open:** the owner's read of `docs/ai-usage.md`, `docs/submission.he.md` and the README's first screen (G7).
- **Rollback:** revert the merge. No table of `dq` or `hr` changes (one index is added to `hr.Employee`); the
  services' code is untouched apart from the compose wiring. A machine that ran this branch is cleaned with `docker compose down -v --rmi local`.
