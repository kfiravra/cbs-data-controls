# dc-ai-suggestions notes

## State
Planned, not started. The plan was written on 2026-11-12 from Kfir's brief, without an interview. Decisions 1 to 9
are the brief; decisions 10 to 23 are the planner's and wait for his objection. Nothing of this task is in the
repository: no `advisor/`, no contract line, no table. Branch `feat/ai-suggestions` does not exist.

## Next
1. Kfir reads plan.md decisions 10 to 23 and Design F (how example 1 is judged), and objects or lets them stand.
2. After the submission is handed in and dc-delivery has merged: switch to Opus, `/resume dc-ai-suggestions`,
   Phase 0.
3. Phase 1: the contract commit on main, on Kfir's word, then `git switch -c feat/ai-suggestions`.

## Blockers
- The submission of 2026-11-15: phase 1 turns main's api suite red until this branch merges (decision 10).
- dc-delivery must merge first: `docker-compose.yml` has no `engine` or `api` service yet.
- Phases 5 and 6 need a model endpoint from Kfir (a Vertex AI project and region, or a gateway address and key)
  and his word on the spend. Phases 1 to 4 need neither.

## Last reviewed
(none)

## Log
- 2026-11-12 created plan from the owner's brief, without an interview, by the dc-delivery session.
