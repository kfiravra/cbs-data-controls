# dc-web: the Angular client
Created: 2026-11-10 · Branch: feat/web (worktree `../cbs-web`, cut from main once Kfir's docs+infra commit is on it)

Amended: 2026-11-10 on two asks from dc-delivery, carried by Kfir (decisions 22 to 27, Design O and Q, phases 7 and
8, the Gate).
Amended: 2026-11-10 by the dc-contracts session on Kfir's scope decision, with the lines from the merged contracts (the
two sections before the Phases).

## Goal

After this task a business user opens the client in Hebrew, right to left, and does the whole job without meeting a
table name: sees the controls list, builds a control from glossary terms (root entity on the relationship map,
nested all/any groups, comparison with a value or with another field, conditions on related records), reads it back
as one sentence with a mark per condition, saves it, runs it, and reads the violations with the reason for each, the
matching value marked, a breakdown per condition, search, filter and paging. Suggested controls are reviewed and
created from a dialog. The screens follow `docs/design.md`; every label comes from the glossary and every sentence
from the engine. This is task 4 of architecture §19, the longest of the three parallel tasks, and the submission is
due 2026-11-15: the budget is 2.65 working days, with a fixed cut order (decision 7).

## Decisions

From the interview (Kfir, 2026-11-10):

1. **The engine renders, the client draws.** Sentences and reasons arrive as parts: `sentenceParts` beside every
   `sentence` and `textParts` beside every reason's `text`, each a list of `TextPart { text, nodeId?, role? }`
   (dc-contracts plan, Design H2 under "Amendments from dc-engine planning", owned by the dc-engine session). The
   api passes them through and stores them in `Run.summary` and `RunResult.reasons`; the web renders from them. No
   renderer, template or variant logic for text in the client. (Kfir's choice. Rejected: my recommendation of a
   client renderer over the templates `GET /glossary` serves; flat strings matched by search.)
2. **The editor's sentence is the engine's.** The editor calls `POST /controls/validate`, debounced 400ms, and draws
   the returned parts; while a row is incomplete it keeps the last valid sentence, dimmed. (Kfir's wording. It
   replaces design.md's dashed open clause; the status line and the open mark still name the unfinished condition.)
3. **Playwright route fixtures feed the screens** until the api lands, and stay as the spec of the states the real
   stack cannot produce on demand (timeout, row cap, engine down, conflict, outdated definition). No mock code
   inside the app; a headed preview script runs over the same fixtures. (Rejected: a `mock` serve configuration
   with a fake backend; waiting for the api.)
4. **A related-records node has its own letter**, in document order, on its head in place of the tree icon; its
   inner conditions continue the sequence. Reasons and the breakdown show the node's letter, because a run matches
   the node and never its inner conditions (dc-contracts decision 8). (Rejected: the first inner letter; lettering
   the node only, which leaves an unfinished inner row without a name.)
5. **Start**: when Kfir's docs+infra commit is on main; the worktree is cut from that main, so `docs/design.md` and
   `docs/PRODUCT.md` come from git and are never copied. Phase 1 reads nothing from `contracts/` and may run
   alongside dc-contracts (Kfir's answer, against §19's "nothing else starts before its gate"). From phase 2 on,
   `contracts/` must be on the branch.
6. **Two asks go to dc-contracts and one is declined** (Design P): Hebrew dates with dots; name-first identifying
   fields with `display_text` defined. No restore endpoint: the archive dialog says only that the control leaves the
   list, keeps its runs and can be duplicated.
7. **Cut order** when time runs short, first cut first: the archived view (archiving itself stays) · the settle ·
   "open in editor" on a suggestion · sorting the results. Never cut: the six-example gate, reasons with marks and marked
   values, errors on the offending row, every results state, Hebrew RTL at 390 and 1440, duplicate, creating the
   selected suggestions.
8. **A run from the list stays on the list**: the row's result updates in place, as design.md draws the row. Save
   and run in the editor goes to the results.

Settled in planning, inside the architecture, design.md and the dc-web skill:

9. **Angular 21 line**: the installed CLI 21.2.29, core 21.2, Material and CDK 21.2, angular-eslint 21.4,
   ngx-translate 18.1, Playwright 1.65. (npm's latest is 22; the harness, PRODUCT.md and the skill's facts are for
   21, which is in long-term support.)
10. **Material where a widget is hard, native where it is not** (Design B). Buttons, links and tables are native
    elements with token classes. Material is never restyled through its internal classes (design.md).
11. **Dates are entered with the native date input**: its value is already the contract's `YYYY-MM-DD`. (Rejected:
    Material's datepicker, which needs a custom adapter to parse a typed Hebrew date.)
12. **Marks are computed in the client from a definition's order alone** (Design H): the editor's draft, the
    definition of the version that ran (one GET beside the run) and a suggestion's definition. `run.conditions`
    cannot give the order: it lists only the nodes a run can match (dc-contracts plan, Design H4c). A mark is never
    stored or sent.
13. **The editor works on a draft model**, not on the contract type: a row may be incomplete. Its checks are
    convenience (§5, layer 1); the server's 422 is the authority.
14. **List and results state lives in the URL's query parameters**, so back and reload keep search, filter, sort
    and page.
15. **The design's "a field left the glossary" state is the contract's `CONTROL_DEFINITION_OUTDATED`** (a run
    error), and it names the condition by its mark: the label of a field that left the glossary no longer exists,
    and a key never reaches the screen. `GLOSSARY_MISMATCH` joins the engine-down banner.
16. **The breakdown counts all violations**, also above the cap, as the contract says; design.md's cap text ("counts
    the shown rows") is corrected.
17. **Archive sits in the editor's page head.** There is no leave-without-saving dialog: design.md keeps dialogs to
    archive and suggestions, and the browser's own `beforeunload` covers a dirty draft.
18. **Dates in the client's own text use the glossary's pattern** for the active language, so a date in a page head
    and a date inside the engine's text look alike.
19. **Plurals without ICU**: `Intl.PluralRules` and key suffixes.
20. **design.md changes ride with the phase that builds them** (phases 3 to 6): the related node's letter, the stale
    sentence and its token, the corrected states, the archive text. It is the one §17 document this task edits
    (decision 26).
21. **One Opus session, in order.** No Sonnet lane and no fan-out of builders: the screens share `he.json`, the
    tokens and the shared components. Agents are spawned only by `/phase-review web` (one reviewer) and
    `/impeccable critique` (two per run), each announced first.

From dc-delivery, carried by Kfir (2026-11-10, after this plan was written):

22. **The gate specs also run at `E2E_BASE_URL=http://localhost:5000`, on a list that already holds the six
    examples under their real names.** dc-delivery loads them through the api at first start and never runs
    them. No spec may assume an empty list, and none may find a control by an example's bare name.
23. **Documentation has an owner.** The §17 documents, `docs/submission.he.md` and the README outside this task's
    own part are dc-delivery's and are never edited here. Documentation drift is listed in the PR body under
    "Docs for dc-delivery" at `/ship`.
24. **The notes Log stays factual about what each review found.** `docs/ai-usage.md` is built from it.

Settled in planning on those three (object or they stand):

25. **How the gate keeps decision 22** (Design O). A gate spec touches only controls it created in that test. Each
    one is named with the example's name plus a tag unique to the test, and is found by the id the app gave it.
    Nothing is ever created under an example's bare name: dc-delivery's loader looks a control up by its exact
    name, archived ones included, and would take it for the loaded example. The teardown archives by id. Phase 7
    proves it on a list that holds the six examples under their real names, twice in a row, and once on the
    build the api hosts.
26. **`docs/design.md` stays with this task, although §17 lists it.** It is the specification Kfir's `/task-plan`
    line gives this task; decisions 2, 4, 6, 15 and 16 change what it says; `/impeccable` judges the screens
    against it in phase 8; and the dc-delivery plan does not edit it, it only checks that the file is tracked (its
    phase B4). So decision 20 holds for `docs/design.md` and decision 23 for every other document. This task's
    own part is `web/README.md`, `docs/design.md` and `.claude/skills/dc-web/SKILL.md`. The row for
    `docs/design.md` in CLAUDE.md is left to dc-delivery, whose phase B4 writes the rows of the §17 documents.
27. **The gate also opens the suggestions dialog on the real stack and creates one draft.** Nobody asked for it.
    dc-delivery takes its README screenshots from the gate run on its composed stack (its decision 27: list,
    editor, results and suggestions at 1440, the results at 390), and this plan's gate had no suggestions screen.
    The same spec is the only run of "create selected" against the real api before dc-delivery's gate. (Rejected: the shot of the mocked spec, which is not the composed stack; a dialog that is opened
    and closed without creating, which leaves the accept request untried.)

