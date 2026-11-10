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
