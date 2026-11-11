# dc-web notes

## State
Phases 1 to 6 are done and committed; the gate specs of phase 7 are written and committed, and its four steps
on the real stack wait for the api and the engine to reach main (2026-11-11, unattended night run on Kfir's
word). The fixes of the phase 6 review are the next commit, then phase 8 on the mocked screens. The dev server
runs on :4200.

## Next
1. `fix(web): review fixes` for the phase 6 review (findings in the Log).
2. Phase 8: `/impeccable audit`, `critique` and `polish` on the mocked screens, the keyboard pass,
   `web/README.md`, the hand-over.
3. When the api and the engine are on main: `git merge main`, then the four waiting steps of phase 7 (the gate
   on the real stack, the fixes its payloads ask for, the pre-loaded list twice, the build the api hosts).

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

25. The results show an identifying field per column, in the glossary's order, and on a phone the same cells
    share the card's first line (design.md draws two columns, name and number; the glossary now has three
    identifying fields for an employee and any number for another entity).
26. "What was checked" in the summary is the plural label of the root entity alone ("נבדקו: עובדים"), and the
    no-violations text says "כל הרשומות ({{entity}})": the mock's "כל העובדים" would need a definite article
    glued to a glossary label.
27. A duration is counted as it is shown: a fraction takes the general plural form ("0.4 שניות"). Hebrew plural
    rules put 0.4 in the same category as 1, which gave "שנייה אחת" for 412 ms before the phase gate.
28. The sort is offered on the first identifying column only (the api sorts by the whole identifying text,
    `sort=display`), and on a phone from a select behind the toolbar's filter button.

29. The list asks for the suggestions dialog through a token (`core/suggestions/suggestions-opener.ts`) that
    the application provides from `features/suggestions`: Design A forbids one feature importing another, and
    Design M opens the dialog from the list. The dialog is loaded when it is first opened.
30. The list has a fixed page of 25 with previous and next, no page-size select (Design K says "paging").
31. `e2e/preview.ts` is a Playwright test that skips itself unless `PREVIEW=1` (`npm run preview`): it shares
    the in-memory api of the mocked specs, which a plain node script cannot import.
32. The dev server Playwright starts runs with `--prebundle=false`: with prebundling, the first time a lazy
    screen brings a dependency the server has not bundled, it reloads the page in the middle of a test (seen
    once here, on the first run after the suggestions dialog was added: four mobile tests lost their dialog).

33. The gate specs were dry-run once on a stand-in, not on the real stack: a temporary script (never
    committed, deleted after the run) served the in-memory api of the mocked specs over HTTP on :5000, behind
    the dev server's proxy. It is not the gate: the stand-in renders with the fake engine and flags the
    records each example expects. It checks the specs themselves (flow, locators, tags, teardown, the health
    fixture), which nobody could otherwise run before dc-delivery.
