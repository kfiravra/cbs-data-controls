# dc-web notes

## State
Phase 4 done and committed (2026-11-11, unattended night run on Kfir's word). The fixes of the phase 3 review
are the next commit, then the phase 4 review runs in the background while phase 5 is built. The dev server
runs on :4200.

## Next
1. `fix(web): review fixes` for the phase 3 review (findings in the Log), then `/phase-review web` on phase 4.
2. Phase 5: the results screen (store, summary, breakdown, table, every state).
3. Phase 6; phase 7 writes the gate specs and runs them only when the api and the engine are on main.

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

4. `vitest` is pinned to `~4.0.8` (4.0.18 installed): npm 10.9.2 crashes on the peer set of vitest 4.1.x
   ("Cannot read properties of null (reading 'edgesOut')"), so `ng new` could not install with `^4.0.8`.
5. `ng new` ran with `--file-name-style-guide=2016`, so files are `*.component.ts` and `*.service.ts` as Design A
   names them; classes carry the suffix (`BannerComponent`) and a routed screen is `*.page.ts`.
6. Specs read `contracts/` and the sources with `node:fs`. The unit-test builder bundles for the browser, so the
   test target builds with a `testing` configuration that keeps `node:fs` and `node:path` external.
7. The form field is 44px through `mat.form-field-overrides` (the height and padding of density -3), not through
   a global density of -3, which would shrink every Material component.
8. The font ships as the Hebrew and Latin subsets only (weights 400, 500, 600), as design.md says.
9. No Material component with an `*Intl` service is used (the table foot is the app's own; no sort header, no
   datepicker), so nothing is provided there and `he.json` has no `material` namespace.
10. Material's select panel has no shape token: it keeps Material's 4px (design.md asks 6px). For phase 8.
11. `npm run typecheck:e2e` type-checks the Playwright specs and the typed fixtures (Design O wants a contract
    change to break the build; Playwright itself does not type-check). It is part of every phase gate here.
12. The shell has no banner slot of its own: design.md puts a banner under the page head, so each screen renders
    its banner there (`.page-banner`).

13. `Run.status` may be `running` (api.md, `Run`), and Design L has no state for it. The results screen will show
    a neutral state panel ("the run is in progress", with reload) and a list row the same words as its last run.
14. The mocked specs get their text from a fake engine (`web/e2e/support/fake-engine.ts`): a spec builds any
    definition and `POST /controls/validate` must answer for it, and a fixture file may hold no Hebrew. It renders
    from the glossary's templates by the rules of errors.md, reads records from `sql/60_seed_hr.sql`, validates
    nothing and decides no violation (those come from each example's `expected`). It is test support, never
    shipped; `e2e/mocked/fake-engine.spec.ts` holds it to the worked example of api.md §5. The client still has
    no renderer (decision 1 of the plan). If Kfir would rather have canned JSON, the fake is one file to replace.
15. The api layer follows errors.md where the plan differs: a failed response that is not a problem is
    `NETWORK_ERROR` (Design E said `INTERNAL_ERROR`).

16. Reviews run in the background while the next phase is built (nobody is waiting on a gate tonight), so the
    order of commits is: phase N, phase N+1, the fixes of the review of N. Each fix commit holds fixes only.
17. The relationship map handles its four arrow keys itself (next follows the reading direction), without the
    CDK key manager Design B names: the group is a handful of buttons with one tab stop.
18. The related-records head reads `[mark] אין אף | יש  [relationship]  עם  [כל התנאים | אחד התנאים לפחות]`:
    Design I asks for wording without gender, and the mock's "יש לפחות אחד ... שמקיים" has two gendered words.
19. The builder's note on missing values names no comparison ("... בהשוואה שבודקת אם הערך חסר או ריק"): the
    labels of the comparisons are the glossary's, and the mock's "ריק" would be a second copy of one of them.
20. The numbering of the six examples follows `sql/README.md` (1 minor-high-salary, 2 termination-before-hire,
    3 active-in-inactive-department, 4 missing-mandatory-data, 5 department-without-active-employees,
    6 inactive-ministry-salary-out-of-range): it is the one order in which "examples 2 to 5" are the heuristic
    ones. `e2e/fixtures/examples.ts` holds it as `exampleNumber(n)`.

21. The editor has one route, `controls/:id`, where `new` is the id of a control that is not saved yet (Design D
    lists `/controls/new` and `/controls/:id`; the addresses are the same). With two route entries a first save
    would rebuild the screen; with one, the screen stays and only its address changes.
22. An archived control opened by its address shows its name, description and sentence as text, with the banner
    and "duplicate" (Design J: "read-only ... 'duplicate' as the one action"). The builder is not drawn disabled.
23. "Try again" on a failure banner of the editor reads again what could not be read (the control, the
    glossary), and otherwise asks the engine for the sentence again; a failed save is retried with Save.
24. After a save that is followed by a run that does not start, the control stays saved, the address becomes
    the control's, and the failure is the banner.

## Reconciliation with `contracts/` (phase 2, 2026-11-11)
Read: `api.md`, `errors.md`, `glossary.json`, `control-definition.schema.json`, the six examples and the thirteen
invalid fixtures, as merged in `f9928bf`. Where they differ from Design E to M of the plan, the contracts were built:

- Design E: a response that is not a `Problem` is `NETWORK_ERROR`, not `INTERNAL_ERROR` (errors.md, Codes).
  `GLOSSARY_MISMATCH` and `DEBUG_DISABLED` are engine-only and never reach the client; they have texts in
  `he.json` because the key guard asks one for every code of the table, and no screen expects them.
- Design K: `GET /controls` searches the name only, so the search field says "by name" (the mock said "name or
  description"). The route's `entity` and `state` map to `rootEntity` and `active` (`true`, `false`, `all`).
- Design L: `Run.status` may be `running` (decision 13 above). The route's `size` maps to `pageSize`.
- Design F: `cardinality` may also be `one_to_one` (errors.md, `PATH_NOT_TRAVERSABLE`), so a path follows every
  relationship that is not `one_to_many`.
- Design J: a `400 REQUEST_INVALID` on the name or the description is not mapped to its field; the editor
  checks both itself (required, 200 and 1000 characters) and a 400 is the general banner.
- Design P, the three facts: reason `params` hold keys and raw values (api.md, `Reason`); `GET /controls/{id}`
  and its versions answer for an archived control ("archived ones included"); the public glossary serves
  `comparable`, `limits` and `formats`. All three hold.
- Nothing in `contracts/` looked wrong, and nothing blocks a screen: no line for Kfir from this step.

## Last reviewed
d57b922 (phase 2), fixed in the `fix(web): review fixes` commit after e517490. Phase 3 (e517490) is under review.

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
- 2026-11-11 cost lines, started without waiting (decision 2 above): npm install for the scaffold (316 MB after
  the first install), Chromium headless shell 1254 for Playwright 1.65 (126 MB), `ng serve` kept running on :4200.
- 2026-11-11 phase 1 on Fable 5.2: gate `gates/phase-1.txt` (ngc, ng lint, e2e type check, 11 unit tests, ng
  build, print guard, `e2e/mocked/shell.spec.ts` on mobile and desktop: 4 passed). Screenshots in
  `screenshots/phase-1/`. The Material theme compiles; no screen draws a themed field yet (phase 3 is the first).
- 2026-11-11 /phase-review web, phase 1 (one reviewer agent, opus; cost line: about 180k tokens, started without
  waiting), diff 459782e..ab0d004: standards 1 critical, 4 warnings, 3 info; plan 1 critical, 1 warning, 3 info.
  `toast.service.ts`: `horizontalPosition: 'start'` without `direction` is the left edge, the end edge in RTL
  (critical). `toolbar.component.ts`: `distinctUntilChanged` swallowed a term typed again after the search was
  cleared from outside (critical). `table-foot.component.ts`: `[attr.aria-label]` on `mat-select` is overwritten by
  the select's own host binding (warning). Icon buttons of the table foot, the toolbar and the confirm dialog had
  no tooltip (warning). Banner, toolbar, confirm dialog and toast had no spec (warning). Literal sizes off the
  scale in `_tables.scss`, `_builder.scss`, `material-theme.scss` and the table foot (warning).
  `material-theme.scss`: the `mat-chip-row` background lost to Material's own rule (warning). Info: the state
  panel's title was always `h2`; `BannerTone` repeated `StateTone` with two tones no banner uses; the font check
  tested only the Latin face; three unused keys in `he.json`; two npm scripts for files that do not exist yet;
  the English `<title>` in `index.html`. Fixed in the review-fix commit: all criticals and warnings (the toast is
  given the direction; the toolbar emits every settled text; the select takes `aria-label` as its input; tooltips
  added; four specs added; the flagged sizes now come from tokens; chips take `elevated-container-color`), and
  the info items except one. Left: `index.html` keeps `<title>Data Controls</title>`, the product's English name,
  shown only until the translated title is set (a Hebrew title there would put Hebrew outside `he.json`); other
  dimension literals that design.md itself gives (1px lines, the 2px outline, chip and spinner sizes, the
  value's `1px 6px`) stay as they are.
- 2026-11-11 phase 2 on Fable 5.2: gate `gates/phase-2.txt` (ngc, ng lint, e2e type check, 129 unit tests in 20
  files, ng build, print guard, `e2e/mocked` on mobile and desktop: 10 passed). The pure logic (`core/definition`,
  `core/text`, the glossary lookups) has its specs beside it; for the operations, the draft check, the field
  rules, the pointer and the text parts the specs were written and seen red before the code, one module at a
  time; for the draft, the marks and the lookups spec and code were written in one step. No screen draws a
  themed Material field yet.
- 2026-11-11 phase 3 on Fable 5.2: gate `gates/phase-3.txt` (ngc, ng lint, e2e type check, 162 unit tests in 22
  files, ng build, print guard, `e2e/mocked` on mobile and desktop: 26 passed). `builder.spec.ts` builds examples
  4, 5 and 6 through `e2e/support/builder-driver.ts`, example 5 with the keyboard alone. Screenshots in
  `screenshots/phase-3/` (`builder-example-5`, `builder-example-6`, `builder-deep-tree` at 390 and 1440): the
  first screens that draw themed Material fields. `docs/design.md` updated for the related node's letter and
  head, the map's link labels and the note. No cut taken.
- 2026-11-11 /phase-review web, phase 2 (one reviewer agent, opus; cost line: about 250k tokens, started without
  waiting), diff 1dda6d3..d57b922: standards 1 critical, 4 warnings, 7 info; plan 1 warning, 1 info.
  `draft.check.ts`: `canAddNested` let a related node in at one node under the limit, though it brings two (itself
  and its first row), so a draft could reach 31 nodes (critical). `draft.check.ts` / `draft.ts`: two spellings of
  one number in a list ("1,000", "1000") passed the check and were sent twice, which the schema rejects (warning).
  `format.service.ts`: `when` counted days in 24-hour spans, wrong by a day around a clock change (warning).
  `glossary.lookups.ts`: `mapFor` draws only the relationships between neighbours while its comment claimed no
  assumption about the graph (warning). `condition.rules.spec.ts`: the branch for an operator of the same arity
  that cannot compare fields was never run (warning). `_mark.scss` / `text-parts.component.ts`: a `value` part
  ("15,000 ₪") could wrap between number and unit, against "keep a value part on one line" (plan warning). Info:
  the text-parts component trimmed the first part; `draft.spec.ts` recomputed `highestId` the way the code does;
  `api.spec.ts` named a case it did not test; `parseNumber` read "1,5" as 15; `GlossaryEntity.description` was
  optional; the enum label lookup was case-sensitive; the fake api wrote a new token for an unchanged save and
  the suggestion fixture took names from the example files; `api.types.ts` lacks `ControlVersionSummary` and the
  health shape; Design F's `unit(field)` does not exist. Fixed in the review-fix commit: the critical and every
  warning (`canAddGroup` and `canAddRelated` replace `canAddNested`; a list is sent once per value; days are
  calendar days; values with their unit are one unbroken span; the rules spec reaches the branch through a new
  operator of the synthetic glossary), and the info items except three. `mapFor` keeps its one-row model: its
  comment and design.md now say that only neighbours are linked and the sentence under the map lists the rest.
  Left: no test at a clock change (the spec cannot set the zone of the machine); `ControlVersionSummary` is not
  mirrored because no screen reads the version list (the health shape comes with the gate fixture in phase 7);
  no `unit(field)` accessor, since it would only return `field.unit`.
- 2026-11-11 phase 4 on Fable 5.2: gate `gates/phase-4.txt` (ngc, ng lint, e2e type check, 196 unit tests in 23
  files, ng build, print guard, `e2e/mocked` on mobile and desktop: 60 passed). `editor.store.spec.ts` holds the
  validate loop (nothing sent for an unfinished draft, 400ms, an older request cancelled, no dimming while
  waiting), the save states and the §13 test of errors to rows; it found one defect before the commit (a reload
  after a conflict did not ask for the sentence again). `editor.spec.ts` covers new, stored, unfinished, a 422 on
  a row, conflict, outdated on load, engine down, glossary down, archive, an archived control, duplicate, the
  root change with its undo, the trace and `beforeunload`. From here `builder.spec.ts` compares the definition
  the editor validates with the example's, node for node. Screenshots in `screenshots/phase-4/`. The stale
  token is white at 72% (`#ffffffb8`), measured 4.86:1 on Action. No cut taken: the settle is built.
