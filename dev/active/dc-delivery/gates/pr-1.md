# PR #1: feat(contracts): database, seed and contracts

State: MERGED · merged 2026-11-10T21:56:41Z · merge commit f9928bf · branch `feat/contracts` into `main` · 8 commits · 75 files, +7547 -635

Commits (oldest first):
- 43745cc feat(sql): database skeleton, hr and dq schemas, two logins
- b0d3015 feat(contracts): definition schema and business glossary
- 16824ce feat(sql): hebrew seed with planted violations and six example controls
- aafe9ca feat(contracts): http api and error catalogue
- dd6eb34 fix(contracts): review fixes
- 9b01a4b refactor(contracts): hebrew only, heuristic suggestions, two delivery…
- 9f717f7 fix(contracts): gender-neutral operator texts
- 46ecf63 docs(contracts): final operator wording in the architecture and the p…

---

## What

Task 1 of `docs/architecture.md` §19: the database, its seed and the whole `contracts/` folder. The engine, the api and the client are built against these files in parallel, by sessions that share nothing else.

**Database** (`docker-compose.yml`, `sql/`, `scripts/db-init.sh`, `scripts/db-check.sh`)

- SQL Server 2022 in compose, bound to 127.0.0.1, with a one-shot init container. `DataControls` under `Hebrew_CI_AS`; schema `hr` (Ministry, Department, Employee) and schema `dq` (Control, ControlVersion, Run, RunResult).
- Two logins that can each do only their own job: `dq_app` (DML on `dq`, denied on `hr`) and `dq_engine_ro` (SELECT on `hr`, denied everything else). No DDL, nothing to `public`.
- `db-init.sh` is re-runnable (a second run changes nothing), has `--reset`, and refuses to run in a linked worktree.
- The seed: 5 ministries, 16 departments, 85 invented employees in Hebrew. Every row an example must flag carries a `-- PLANTED <example>` comment, every near miss a `-- BOUNDARY <example>` comment.

**What each contracts file fixes**

| File | Fixes |
|---|---|
| `contracts/control-definition.schema.json` | The JSON of a control: a root entity and a tree of groups, conditions and related-record nodes; eighteen operators and the operand shape of each. Draft 2020-12, node types and operand shapes by `if`/`then`, no `not`, `anyOf` or `oneOf`, so Python `jsonschema` and JsonSchema.Net report a violation at the same path |
| `contracts/glossary.json` | The business language: entities, fields, relationships, operators with `label`, `sentence` and `reason` variants, phrases, limits, formats, and the texts of suggestions. Every text is keyed by language and the glossary lists Hebrew alone. The only place a table or column name appears, and the one source of sentence and reason text |
| `contracts/examples/*.json` | Six controls, each with the records it must flag in the seed and the condition ids matched per record |
| `contracts/examples/invalid/*.json` | Thirteen definitions that must be rejected: five by the schema, eight by the glossary, each with its code and JSON pointer |
| `contracts/api.md` | Both HTTP APIs, the engine's and `/api/v1`: every request, response, status and error, with the shared shapes defined once |
| `contracts/errors.md` | The closed lists (error codes, definition error codes with their paths, reason keys, evidence keys, request error codes, text part roles) and the rules they share: matched, NULL, age, depth and count, order of checks, rendering |

**The six examples and what they flag in the seed**

| Example | Root | Rule | Expected |
|---|---|---|---|
| `minor-high-salary` | employee | age under 18 AND salary above 15,000 | 3 (4 on the alternate run date 2026-10-31) |
| `termination-before-hire` | employee | termination date earlier than hire date (field to field) | 3 |
| `active-in-inactive-department` | employee | active AND the department is inactive (one hop) | 6 |
| `missing-mandatory-data` | employee | active without email, salary or department, OR inactive without a termination date | 10 |
| `department-without-active-employees` | department | active AND none of its employees is active (one-to-many) | 3 |
| `inactive-ministry-salary-out-of-range` | employee | active AND the ministry is inactive (two hops) AND salary below 6,000 or above 40,000 | 3 |

Each count is checked against the database by a hand-written query per example (`sql/checks/`), which shares no code with the engine and also states which condition ids match per record.