34. The list's name link has the test id `control-link`; `control-name` is the editor's name field alone. The
    dry run found the clash: the gate's list spec read the list's link where it meant the editor's field.

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
3474145 (phase 5), fixed in the `fix(web): review fixes` commit after 383ec73. Phase 6 (383ec73) is under review.

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
- 2026-11-11 /phase-review web, phase 3 (one reviewer agent, opus; cost line: about 175k tokens, started without
  waiting), diff d57b922..e517490: standards 3 warnings, 3 info; plan 1 critical, 3 warnings, 3 info.
  `condition-group.component.html`: the related-records adder was allowed at one node under the limit (critical;
  the same defect the phase 2 review found in `canAddNested`, already fixed in a1682ae before this review was
  read). `field-picker`, `operator-picker`, `related-node`, `value-input`: `[attr.aria-invalid]` on a Material
  control loses to Material's own host binding when the control is drawn already invalid (warning).
  `builder-driver.ts`, `builder.spec.ts`, `condition-builder.component.ts`: elements found by chains of CSS
  classes, against "by role and test id" (warning). `condition-row.component.html`: the remove button came
  before the field in the DOM though it is last on the line, and the three inputs had the same name in every row
  (warning). `value-input`: a date input emptied the draft and wiped the half-typed date while one part of it was
  being changed (warning). `builder-driver.ts`: keyboard mode clicked for a list of enum values, and no test
  tabbed through a row or typed by keyboard (warning). `builder.spec.ts`: `expectBuilt` would pass with a wrong
  operator, value or nesting (warning). Info: the traced node in the view object rebuilt every row's lists on
  hover; a third copy of the key-or-id lookup; `sentence-field` unused at that commit; focus after a removal
  went to the first row of a group above, and to the adders when a first row was removed; a related node kept
  its rows when its old relationship had left the glossary; the map drew a connector where design.md says there
  is no link; spec gaps (chips, the enum multi-select, an emptied input). Fixed in the review-fix commit: the
  `appInvalid` directive sets Material's error state, so `aria-invalid` and the outline follow; rows, adders
  and the all/any control carry the key of their group (`data-parent`, `data-adder-of`, `data-op-of`) and marks
  a test id and their state, and the driver, the specs and the focus code use them; the row reads field,
  comparison, value, remove and is a named group; a half-typed date is not an edit and goes back to the last
  whole date on blur; the driver fills an enum list with keys, `builder.spec.ts` builds examples 1 and 2 by
  keyboard and tabs through a row; `nodeName` is one function; focus goes to the row just above, else to the
  row that takes the place; the relationship reset and the map connector; the unit tests named. `expectBuilt`
  had already been strengthened in phase 4 (the validated definition equals the example's, node for node).
  Left: the driver still focuses a control before working it with keys (it proves each control works by
  keyboard; the tab order of a row has its own test, and the pass through the whole flow is phase 8).
- 2026-11-11 phase 5 on Fable 5.2: gate `gates/phase-5.txt` (ngc, ng lint, e2e type check, 238 unit tests in 26
  files, ng build, print guard, `e2e/mocked` on mobile and desktop: 94 passed, 2 skipped by project on purpose:
  the header sort is a desktop test and the sort select a phone test). `results.spec.ts` covers a run with
  violations (marks per record against each example's `matched`), the breakdown filter, search and its
  no-match state, paging and a reload by address, sort, the trace, no violations, the cap, timed out, outdated
  by mark, failed otherwise, running, run again with skeleton rows, loading, not found and an archived
  control. Screenshots in `screenshots/phase-5/`. `docs/design.md`: the States table now has the rows of
  decisions 15 and 16, and rows for a run that failed otherwise, a run in progress, an archived control and
  not found. No cut taken: the sort is built.
- 2026-11-11 /phase-review web, phase 4 (one reviewer agent, opus; cost line: about 170k tokens, started without
  waiting), diff a1682ae..5a57791: standards 3 info; plan 2 critical, 5 warnings, 2 info.
  `control-editor.page.ts` with `editor.store.ts`: "try again" after a failed glossary read did nothing for a
  stored control, because `open` returned early for the control it already held (critical). `editor.store.ts`:
  removing a row left the server's error for it in place, and the status line kept naming it (critical). A
  sentence that came back did not take the engine banner away (warning). The first-sentence flag was cleared by
  a 503, so a retry never flagged an outdated control, and it survived an unfinished draft, so the user's own
  422 could show as "outdated" (warning). A first save and run navigated to the results before the address was
  replaced, leaving `/controls/new?from=` in the history (warning). `open` had no guard against an older call
  landing after a newer one (warning). Edits typed while a save was on its way were overwritten and lost their
  `beforeunload` guard (warning). Info: live errors did not open their mark, and design.md said a refused draft
  is not asked about; a description-only issue focused the name; a test read its expected mark from the store;
  the store was over 500 lines and packed its validate key into a string. Fixed in the review-fix commit: all
  of them. `open(target, again)` reads everything once more on a retry and on a reload, and counts its turns;
  an edit drops the errors of the row it edits and of rows that are gone; `sentenceFailure` is its own signal,
  cleared by the next sentence; the first-sentence flag ends on a sentence, a 422 or the first edit; the
  address is replaced before the results are opened; a save keeps what was typed during it and stays dirty;
  the store's types and its messages moved to `editor.types.ts` and `editor.messages.ts`, and its spec was
  split in two over `src/testing/editor-store.ts`. Nine tests added for these cases (unit and mocked e2e).
- 2026-11-11 phase 6 on Fable 5.2: gate `gates/phase-6.txt` (ngc, ng lint, e2e type check, 275 unit tests in 30
  files, ng build, print guard, `e2e/mocked` on mobile and desktop: 134 passed, 2 skipped by project on
  purpose). `list.spec.ts`: the first screen of the delivered system (six examples, none run), a run in place,
  the result cell in its forms, search and its no-match state, the entity and state filters with the archived
  view, edit and duplicate, first use, paging, loading, and failures. `suggestions.spec.ts`: the drafts with
  marks and nothing saved or run, create selected, open in editor, a refused draft, empty and failed, focus
  kept inside and returned. Screenshots in `screenshots/phase-6/` (`list-delivered` is the first screen of the
  delivered system). `docs/design.md`: the archive confirmation without a restore, and the suggestions dialog
  as built. No cut taken: the archived view and "open in editor" are built.
- 2026-11-11 /phase-review web, phase 5 (one reviewer agent, opus; cost line: about 177k tokens, started without
  waiting), diff de43850..3474145: standards 6 warnings, 1 hard violation, 3 info; plan 1 warning, 2 info.
  `run-results.page.html`: the trimmed search was written back into the search field, eating a space the user
  had just typed (warning; the list page did the same). `results.store.ts`: opening another run neither dropped
  the rows request of the run that was left nor guarded against an older `open` landing late, so rows or a
  failure of run A could stand under run B (warning). `run-results.page.html`: a glossary that could not be
  read was not said, and without it a record's number got separators (warning). `results-table`, `breakdown`:
  a node without a mark drew an empty mark box named "תנאי " (warning). A first page of rows that failed left
  skeleton rows waiting forever (warning). `docs/design.md`: the archived row promised a Warning banner with
  "Duplicate" on the results, the code showed a Danger banner whose "try again" reloaded (warning).
  `run-results.page.ts`: an `effect` wrote `loadState` from the address, a derived value (hard violation,
  typescript.md). The no-violations state dropped the run summary, against Design L (plan warning). Info:
  `counted()` repeated the plural pipe; the breakdown had its own number format; identifying text after the
  first column was drawn as metadata; spec selectors by class, a test name that claimed more than it tested, a
  hover read without retry, a fixture path that did not match its node; no screenshot of the running, loading
  and not-found states; two States rows beyond what the phase asked. Fixed in the review-fix commit: all of
  them. The search goes to the address as typed (both screens); the store counts its opens and drops the rows
  request on a new one; the glossary banner stands on the results and a number without a glossary field is
  written digit for digit; no mark, no box; the table waits only while a request is on its way; a refused
  re-run is its own failure (a Warning banner for an archived control, else "try again" runs again) and
  design.md says that; not-found from the address is a `computed` in the results page and in the editor page;
  the summary stands for a clean run; `CountedService` is the one place for counted text. Eleven tests added.
- 2026-11-11 phase 7 on Fable 5.2, the part that needs no service: `e2e/support/gate.ts` (the health check as
  a worker fixture, a tag per test, the ids a test created, archive in the teardown) and `e2e/gate/`
  `examples.spec.ts`, `list.spec.ts`, `suggestions.spec.ts`, written to Design O. Not run on the real stack:
  `git log main` ends at `f9928bf`, the api and the engine are on `feat/api` and `feat/engine`, and nothing
  listens on :5000 or :8000. Dry run on a stand-in (decision 33; cost line: about four minutes of Playwright,
  started without waiting): first run 2 of 16 passed and showed two things, a test id shared by the list's
  name link and the editor's name field (fixed, decision 34) and a fake that knew an example only by its exact
  ids (the fixture now compares node for node, `expectedFor`); second run 16 of 16 on mobile and desktop with
  one worker. After it the stand-in held 24 controls: the 6 untagged ones still active, never run and at
  version 1, and 18 tagged ones, all archived. With no health answer the fixture stops every test with one
  line ("the gate needs the api, the engine and the database: ... did not answer"). Waiting for the merge: the
  gate on the real stack, fixes from real payloads, the pre-loaded list twice, the build the api hosts.
