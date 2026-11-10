# dc-contracts notes

## State
Executing the whole task in one run on Fable 5.2 (Kfir's word, 2026-11-10): three Opus lanes in the main tree
(lane 1: phase 1; lane 2: phase 2; lane 3: the phase 4 documents) beside the orchestrator's phase 3. No per-phase
review; one review over the branch at the end, then the Gate, the push and the PR. No merge.

In the tree, uncommitted: the six examples (`contracts/examples/`), the six oracle queries (`sql/checks/`), the
decision-3 harness lines, architecture §4.3. The seed is drafted outside the tree (session scratchpad) until lane 1
finishes, because `db-init.sh` runs every `sql/NN_*.sql` it finds.

## Next
1. Lane 1 reports: check its verify output, commit phase 1 (task folder and `.gitignore` staged by name).
2. Lane 2 reports: add the `glossary` section of db-check, commit phase 2 with architecture §4.3.
3. Phase 3: seed into `sql/`, db-check `hebrew` and `examples`, contracts-check 4 and `--render`, `sql/README.md`.
4. Phase 4: check 5 over lane 3's files, CLAUDE.md rows, the remaining architecture lines, the README section.
5. One review by area, one fix commit, the Gate from a clean container, push, PR. Show Kfir the `--render` output.

Held for the review-fix commit (found by the orchestrator, not by a reviewer):
- `.env.example` carries working passwords. `/ship` step 2 stops on `MSSQL_SA_PASSWORD=` with a value and the
  dc-delivery plan (decision at its line 44) wants placeholders: empty the three values, and say in the README quick
  start that they are set after the copy. The local `.env` keeps its values.
- The `/run` example of `api.md` uses invented names and wording: align it with the seed (1051, 1052) and with the
  glossary's real templates once lane 2's glossary is in.

## Blockers
(none)

## Last reviewed
(none)

## Log
- 2026-11-10 created plan. Interview in two rounds, seven decisions by Kfir (plan.md Decisions 1 to 7); `main`
  pushed (`fce7685..2303d2f`) on Kfir's word and `feat/contracts` cut from it.
- 2026-11-10 found while orienting: `Skill(dc-sql)` fails with "Unknown skill" because the four `dc-*` skills are
  path-scoped and no file of their area exists yet. Read the `SKILL.md` files directly; Phase 0 fixes the
  instruction in `/task-plan`.
- 2026-11-10 machine facts: Docker 29.9, compose v5.6, uv 0.11, jq 1.7, node 22, .NET 10.0.114, no host `sqlcmd`,
  port 1433 free, port 8000 held by another project's container (not needed in this task).
- 2026-11-10 amended during `/task-plan dc-engine`, on Kfir's word: plan.md decisions 26 to 29, Design H (which
  wins over B to F), one new step in each of phases 2, 3 and 4, two architecture steps reworded, one risk line.
  Nothing was executed. The engine plan (`dev/active/dc-engine/plan.md`, Design J) assumes exactly these shapes.
- 2026-11-10 amended during `/task-plan dc-api`, on Kfir's word: plan.md Design I (it adds to E and F; where it
  and H both speak of the `SCHEMA_VIOLATION` path, H4a holds), one new step in each of phases 2 and 4. Nothing was
  executed. The api plan (`dev/active/dc-api/plan.md`, Design H) assumes exactly these lines.
- 2026-11-10 phase 0 done on Fable 5.2, inside `bce225b` on main (`docs: design, product and task plans;
  chore(claude): track task folders`, pushed on Kfir's word): `/task-plan` reads the `dc-*` skills by file and the
  README row says "or by reading the file". The same commit tracks the task folders (`.gitignore`, CLAUDE.md,
  `/task-plan`, `/ship`) and narrows the suite guard to `playwright test`. Hook tests 224 pass, 0 fail:
  `gates/phase-0.txt`. No review ran, as the plan says for this phase. `feat/contracts` fast-forwarded to `bce225b`.
- 2026-11-10 phase 1 done (lane 1 on Opus, verified again by the orchestrator): `gates/phase-1.txt`, db-check 13
  passed, 0 failed, a second init changes nothing. Differences from Design A, all kept: a refused CREATE TABLE is
  error 262 (229 is for objects), so db-check asserts 262; one more index, `IX_Run_control_id_control_version`, for
  the composite FK; `platform: linux/amd64` in compose; db-check also asserts the server collation, the index set and
  that `public` holds nothing; `.env.example` carries working dev passwords (dc-delivery wants them empty later).
  Hebrew round trip through db-init and db-check proven before the seed: `-f 65001` in, UTF-8 out. Not verified:
  shellcheck (not installed), bash 3.2, a host sqlcmd, SSMS. No review here: one review at the end, on Kfir's word.
- 2026-11-10 phase 2 done (lane 2 on Opus; the db-check `glossary` section and architecture §4.3 by the
  orchestrator): `gates/phase-2.txt`, contracts-check 3 checks passed, db-check 16 passed, hook tests 226 pass.
  The schema says "exactly one of value or right" with two `if`/`then` pairs and no `not`, `anyOf` or `oneOf`;
  `allOf` holds the list of `if`/`then` pairs. `jsonschema` is pinned to 4.26.0. Lane 3 reported that 4.26.0 puts
  a member forbidden with `properties: { member: false }` at the member; checked by the orchestrator against the
  final schema on 4.26.0 and 4.25.1: one error at the node in both, all five schema-layer fixtures at their expected
  path, so the schema stays. Lane 2 also ran JsonSchema.Net 8.0.5 in a scratch console app: 41 cases agree with
  Python after the api's three corrections. db-check `glossary` also asserts the type family per stored field and
  that `dq_engine_ro` sees `hr` alone. For Kfir's read at the Gate: numbers say "קטן מ" and "גדול מ" (decision 12)
  where the assignment says "נמוך מ" and "גבוה מ"; `is_active` is labelled "סטטוס"; a two-hop path names the last
  relationship only ("סטטוס של המשרד"). For the engine session: the glossary has entity `description` and field
  `label` and `description`, which its plan's list (Design J) leaves out; `arity` is 0, 1, 2 or the string "list".
- 2026-11-10 phase 3 done (orchestrator, Fable 5.2): `gates/phase-3.txt`, db-check 27 passed, 0 failed over five
  sections after `db-init.sh --reset` and a second init; contracts-check 4 checks passed. Seed: 5 ministries, 16
  departments, 85 employees; expected totals 3 (4 on 2026-10-31), 3, 6, 10, 3, 3, each matched by its hand-written
  query; the first example holds its three records to 2027-12-31 and drops to two on 2028-01-01. Seed sanity: 22 of
  25 terminations on or after the hire date (21 after, 1 same day, 3 before). Choices of the orchestrator: only
  department 204 has no manager, so the engine's `missing_optional` has one record to find; the oracle returns
  `key|name|matched ids` (the flags per condition id live in its CTE); examples omit `path` for a field of the
  scope's own entity; `--render` takes the actual values of its reasons from a small table in the script (the
  first planted record per example). Check 4 was mutation-tested: 19 mutations of the examples, each reported.
  Phase 3's verify used `--reset` instead of `down -v`; the clean-container run is the Gate's.
