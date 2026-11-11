---
name: dc-web
description: "Repo facts for web/, the Angular 21 client (standalone components and signals, ngx-translate with he.json, Angular Material in RTL, Vitest, Playwright at 390 and 1440). Loads on its own when files under web/ are touched. Use when building screens, the condition builder, reusable components, translation keys, error display, responsive layout or e2e specs."
paths:
  - "web/**"
---

# dc-web

Angular 21 workspace in `web/` (project `web`): standalone components only, signals for screen and editor state,
services for HTTP and the glossary cache, no global store library. Zoneless (the v21 default) with `OnPush`
components. `@ngx-translate/core` and `@ngx-translate/http-loader` with `he` as the one language (the texts stay
keyed by language; there is no `en.json` and no language switch); Angular Material and the CDK; Vitest through
`ng test` (the v21 default); Playwright for e2e.
One page since the UX pass of 2026-11-11: the controls list is the parent route and holds a panel (a modal
sheet at the inline end) in which the routed screens open: control editor, run results; the suggestions open as
the same sheet through `MatDialog`. The visual design is `docs/design.md`, worked through `/impeccable`. Conventions:
[.claude/rules/typescript.md](../../rules/typescript.md).

## Reusable components (§8: the editor and the suggestions dialog share them)

condition group (recursive) · condition row · field picker · operator picker · value input · related-records node ·
rule sentence bar · entity cards · entity chain · results table · run summary · error banner · confirm dialog.

Each takes `input()` / `input.required()` and emits `output()`, holds no HTTP, shows glossary labels in the active
language, and puts every other string through a translation key. Look for the existing one before writing another.

## Verify

```
cd web && npx ng lint && npx ng test --watch=false && npx ng build
npm run typecheck:e2e            # the Playwright specs and their typed fixtures; Playwright itself checks no types
npx playwright test e2e/mocked   # route fixtures only, no service; screenshots at 390 and 1440
npx playwright test e2e/gate --project=mobile --project=desktop --workers=1   # the api on :5000 with engine and db up
```

Two e2e folders. `e2e/mocked` runs on an in-memory api (`e2e/support/routes.ts`) whose text comes from a fake engine
(`e2e/support/fake-engine.ts`, held to the worked example of `contracts/api.md` §5) and whose records come from
`sql/60_seed_hr.sql`; a call no fixture answers fails the test. `e2e/gate` needs the real stack. A gate spec acts
only on controls it created in that test, named `<example name> e2e-<6 chars>`, and finds them by id, never by a
bare name: the list it runs on also holds the six loaded examples and other people's controls.

The Stop hook runs `npx ngc -p tsconfig.app.json --noEmit` (TypeScript and template type checks, no output) and
eslint on the touched files. `ng lint` needs `ng add angular-eslint` once; without it the CLI prompts. `npx
playwright install --with-deps chromium` needs sudo on WSL: ask the user to run it with `!`.

## Facts that bite

- Translations: `provideTranslateService({ loader: provideTranslateHttpLoader({ prefix: '/assets/i18n/', suffix:
  '.json' }), fallbackLang: 'he', lang: 'he' })`. Plugin providers go inside that config object; top-level
  `provideTranslate*` calls beside it are ignored.
- New CLI projects serve `public/` only. Add `{ "glob": "**/*", "input": "src/assets", "output": "assets" }` to the
  build `assets` in `angular.json`, or `/assets/i18n/he.json` 404s and every string renders as its key.
- A missing key renders the key itself (`errors.QUERY_TIMEOUT`), silently. A unit test asserts that `he.json`
  covers every error code in `contracts/errors.md`. Reason and sentence text is
  not in these files: it arrives rendered from the engine, whose one source is the glossary.
- Language and direction are bootstrap-time: set `<html lang="he" dir="rtl">` before `bootstrapApplication`.
  `LOCALE_ID` is fixed for the app's lifetime. Register the Hebrew locale data (`@angular/common/locales/he`) for dates and numbers.
- RTL: logical properties only (`margin-inline-start`, `padding-inline`, `inset-inline-end`, `text-align: start`,
  `border-inline-start`). Material components follow the document direction; check icons that point (arrows,
  chevrons) and flip the ones that do not mirror under `[dir=rtl]`.
- Material's built-in strings (the paginator's labels and others) stay English until their `*Intl` services are
  provided from the translation files; dates use the `he-IL` locale.
- Glossary labels come from the glossary the api serves, in the active language. The client holds no table, column
  or field name and never SQL; its validation is a convenience, not a check.
- Text arrives rendered, as parts: `sentenceParts` beside every `sentence`, `textParts` beside every reason's `text`,
  each part `{ text, nodeId?, role? }`. The client has no renderer: `shared/text-parts` draws the parts (a mark
  before the first clause of each node, `actual` and `otherActual` parts as values) and applies no template, variant
  or value format. Marks are computed from a definition's order alone (`core/definition/marks.ts`); their letters
  are `common.markLetters` in `he.json`.