## Scope decision (Kfir, 2026-11-10; written in by the dc-contracts session, which carried it through all five plans)

Applied to the text of this plan. Where a line still disagrees with this section, this section holds.

1. **Hebrew only.** No `en.json`, no language switch, no English spec and no English screenshot. The mechanism
   stays: one translation file per language, `LanguageService` holding the language as a value, `label[lang]`,
   `Accept-Language` on every call. The glossary lists `he` alone, and its texts are objects with the one key `he`.
2. **Suggestions are heuristics only.** The answer to `POST /suggestions` is `{ items }`: there is no `source`, no
   key and no paid call, so the gate needs no word about spend for the suggestions spec.
3. **No offline Windows bundle** in dc-delivery: its gate is the Docker path and a from-source run.
4. **Screenshots at 390 and 1440 only.** The Playwright projects are `mobile` and `desktop`; there is no `tablet`
   project and no shot at 1024. The breakpoints of `docs/design.md` are layout, not screenshots, and stay.

`docs/design.md` was edited for 1 and 4 by the dc-contracts session (the app bar has no language switch, marks are
Hebrew letters only, the check is at 390 and 1440). It stays this task's document from here on.

## Lines from dc-contracts as it merges (2026-11-10)

`contracts/` wins over this plan. These points were pinned there, most of them in the review of the branch:

- **Both asks of decision 6 are in the contract**: `formats.he.date` is `dd.MM.yyyy`, and the identifying fields
  are name first with `display_text` defined (dc-contracts decisions 30 and 31). The table of Design P that calls
  them "not in the dc-contracts plan yet" is out of date.
- **Error paths.** A semantic error names the member the editor edits as one input (`left`, `operator`, `value`,
  `values` with `params.index`, `right`, `relationship`), as Design K assumes. Two kinds end elsewhere and need
  the fallback through `nodeId`: schema-layer paths (`…/type`, `…/left/path`, the node itself) and
  `DUPLICATE_NODE_ID` (`…/id`, with no `nodeId`).
- **`NETWORK_ERROR`** is a row of `errors.md` now: a code the client derives when the api does not answer.
  `GLOSSARY_MISMATCH` never reaches the client; the state for a control whose field left the glossary is the run
  error `CONTROL_DEFINITION_OUTDATED`. The States table of `docs/design.md` still says otherwise.
- **`Run.status` may be `running`** when a run is fetched: another user's run in progress, or one a crash cut
  off. No screen state covers it yet.
- **Counts under the cap are exact**: `conditions[].count` is over all violations, not the stored rows. The
  States table of `docs/design.md` says the opposite and is the line that changes.
- **Identifiers.** A field marked `identifier: true` (employee and department numbers) is a number written digit
  for digit. `display` values of such a field are drawn without a thousands separator, which is how
  `display_text`, and so the search, holds them.
- **Rendered text.** A value part carries its unit after a plain space: keep a value part on one line. A NULL
  renders as nothing. The engine's reason reads "גיל: 15 (מתחת ל־18)"; `docs/design.md` draws "גיל [15] נמוך
  מ־16", and its related-records head words the node differently from the engine's "אין … עם (…)". Kfir settled
  the engine's wording at the dc-contracts gate: numbers "מתחת ל־" and "מעל", dates "לפני" and "אחרי", and the
  colon style for the rest ("שכר: חסר"), so no text agrees with the gender of a field.
- **The public glossary** has a shape table in `api.md`: `operators` resolved per field, `comparable`,
  `identifier`, `visible`, `arity` as 0, 1, 2 or `"list"`.
- **Requests**: `page` is 1 to 1,000,000; the results `search` is trimmed and an empty one filters nothing; a body
  over 1 MB is 413 and a body that is not JSON 415, both `REQUEST_INVALID`.

## Phases

Budget in working days: phase 1 0.3 · 2 0.3 · 3 0.4 · 4 0.3 · 5 0.35 · 6 0.3 · 7 0.45 · 8 0.25, 2.65 in all. Phase 7
grew by 0.15 on 2026-11-10 with decisions 25 and 27: the suggestions spec, the two runs on a pre-loaded list and
the run on the build the api hosts.

Every phase from 1 on ends the same way: tick the steps as they finish, `/check --tests`, the phase's mocked
Playwright specs, the verify output saved as `gates/phase-N.txt` and the screenshots copied to
`screenshots/phase-N/`, `/phase-review web`, one `fix(web): review fixes` commit, and the Log lines of Design Q in
`notes.md`: one for the phase and one for the review, whether it found anything or not. A phase that makes a
sentence in one of dc-delivery's documents untrue adds a line to "Docs for dc-delivery" in `notes.md` at that
moment (decision 23). Say the cost before anything that takes minutes or spawns an agent (npm install, a
Playwright run, a reviewer, a critique) and wait for the word. The Design section below is the specification each
step builds from.

### Phase 0: worktree (from the main tree, no commit)
- [x] Kfir's docs+infra commit is on main: `git log -1 --format='%h %s' main -- docs/design.md docs/PRODUCT.md`
      prints it. Not there: stop, nothing starts.
- [x] `git worktree add ../cbs-web -b feat/web main`
- [x] Move this folder, so one live copy exists: `mkdir -p ../cbs-web/dev/active && mv dev/active/dc-web
      ../cbs-web/dev/active/`. Copy `.claude/settings.local.json` to `../cbs-web/.claude/` (ignored by git: local
      permissions and the impeccable hooks).
- [x] A new session in `../cbs-web` on Opus, `/resume dc-web`.

The design reference stays in the main tree and is read by absolute path:
`/home/kfir/projects/cbs-data-controls/dev/active/design/` (`mock/*.html`, `mock/app.css`, `mock/tokens.css` and the
eight screenshots). Never read its `vendor/` or `.taste-skill/`.

Verify: `git -C ../cbs-web status --short` prints nothing and `../cbs-web/docs/design.md` exists.

### Phase 1: workspace, tokens, shell, i18n (reads nothing from `contracts/`)
- [x] Say the cost first (npm install: about two minutes, about 400 MB), then scaffold from the worktree root:
      `ng new web --style=scss --routing --ssr=false --skip-git --package-manager=npm`. In `web/`:
      `ng add @angular/material@21`, `ng add angular-eslint@21`, `npm i @ngx-translate/core@18
      @ngx-translate/http-loader@18 @fontsource/ibm-plex-sans-hebrew`, `npm i -D @playwright/test
      @material-symbols/svg-400`, `npx playwright install chromium` (if system libraries are missing, ask Kfir to
      run the `--with-deps` form with `!`: sudo is denied here).
- [x] `angular.json`: `src/assets` in the build assets, `.svg` loaded as text, `proxy.conf.json` (`/api` to
      `http://localhost:5000`) on serve. `web/.gitignore`: `e2e/screenshots/`, `test-results/`,
      `playwright-report/`.
