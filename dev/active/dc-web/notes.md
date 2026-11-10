# dc-web notes

## State
Phase 1 in progress (2026-11-11, unattended night run on Kfir's word). Phase 0 was done by Kfir: the worktree
`../cbs-web` on `feat/web` is cut from main at `f9928bf`, which already holds dc-contracts (#1), `docs/design.md`
and `docs/PRODUCT.md`; this folder came from git, `.env` and `.claude/settings.local.json` are in place.

## Next
1. Phase 1: scaffold `web/`, tokens, shell, i18n, the shell spec.
2. Phases 2 to 6 in order, each with its review, fix commit and ticks.
3. Phase 7: write the gate specs; run them only when the api and the engine are on main.

## Blockers
- Phase 7 runs (the gate on the real stack, the pre-load, the hosted build): the api and the engine are not on
  main (`git log main` ends at `f9928bf` on 2026-11-11). Kfir's word for tonight: wait for the merge, start no
  service from another worktree.

## Decisions taken unattended (2026-11-11, Kfir asleep: "decide, write it in notes.md, continue")
1. The session runs on Fable 5.2, not Opus as decision 21 says: a session cannot switch its own model and nobody
   is awake to do it. Reviewer and critique agents stay on opus.
2. A cost line (npm install, a Playwright run, a reviewer, a critique) is written to the Log and the run starts
   at once; nothing waits for a word tonight.
3. Phase 2's `git merge main` is a no-op: the branch was cut after dc-contracts merged.

## Last reviewed
(none)

## Hand-over to dc-delivery
Read by its phase B0 (plan.md Design Q). Filled as the work goes and complete before `/ship`.

- Its asks of 2026-11-10. (1) The gate specs also run at `E2E_BASE_URL=http://localhost:5000` on a list that holds
  the six examples under their real names; no empty list assumed, no control found by a bare name: planned
  (decisions 22, 25 and 27; Design O), nothing built. (2) Documents and Log: planned (decisions 23, 24 and 26;
  Design Q).
- As built: (at the gate, ten lines at most: the gate command, the projects, the screenshot folder and the five
  gate shots, the build output folder, whether the gate ran on a pre-loaded list and on the hosted build, what
  this task left in the dev `dq`)
- Cuts: (none yet; each one with the sentence dc-delivery must write about it)

## Docs for dc-delivery
Kept as the work goes (plan.md decision 23, Design Q) and copied into the PR body under this heading at `/ship`.
The entries below come from the plan, before any code: check each against the documents on main and against what
was built, drop what did not happen, add what did.

- `docs/architecture.md` §8 (screen 2, the component list) and §13 ("preview sentence"): the client has no
  sentence renderer. The editor draws the engine's sentence from `POST /controls/validate`, called 400ms after the
  last edit, and keeps the last valid sentence, dimmed, while a row is incomplete (decisions 1 and 2). The focused
  test is that validate loop.
- `docs/architecture.md` §8, screens 1 and 3: archiving is an action of the editor's page head, and the list has an
  archived view (decision 17; the view is the first cut). A definition that no longer fits the glossary is the run
  error `CONTROL_DEFINITION_OUTDATED`, and the screen names the condition by its mark (decision 15).
- `docs/architecture.md` §8 and §13, and the README's tests part: the e2e has two folders, `e2e/mocked` on
  Playwright route fixtures with no service and `e2e/gate` on the real stack; the commands are in
  `web/README.md`. §8 promises screenshots at 390, 1024 and 1440 at every gate: 1024 is the third cut.
- `docs/assumptions-limitations-extensions.md`: an archived control cannot be restored, only duplicated (decision
  6); a dirty draft is guarded by the browser's own prompt, with no dialog of the app (decision 17); dates are
  typed into the browser's date input (decision 11); the client is tested in Chromium only; a run made in the
  other language shows its text as stored; and every cut taken from decision 7.
- README, the demo walkthrough: with the examples loaded, the suggestions made without a key repeat controls the
  list already holds (plan.md Risks).
- `.claude/CLAUDE.md`: "Where to read" has no row for `docs/design.md` (decision 26). The gotcha "the client
  renders the text" no longer holds for rule sentences and reasons, which arrive rendered by the engine.
- `docs/ai-usage.md`: the Log below.

## Log
A review's line follows plan.md Design Q: who reviewed and on which model, the diff range, findings per axis and
severity, each critical and warning by file, what the fix changed, what was left and why, what Kfir rejected or
rewrote. A review that found nothing, or did not run, is logged as that.

- 2026-11-10 created plan on Fable 5.2. Interview in two rounds and two messages from Kfir: eight decisions (plan.md 1 to 8).
  Kfir overrode my recommendation of a client-side renderer: the engine returns parts and the client only draws.
  The start moved from "now" to "after the docs+infra commit on main", with the worktree cut from that main.
- 2026-11-10 asks for dc-contracts, carried by Kfir (plan.md Design P): the Hebrew date pattern `dd.MM.yyyy` and
  name-first `identifyingFields` with `display_text` defined. Neither was in the dc-contracts plan at 19:54. A
  restore endpoint was declined.
- 2026-11-10 19:54 "Amendments from dc-engine planning" landed as Design H of the dc-contracts plan, and this plan
  was aligned with it: `TextPart { text, nodeId?, role? }`; marks from the definition of the version that ran,
  because `conditions[]` lists only the nodes a run can match (H4c), so the ask to widen that list is withdrawn;
  the `comparable` flag; `limits.maxTotalValues`; how depth and conditions are counted. Also read from the dc-api
  plan: `PUT` on an archived control is 409, `sort=key` is `seq`, the SPA fallback exists.
- 2026-11-10 found while orienting: `Skill(dc-web)` fails with "Unknown skill" until a file under `web/` is touched
  (read `.claude/skills/dc-web/SKILL.md` instead). The suite guard's `pgrep` pattern matches the Playwright MCP
  server of every session (`playwright-mcp`); use `playwright test` in the pattern.
- 2026-11-10 machine facts: Angular CLI 21.2.29, node 22.16, npm 10.9, .NET 10.0.114; on npm the 21 line is core
  21.2.26, Material and CDK 21.2.14, angular-eslint 21.4.0, and `@ngx-translate/core` 18.1.0 accepts Angular 18 and
  up; Playwright 1.65.0 is current and Chromium builds up to 1252 are cached in `~/.cache/ms-playwright`; ports
  4200, 5000, 8000 and 1433 were free and no container was running.
- 2026-11-10 21:33 amended the plan on Fable 5.2, on Kfir's message carrying two asks from the dc-delivery session.
  (1) The gate specs also run at `E2E_BASE_URL=http://localhost:5000` on a list that holds the six examples under
  their real names; no spec assumes an empty list or finds a control by a bare name (decision 22). (2) The §17
  documents, `docs/submission.he.md` and the README outside this task's part are dc-delivery's, drift goes into the
  PR body under "Docs for dc-delivery", and the Log stays factual (decisions 23 and 24). Read for the facts:
  `dev/active/dc-delivery/plan.md` as of 21:10 (its loader finds a control by exact name with `active=all` and
  never runs it; its phase B1 runs `e2e/gate` on `mobile` and `desktop`; its decision 27 takes five README
  screenshots from that run) and `dev/active/dc-api/plan.md` as of 21:21 (health is always 200; names are not
  unique; the list is ordered by name; `wwwroot` sits beside the executable). Mine and not asked (decisions 25 to
  27): the tag and id rules of Design O; `docs/design.md` kept with this task; a suggestions spec in the gate; the
  pre-load and three more gate runs in phase 7, which grew by 0.15 day. Found while reading: with the examples
  loaded, the suggestions made without a key repeat the rules of examples 2 to 5 (plan.md Risks); step 3 of
  `/ship` tells a session to apply documentation edits itself and its PR body has four headings, which decisions
  23 and 26 override for this task. No review has run on this plan in Claude Code.
- 2026-11-11 resumed on Fable 5.2 for an unattended run to the final gate, on Kfir's pasted instructions: no
  questions, no stop at phase gates, decisions written here, steps that need the api or the engine wait for their
  merge, the shared SQL Server container is never touched, `contracts/` is frozen, scope is the plan as it is,
  push and PR only if the gate passes (his word given in that message), no merge. Phase 0 found done on disk.
