# dc-contracts notes

## State
Phase 0 not started. The plan was written on Fable on 2026-11-10; execution is for Opus. Branch `feat/contracts`
exists (cut from main at 2303d2f, which is pushed) and has no commits of its own. No container is running and the
SQL Server image is not pulled yet.

An untracked `docs/PRODUCT.md` is in the tree. It belongs to the design session of kickoff §4 (`/impeccable`,
written 2026-11-10 14:57), not to this task: stage this task's files by name and leave it out of every commit here.

## Next
1. Switch the session to Opus and run `/resume dc-contracts`.
2. Phase 0: the two text fixes in `.claude/skills/task-plan/SKILL.md` and `.claude/README.md`, the hook tests, the
   commit.
3. Phase 1 starts with `docker compose pull db` (about 1.6 GB on disk the first time): state it and wait for the word.

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