- [x] `eslint.config.js`: the ESLint block of `.claude/standards/linter-followups.md` (no-console, the Hebrew
      literal rule, the size warnings; `max-lines-per-function` off for specs).
- [x] Styles per Design B: tokens, base, the native component partials, the Material theme. Look up the names of
      `mat.theme`, `mat.theme-overrides` and the per-component `overrides` tokens through context7 before writing
      the theme. Two hours at most (Risks).
- [x] The font from `@fontsource/ibm-plex-sans-hebrew` (400, 500, 600) through the stylesheet; icons per Design B.
- [x] Language and direction per Design C: `main.ts`, `LanguageService`, `LOCALE_ID` and locale data, the translate
      providers, the plural helper, Material's Intl strings.
- [x] Shell: app bar (brand mark, name), page container, banner slot, the routes of Design D with
      lazy placeholder screens and the not-found state.
- [x] Shared components, first group of Design I.
- [x] `he.json` with the keys used so far; the key guard and the style guard of Design N.
- [x] `playwright.config.ts` per Design O. `e2e/mocked/shell.spec.ts`: `lang` and `dir`, the
      font is loaded (`document.fonts.check`), no request failed, the not-found state; screenshots.

Verify: `/check --tests` · `cd web && npx playwright test e2e/mocked/shell.spec.ts` (about a minute: say so first)
Review: `/phase-review web`
Commit: `feat(web): workspace, design tokens and hebrew rtl shell`

### Phase 2: contracts in, core logic, api layer
- [ ] `git merge main` once dc-contracts is merged there (a local merge commit; nothing is pushed). Until then only
      the two steps marked "no contracts" may run.
- [ ] Reconcile. Read `contracts/api.md`, `contracts/errors.md`, `contracts/glossary.json` and
      `contracts/control-definition.schema.json`. They carry Design E, F and H of the dc-contracts plan (H is
      "Amendments from dc-engine planning"; the plan is in `/home/kfir/projects/cbs-data-controls/dev/active/`).
      List in `notes.md` every place where they differ from Design E to M of this plan and work through the checks
      of Design P. The contracts win; anything that blocks a screen goes to Kfir as one line.
- [ ] (no contracts) `core/definition`: the contract types from Design C of the dc-contracts plan, the draft model,
      the tree operations, ids, `fromDefinition` / `toDefinition`, `checkDraft`. Test-first (`/tdd`).
- [ ] (no contracts) `core/definition/marks.ts`. Test-first.
- [ ] `core/api/api.types.ts`, the one mirror of `contracts/api.md`; the four api services; the two interceptors
      and `ApiError` (Design E), with `HttpTestingController` specs.
- [ ] `core/glossary`: model, service and cache, the lookups of Design F, tested against `contracts/glossary.json`
      and against a synthetic glossary with other entities.
- [ ] `core/definition/pointer.ts`: a definition error to its node and its input, tested with
      `contracts/examples/invalid/*.json`.
- [ ] `core/text/text-parts.ts` and the shared `mark`, `value` and `text-parts` components (Design H).
- [ ] `core/i18n/format.service.ts` (Design C).
- [ ] `e2e/fixtures` and `e2e/support/routes.ts` per Design O: the glossary, the six examples as controls, validate
      answers, runs and result pages for every state.
- [ ] `he.json`: `errors.<CODE>` and `errors.definition.<CODE>` for every code of `contracts/errors.md`; the key
      guard now reads that file.
- [ ] `.claude/skills/dc-web/SKILL.md`: the facts this plan changed (text arrives as parts and the client has no
      renderer; the `mocked` and `gate` spec folders; a gate spec acts only on its own tagged controls and finds
      them by id).

Verify: `/check --tests`
Review: `/phase-review web`
Commit: `feat(web): definition draft, glossary and api layer`

### Phase 3: condition builder
- [ ] Impeccable setup once per session (`.claude/skills/impeccable/scripts/impeccable context --target
      web/src/app`), and `reference/craft-floor.md` before the first UI edit, as that skill requires.
- [ ] Components of Design I: relationship map, condition group (recursive), condition row, field picker, operator
      picker, value input in every kind, related-records node, adders, the note on missing values.
- [ ] `EditorStore` (Design J) with the draft only: root entity, tree, issues, traced node. The editor route renders
      the builder for a new control over the glossary fixture.
- [ ] The rules of Design G in the UI: the operator kept or reset when the field changes, the operand reset when its
      kind changes, limits disable the adders, the last row of a nested group removes the group, focus moves to a
      new row and back after a removal.
- [ ] The row's container query (one line from 560px of its group, stacked below), the rail, the joiner, the
      nesting indents.
- [ ] Component specs: adding and removing conditions and groups (the §13 test), the operator list follows the
      field, the value input follows the type and the arity, the comparison toggle.
- [ ] `e2e/support/builder-driver.ts`, first version, and `e2e/mocked/builder.spec.ts`: examples 5 and 6 built
      through the driver, one of them by keyboard only; screenshots of a deep tree at 390 and 1440.
- [ ] `docs/design.md`: the related-records node carries its own letter (decision 4), and its head as built.

Verify: `/check --tests` · `cd web && npx playwright test e2e/mocked/builder.spec.ts`
Review: `/phase-review web`
Commit: `feat(web): condition builder from the glossary`

### Phase 4: editor: sentence, save, run, errors
- [ ] Sentence field: the parts with their marks, the validate loop of Design J, the stale state, the first-time
      hint, the status line, `aria-live`.
- [ ] The trace across row and clause. The settle when a clause changes (cut 2).
- [ ] Load (an existing control, a new one, `?from=<id>`, a suggestion in router state), the details fields, save,
      save and run, cancel, archive with the confirm dialog, the toasts.
- [ ] Errors: client issues on save, 422 mapped to rows and inputs, the conflict banner with its reload, an outdated
      definition on load, the engine down.
- [ ] A root entity change clears the tree with an Undo toast; `beforeunload` while the draft is dirty.
- [ ] Specs: validation errors map to rows (the §13 test); the validate loop (no request for an incomplete draft,
      stale while incomplete, an older answer never replaces a newer one); the save states.
- [ ] `e2e/mocked/editor.spec.ts`: new, existing, incomplete, 422 on a row, conflict, outdated, engine down;
      screenshots.
- [ ] `docs/design.md`: Rule sentence (the stale form replaces the open clause), the stale token with its measured
      contrast (at least 4.5:1 on Action; white at 72% measured about 4.8 in planning, re-measure), the settle's
      trigger, and the closing paragraph on what the contracts now provide.

Verify: `/check --tests` · `cd web && npx playwright test e2e/mocked/editor.spec.ts`
Review: `/phase-review web`
Commit: `feat(web): control editor with the engine's sentence, save and run`

### Phase 5: run results
- [ ] `ResultsStore` with the query parameters of Design D; page head, plain sentence, run summary, breakdown,
      toolbar, results table and card rows, table foot.
- [ ] Reasons from `textParts` with the actual values marked; marks from the definition of the version that ran;
      the trace across breakdown, sentence and reasons; the active mark while a condition filters.
- [ ] The states of Design L: loading and re-run skeletons, no violations, cap exceeded, timed out, outdated
      definition, failed otherwise, a search that matches nothing, run not found.
- [ ] Sort (cut 4): the first column's header, and the sort select on a phone.
- [ ] Specs: the results table (marks, marked values, `<bdi>`), the breakdown filter, the state chosen from a run.
- [ ] `e2e/mocked/results.spec.ts`: every state above; screenshots.
- [ ] `docs/design.md`: the rows of the States table that decisions 15 and 16 change.

