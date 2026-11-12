# PR #4: feat(web): the Angular client

State: MERGED · merged 2026-11-11T09:20:12Z · merge commit 612b2b7 · branch `feat/web` into `main` · 20 commits · 231 files, +34453 -167

Commits (oldest first):
- 459782e chore(dc-web): reconcile plan and notes after phase 0
- ab0d004 feat(web): workspace, design tokens and hebrew rtl shell
- 1dda6d3 fix(web): review fixes
- d57b922 feat(web): definition draft, glossary and api layer
- e517490 feat(web): condition builder from the glossary
- a1682ae fix(web): review fixes
- 5a57791 feat(web): control editor with the engine's sentence, save and run
- de43850 fix(web): review fixes
- 3474145 feat(web): run results with reasons, breakdown and states
- dc6b420 fix(web): review fixes
- 383ec73 feat(web): controls list and suggestions dialog
- 9137de9 fix(web): review fixes
- 44a7219 test(web): gate specs for the six examples on the real stack
- 3d5836f fix(web): review fixes
- fcf0036 fix(web): design critique and polish
- 50a4e1d fix(web): review fixes
- 268a0f7 Merge remote-tracking branch 'origin/main' into feat/web
- 8be9e82 fix(web): run duration and gate shot on the real stack
- b43fd45 fix(web): review fixes
- 412b42f test(web): the edge of a run's duration in words

---

## What

The Angular client of Data Controls (`web/`): Angular 21 (standalone components, signals, zoneless), Angular
Material and the CDK, `@ngx-translate/core`, Hebrew and right to left, built for 390 and 1440. It talks only to
the application api under `/api/v1`.

- **Controls list**: search by name, filters by root entity and state (active, archived, all), run from the row
  with the result announced, edit, duplicate, and the last run's result as a link to that run.
- **Control editor**: the condition builder (groups, conditions, related-record nodes) built entirely from the
  glossary; the rule sentence drawn from the engine's answer to `POST /controls/validate`, with a mark per
  condition; save, save and run, archive; errors placed on the node the engine names; a removed condition or
  group offered back; a changed draft guarded on leaving.
- **Run results**: the control in words, the count, a breakdown by condition that filters the records, and for
  every record its identifying fields and a reason per matched condition with the actual value marked; search,
  sort, paging in the address; a state for every way a run can end (nothing found, capped, timed out, outdated
  definition, failed, still running).
- **Suggestions dialog**: the drafts the engine proposes with their evidence; create the ticked ones or open
  one in the editor.
- **No renderer and no business term in the client**: every label comes from `GET /glossary` at run time, and
  sentences, reasons and suggestion texts are drawn as the engine rendered them. Every interface text is a key
  of `web/src/assets/i18n/he.json`; errors are shown by code.
- **Tests**: 296 unit and component tests (Vitest); `e2e/mocked`, Playwright on an in-memory api with no
  service; `e2e/gate`, the six examples of `contracts/examples/` built through the interface by one generic
  driver, saved, run on the real engine and read back record by record.

Also in this branch: `web/README.md`, `docs/design.md` aligned with what was built, the `dc-web` skill's facts,
and the task folder `dev/active/dc-web/` (plan, notes with every decision and review, gate outputs). The branch
holds a merge of `main` at `eec007d` (the engine and the api), with no conflict.

## Why

It is the only thing a business user sees: the assignment asks for controls that a non-programmer can define,
run and read. The gate specs are the proof that the builder is generic: one driver that knows no example builds
all six from glossary terms.

## How to test

```sh
cd web && npm ci
npx ng lint && npm run typecheck:e2e && npx ng test --watch=false && npx ng build
npx playwright install chromium     # once per machine
npm run e2e                         # the mocked specs, no service needed
```

With the database, the engine and the api up (README, "Engine" and "The api"):

```sh
cd web && npm run e2e:gate                                    # behind the dev server on 4200
E2E_BASE_URL=http://localhost:5000 npm run e2e:gate           # on the build the api hosts
```

For the second, copy `web/dist/web/browser` into the `wwwroot` beside the api's app before it starts
(`web/README.md`).

What ran on 2026-11-11, on this branch with the engine and the api started from its own tree against the
shared database (`dev/active/dc-web/gates/final.txt`, `gates/phase-7.txt`):

- `/check all --tests`: green. `sql-check` 27 assertions, `contracts-check` 5 checks, the engine's ruff, pyright and 521 tests,
  the api's build with warnings as errors, format and 370 tests (3 live ones skipped by their own switch), the
  client's type checks, lint, 296 unit tests and build (545 kB initial, 137 kB transfer), the print guard and
  226 hook tests. `sql-init` is skipped in a worktree by the runner.
- `e2e/mocked` on `mobile` and `desktop`: 156 passed, 2 skipped by project on purpose.
- `e2e/gate`: 16 of 16 behind the dev server and 16 of 16 on the build the api hosts, on a list that already
  held the six examples under their real names. After each run the listing of every control the gate did not
  create is the same as before it.

A gate run leaves 18 archived controls with `e2e-` in their names and nothing active.

## Risks and rollback

- The client is new code beside `api/` and `engine/` and changes neither; removing `web/` removes it. Nothing in
  `contracts/`, `sql/`, `api/` or `engine/` is touched by this branch's own commits.
- Tested in Chromium only, at 390×844 and 1440×900.
- States the real stack was not made to produce (a timeout, the row cap, a database or engine that is down, a
  save conflict) are covered by the mocked specs alone.
- Leaving a changed draft by a link of the app asks through the browser's own `confirm` (notes, decision 38;
  kept on review). Reverting it is the one `canDeactivate` entry of `app.routes.ts`.
- Left open on purpose, to be listed as limitations: on a phone the breakdown stands before the records; nested
  groups have no name for a screen reader; a save conflict loads the current version and discards the draft; a
  list row's count may belong to an older version of the rule.
- The Hebrew interface texts have not had their final read-through yet; a wording change is a change to
  `he.json` alone.

## Docs for dc-delivery

Sentences in documents this task does not own that are no longer true, or limits a reader should be told
(checked against `main` at `eec007d`):

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
- `docs/assumptions-limitations-extensions.md`, decided on 2026-11-11, as limitations: on a phone the
  breakdown stands before the records; nested groups have no name for a screen reader; a save conflict loads the
  current version and discards the draft; a list row's count may belong to an older version of the rule. The
  line above about a changed draft holds for a link of the app as well as for a reload or a closed tab
  (decision 38, kept on review).
- `docs/ai-usage.md`: the Log below. The design pass of phase 8 used the impeccable skill's detector and two
  opus sub-agents per critique run.
- Dropped since the plan: the 1024 screenshot (main's §8 already says 390 and 1440), the missing
  `docs/design.md` row and the "client renders the text" gotcha of `.claude/CLAUDE.md` (both already right on
  main).

