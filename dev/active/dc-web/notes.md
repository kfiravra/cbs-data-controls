# dc-web notes

## State
All eight phases are done (2026-11-11). Phase 7 ran in the morning on Kfir's word: `origin/main` (`eec007d`, the
engine and the api) merged into `feat/web`, both services started from this worktree against the shared
database, the gate specs green on the real stack, on the pre-loaded list twice and on the build the api hosts.
The six examples are in the dev `dq` under their Hebrew names. Kept by Kfir (2026-11-11): decision 38, the leave
prompt; the four items the critiques left open stay open, and dc-delivery lists them as limitations.

## Next
1. Kfir reads the Hebrew interface in the browser, on the stack this session leaves running
   (`http://localhost:5000`). The texts added since his last reading are decisions 44 and 46.
2. The PR is opened on his word at the end of this session; the merge is his.
3. For dc-delivery (limitations, on Kfir's word): the phone results layout (the breakdown stands before the
   records), nested groups unnamed for a screen reader, a conflict that discards the draft, a list row's count
   that may belong to an older version of the rule. Each is in the Log of 2026-11-11 with its reason.

## Blockers
- None.

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

35. The three `/impeccable critique` runs started without waiting for the word the plan asks for (decision 2):
    six opus sub-agents in all, one pair at a time. Their token counts are in the Log.
36. The critique snapshots were not written to `.impeccable/critique/`: the folder is not ignored by git and the
    plan lists no such file. What each run found and what happened to each finding is in the Log, and the polish
    pass worked from the reports themselves.
37. The plan says to fix the critiques' P0 and P1. A P2 was fixed as well where it was a misleading state, an
    overflow, or silence for assistive technology; a P2 that asks for new behaviour or reopens a decision of the
    plan was left. Each is named in the Log with which of the two it was.
38. Leaving a changed draft by a link of the app (cancel, the way back, the brand) is asked by the browser's own
    prompt (`window.confirm` behind `canDeactivate` on `controls/:id`). Plan decision 17 kept dialogs to archive
    and suggestions because "`beforeunload` covers a dirty draft"; the editor critique watched it not cover a
    link of the app. The prompt is the browser's, not a dialog of the app, so the rule of design.md stands. If
    Kfir would rather keep the silent leave, it is the one `canDeactivate` line of `app.routes.ts`.
39. A removed condition or group is offered back by a toast, as a changed root entity already was. Both
    offers are withdrawn as soon as the conditions are another draft (a further edit, a reload, a conflict's
    "load the current version"), and the store refuses a way back taken from a draft that moved on.
40. A button made unavailable by its own press is `aria-disabled`, not `disabled`, and keeps the focus: run on
    a list row, save, save and run, run again, the pager's two ends, "create the selected". A button that cannot
    be used as the screen stands (nothing ticked, a limit reached, the operator before a field) stays `disabled`.
    The pager's buttons are `aria-disabled` at both ends always, also on a first page nobody pressed: one
    button with one behaviour, at the cost of a stop on a button that does nothing.
41. `ללא חריגות` on a list row links to its run, as a count and a stopped run already did (design.md drew it as
    text): the results of a clean run could not be opened from the list at all.
42. The results page head offers no "run again" for a run whose definition is outdated or that is still running:
    the panel under it says a run cannot start.
43. A dialog's opening is the app's own animation on its panel class (fade, 6px rise, `--duration-panel`);
    Material's own opening is given 0ms and its closing fade stays. A select's panel keeps Material's motion and
    its 4px corners: no token exists for either, and design.md forbids restyling Material by its classes. This
    closes decision 10.
44. Texts added to `he.json` in phase 8, for Kfir's reading: `list.count.found.*`, `list.announce.*` (heard, not
    seen), `editor.sentence.hintInvalid` and `hintUnavailable`, `editor.toast.removedCondition` and
    `removedGroup`, `editor.leave.confirm`, `results.noMatch.bodyCapped`, `results.failed.reasons.*`; and
    `errors.ROW_CAP_EXCEEDED.body` was rewritten.

