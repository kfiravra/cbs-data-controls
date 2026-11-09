---
name: dc-web
description: "Repo facts for web/, the Angular 21 client (standalone components and signals, ngx-translate he and en, Angular Material in RTL, Vitest, Playwright at 390 and 1440). Loads on its own when files under web/ are touched. Use when building screens, the condition builder, reusable components, translation keys, error display, responsive layout or e2e specs."
paths:
  - "web/**"
---

# dc-web

Angular 21 workspace in `web/` (project `web`): standalone components only, signals for screen and editor state,
services for HTTP and the glossary cache, no global store library. Zoneless (the v21 default) with `OnPush`
components. `@ngx-translate/core` and `@ngx-translate/http-loader` with `he` as the initial and fallback language
and `en` beside it; Angular Material and the CDK; Vitest through `ng test` (the v21 default); Playwright for e2e.
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
npx playwright test     # the api on :5000 with engine and db up; screenshots at 390 and 1440
```

The Stop hook runs `npx ngc -p tsconfig.app.json --noEmit` (TypeScript and template type checks, no output) and
eslint on the touched files. `ng lint` needs `ng add angular-eslint` once; without it the CLI prompts. `npx
playwright install --with-deps chromium` needs sudo on WSL: ask the user to run it with `!`.

## Facts that bite

- Translations: `provideTranslateService({ loader: provideTranslateHttpLoader({ prefix: '/assets/i18n/', suffix:
  '.json' }), fallbackLang: 'he', lang: 'he' })`. Plugin providers go inside that config object; top-level
  `provideTranslate*` calls beside it are ignored.
- New CLI projects serve `public/` only. Add `{ "glob": "**/*", "input": "src/assets", "output": "assets" }` to the
  build `assets` in `angular.json`, or `/assets/i18n/he.json` 404s and every string renders as its key.
- A missing key renders the key itself (`errors.QUERY_TIMEOUT`), silently. A unit test asserts that `he.json` and
  `en.json` hold the same keys and cover every error code and reason key in `contracts/errors.md`.
- Language and direction are bootstrap-time: set `<html lang dir>` from the saved language before
  `bootstrapApplication` (`he` → `rtl`). `LOCALE_ID` is fixed for the app's lifetime, so a language switch stores
  the choice and reloads. Register the Hebrew locale data (`@angular/common/locales/he`) for dates and numbers.
- RTL: logical properties only (`margin-inline-start`, `padding-inline`, `inset-inline-end`, `text-align: start`,
  `border-inline-start`). Material components follow the document direction; check icons that point (arrows,
  chevrons) and flip the ones that do not mirror under `[dir=rtl]`.
- Material's built-in strings (the paginator's labels and others) stay English until their `*Intl` services are
  provided from the translation files; dates use the `he-IL` locale.
- Glossary labels come from the glossary the api serves, in the active language. The client holds no table, column
  or field name and never SQL; its validation is a convenience, not a check.
- Errors: one HTTP interceptor turns problem details (`code`, `params`, `path`) into a translated message; a
  definition error's JSON path maps to its editor row through the condition id. Never show `detail` or a status text.
- Dev server: `ng serve` on :4200 proxies `/api` to :5000 (`proxy.conf.json`), so the api needs no CORS entry for
  it. The production build lands in `dist/web/browser/`, which the api serves.
- Playwright: projects `mobile` (390×844) and `desktop` (1440×900), `locale: 'he-IL'`, `timezoneId:
  'Asia/Jerusalem'`. Each gate spec saves a full-page `page.screenshot` per screen per project; `toHaveScreenshot`
  baselines are per-OS and font-sensitive and are not used. Specs find elements by role and test id and read
  expected text from `he.json`: no Hebrew literal in a spec.

## Read before changing

[architecture.md](../../../docs/architecture.md) §8 (client), §9 (flows), §12 (errors); `docs/design.md`;
`contracts/api.md` for payloads; `contracts/errors.md` for codes and reason keys.
