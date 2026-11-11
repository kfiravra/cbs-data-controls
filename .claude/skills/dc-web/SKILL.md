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
Screens follow architecture §8: controls list, control editor, run results, suggestions dialog. The visual design
comes from `docs/design.md` (written before this task), worked through `/impeccable`. Conventions:
[.claude/rules/typescript.md](../../rules/typescript.md).

## Reusable components (§8: the editor and the suggestions dialog share them)

condition group (recursive) · condition row · field picker · operator picker · value input · related-records node ·
rule sentence preview · relationship map · results table · run summary · error banner · confirm dialog.

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
  (`src/styles/material-theme.scss`), a rule on the host element, or a panel class the app passes in.
- A button its own press makes unavailable (run, save, run again, the pager's ends) takes
  `[attr.aria-disabled]`, and its handler ignores a second press: `disabled` would drop the focus the button holds.
  `disabled` is for a button that cannot be used as the screen stands. Both look the same (`_buttons.scss`).
- Reduced-motion rules live in `styles/components/_motion.scss`, the last partial of `styles.scss`: they have the
  specificity of the rules they switch off, so only the order makes them win.
- The editor's route asks before a changed draft is left (`canDeactivate`, the browser's `confirm`). Playwright
  dismisses a dialog by default, which keeps the page: a spec that leaves a changed draft answers the dialog.
- `vitest` is pinned to `~4.0.8`: npm 10.9.2 crashes resolving the peer set of 4.1.x.
- Dev server: `ng serve` on :4200 proxies `/api` to :5000 (`proxy.conf.json`), so the api needs no CORS entry for
  it. The production build lands in `dist/web/browser/`, which the api serves.
- Playwright: projects `mobile` (390×844) and `desktop` (1440×900), `locale: 'he-IL'`, `timezoneId:
  'Asia/Jerusalem'`. Each gate spec saves a full-page `page.screenshot` per screen per project; `toHaveScreenshot`
  baselines are per-OS and font-sensitive and are not used. Specs find elements by role and test id and read
  expected text from `he.json`: no Hebrew literal in a spec.

## Read before changing

[architecture.md](../../../docs/architecture.md) §8 (client), §9 (flows), §12 (errors); `docs/design.md`;
`contracts/api.md` for payloads; `contracts/errors.md` for codes, reason keys and part roles (the text of a reason
comes in the payload, never from i18n).