Verify: `/check --tests` · `cd web && npx playwright test e2e/mocked/results.spec.ts`
Review: `/phase-review web`
Commit: `feat(web): run results with reasons, breakdown and states`

### Phase 6: controls list and suggestions
- [ ] `ListStore`, the table and card rows, the toolbar (search; entity and state filters; the phone's filter
      button), the result cell, run in place (decision 8), edit, duplicate, paging, the two empty states, loading.
- [ ] The archived view (cut 1): the state filter and archived rows with duplicate only.
- [ ] The suggestions dialog per Design M: request, drafts with marks, selection, create selected, open in editor
      (cut 3), its empty and failed states.
- [ ] Specs: the result cell from `lastRun`, run in place, the dialog's selection count.
- [ ] `e2e/mocked/list.spec.ts` and `suggestions.spec.ts`; screenshots, among them the first screen of the
      delivered system (six examples, none of them run: Design K). `e2e/preview.ts`.
- [ ] `docs/design.md`: the archive dialog's text (no restore).

Verify: `/check --tests` · `cd web && npx playwright test e2e/mocked`
Review: `/phase-review web`
Commit: `feat(web): controls list and suggestions dialog`

### Phase 7: the real stack
- [ ] `git merge main` when the api and the engine are on it, or run them from their worktrees; the db runs from
      the main tree. Say what will run and for how long, and wait for the word. Port 8000: ask before stopping
      another project's container.
- [ ] `e2e/support/gate.ts` per Design O: the health check, the tag, the ids a test created, the teardown.
- [ ] `e2e/gate/examples.spec.ts` per Design O: the six examples built through the UI under tagged names, saved,
      run and read; example 4 leaves `gate-editor` and `gate-results`; one example reloads its results by URL.
- [ ] `e2e/gate/list.spec.ts`, on a control of its own (example 4, created through the api): `gate-list` before it
      creates anything; the row found by search and id; run from the row and the row's result; search and the
      condition filter on that run's results; duplicate, the copy saved and found by its own id; archive, after
      which no active row carries the test's tag.
- [ ] `e2e/gate/suggestions.spec.ts` per Design O: the drafts as the engine's answer holds them,
      `gate-suggestions`, one draft created under a tagged name and opened by its id.
- [ ] Fix what the real payloads show. A difference from the contracts is one line to Kfir, never a silent adapter.
- [ ] The pre-loaded list (decision 22). Save the "before" listing of Design O. If no control carries an example's
      exact name, say what will be posted and wait for the word, then post the six examples under their Hebrew
      names with the loop of Design O (with `scripts/examples.py` on the branch: `python3 scripts/examples.py
      load`). They stay, active and untouched: dc-delivery's loader skips a name that exists, archived or not, so
      an archived example is never loaded again. Then the gate twice in a row; after each run the listing equals
      the one saved before it. Without the word, skip the step and say so in the Log: dc-delivery's phase B1 is
      then the first run on such a list.
- [ ] The build the api hosts. From this worktree's own build of the api, after the merge, never from another
      session's worktree: `npx ng build`, the output copied into the `wwwroot` beside the api's executable (under
      `bin/`, which git ignores; dc-api plan, Design D), the api started as its README says, then the gate once
      with `E2E_BASE_URL=http://localhost:5000`. If the api is not on this branch yet, skip it and write that into
      the hand-over: dc-delivery's phase B1 is then the first run on a hosted build.

Verify: `/check --tests` · the gate command of Design O, on the pre-loaded list twice and once with
`E2E_BASE_URL=http://localhost:5000` (each run takes minutes against live services: say so first)
Review: `/phase-review web`
Commit: `test(web): six-example gate against the real stack`

### Phase 8: design pass
- [ ] `/impeccable audit` on the three screens; fix what fails (names, focus order, contrast, reduced motion).
- [ ] `/impeccable critique`, once per screen. Say the spend first (two opus sub-agents per run, three runs, one
      run at a time) and wait for the word. Fix its P0 and P1 findings.
- [ ] `/impeccable polish`, once, over the client.
- [ ] A keyboard pass by hand through the gate flow: every action reachable, focus visible, a dialog traps focus
      and returns it.
- [ ] `web/README.md` per Design Q: serve, test, the two e2e folders, the gate command with what it needs and
      leaves, the projects, the screenshot folder, the build output folder.
- [ ] `notes.md`, "Hand-over to dc-delivery": the as-built lines and every cut, per Design Q.

Verify: `/check all --tests` · `cd web && npx playwright test e2e/mocked` · the gate command of Design O
Review: `/phase-review web`
Commit: `fix(web): design critique and polish`

### Gate
- [ ] After phase 8: the mocked and the gate specs green on `mobile` and `desktop`, the gate on the pre-loaded
      list and, where phase 7 could run it, on the build the api hosts; `/check all --tests` green. The output
      goes to `gates/final.txt`, the screenshots to `gates/final/`.
- [ ] Kfir reads the Hebrew interface, on the preview script or the screenshots. It is the last cheap moment for a
      wording change.
- [ ] `notes.md` is complete for dc-delivery (Design Q): the hand-over block, a Log line per review, and the drift
      list checked line by line against the documents on main.
- [ ] `/ship`. Its docs-drift step edits only this task's own files (decision 26). Every other row of its table
      becomes a line under a fifth heading of the PR body, `## Docs for dc-delivery`, taken from the list in
      `notes.md`. Then the PR and the merge on Kfir's word.

## Design

### A. Workspace and folders

```
web/
  angular.json · proxy.conf.json · eslint.config.js · playwright.config.ts
  e2e/        fixtures/ (typed) · support/ (routes, driver, i18n, shots) · mocked/ · gate/ · preview.ts
  src/
    main.ts   styles/ (tokens, base, material-theme, components/)   assets/i18n/ (he.json)   assets/icons/
    app/
      app.config.ts · app.routes.ts · app.component
      core/      api/ · http/ · glossary/ · definition/ · text/ · i18n/
      shared/    one folder per reusable component (Design I)
      features/  controls-list/ · control-editor/ · run-results/ · suggestions/   (page, store, parts used once)
```

Features import `core` and `shared`, never each other; `shared` imports `core` only. Components hold no HTTP
(`.claude/rules/typescript.md`). A store is a class of signals provided by its page.

### B. Tokens, theme, fonts, icons

- `styles/tokens.scss`: the `:root` block and the three media rules of `mock/tokens.css`, names and values
  unchanged (they are those of the design.md frontmatter). Its `@font-face` rules are not copied: the font comes
  from the package's stylesheets.
- `styles/base.scss` and `styles/components/*.scss`: ported from `mock/app.css` for what stays native: buttons and
  icon buttons, links, tables and card rows, toolbar, banner, state panel, summary, meters, the builder's rail and
  joiner, the relationship map, sentence, mark, value, chip, skeleton, the reduced-motion block. Class names may
  change; values come only from tokens.
- `styles/material-theme.scss`: one light theme with `mat.theme`; the system tokens pointed at the custom
  properties with `mat.theme-overrides`; form-field density −3 (44px); and the per-component `overrides` for what
  still differs: the field's outline and shape, select and menu panels (6px, the Overlay shadow), the dialog (8px,
  a Line strong edge, the Overlay shadow, the Scrim), the snackbar (Bar, 6px), checkbox and button toggle (Ink
  selects), chips, tooltip. Never a selector on an internal `mdc-` or `mat-mdc-` class.
- Material is used for: form field with input and textarea, select with option groups, menu, chips grid, checkbox,
  button toggle (the segmented control), dialog, snackbar, tooltip, icon. Native elements with token classes:
  buttons and links, tables, the relationship map (a radio group on the CDK key manager), the meter list.
