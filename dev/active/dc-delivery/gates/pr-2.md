# PR #2: feat(engine): the Python control engine

State: MERGED · merged 2026-11-11T06:36:06Z · merge commit 0e07fca · branch `feat/engine` into `main` · 14 commits · 121 files, +13141 -77

Commits (oldest first):
- 05369a6 chore(dc-engine): reconcile task notes and plan after phase 0
- a426451 feat(engine): service skeleton, glossary loader and startup check
- c96bc1d feat(engine): definition validator with the full rejection catalogue
- e1787af fix(engine): review fixes
- e74d531 fix(engine): review fixes
- a9b3ec8 feat(engine): compiler with golden tests and compile cache
- 642f140 fix(engine): review fixes
- a49c710 feat(engine): executor, explainer and the validate and run endpoints
- 57e3e28 feat(engine): control suggestions from lifecycle, required fields and…
- 102543c fix(engine): review fixes
- dcc70b6 fix(engine): review fixes
- 85bfa53 build(engine): container image
- c8784eb fix(engine): review fixes
- 05b5a20 test(engine): move the validator bound tests to their own module

---

## What

`engine/`: the Python control engine of architecture §6, with all six endpoints of `contracts/api.md` §3.

- **Glossary and startup check.** Loads `contracts/glossary.json` into typed, immutable values, builds one
  SQLAlchemy table per entity from it, and refuses to start when the database lacks a table or column the
  glossary names, or when a column's type does not fit its field.
- **Validator.** The schema layer and the semantic layer, every code of `contracts/errors.md` with its path,
  params and `nodeId`, errors in document order.
- **Compiler and cache.** One inner SELECT with the real WHERE and a flag per node; a page and a count derived
  from it; `age` rewritten into birth-date ranges on the run date; many-to-one paths as LEFT OUTER JOINs,
  one-to-many as correlated EXISTS. Every caller value is a typed bind; identifiers come from the glossary's
  tables only. A bounded, thread-safe plan cache.
- **Executor.** Count, then page, on one connection as `dq_engine_ro`, under a row cap and a statement timeout,
  behind a guard that lets one SELECT through and nothing else.
- **Explainer.** The rule sentence, a sentence per node and a reason per matched node, rendered from the
  glossary's templates, each also as parts with node id and role. No code names a language.
- **Suggestions.** Five generators that read `lifecycle`, `required`, cardinality and type, plus counts from one
  aggregate SELECT per entity. Every proposal is validated, compiled and counted like a user's definition.
- **Image.** `engine/Dockerfile` (Debian 13, ODBC Driver 18, non-root).
- The README's **Engine** section, the engine block of `.env.example`, and three corrected sentences in the
  `dc-engine` skill and the security-auditor brief.

## Why

It is task 2 of architecture §19: the only component that reads `hr`, so every guarantee of §10 (identifiers
from the glossary, values bound, read-only single SELECT, bounded execution) is implemented and tested here.
The api builds its run flow on it.

## How to test

From `engine/`, with the database of the README's quick start running and `.env` in the repository root:

```sh
uv sync
uv run python -m pytest          # 521 tests; the integration tests need the seeded database and never skip
uv run ruff check . && uv run pyright
uv run python -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000
```

then, from the repository root:

```sh
curl -s localhost:8000/health
curl -s -X POST localhost:8000/run -H 'content-type: application/json' \
  -d "{\"definition\": $(jq -c .definition contracts/examples/minor-high-salary.json), \"runDate\": \"2026-11-01\"}" \
  | jq '.totalCount, [.violations[].key]'        # 3 and 1051, 1052, 1053
curl -s -X POST localhost:8000/suggest -H 'content-type: application/json' -d '{}' | jq '[.items[].name]'
```

The gate of §19, item by item, with the tests that prove each (`dev/active/dc-engine/gates/final.txt`):