Taken on 2026-11-11 in the morning (Kfir's second message: "no questions"):

45. The engine and the api run from this worktree's own installs and builds (`uv sync`, `dotnet build`), each
    in its own session so that they outlive the command that started them. The engine gets
    `ENGINE_DB_HOST=127.0.0.1` and `ENGINE_DB_PORT=1433` in its environment, as Kfir said; the api needs nothing
    beyond `.env` (its block of `.env.example` is defaults, and `DB_HOST=localhost` connects from here). Each
    service reads only its own login from `.env`.
46. A run that took less than a twentieth of a second reads `פחות משנייה` in the summary
    (`results.summary.durationUnder`), not "0 שניות": the engine answers the sample data in about 10 ms, so
    every real run read as a run that took no time. A new Hebrew text, for Kfir's reading. Longer runs keep
    decision 27.
47. The gate waits for the toast of the save to go before it shoots `gate-results` (example 4 only, about six
    seconds a project): the toast rides to the results screen and stood over the records in the README image.
48. Beyond the gate, the real api was asked by hand for what no gate test reaches: the list and results queries
    with the client's own parameters, four invalid fixtures through `POST /controls/validate`, an unknown run,
    and a `PUT` and a run on an archived control of the gate's own (both refused, 409). Nothing was written by
    these. Every answer has the shape `api.types.ts` holds: no difference from the contracts, no line for Kfir.
49. The before-and-after listing of Design O reads every page of the list (plan.md, Design O, rewritten): the
    api deletes nothing, a gate run adds 18 archived controls, and at 118 controls one page of 100 dropped the
    example that sorts last, which read as a difference. `pageSize` is at most 200.
50. The phase's commit is `fix(web): run duration and gate shot on the real stack`, not the plan's
    `test(web): six-example gate against the real stack`: the gate specs were committed in the night
    (`44a7219`), and what the morning added to the code is two fixes.
51. The task folder stays in `dev/active/dc-web/` (`/ship` offers to archive it): dc-delivery reads these notes
    from there in its phase B0, and the merge is not done.
52. The stack is left running on Kfir's word, for his reading: the engine on 8000 and the api on 5000, which
    also serves this branch's build at `http://localhost:5000`. Both are this session's own processes; their
    process ids and logs are in the session's scratch folder, and `pkill -f "uvicorn app.main"` and
    `pkill -f DataControls.Api` stop them. The database container is not theirs to stop.

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
8be9e82 (phase 7 on the real stack), fixed in the `fix(web): review fixes` commit that follows it. Before it:
fcf0036 (phase 8) together with 44a7219 (the gate specs), fixed in 50a4e1d. The fix commits are not reviewed.

## Hand-over to dc-delivery
Read by its phase B0 (plan.md Design Q). Complete: phase 7 ran on the real stack on 2026-11-11.

- Its asks of 2026-11-10. (1) Built: the gate specs run at `E2E_BASE_URL=http://localhost:5000` as well as behind
  the dev server, on any list; no spec assumes an empty list, counts or orders the list as a whole, or finds a
  control by a bare name (each test tags the names it creates and follows ids). Run on the real stack, both ways.
  (2) Done as planned: this task edited only `web/README.md`, `docs/design.md` and `.claude/skills/dc-web/SKILL.md`;
  the drift is the list below; the Log is factual.
- As built:
  1. The gate: `cd web && npm run e2e:gate` (the dev server on 4200, `/api` proxied to 5000), or
     `E2E_BASE_URL=http://localhost:5000 npm run e2e:gate` for the build the api hosts. One worker, the projects
     `mobile` (390×844) and `desktop` (1440×900), 8 tests in each: the six examples, the list, the suggestions.
  2. It needs `GET /api/v1/health` with `database: ok` and `engine: ok` and the seed of `sql/`; it stops with a
     message when the stack is not healthy. Its expected records hold for run dates 2026-11-01 to 2027-12-31.
  3. Screenshots: `web/e2e/screenshots/<project>/gate-list.png`, `gate-editor.png`, `gate-results.png`,
     `gate-suggestions.png`. The five for the README are the four of `desktop/` and `mobile/gate-results.png`;
     the editor and results shots are example 4 and show the test's tag in the control's name.
  4. The build: `cd web && npx ng build` writes `web/dist/web/browser` (base href `/`; 545 kB initial, 137 kB
     estimated transfer; each screen and the dialog are lazy chunks).
  5. A gate run leaves 18 archived controls with `e2e-` in their names (9 per project) and their runs in `dq`,
     none active; it reads `hr` only through the api's runs.
  6. The gate ran on the real stack on 2026-11-11, on this branch with `eec007d` merged, the engine and the api
     started from this worktree (`gates/phase-7.txt`): once on a list without the examples, twice in a row on
     the pre-loaded list behind the dev server, once at `E2E_BASE_URL=http://localhost:5000` on the build the api
     hosts; 16 of 16 each time. After each of the last three runs the listing of the controls without a tag
     equals the one saved before it (`gates/phase-7-list-*.txt`): the six examples were not opened, run or
     changed.
  7. The hosted build: with `dotnet run` the api's content root is its build folder, so the client's build goes
     to `api/src/DataControls.Api/bin/Debug/net10.0/wwwroot` (ignored by git) and the api is restarted; a
     published app takes it in the `wwwroot` of its publish folder, as the README says. A deep link, the
     translation file and the fonts are served from there; a path with an extension that names no file is the
     api's 404 problem.
  8. What this task left in the dev `dq`: the six examples, posted once on 2026-11-11 on Kfir's word from
     `contracts/examples/` as of `f9928bf`, under their Hebrew names, ids 1800 to 1805, active, version 1, never
     run. And the gate's archived controls with `e2e-` in their names, 18 a run, with their runs: 126 after the
     seven runs of 2026-11-11, so the store held 136 controls when this task ended. Four archived controls with
     English names (ids 1462, 1463, 1676, 1677) were there before and are not this task's.
  9. `npm run e2e` is the mocked suite (no service needed); `npm run preview` opens the app over the same
     in-memory api, for reading the Hebrew interface without a backend.
- Cuts: none taken. The four of decision 7 (the archived view, the settle, "open in editor" on a suggestion,
  sorting the results) are all built, so dc-delivery writes no sentence about a cut of this task.

## Docs for dc-delivery
Kept as the work goes (plan.md decision 23, Design Q) and copied into the PR body under this heading at `/ship`.
Checked on 2026-11-11 against the documents as they stand on main (`eec007d`, which changed the README and no
file under `docs/`) and against what was built.

- `docs/architecture.md` §8, screen 2 ("live sentence preview") and the component list ("rule sentence
  preview"), and §13 ("preview sentence" among the focused Angular tests): the client has no sentence renderer.
  The editor draws the engine's sentence from `POST /controls/validate`, called 400ms after the last edit, and
  keeps the last valid sentence, dimmed, while a row is incomplete. The focused test is that validate loop
  (`editor.sentence.spec.ts`), not a rendering test.
- `docs/architecture.md` §8, screen 1: the list's actions are run, edit and duplicate, as written; archiving is
  an action of the editor's page head, and the list has an archived view (the state filter). Screen 3: sorting is
  by the record's identifying fields only (`sort=display`), filtering is by condition through the breakdown, and a
  definition that no longer fits the glossary is the run error `CONTROL_DEFINITION_OUTDATED`, with the condition
  named by its mark.
- `docs/architecture.md` §8 and §13, and the README's tests part: the e2e has two folders, `e2e/mocked` on
  Playwright route fixtures with no service and `e2e/gate` on the real stack; the commands are in
  `web/README.md`. The mocked specs take their sentences and reasons from a fake engine that is test support
  (`web/e2e/support/fake-engine.ts`), never shipped.
- `docs/assumptions-limitations-extensions.md`: an archived control cannot be restored, only duplicated; a dirty
  draft is guarded by the browser's own prompt, with no dialog of the app; dates are typed into the browser's
  date input; the client is tested in Chromium only; a run made in another language would show its text as
  stored; a run still `running` when its page opens shows a neutral state with a reload, since runs are
  synchronous and the client does not poll; the page title is English until the translations load (the static
  `index.html` may hold no Hebrew).
- README, the demo walkthrough: with the examples loaded, the suggestions repeat controls the list already
  holds.
- README, "Running the tests" ("Engine, api and web: one command each, filled by ..."): the client's commands
  are in `web/README.md` (unit tests, the mocked specs, the gate). "The api", "Run it from a checkout": started
  with `dotnet run`, the api serves the client from `bin/Debug/net10.0/wwwroot`, not from a `wwwroot` in the
  project folder.
- README, the demo walkthrough and the screenshots: a run on the sample data takes about 10 ms, and the summary
  says `פחות משנייה`. The list of the delivered system, six examples never run, is `gate-list.png`.
- `dev/active/dc-delivery/plan.md`, the before-and-after listing (`...controls?active=all&pageSize=100`): it
  reads one page. The dev store held 136 controls on 2026-11-11 and each gate run adds 18, so the listing must
  page (the loop of this task's plan.md, Design O), or an example that sorts last drops out and reads as changed.
- `docs/assumptions-limitations-extensions.md`: the api deletes nothing, so archived controls, the gate's among
  them, stay in the store and in the archived view of the list.
- `docs/assumptions-limitations-extensions.md`, on Kfir's word of 2026-11-11, as limitations: on a phone the
  breakdown stands before the records; nested groups have no name for a screen reader; a save conflict loads the
  current version and discards the draft; a list row's count may belong to an older version of the rule. The
  line above about a changed draft holds for a link of the app as well as for a reload or a closed tab
  (decision 38, kept by Kfir).
- `docs/ai-usage.md`: the Log below. The design pass of phase 8 used the impeccable skill's detector and two
  opus sub-agents per critique run.
- Dropped since the plan: the 1024 screenshot (main's §8 already says 390 and 1440), the missing
  `docs/design.md` row and the "client renders the text" gotcha of `.claude/CLAUDE.md` (both already right on
  main).

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
- 2026-11-11 /phase-review web, phase 6 (one reviewer agent, opus; cost line: about 155k tokens, started without
  waiting), diff dc6b420..383ec73: plan 1 critical, 4 warnings; standards 3 warnings, 3 info.
  `controls-list.page.html`: the trimmed search was written back into the field (critical; the same defect the
  phase 5 review found on the results screen, already fixed on both screens in 9137de9 before this review was
  read). `controls-list.page.ts`: the first-use panel also showed when only archived controls existed and took
  the toolbar away with it, and `state=all` with no control showed the no-match panel (warning).
  `suggestions-dialog`: the dialog could be closed while the selection was being created, losing the toast and
  the reload (warning). `list.store.ts`: after a failed load the rows of the question before stood under the
  new search, with a count line that mixed the two (warning). `suggestions.spec.ts`: a name compared as a
  substring (warning). `list.spec.ts`: a 503 `ENGINE_UNAVAILABLE` on `POST .../runs`, which that endpoint never
  sends (warning). `controls-list.page.html`: the glossary failure was not shown (warning), and the first-use
  view had two filled "new control" buttons (warning, One Cobalt). Info: the first-use text named an example of
  the sample model; a hand-rolled plural for the created toast and a spec helper that recomputed plurals; every
  "open in editor" button had the same name. Fixed in the review-fix commit: all of them. The store asks once
  whether any control exists when the active list is empty with nothing narrowing it, and the page tells first
  use, "every control archived" (with the way to the archive) and no match apart; a failed read clears the
  rows and a failed run is its own banner; the dialog holds its close while it creates; names are compared
  whole through `suggestion-name`; the run fixtures fail with `DATABASE_UNAVAILABLE`; the glossary banner
  stands on the list; the head leaves its actions to the first-use panel; the first-use text has no example
  and design.md says why; the toast counts through `CountedService`; "open in editor" is named by its draft.
  Thirteen tests added or changed.
- 2026-11-11 phase 8, `/impeccable audit` on Fable 5.2 (no agent): the detector (`impeccable detect`, 62 rules)
  found nothing in `web/src` or on the list, the editor and the results at 1440 and 390. A scratch script measured
  six views at both widths: contrast, names of controls, headings, landmarks, overflow (also with text at 200%),
  target sizes, reduced motion. No contrast failure, no unnamed control, one `h1` a screen, no sideways scroll.
  Found: reduced motion was not honoured (its rules loaded before the partials they switch off, so the
  skeleton kept breathing and the button kept its step); the name link and the result link of a row were 20px
  high and the sort header's button 22px; the brand link 28px. Fixed: the reduced-motion rules are the last
  partial (`_motion.scss`); a row's link has a 24px box and answers a touch over the height of a control; the
  sort button is padded; the brand link is 44px. Not findings: Material's inner elements inside 44px fields,
  and 36px small controls at 1440, which design.md allows.
- 2026-11-11 phase 8, keyboard pass on Fable 5.2 (no agent): a scratch Playwright walk with Tab over the list,
  the editor and the results at 1440, their first stops at 390, and both dialogs (first focus, the trap, Escape,
  the return). Every action of the gate flow is a stop with a visible ring, both dialogs trap the focus and give
  it back to their opener. Found: the all/any segment showed no focus on its selected (Ink) segment; at 390 the
  results' header, which is read and not seen there, kept its sort button as a stop nobody can see; a button
  that disables itself under the focus drops it (run on a row, save, save and run, run again, the pager).
  Fixed: a ring inside the segment (by the component's element and ARIA state); the sort button is not rendered
  below 640 and the header names itself; decision 40. Seen and left: Escape on a dialog whose close button
  shows its tooltip closes the tooltip first and the dialog on the second press (Material's tooltip); the router
  does not move the focus on a navigation; the pager's two ends are now stops also when they are unavailable.
- 2026-11-11 phase 8, `/impeccable critique` of the controls list, dual-agent (A design review: opus, 162.8k
  tokens, 7.5 minutes; B detector and overlay: opus, 58.4k tokens, 3.9 minutes; started without waiting,
  decisions 2 and 35). B: 0 findings (CLI over the markup, the overlay at 1440, at 390 and with the suggestions
  dialog open). A: 28 of 40. P1, a run from the list ends silently for a screen reader and the keyboard (the
  disabled button drops the focus, nothing says the start or the outcome, the table reflows while a row runs,
  a failure's banner is at the top and names no control). Fixed: decision 40, a status line that says the start
  and the outcome with the control's name, the actions column keeps its width. Left: the failure banner's place
  and text (the design's place for a failed call; it is an alert, so it is spoken). P2, the head's count reads a
  narrowed list as the whole, and a folded phone filter shows no sign: fixed (`נמצאו 3 בקרות` when narrowed; the
  phone's filters unfold while one is in force). P2, `ללא חריגות` is a dead end: fixed (decision 41). P2, run
  and result are named for the eye only: fixed (both are described by the row's name). P2, a count may belong
  to an earlier version of the rule: left, it is new behaviour and `updatedAt` also moves on a rename. Minor,
  fixed: the meta line holds its place while the list loads; the search icon stands 12px from the field's edge.
  Minor, left: the searched term is not isolated inside its quotes; the table has no accessible name; the pager
  shows with one page; the row's hover tint suggests the row is one target; the header `חריגות` stands over
  results that are not counts; the count is said in the head and in the foot. Its three questions (the sentence
  on a row, the name opening the results, a run landing on its results) are for Kfir.
- 2026-11-11 phase 8, `/impeccable critique` of the control editor, dual-agent (A: opus, 215.7k tokens, 9.2
  minutes; B: opus, 77.9k tokens, 6.0 minutes). B: 0 findings (CLI: 5 templates parsed, 24 `.ts` files matched by
  pattern only; the overlay on a nested control at both widths, a control with a related node, a new control at
  390; closed menus and dialogs not scanned). A: 26 of 40. P1, destructive edits have no way back: removing a
  group takes its conditions with one press and no undo, and cancel, the way back and the brand leave a changed
  draft unasked (watched in the live app). Fixed: decisions 38 and 39. Left: the group's remove button stays in
  the column of the rows' remove buttons (with the undo, a slip costs one press). P2, the sentence field says
  untrue things outside the happy path: fixed, the hint says why there is no sentence (three texts). P2, the
  nesting is invisible to assistive technology (unnamed groups, identical names of adders and removers, the
  whole sentence said again after each edit): left, it needs a name for each group and is the first thing to
  take up after the gate. P2, a conflict discards the draft (its one action loads the current version): left,
  design.md gives the conflict that one action and "save as a new control" is new behaviour. P2, the operator
  list is twelve flat options: left, the list and its order are the glossary's. Minor, fixed: at 390 the
  archive button stood centred in a full-width row. Minor, left: the mark's height in the sentence (measured:
  centred on the Hebrew letter); the root's all/any shown with one condition; a field name cut short in compare
  mode; a value's error under the toggle at 390; `VALUE_TYPE_MISMATCH` names no type; every control's tab reads
  `עריכת בקרה`; the missing-value note at the panel's foot where PRODUCT.md says beside the operator; the save
  buttons look ready while the engine is down.
- 2026-11-11 phase 8, `/impeccable critique` of the run results, dual-agent (A: opus, 194.0k tokens, 7.3 minutes;
  B: opus, 67.9k tokens, 2.9 minutes). B: 0 findings (CLI: 2 templates parsed, 18 `.ts` files by pattern only;
  the overlay on a run at both widths, a second run, the not-found state at 390). A: 28 of 40, no P0 or P1. P2,
  above the row cap the search and the filter speak as if they reached every violation: fixed (the banner says
  what they reach; a search that finds nothing there says how far it looked). P2, a failed run shows the text
  of a live failure ("unavailable now") for something that happened then: fixed, past-tense reasons by code.
  P2, the head's actions ignore the state: fixed for an outdated and a running run (decision 42); left, the run
  button repeated in the timed-out, failed and clean panels, the two labels of edit, `בדיקה חוזרת` beside
  `הרצה חוזרת`. P2, the results change silently for a screen reader: fixed, the range and the no-match panel
  are statuses and a breakdown row's number is read with its noun; left, nothing is said after a rerun opens
  the new run. P2, the phone does not serve reading: fixed, a long value wraps inside its tint (it widened the
  page: 487px on a 390 screen for a 55-character address); left, the breakdown stands before the records at 390
  (the first record at 1,338px) and nothing beside the table says a condition filters it: both change the
  Layout row of design.md and are for Kfir. Minor, left: a line of the sentence may end on an open bracket; the
  head reflows while a rerun runs; `0 חריגות` over `לא נמצאו חריגות`; `הבדיקה נעצרה` here and `ההרצה נעצרה` on the
  list; traced and active marks share one fill; the first name bold and the last regular; the not-found run
  keeps the tab title of the results.
- 2026-11-11 phase 8, `/impeccable polish` on Fable 5.2 (no agent), over the three reports and its own pass.
  Besides the fixes above: the dialog's opening as design.md says it (decision 43; a first version restyled
  Material by its internal classes, against design.md's own rule, and was redone); a sweep of six routes and the
  dialog at both widths for console errors and failed requests (none); layout shift on load measured and the
  head's meta line and the editor's archive action given a held place (list at 1440: 0.098 to 0.004; editor at
  390: 0.737 to 0.187; results at 390 stays 0.219, its meta wraps to two lines there and one is held; what is
  left is the font swap of a cold load and the form growing under the fold). `docs/design.md` follows what is
  built: segmented control (focus), tables (row links, the hidden header, the foot as a status), the list (the
  count line, a run from the list), toolbar (phone filters), the value, the rule sentence (hints), the builder
  (removing), dialogs and toast (leaving, unavailable buttons), motion, shapes (the select's panel), four rows
  of States, one Don't. `web/README.md` written; the hand-over block and the drift list filled.
- 2026-11-11 phase 8 on Fable 5.2: gate `gates/phase-8.txt` (ngc, ng lint, e2e type check, 293 unit tests in 30
  files, ng build at 545 kB initial and 137 kB transfer, print guard, `e2e/mocked` on mobile and desktop: 150
  passed, 2 skipped by project on purpose). The gate specs were dry-run on the stand-in again after the changes
  (16 of 16; decision 33). Screenshots in `screenshots/phase-8/`. No cut taken.
- 2026-11-11 /phase-review web, phase 8 and the gate specs of phase 7 (one reviewer agent, opus, 196.7k tokens,
  8.2 minutes; started without waiting), diffs 9137de9..44a7219 and 3d5836f..fcf0036: standards 1 critical, 3
  warnings, 8 info; plan 2 info and one decision only partly built. `editor.store.ts`: the way back from a
  removal could be taken after the control was read again (a conflict's "load the current version", "try
  again"), putting the old draft over the newer version with `dirty` still false, so a save would overwrite
  it unasked (critical). `control-editor.page.ts`: the flag behind the offer was never cleared when its toast
  timed out or was replaced, so the next edit dismissed an unrelated toast, and the root change's way back
  threw away later edits the same way (warning). `e2e/support/gate.ts`: the teardown stopped at the first
  control that would not archive and left the rest active, against Design O (warning). `app.routes.ts`: the
  leave guard also ran on the first save's own move from `new` to the saved address, and asked if something was
  typed while it saved (warning). Info: a Hebrew word in a stylesheet comment; a raw `2px` and `-4px` where
  tokens exist, and a width tied to a Hebrew label; the segment's ring reaches Material's inner `button`, which
  the skill file did not allow though design.md did; design.md still called a running button disabled; under
  reduced motion a pressed unavailable button changed its tone; `markedIds` written twice in the e2e folder;
  `resultOf` imported from a component file; the codes with a failed-run text listed twice; the pager's first
  button is unavailable, not disabled, on a page nobody pressed (against the wording of decision 40); the gate
  has not run on the real stack (known, Blockers). Fixed in the review-fix commit: the critical and the three
  warnings (the store refuses a way back from a draft that moved on, for a removal and for a root change; the
  page ties each offer to the draft it starts from and withdraws it when the draft is another one; the
  teardown tries every control and fails at the end with what it could not archive; the guard lets the editor
  move to the address of the control it holds), with a unit spec for each refusal and e2e specs for the
  withdrawn offer and the first save; and the info items (the comment, the two literals, the pressed tone,
  one `markedIds`, `run-result.ts`, the translation file as the one list of failed-run texts, the skill file
  and design.md in line, decisions 39 and 40 reworded to what is built). Left: the 9.25rem of the actions
  column, with its reason beside it. The gate specs were dry-run on the stand-in once more after the teardown
  change (16 of 16; 6 untagged controls untouched, 18 tagged ones archived).
- 2026-11-11 final gate on Fable 5.2, on what can run without the api and the engine: `gates/final.txt`
  (`/check all --tests`: `sql-check` 27 assertions, `contracts-check` 5 checks, ngc, ng lint, the e2e type
  check, 296 unit tests in 30 files, ng build at 545 kB initial and 137 kB transfer, the print guard, 226 hook
  tests; then `e2e/mocked` on mobile and desktop: 154 passed, 2 skipped by project on purpose). `sql-init` is
  skipped in a worktree by the runner. Screenshots in `gates/final/screenshots/` (31 a project; no gate shot
  among them: those come from the real stack). Not run, and why: `e2e/gate` on the real stack, on a pre-loaded
  list and on the build the api hosts: `git log main` and `origin/main` still end at `f9928bf`, so the api and
  the engine are not there. By Kfir's rule for the night the gate is blocked only by steps that wait for a
  merge: committed, not pushed, no PR. The stand-in api and the dev server of this session are stopped; nothing
  of this run is left in the repository's tree or in the dev `dq`.
- 2026-11-11 morning, Kfir: "The engine and the api are merged to main. Finish this task now". His words for the
  steps: merge `origin/main` (no rebase); start the engine and the api from this worktree against the shared
  database, with `ENGINE_DB_HOST=127.0.0.1` and `ENGINE_DB_PORT=1433` in the environment; "Posting the six
  examples into the dev dq: you have my word"; "Keep decision 38 (the leave prompt). The four items you left
  open stay open; delivery lists them as limitations"; `/check all --tests` green, then "You have my word for
  the push and the PR. No merge"; leave the stack running for his reading of the Hebrew interface. No questions,
  the database container never stopped or reset, wait when another suite runs.
- 2026-11-11 phase 7 on Fable 5.2, gate `gates/phase-7.txt`. `origin/main` (`eec007d`) merged as `268a0f7`, no
  conflict; `contracts/` is the same as at `f9928bf`. Installs: `uv sync` in `engine/`, `dotnet build` in
  `api/`. The engine on 8000 and the api on 5000 from this worktree, both healthy against the shared container
  (port 8000 was free; no other project's container held it). The gate specs passed on the real stack on their
  first run, 16 of 16, with no change to a spec's flow or to the driver. What the real stack showed, and the
  mocks had not: (1) a run takes about 10 ms and the summary read "0 שניות" (fixed, decision 46, with a mocked
  spec); (2) the toast of the save stood over the records in `gate-results` (fixed in the spec, decision 47).
  The payloads were also read by hand (decision 48): no difference from the contracts. The pre-load: no control
  carried an example's exact name, so the six were posted (six times 201, ids 1800 to 1805). Then the gate twice
  on that list and once on the build the api hosts, 16 of 16 each; the listing of untagged controls after each
  run equals the one before it. Not provoked on the real stack: a timeout, a row cap, an engine or database that
  is down, a save conflict; those states are covered by the mocked specs alone.
- 2026-11-11 /phase-review web, phase 7 (one reviewer agent, opus, 96k tokens; spend written here and started at
  once, as in the night), diff 268a0f7..8be9e82 over `web/`, `docs/design.md` and the skill file: standards
  0/0/5, plan 0/0/1. `run-results.page.ts`: a null duration would read as "less than a second" (cannot happen:
  the summary is drawn for a succeeded run, which has the engine's integer); the edges 0, 49, 50 and 99 ms
  checked by the reviewer and right. `he.json`: `durationUnder` is a value among labels and does not say under
  what; no unit guard checks that a used key exists, only the e2e `t()`. `results.spec.ts`: a real regression
  test, with no case at the 49/50 ms edge. `examples.spec.ts`: the toast wait is right and not flaky (only the
  first save shows a toast; `toBeHidden` passes at once when it is gone); its 10 s equals the default and its
  tie to the toast's six seconds was nowhere in the code. `web/README.md`: "read once at startup" said more than
  the api does (the folder must exist at the start; files are read as asked). Plan: the commit message differs
  from the one the plan names (decision 50). Fixed in the review-fix commit: the spec's comment names the six
  seconds, and the README and the skill file say what the api needs. Left: the null duration (unreachable under
  the contract), the key's name (a rename is a change to `he.json`, which Kfir is about to read), the edge case
  (decision 46 is a rounding, checked by the reviewer by hand).
- 2026-11-11 final gate on Fable 5.2, on the real stack, at 8be9e82: `gates/final.txt`. `/check all --tests`:
  `sql-check` 27 assertions, `contracts-check` 5 checks, engine ruff and pyright and 521 tests, api build with
  warnings as errors, format and 370 tests (3 live ones skipped by their own switch), ngc, ng lint, the e2e type
  check, 296 unit tests in 30 files, ng build at 545 kB initial and 137 kB transfer, the print guard, 226 hook
  tests; `sql-init` skipped in a worktree by the runner. Then `e2e/mocked`: 156 passed, 2 skipped by project on
  purpose. Then `e2e/gate` behind the dev server and on the build the api hosts, on the pre-loaded list: 16 of
  16 each. The engine's tests had `ENGINE_DB_HOST` and `ENGINE_DB_PORT` in the environment; the api of this
  worktree was stopped for its own build and tests and started again. The script ended red on one line: the
  listing after the hosted run differed from the one before it by the example `קטינים בשכר גבוה`. Cause: the
  store held 118 controls and the listing read one page of 100 (decision 49); the control was unchanged, and
  the listing over every page is equal. After the review fixes: ng lint, the e2e type check and the gate on the
  hosted build once more, 16 of 16, with the paged listing equal before and after. Screenshots in
  `gates/final/screenshots/`, the four gate shots of each project among them. The header's "1 changed file" is
  the gate file itself. Secrets: the branch diff and the gate files hold no token and no password value.