- Fields: a plain `<label>` above, outline appearance, dynamic subscript sizing, no `mat-label`.
- Icons: the SVG files in use are copied from `@material-symbols/svg-400/sharp` to `src/assets/icons/`, imported as
  text and registered with `MatIconRegistry.addSvgIconLiteral` in one file: no request per icon, so a screenshot
  never misses one. An icon that points carries a class that mirrors it under `[dir=rtl]`.

### C. Language, direction, formats

- `main.ts` sets `<html lang="he" dir="rtl">` and bootstraps with `LOCALE_ID` `he`, the registered locale data and
  `provideTranslateService({ loader: provideTranslateHttpLoader({ prefix: '/assets/i18n/', suffix: '.json' }),
  fallbackLang: 'he', lang: 'he' })`.
- `LanguageService` holds the language as a value, so components read `label[lang]` and nothing else names `he`.
  There is no switch and nothing is stored. An interceptor sends `Accept-Language` on every api call.
- Glossary labels are `label[lang]`. Counted nouns go through `plural.ts`: `Intl.PluralRules(lang)` picks the key
  suffix (`.one`, `.two`, `.other`) and falls back to `.other`.
- `FormatService`: dates by the date pattern of the glossary's `formats[lang]` (fallback `dd.MM.yyyy` while the glossary is not
  loaded), time as `HH:mm`, today and yesterday in words, numbers and
  seconds through `Intl.NumberFormat`. Digits are Western. User data is wrapped in `<bdi>`.
- Material's own strings come from the translation files through its `*Intl` services.

### D. Routes

| Path | Screen |
|---|---|
| `/` | controls list (query: `search`, `entity`, `state`, `page`) |
| `/controls/new` | editor, new (`?from=<id>` duplicates; a suggestion arrives in router state) |
| `/controls/:id` | editor |
| `/runs/:id` | results (query: `page`, `size`, `search`, `condition`, `sort`, `dir`) |
| `**` | the not-found state panel |

Lazy `loadComponent`, `withComponentInputBinding()`, a translated title per route. The suggestions dialog opens
from the list and has no route.

### E. API layer and errors

- `api.types.ts` mirrors `contracts/api.md` in one place: `Control`, `ControlSummary`, `Run`, `Violation`,
  `Page<T>`, `Glossary`, `Definition`, `Problem`, the parts. Services: `GlossaryApi`, `ControlsApi` (list, get,
  create, update, archive, validate, version), `RunsApi` (start, get, results), `SuggestionsApi` (request, accept).
  The base path is `/api/v1`, relative.
- `problemInterceptor` turns any failed response into `ApiError { status, code, params, errors, correlationId }`:
  a problem body as it is, status 0 as the client code `NETWORK_ERROR`, anything else as `INTERNAL_ERROR`. `detail`,
  the status text and the correlation id are never shown.

| Code | Shown as |
|---|---|
| `DEFINITION_INVALID` on save | each error on its row and its input (Design J); an error with no node in a Danger banner |
| `DEFINITION_INVALID` on the live validate | the stale sentence and the status line only |
| `CONCURRENCY_CONFLICT` | Warning banner in the editor; action: load the current version |
| `CONTROL_NOT_FOUND`, `RUN_NOT_FOUND`, `VERSION_NOT_FOUND`, `NOT_FOUND` | the not-found state panel |
| `CONTROL_ARCHIVED` | Warning banner: the control is archived and can be duplicated |
| `ENGINE_UNAVAILABLE`, `DATABASE_UNAVAILABLE`, `GLOSSARY_MISMATCH`, `NETWORK_ERROR` | Danger banner under the page head: what still works, try again |
| `QUERY_TIMEOUT` | on a run: the Danger state panel of the results; on a live call: a Danger banner |
| `CONTROL_DEFINITION_OUTDATED` (run error) | Warning state panel on the results; Warning banner and row errors in the editor |
| `REQUEST_INVALID`, `INTERNAL_ERROR` | Danger banner with general text |
| `ROW_CAP_EXCEEDED` (from `capExceeded`) | Warning banner above the table |

### F. Glossary service

One `GET /glossary`, cached for the session in a signal. A failed load leaves the list and the stored results
readable (a label falls back to a dash) and shows the engine banner. The lookups are pure over the loaded glossary:

- `rootEntities()`, `entity(key)`, and `mapFor(root)`: the entities and the labelled links the relationship map
  draws.
- `fieldGroups(scopeEntity)`: the scope's own visible fields, then one group per many-to-one path of at most
  `limits.maxPathHops`, labelled by its relationship labels. `relatedOptions(scopeEntity)`: its one-to-many
  relationships.
- `operatorsOf(field)`: the field's resolved `operators`. `operatorLabel(operator, type, rightIsField)`: the label
  variant in the order `<type>.field`, `field`, `<type>`, `default`. Choosing a picker label is the only use of
  variants in the client.
- `comparableFields(scopeEntity, field)`: the fields of the same type whose `comparable` flag is not false, when
  the operator is `fieldComparable` and the left field is itself comparable (dc-contracts plan, Design H3).
  Otherwise the comparison toggle is not offered.
- `valueLabel(field, value)` for enum and boolean values; `unit(field)`.

Nothing in `web/` names an entity, a field, a relationship or an operator key, outside tests that read them from
`contracts/`.

### G. Definition draft

- The contract types are as the schema defines them. The editor works on a draft: `DraftGroup { key, op, children
  }`, `DraftCondition { id, left?, operator?, mode: 'value' | 'field', value?, values?, right? }`, `DraftRelated {
  id, relationship?, quantifier, where }`. A group's `key` is a UI key for `track` and is dropped on the way out.
- Operations are pure and return a new tree that shares its unchanged branches: add condition, add group, add
  related, remove, set a group's operator, patch a condition, patch a related node. Ids are `c<n>` and `r<n>`, n
  from a counter seeded above the highest loaded id and never reused in a session.
- `checkDraft(draft, glossary)` returns `complete`, the issues per node (`missingField`, `missingOperator`,
  `missingValue`, `invalidNumber`, `rangeOrder`, `missingRelationship`, `tooManyValues`) and whether each adder is
  allowed under `limits`, counted as the contract counts (dc-contracts plan, Design H3 and H4b): depth is the
  number of group nodes on the longest chain, the root group and a related node's `where` group included;
  conditions are every condition and every related node, so a mark never passes the thirtieth letter; values are
  limited per list and over the whole definition.
- Rules. A new control starts with the first rootable entity and one empty condition. Changing a field keeps the
  operator when the new field allows it and resets the operand when the type or the arity changes. Removing the
  last child of a nested group removes the group; the root group always keeps one row. The scope of a group is the
  root entity, or the related entity inside a related node. Changing the root entity replaces the tree with one
  empty condition (a toast with Undo).
- `toDefinition` exists only for a complete draft. `fromDefinition` keeps keys the glossary no longer has, so the
  row can say that its field is gone.

### H. Marks and text parts

- Order: every condition and every related node in document order, a related node before the conditions inside
  it. One function over a definition serves the three screens: the editor walks its draft, the results walk the
  definition of the version that ran (`GET /controls/{id}/versions/{version}`, fetched beside the run), and the
  suggestions dialog walks each draft's `definition`. `run.conditions` lists only the nodes a run can match, so it
  feeds the breakdown and never the order.
- Letters: Hebrew numerals (א to י, יא to יד, טו, טז, יז to יט, כ, כא and on to ל).
- States: resting, traced, active (the current filter), open (incomplete or invalid). A mark is hidden from
  assistive technology where a name says it (`condition B`) and is its name elsewhere.