**Checks added**

- `scripts/db-check.sh`: 27 assertions in five sections (`structure`, `permissions`, `glossary`, `hebrew`, `examples`).
- `scripts/contracts-check.py` (`uv run`): five checks (the schema, the glossary, their agreement, the examples, the invalid fixtures against `errors.md`), and `--render`, which prints the rule sentence and the reasons of every example in each language the glossary lists.
- The harness runs `contracts-check` for any change under `contracts/` (pkgmap row, with tests).

## Why

The three services are written in parallel and may not import each other's code or pass SQL text. Everything they must agree on has to exist first, be exact, and be checkable without any of them: the definition shape, the business terms, the HTTP payloads, the error codes, and the records each example flags.

## How to test

```sh
cp .env.example .env                     # then set the three passwords in .env
docker compose up -d db && scripts/db-init.sh
scripts/db-init.sh                       # a second run changes nothing
scripts/db-check.sh                      # 27 passed, 0 failed (needs jq)
uv run scripts/contracts-check.py        # 5 checks passed
uv run scripts/contracts-check.py --render
node --test .claude/hooks/tests/*.test.mjs
```

## Gate output

From a clean container (`docker compose down -v` first), on the tree of the last commit. The full output is `dev/active/dc-contracts/gates/final.txt`.

```
$ docker compose down -v
exit=0
$ docker compose up -d db && scripts/db-init.sh
db-init: DataControls is ready on db,1433 (7 scripts)
exit=0
$ scripts/db-init.sh
db-init: DataControls is ready on db,1433 (7 scripts)
exit=0
$ scripts/db-check.sh
PASS examples: active-in-inactive-department on 2026-11-01: 6 records, keys and matched ids as the example expects
PASS examples: department-without-active-employees on 2026-11-01: 3 records, keys and matched ids as the example expects
PASS examples: inactive-ministry-salary-out-of-range on 2026-11-01: 3 records, keys and matched ids as the example expects
PASS examples: minor-high-salary on 2026-11-01: 3 records, keys and matched ids as the example expects
PASS examples: minor-high-salary on 2026-10-31: 4 records, keys and matched ids as the example expects
PASS examples: missing-mandatory-data on 2026-11-01: 10 records, keys and matched ids as the example expects
PASS examples: termination-before-hire on 2026-11-01: 3 records, keys and matched ids as the example expects
db-check: 27 passed, 0 failed (structure permissions glossary hebrew examples)
exit=0
$ uv run scripts/contracts-check.py
contracts-check: ok, 5 checks passed (schema, glossary, agreement, examples, invalid fixtures)
exit=0
$ node --test .claude/hooks/tests/*.test.mjs
# tests 226
# pass 226
# fail 0
exit=0
overall=0
```

## Review findings and what was done

One review over the branch by area (sql, engine, api, web, infra), five reviewers, then one fix commit (`dd6eb34`). A second, narrow review read the scope-decision diff for leftovers and contradictions; its findings are fixed in the same commit as the decision (`9b01a4b`).