| Gate item | Proof |
|---|---|
| golden tests for the six examples | `tests/golden/*.sql`, `*.params.json`, `*.text.json` |
| every rejection path | the 13 invalid fixtures by code and path, 92 more validator tests, 26 over HTTP |
| injection values bound | text only in the parameters; no literal in any statement but the LIKE wildcard, the flags' 1 and 0 and the row cap, on the examples and on definitions generated from the real and from a synthetic glossary; end to end: no row, the table unchanged |
| the exact planted ids | every example on its date, example 1 also on 2026-10-31: keys and matched ids; one answer equal to the example of `contracts/api.md` §5 |
| `/suggest` yields examples 2 to 5 | each reproduced node for node, flagging exactly its records |

Also run for the gate: `scripts/db-check.sh` (27 of 27), `uv run scripts/contracts-check.py`, the hook tests (226
of 226), the suite under Python 3.13 and 3.14 (521 each), the Windows wheel check for 3.12 to 3.14, every
command of the README's Engine section in a scratch copy, and the image on the compose network.

## Risks and rollback

- **Open before merge, both Kfir's.** The Hebrew text has not been read by a person:
  `engine/tests/golden/*.text.json` (sentences and reasons of the six examples) and
  `dev/active/dc-engine/gates/suggest-answer.json` (the seven proposals on the seed). And one line waits to be
  pasted into the dc-api session (`notes.md`, "Lines for the other sessions").
- **This branch was built in one unattended night.** `dev/active/dc-engine/notes.md`, "Decisions taken
  unattended", lists 25 decisions that were Kfir's to make and were made without him. The ones most worth a
  look: 10 (only caller values are parameters; a glossary with `maxTotalValues` above 500 is refused at
  startup), 18 (three proposals beyond the four of the gate), 22 (a tree more than eight times past a limit is
  answered by the limit alone, before the schema), 23 (the contract sets no length for a text literal).
- **Reviews.** Seven read-only agents on opus: one per phase, one for the image, and the security audit
  (`dev/active/dc-engine/reviews/`). They found three critical or high defects (a recursion crash on deep
  nesting, a parameter-count crash on nested groups, a quadratic uniqueness check); each is fixed with tests.
- **Not proven.** Nothing ran on Windows. The statement-timeout path is proven on a fabricated driver error,
  because the read-only login cannot run a slow statement on purpose.
- **Rollback.** The branch adds `engine/` and one README section and changes nothing the other services read:
  `contracts/`, `sql/` and `docker-compose.yml` are untouched. Reverting the merge removes it whole.

## Docs for dc-delivery

What this task made untrue or incomplete in documents it does not own (details in `notes.md`):

- `docs/architecture.md` §14, "connection strings for the two logins": the engine takes no connection string;
  it reads `ENGINE_DB_HOST`, `ENGINE_DB_PORT`, `ENGINE_DB_NAME`, `ENGINE_DB_DRIVER` and `DQ_ENGINE_RO_PASSWORD`.
- `README.md`, Configuration table and the last bullet of "Running the tests": the engine's variables and
  commands are in the new Engine section; the two placeholder sentences can point there.
- `README.md`, Contracts table and the `--render` line ("Hebrew and English", "he and en"): the glossary lists
  Hebrew alone.
- `docker-compose.yml`, the engine service: build from `engine/Dockerfile` with the repository root as context;
  set `ENGINE_DB_HOST=db`; pass `DQ_ENGINE_RO_PASSWORD` by name and never the whole `.env`; wait for `db-init`
  to complete, not only for a healthy `db`; keep port 8000 unpublished or on 127.0.0.1 (the engine has no
  authentication).
- Repository root: there is no `.dockerignore`; `engine/Dockerfile.dockerignore` is read by BuildKit only.
- README manual path: `ENGINE_DB_HOST=localhost` or `.\SQLEXPRESS` with an empty port on Windows; `127.0.0.1`
  against the compose database (where `localhost` resolves to `::1` first, the ODBC driver never falls back).
- `docs/architecture.md` §6, compiler and suggestions: flags have generated labels and exist for the nodes that
  can be matched; the profile is the row count, the missing count of each optional field and the order of each
  pair of date fields, with five generators.
- `docs/architecture.md` §19: `/suggest` yields examples 2 to 5 and, on the seed, three more proposals.
- For the limitations document: the timeout path is proven on a fabricated error; count and page are two
  statements at the default isolation level; a suggestion is counted on today's date; the Debian half of the
  image is not pinned; an age operand beyond the range of DATE is clamped.