- Text parts, as Design H2 of the dc-contracts plan defines them: `TextPart { text, nodeId?, role? }`.
  `sentenceParts` stands beside every `sentence` (a validate answer, a run, each entry of `conditions`, each
  suggestion) and `textParts` beside every reason's `text`; the joined `text` of a list is the plain string.
  `nodeId` is on every part of one node's clause. `role` is the placeholder the part came from: `field`, `value`,
  `actual`, `other`, `otherActual`, `relationship`. The client only draws: consecutive parts of one `nodeId` become
  one clause element; the mark stands before the first clause of each node, bound to its first word; a part whose
  role is `actual` or `otherActual` is drawn as the value. No template, no variant and no value formatting is
  applied to rendered text.
- Trace: a signal on the screen's store holds the node under the pointer or in focus (a row, a clause, a breakdown
  row, a reason), and every mark of that node fills. Settle: when a new sentence arrives, the nodes whose clause
  text changed play the 600ms settle once.

### I. Components (`shared/`: `input()` and `output()`, no HTTP, every string through a key)

- First group (phase 1): icon · banner (the error banner) · state panel · skeleton · toast · confirm dialog ·
  toolbar · table foot (the range in words, page size, previous, next).
- Second group: mark · value · text parts (plain sentence, reason line) · sentence field · relationship map ·
  condition group (recursive) · condition row · field picker · operator picker · value input · related-records
  node · run summary · breakdown · results table.
- Used once and kept in their feature: the list's table, the suggestions draft row.
- Value input by kind: number (a text input with `inputmode` and the unit at the end), text, date (decision 11),
  boolean and enum (a select with the glossary's labels), two inputs for arity 2, chips for a list (a multiple
  select for an enum), "no value needed" for arity 0, and the field picker when the comparison toggle is on.
- Related-records node head: its mark, the quantity select, the relationship select, a lead word and the all/any
  toggle of its own conditions. The wording carries no gender.

### J. Editor

`EditorStore`, provided by the page: the loaded control and its token, name, description, root entity, draft, the
`checkDraft` result (computed), server errors by node, `sentence { parts, stale }`, the traced node, `showErrors`,
the save state.

- Validate loop, on every change of the root entity or the draft. Draft incomplete: no request, and the sentence
  turns stale at once. Draft complete: after 400ms, `POST /controls/validate`; the next edit cancels it, and an
  older answer never replaces a newer one. 200: the returned parts, not stale. 422: stale, and the status line
  names the first failing condition by its mark. Unavailable: stale, and the engine banner.
- Stale: the last valid sentence stays, dimmed, with marks from the current draft (ids are stable; a clause whose
  node is gone has no mark). No valid sentence yet: a one-line hint. While a complete draft waits for its answer
  the sentence is not dimmed, so typing does not make it flicker.
- Save. Incomplete: `showErrors`, focus on the first offending input, nothing sent. Otherwise POST, or PUT with the
  token. Success: a toast (`saved`, or `saved as version n` when the version changed; a name-only edit keeps the
  version), and the URL becomes `/controls/:id`. 422: each error goes to its node by `nodeId`, else by resolving
  `path` against the definition that was sent; the pointer's last segment picks the input (`left`, `operator`,
  `value`, `values`, `right`, `relationship`). A message says what to fix and never echoes a key. 409: the
  conflict banner; "load the current version" refetches and replaces the screen's state.
- Save and run: save, then `POST /controls/{id}/runs`, then `/runs/{id}` whatever the run's status.
- Opening a control whose definition no longer validates: the 422 of the first validate is shown at once (Warning
  banner, row errors), and a key the glossary no longer has renders as "no longer available".
- Archive: a text button in the page head of a saved control, the confirm dialog, `DELETE`, a toast, the list.
- An archived control opened by its URL is read-only (the api answers 409 `CONTROL_ARCHIVED` to a `PUT`): the
  Warning banner, no save, and "duplicate" as the one action.
- Cancel returns to the list.

### K. Controls list

`ListStore`: the query parameters, the page of `ControlSummary`, the ids now running.

- Rows as design.md draws them: the name (a link to the editor) over the description, the root entity's label, the
  last run (today and yesterday in words, else the date; "not run yet"), the result, the actions.
- Result cell from `lastRun`: none is a dash; succeeded with violations is the count as a link to that run;
  succeeded with none is "no violations" in Success; failed or timed out is "run stopped" in Danger, linking to
  the run.
- Run: the row's button shows the spinner, the POST returns the finished run, and the row's `lastRun` is replaced
  in place. A failed request shows the banner.
- Duplicate: `/controls/new?from=<id>`. The editor loads the source, drops its id and token and adds the copy
  suffix to the name; nothing is saved until the user saves.
- Toolbar: search (300ms), root entity, state (active, archived, all); on a phone the two filters open from one
  square button. Archived rows show a chip and offer duplicate only.
- Empty: no control at all is the first-use state panel (new control, suggestions); a query that matches nothing
  is the neutral panel with "clear".
- The delivered system opens on six controls that were never run (dc-delivery decisions 5 and 6): every row reads
  "not run yet" with a dash for the result. The first-use panel shows only where the examples were not loaded.

### L. Results

`ResultsStore`: the run, the query parameters, the current page of violations.

- Head: the back link, the control's name, when it ran and on which version; "edit the control" (tonal) and "run
  again" (primary). Run again: skeleton rows, the POST, then the new run's URL.
- The plain sentence from `run.sentenceParts`, its marks from the definition of the version that ran (Design H).
  Summary: the figure with its noun, what was checked, the duration, the previous run's count and date as a link.
- Breakdown: "all violations", then one row per entry of `run.conditions` (the nodes a run can match): mark, the
  clause from the entry's `sentenceParts`, count, and its share of the total as a bar. A row is a toggle button
  that sets `condition`.
- Table from 640px and card rows below, from one data source: a column per identifying field in the glossary's
  order, then the reasons, one line each: its mark, then its `textParts` with the actual values marked. Search
  (300ms) reads the snapshot. Sort: the first column's header cycles `sort=display` ascending, descending, and off
  (`sort=key`); a select on a phone. Page size 10, 25, 50 or 100; 25 by default.
- States from the run. `succeeded` with zero: the Success state panel in place of the breakdown and the table.
  `capExceeded`: the Warning banner. `timed_out`: the Danger panel with the seconds. `failed` with
  `CONTROL_DEFINITION_OUTDATED`: the Warning panel naming the condition by its mark. `failed` otherwise: the Danger
  panel with "run again". A search that matches nothing: the neutral panel.

### M. Suggestions dialog

Opened from the list's head and from the first-use panel. `POST /suggestions` on open, with skeleton rows
meanwhile. Each draft: a checkbox (none ticked at first), the name, the sentence with its marks, the rationale, the
evidence texts as chips, and "open in editor", which closes the dialog and opens `/controls/new` with the draft in
router state. The main button counts the selection and is disabled at zero; it posts `/suggestions/accept`, then a
toast, the dialog closes and the list reloads. A 422 marks the draft at the failing index. No suggestions: a
sentence saying so. Opening the dialog saves and runs nothing.

### N. Translation keys and guards

- Namespaces: `app`, `common`, `list`, `editor`, `results`, `suggestions`, `states`, `material`, `errors.<CODE>`,
  `errors.definition.<CODE>`. Sentence and reason text is not here: it arrives rendered (dc-contracts decision 3).
- Hebrew text: the mock's wording wherever the mock shows the string, otherwise the voice of `docs/PRODUCT.md`
  (action nouns, no gendered address, no database terms).
- Guard specs: `he.json` holds no empty value; every code and every definition
  error code of `contracts/errors.md` has its key; no Hebrew letter in `src/app/**/*.{ts,html}`; no hex colour
  outside `tokens.scss`, and no physical side (`left`, `right`, `margin-left`, `padding-right` and the like) in
  any stylesheet.

### O. Tests, fixtures, Playwright