- Errors: `problemInterceptor` turns every failed api call into `ApiError { status, code, params, errors }`; a body
  that is not a problem is the client code `NETWORK_ERROR`. The text of a code is `errors.<CODE>.title` and `.body`,
  of a definition error `errors.definition.<CODE>`. A definition error goes to its row by `nodeId`, else by
  resolving `path` against the definition that was sent (`core/definition/pointer.ts`). Never show `detail` or a
  status text.
- Unit specs read `contracts/` and the sources with `node:fs` (`src/testing/`). The unit-test builder bundles for
  the browser, so the test target builds with the `testing` configuration, which keeps `node:fs` and `node:path`
  external; `src/testing/**` is excluded from `tsconfig.app.json`.
- Material in RTL: `MatSnackBar` reads `horizontalPosition: 'start'` as the left edge unless the config carries
  `direction`; `[attr.aria-label]` on `mat-select` is overwritten by its own host binding, so bind its `aria-label`
  input. Never select an internal `mdc-` or `mat-mdc-` class: use the component's `overrides` mixin
  (`src/styles/material-theme.scss`), a rule on the host element, or a panel class the app passes in. Where no
  token exists (the focus ring of a button-toggle segment) the rule names the component's element and its state
  in ARIA.
- A button its own press makes unavailable (run, save, run again, the pager's ends) takes
  `[attr.aria-disabled]`, and its handler ignores a second press: `disabled` would drop the focus the button holds.
  `disabled` is for a button that cannot be used as the screen stands. Both look the same (`_buttons.scss`).
- Reduced-motion rules live in `styles/components/_motion.scss`, the last partial of `styles.scss`: they have the
  specificity of the rules they switch off, so only the order makes them win.
- One page: `ControlsListPage` is the route `''` with three children (`controls/:id`, `controls/:controlId/runs`,
  `runs/:id`) and renders their outlet inside its sheet, created only while a child address is shown. It reads its
  own view (search, filter, tab, page) from the address only when no child is active and keeps it in memory under
  a panel: the panel's query (`page`, `search`) would otherwise be read as the list's. Never bind the list's view
  through `withComponentInputBinding`.
- A screen in the panel must not navigate after an `await` once it was left (`left`, set on destroy): a run or
  a save that lands late would open the panel again. It reports to `ListChanges` instead, and the list reads
  itself again.
- Layout inside the panel answers to the panel's width: `@container sheet (min-width: …)`, not `@media`. A screen
  in the panel is `.sheet__screen` with `.sheet__head`, `.sheet__body` (the one scroller) and `.sheet__foot`.
- Test ids are shared between the list and what stands in the panel (`toolbar-search`, `table-range`,
  `error-banner`, `skeleton-row`): a spec of a panel screen looks inside `page.getByTestId('panel')`. The panel's
  title is `panel-title`; `page-title` is the list's.
- Esc is heard in the capturing phase on the document (the list's page): a tooltip of Material would otherwise
  take the first Esc for itself. An open `mat-select` is left its Esc by its state in ARIA
  (`[role="combobox"][aria-expanded="true"]`).
- From 640px the page and a panel's body keep the room of their scrollbar (`scrollbar-gutter: stable`), so
  nothing moves sideways when one appears; below 640px they do not (a phone lays its scrollbar over the page).
  A fixed layer is laid out beside the page's scrollbar: compare a panel's width with
  `document.documentElement.clientWidth` or with its layer, not with the viewport size.
- The details of a list row are under the name's stretched link (`.row-link::after`): Playwright reports a
  click on another cell as intercepted. A spec clicks the details with `click({ force: true })`, which lands on
  the link as a user's click does; the run and action cells stand over the link and are clicked as usual.
- A button that says it is unavailable with `aria-disabled` is not enabled for Playwright: `click()` waits on
  it. A spec that presses such a button on purpose forces the click.
- `app-text-parts` draws a rule as plain text with no letter in it: with `marks`, each condition's clause
  carries `data-tone` (the place of its colour in the set of eight, `tonesOf` in `core/definition/marks.ts`) and
  is underlined in that colour by a drawn line (a gradient that fades at both ends, not a text decoration, and
  placed inside the words' own line box: no padding, nothing added to the height).
  The same `data-tone` is on the condition's `app-mark` in the builder, on the filter chips and beside the
  reasons. A rule's group marks are not written: a top-level group is a `rule-line`, a group inside a group a
  line with `data-depth="1"`, and each group's line starts with its joining word (never a line of one alone).
  The marks are the glossary's `groupOpen` and `groupClose` (round brackets until a
  glossary is read), looked for only in parts with no `role`: a bracket in a value, a label or a relationship's
  name is data and stays. A drawing with colours or lines carries the engine's plain sentence, each condition
  named by its mark (not where `named` is false: a suggestion shows no letters), in a visually hidden
  `plain-text` span and is itself hidden from assistive technology (`drawn-text`), so `textContent` of such a
  sentence holds the words twice. A reason (`markValues`) keeps its brackets. A spec reads a rule's colours
  with `ruleTones`, and a painted colour with `lineOf` and `groundOf` (`e2e/support/rule.ts`); it writes the
  colours it expects out and never computes them the way the code does.
- A results view sorts by a column: an identifying field's key or `_reasons` (`REASONS_COLUMN`, a name no
  field can have) in the address (`?sort=`), sent to the api as `sort=field&field=<key>` or `sort=reasons`;
  null is the run's order (`sort=key`).
- The builder offers one adder until its "advanced" action is pressed (`data-testid="advanced"`), or the draft
  holds a group or a related-records node. The e2e builder driver presses it before a group or a related node.
- A shot with a panel open is of the window, not the whole page (`e2e/support/shots.ts`): the page behind the
  panel is held still by the CDK's block scroll strategy and a full-page picture would show it running on.
- The entity cards are a radio group whose arrows move the focus and choose nothing; Space, Enter or a click
  chooses. A choice resets the condition tree, so it must never follow from passing over a card (the critique
  of 2026-11-11 found two arrow presses losing a control's conditions).
- A results panel always shows the rule: a run that stopped carries no `sentenceParts`, so the store asks
  `POST /controls/validate` once with the definition of the version that ran. A store spec of a stopped run
  answers that request.
- A new control has nothing chosen: until one of the entity cards is pressed the builder's place is held by
  `builder-waiting` (no `condition-builder` in the page), and that press asks `POST /suggestions` with
  `rootEntity` and `max: 3` (a store spec answers it; a mocked spec gets the fake api's). The answer stands
  behind one row (`ideas-toggle`), which is in the page from the choice on and comes in with an animation (a
  spec that measures it waits with `atRest`): the options (`idea`) are in the page only while it is open. Its
  words are repeated in a hidden `role="status"` (`ideas-status`); an open list closes on a press also while
  it waits (`ideas-pending`).
- The editor has no leave guard: the panel closes at once, and a changed draft is kept in memory
  (`ClosedDrafts`, one draft) and offered back by a toast that stands twelve seconds. Its action asks for the
  draft (`ClosedDrafts.ask(path)`) and navigates to the editor's address; the editor takes it in `show()`, or,
  when it already stands at that address and no navigation happens, in the effect on `ClosedDrafts.wanted`.
  The draft that is asked back is taken before the draft it replaces is kept: there is room for one. A draft
  left while its save was on its way is offered back only if that save fails. Only the browser's own
  `beforeunload` prompt is left: a spec that reloads or `goto`s away from a changed draft answers that dialog.
- `EditorStore.save` holds the turn it was sent in: when another control took the screen meanwhile (`open`,
  `restore`), the answer changes nothing of that control.
- The glossary is read once per page load: a store spec that opens twice answers `/api/v1/glossary` the first
  time only.
- The results store reads the run's control beside the run (`GET /controls/<id>`, for whether it is archived):
  a store spec answers it or leaves it to the spec's teardown.
- `vitest` is pinned to `~4.0.8`: npm 10.9.2 crashes resolving the peer set of 4.1.x.
- Dev server: `ng serve` on :4200 proxies `/api` to :5000 (`proxy.conf.json`), so the api needs no CORS entry for
  it. The production build lands in `dist/web/browser/`, which the api serves from the `wwwroot` beside its own
  app (the folder must exist when the api starts): under `dotnet run` that is
  `api/src/DataControls.Api/bin/Debug/net10.0/wwwroot`.
- The api deletes nothing, so every gate run adds 18 archived controls to the store. A listing of "every
  control" must page (`pageSize` is at most 200): one page of 100 silently drops what sorts last.
- The real engine answers the sample data in about 10 ms and the fixtures say 412: a text that formats a
  measured value needs a spec at the real size too (the summary's `results.summary.durationUnder`).
- A toast lives six seconds and rides along through a navigation: a gate shot of the screen after a save waits
  for it to go, or it stands over the page in the image.
- A worktree's `.env` may have no engine block: start the engine there with `ENGINE_DB_HOST=127.0.0.1` and
  `ENGINE_DB_PORT=1433` in the environment (`localhost` resolves to `::1` first on WSL and the ODBC driver does
  not fall back).
- Playwright: projects `mobile` (390×844) and `desktop` (1440×900), `locale: 'he-IL'`, `timezoneId:
  'Asia/Jerusalem'`. Each gate spec saves a full-page `page.screenshot` per screen per project; `toHaveScreenshot`
  baselines are per-OS and font-sensitive and are not used. Specs find elements by role and test id and read
  expected text from `he.json`: no Hebrew literal in a spec.

## Read before changing

[architecture.md](../../../docs/architecture.md) §8 (client), §9 (flows), §12 (errors); `docs/design.md`;
`contracts/api.md` for payloads; `contracts/errors.md` for codes, reason keys and part roles (the text of a reason
comes in the payload, never from i18n).