| Area | Finding | Done |
|---|---|---|
| infra, critical | `contracts-check.py` ended in a traceback on a malformed glossary or schema, losing its failure lines | Fixed: guarded lookups, later checks skipped while the schema or glossary has failures, a crash becomes a failure line. Twelve malformed cases re-run |
| infra | Semantic fixtures were matched by path, not by code | Fixed: the check walks the definition with the error code of every fault; relabelled fixtures are reported |
| infra | Two functions over the size standard; one architecture line named a client code as an engine code | Fixed. The script stays one file, as planned |
| sql | The two login passwords were on the `sqlcmd` command line | Fixed: they reach `sqlcmd` through the environment |
| sql | Nothing enforced the password rule; the wait loop hid the server's error | Fixed: both scripts refuse unsafe passwords; the last error is shown |
| sql, not verified | Git Bash would rewrite the container paths in `db-check.sh` | Guard added; there was no Git Bash to prove it on |
| sql | `dbo` owns both schemas, so a view or procedure would pass the `DENY` | Documented in `sql/README.md`; no such object exists |
| api | The standards forbade any text crossing a service boundary, while the contract sends rendered sentences and reasons | Standards aligned with the contract |
| api | No state for a run whose snapshot cannot be stored; a non-object definition answered differently in the two documents; no code for an oversized body; `page` unbounded | Pinned in `api.md` and `errors.md` |
| api | `Run.rootEntity` has no column | Answered with a note (read from the version's definition); no column added |
| engine | The age rule named a field instead of the computed function; enum labels had no fallback; suggestion placeholders were defined only in the plan; number literals were unbounded | Fixed in `errors.md` |
| engine, web | A condition after a related-records clause read as part of it | The two related sentence phrases bracket their conditions |
| web | Identifier numbers got thousands separators while the search text held plain digits | `identifier: true` on those fields; written digit for digit |
| web | No code for "the api did not answer"; the public glossary had no shape table | `NETWORK_ERROR` added as a client-derived code; tables added to `api.md` |
| web, wording | Value labels disagreeing with their field label, a maqaf before a Hebrew word, two words for one check, bare prefix letters on picker labels | Fixed in the glossary |
| web, not changed | Every predicate outside the colon style is masculine singular | Left for the owner's read: the plan names today's words |
| orchestrator | `.env.example` carried working dev passwords | Emptied; the local passwords were rotated before the push. Commit `43745cc` still shows the old values in history; they open nothing |
| scope review | Stale cut numbers in three plans; a screen state and a date fallback that existed only for English | Fixed |
| scope review | The engine's Windows wheel check and its runs under Python 3.13 and 3.14 were removed with the bundle, though the from-source path needs them | Restored in the engine plan |

The seed and the six oracle queries were checked row by row by the sql reviewer and came back clean.

## Scope, as decided on 2026-11-10 before the push

- **Hebrew only.** The language mechanism is whole (texts keyed by language, `languages` and `defaultLanguage`, `Accept-Language`, the run's language); only the English values are gone. A request for a language that is not listed gets the default.
- **Suggestions are heuristics only.** No LLM lane, and no contract member that existed only for it (`source` of `/suggest`). `docs/architecture.md` §6 keeps the LLM step as a design that is not built.
- **Two delivery paths**: Docker, and short from-source instructions. The offline Windows bundle is out of the plans.
- **Web screenshots at 390 and 1440 only.**

Carried through `contracts/`, `docs/`, `.claude/` and the five plans under `dev/active/`. `README.md` was left as it is on purpose, so its line about `--render` still says "he and en".

## Decided where the plan was silent

For objection before the contract freezes:

- The path of every definition error is pinned per code in `errors.md`; a semantic error names the member the editor edits as one input.
- A number field may be `identifier: true` (employee and department numbers): written digit for digit, never with a thousands separator, as `display_text` holds it.
- The two related `sentence` phrases bracket their conditions, so a condition that follows "none of the related records" cannot be read into it.
- `is_null` reads "חסר" for every type; "ריק" belongs to `is_empty`. Numbers say "קטן מ־" and "גדול מ־" (the plan's decision 12) where the assignment says "נמוך מ" and "גבוה מ".
- A run whose snapshot cannot be stored is closed `failed` with `INTERNAL_ERROR`; `Run.rootEntity` is read from the version's definition and has no column.
- `NETWORK_ERROR` is a client-derived code; `REQUEST_INVALID` also answers 413 and 415; `page` is 1 to 1,000,000; a number literal stays below 10^15.
- Still open, not changed: every predicate outside the colon style is masculine singular, which holds only because all eighteen field labels are masculine today.

## Risks and rollback

- A contract change after this merges costs three sessions: it is one commit to `contracts/` on `main` plus one line to each. The wording in `glossary.json` is the cheapest thing to change now and the dearest later.
- `scripts/db-init.sh --reset` drops `DataControls`, and with it every session's `dq` rows; a changed seed row needs it.
- The first example depends on the run date: it holds its three records from 2026-11-01 to 2027-12-31 (`sql/README.md`).
- Rollback: revert the merge. Nothing outside this repository changes; the only state is the local Docker volume (`docker compose down -v`).