- Unit and component specs sit beside their files; the pure logic is written test-first. Expected values come from
  `contracts/`, read from disk: the six examples round-trip through `fromDefinition` and `toDefinition`; each
  invalid fixture's path resolves to the right node; the glossary lookups. One synthetic glossary with other
  entities proves nothing assumes the sample model.
- `playwright.config.ts`: projects `mobile` 390×844 and `desktop` 1440×900; `locale: 'he-IL'`,
  `timezoneId: 'Asia/Jerusalem'`. `baseURL` is `E2E_BASE_URL` when it is set and `http://localhost:4200` when it
  is not. The `webServer` block (`ng serve` on 4200, reusing a running one) exists only when it is not set, so a
  run aimed at the build the api hosts starts no dev server. No `toHaveScreenshot` baselines:
  `support/shots.ts` saves a full-page PNG as `e2e/screenshots/<project>/<name>.png`.
- `e2e/fixtures/*.ts` export typed objects that `satisfies` the types of `api.types.ts`, so a contract change
  breaks the build: the glossary (read from `contracts/glossary.json` and stripped as the engine serves it), the
  six examples as controls, validate answers, runs and result pages for every state. `support/routes.ts` answers
  `**/api/v1/**` from them with `page.route`; an api call no fixture answers is aborted and fails the test, so a
  mocked spec reaches no api at any base URL.
- `e2e/mocked/` runs on fixtures alone and needs no service. Its list is a fixture too: the first-use state (no
  control at all) exists only there, and one list fixture is the first screen of the delivered system, six
  examples that were never run.
- `e2e/gate/` needs the api with the engine and the db, at `baseURL`. Its specs take `test` from
  `support/gate.ts`. A worker fixture there reads `/api/v1/health` once and stops with one clear line unless
  `database` and `engine` are both `ok`: health answers 200 also when the stack is degraded (dc-api plan).
- `support/builder-driver.ts` builds any definition through the UI. It walks a definition from
  `contracts/examples/<id>.json` and, node by node, adds the row and picks the field by its glossary label and
  path, the operator, the value or the other field, the related node and its quantity. One driver for all six
  examples: that is what makes the gate a proof of a generic builder.
- Gate assertions per example: the total; the set of record keys on the results equals
  `expected.violations[].key`; for each record, the marks shown equal the marks of its `matched` ids. A run from
  the UI uses today's date, and the expected sets hold for every run date from 2026-11-01 to 2027-12-31
  (dc-contracts decision 1), so the gate sends no run date. Example 1's other set, for 2026-10-31, is out of its
  reach.
- Specs find elements by role and `data-testid`, read interface text from `he.json` and labels from
  `contracts/glossary.json`. No Hebrew literal in a spec. A control is found by its id in every spec, and a name
  is compared whole (`exact: true`), never as a substring.
- `e2e/preview.ts`: a headed Chromium over the same routes, paused, to look at the app with no backend.

**The gate on a list it does not own** (decisions 22 and 25). In this task the gate runs at 4200. dc-delivery runs
it at `E2E_BASE_URL=http://localhost:5000`, where the list already holds the six examples under their real names,
loaded through the api and never run. The list may also hold other people's controls and what an earlier gate run
left behind.

- **Own controls only.** A gate spec acts only on controls it created in that test. It never opens, runs, edits,
  duplicates or archives another control: the six loaded examples are the same after a run as before.
- **No assumption about the list.** No gate spec waits for the first-use state. None counts, orders or pages the
  unfiltered list, and none expects a row at a position. A count is asserted only under a search for the test's
  own tag.
- **Names.** `support/gate.ts` gives every test a tag: `e2e-` and six random base-36 characters, new for each test
  in each project. A control the gate creates is named `<the example's Hebrew name> <tag>`; the copy that
  "duplicate" makes keeps the tag inside its name. Nothing is created under an example's bare name, not even for
  a moment: dc-delivery's `scripts/examples.py` finds its controls by exact name, archived ones included.
- **Identity.** A control is known by its id: from the URL after a save in the UI (`/controls/<id>`), or from the
  api's answer when the fixture created it. A list row is found by a search for the control's full name and then
  by the row whose editor link ends in that id. An example's bare name is never a locator: it matches the loaded
  example, and as a substring every tagged copy.
- **Arrangement.** `examples.spec.ts` builds through the UI; that is the proof. `list.spec.ts` creates its control
  through the api (`POST /api/v1/controls` with the example's definition and a tagged name), because building is
  proven by then.
- **Cleanup.** The fixture keeps the ids a test created and archives each through the api in its teardown, also
  when the test failed (`DELETE /api/v1/controls/<id>`; a repeat answers 204). The api deletes nothing, so the
  archived controls stay, about eighteen per run, each recognisable by its tag. A killed run can leave active
  ones; they do not disturb a later run.
- **Suggestions** (decision 27). `suggestions.spec.ts` opens the dialog from the list's head and waits for the
  answer to `POST /suggestions`. It asserts what that answer holds and no fixed number: as many drafts as items,
  at least one, each with its sentence and marks, none ticked. It shoots the dialog, ticks the first draft and
  creates it. The dialog has no rename, so the spec adds the tag to that item's `name` in the request on its way
  out (`route.continue` with the changed body). The id comes from the answer to `/suggestions/accept`; the control
  is opened by that id and archived in the teardown.
- **Shots.** `list.spec.ts` shoots the list before it creates anything (`gate-list`); `examples.spec.ts` shoots
  example 4 in the editor before the save (`gate-editor`) and its results (`gate-results`); `suggestions.spec.ts`
  shoots the dialog (`gate-suggestions`). Both projects write them, so `e2e/screenshots/desktop/` holds the four
  at 1440 and `mobile/gate-results.png` is the results at 390: the five images of dc-delivery's decision 27. The
  editor and results shots show the tag in the control's name.
- **Command.** `cd web && npx playwright test e2e/gate --project=mobile --project=desktop --workers=1`, with
  `E2E_BASE_URL=http://localhost:5000` in front for the build the api hosts. One worker keeps another test's
  controls out of the list shot and the runs apart; the specs pass without the flag too.
- **Before and after.** The listing below prints every control that carries no tag. Saved under `gates/` before a
  gate run and after it, the two files are equal: the gate changed nothing it did not create.

  ```
  curl -s 'http://localhost:5000/api/v1/controls?active=all&pageSize=100' \
    | jq -c '.items[] | select(.name | test(" e2e-[0-9a-z]{6}") | not) | [.id, .name, .version, .isActive, .lastRun.id]'
  ```
- **Pre-load** (phase 7, on Kfir's word). The committed loader is dc-delivery's `scripts/examples.py`. Until it
  exists, the six examples are posted once from the worktree root, and they stay:

  ```
  for f in contracts/examples/*.json; do
    jq '{name: .name.he, description: .description.he, definition}' "$f" \
      | curl -sS -o /dev/null -w "%{http_code} $f\n" -X POST http://localhost:5000/api/v1/controls \
          -H 'content-type: application/json' --data-binary @-
  done   # six lines, each starting with 201
  ```

### P. Asks to dc-contracts (Kfir carries them; this task never edits that plan or `contracts/`)

| Ask | State on 2026-11-10 |
|---|---|
| Each part carries its text, the node it speaks for and what kind of text it is | met: dc-contracts plan, Design H2 (`nodeId`, `role`) |
| `conditions[]` lists every condition and related node, with `count` null inside a related sub-tree | withdrawn: Design H4c lists the nodes a run can match, and the client takes the order from the version's definition (decision 12). Should the engine session widen the list after all, the breakdown skips an entry whose `count` is null |
| Glossary `formats`: the Hebrew date pattern is `dd.MM.yyyy` | approved by Kfir; not in the dc-contracts plan yet (its Design B says `dd/MM/yyyy`) |
| `identifyingFields` name first (employee: `first_name`, `last_name`, `employee_number`; department: `name`, `department_number`), and `display_text` defined as those values joined by one space in that order | approved by Kfir; not in the dc-contracts plan yet (its Design B lists the number first) |

Already settled by the dc-api plan (read 2026-11-10): a `PUT` on an archived control is 409 `CONTROL_ARCHIVED` and
there is no un-archive; `sort=key` is the engine's key order (`seq`) and the default, `sort=display` is
`display_text` then `seq`; the static hosting falls back to `index.html` behind the api catch-all.

Checked at the reconciliation of phase 2, as facts and not as asks: reason `params` hold keys and raw values; `GET
/controls/{id}` and its versions answer for an archived control; the public glossary serves `comparable`, `limits`
and `formats`.

Declined by Kfir: a restore endpoint.

### Q. Hand-over to dc-delivery (decisions 22 to 27)

dc-delivery reads this task's `notes.md` and `web/README.md` in its phase B0, runs the gate specs on its composed
stack in B1, takes its README screenshots from that run, and builds `docs/ai-usage.md` from the notes Logs of the
five tasks.

| Document | Whose |
|---|---|
| `web/README.md`, `docs/design.md`, `.claude/skills/dc-web/SKILL.md` | this task's (decision 26) |
| `README.md`, `docs/architecture.md`, `docs/control-definition.md`, `docs/glossary.md`, `docs/examples.md`, `docs/assumptions-limitations-extensions.md`, `docs/ai-usage.md`, `sql/README.md`, `docs/submission.he.md`, the document rows of `.claude/CLAUDE.md` | dc-delivery's: never edited here, even when a line in them is wrong |

- **Drift.** `notes.md` keeps the list "Docs for dc-delivery". A line is added when a phase makes a sentence in
  one of dc-delivery's documents untrue, or learns a limit a reader should be told: the document, the section,
  what is true now. Before `/ship` each line is checked against the documents as they stand on main, because
  dc-contracts aligns some lines of §8 itself.
- **PR body.** The four headings of `/ship` and a fifth, `## Docs for dc-delivery`, with that list. The edits to
  `docs/design.md` are this task's and stand under `## What`.
- **`web/README.md`** holds what dc-delivery records as built: how to serve (the proxy to 5000), the unit tests,
  the two e2e folders, the gate command with `E2E_BASE_URL`, what the gate needs (the api, the engine and the db
  healthy) and what it leaves (archived controls with `e2e-` in their names), the two projects, the
  screenshot folder with the five gate shots, the build output folder.
- **`notes.md`, "Hand-over to dc-delivery"**: the state of its asks; the as-built facts in ten lines at most; every
  cut of decision 7 that was taken, with the sentence dc-delivery must write about it; whether the gate ran on a
  pre-loaded list and on the hosted build; what this task left in the dev `dq` (the six examples of phase 7, with
  the date and the commit `contracts/examples/` was at).
- **The Log** (decision 24). A line is written when the thing happened and says what the session saw.
  - A phase: `<date> phase N on <model>: <shas>, gate gates/phase-N.txt`, and any cut with its reason.
  - A review: `<date> /phase-review web, phase N (one reviewer agent, opus), diff <sha>..<sha>: standards c/w/i,
    plan c/w/i. <file>: <finding>; … Fixed in <sha>: … Left: … (why).` The same form serves `/impeccable audit`,
    `critique` and `polish`, with their own severities and their number of agents.
  - Kfir: what he rejected, rewrote or decided, in his words where he wrote any. A review he relays from the
    claude.ai chat is logged as relayed by him: what it found and what changed.
  - A review that found nothing is logged as that, with its range; one that did not run, as not run, with the
    reason. No verdict stands in for the findings, and no line says what Kfir read or approved unless he said so.

## Risks

- **Design H of the dc-contracts plan can still move** until that task writes `contracts/api.md` (its phase 4).
  This plan follows H as it stood on 2026-11-10 at 19:54: `TextPart { text, nodeId?, role? }`, and `conditions[]`
  as the nodes a run can match. The reconciliation of phase 2 is the check.
- **The contracts differ from what this plan read** (Design E and F of the dc-contracts plan, before it ran).
  Phase 2 opens with the reconciliation, the contracts win, and the fixtures are typed, so a later change fails
  the build and not a screenshot.
- **The api or the engine is late.** Phases 1 to 6 need neither. Phase 7 waits for both; if the wait eats the
  budget, the gate run moves to dc-delivery on Kfir's word and this task ships on the mocked specs. The gate specs
  are written to Design O either way, and the hand-over says that they never ran.
- **Material theming eats time.** Two hours for the theme in phase 1. Where a token does not reach, keep
  Material's default, note it for phase 8, and never pierce an internal class.
- **Validate round trips.** Answers can arrive out of order (cancel, and a sequence check), and a typing user must
  not see the sentence flicker (dimmed only while incomplete or invalid).
- **Zoneless, Material and Vitest.** A harness may need a browser API that jsdom lacks. Keep component specs to
  the DOM, inputs and outputs, and move what jsdom cannot do to a mocked Playwright spec.
- **The suite guard matches the Playwright MCP server** that every session starts: `playwright-mcp` matches the
  pattern `playwright`, so the check always reports a running suite. Check with `pgrep -fa "pytest|dotnet test|ng
  test|vitest|playwright test"`. The fix to CLAUDE.md and the check skill is Kfir's (infra).
- **Deep links** rely on the api's fallback to `index.html` (in the dc-api plan). The gate reloads a results page by
  its URL; on the build the api hosts (phase 7, or dc-delivery's phase B1) a 404 there is one line to the api
  session.
- **Port 8000** may be held by another project's container: ask before stopping it.
- **Merging main into `feat/web`** (phases 2 and 7) can conflict in `.claude/` files both sides touched. This task
  edits `.claude/` in one place, the dc-web skill file, after the merge of phase 2 (decision 26).
- **The gate runs on a list it does not own** (decision 22). The rules of Design O are the defence, and phase 7
  checks them: two runs on a list that holds the six examples, with every untagged control compared before and
  after. If Kfir withholds the pre-load, dc-delivery's phase B1 is the first such run.
- **With the examples loaded, the suggestions repeat controls the list already holds**: the
  engine proposes the rules of examples 2 to 5 (dc-engine decision 1) and dc-delivery loads all six (its decision
  5). No plan marks or hides a suggestion that exists, and creating one adds a second control with the same rule.
  A mark would need the api to compare definition hashes, which is a contract ask. Kfir decides whether it
  matters for the demo.
- **Gate leftovers.** The api deletes nothing: each gate run adds about eighteen archived controls, all tagged, and
  a killed run can leave active ones. They are harmless to a later run, and a grader's database starts without
  them.
- **The tag shows in two of the README shots**: the editor and the results carry it in the control's name. Taking
  them as they are is dc-delivery's call.
- **Hebrew wording** is written by the executor. Kfir's read-through at the gate is the check.
- **Time**: the cut order of decision 7. A cut is recorded in notes with its reason; the gate items are never cut.

## Out of scope

- A renderer of sentences or reasons in the client, and any change to `contracts/` (asks go through Kfir).
- Restoring an archived control; reordering or dragging conditions; a leave-without-saving dialog; a dark theme.
- Screens the API could feed but §8 does not list: run history per control, version history and diff.
- Sign-in, export, scheduling, a glossary editor (architecture §20).
- The api's static hosting (dc-api). The compose services, the example loader `scripts/examples.py`, the
  manual-path scripts, the root README, the §17 documents other than `docs/design.md`, `docs/submission.he.md` and
  the document rows of CLAUDE.md (dc-delivery, decisions 23 and 26): not edited here, even when a line in them is
  wrong; the line goes to "Docs for dc-delivery".
- Visual-regression baselines, browsers other than Chromium, CI.
