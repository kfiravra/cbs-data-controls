# web

The Angular client of Data Controls, in Hebrew, right to left. It is one page: the list of controls, with the
control editor, the run results and the suggestions opening in a panel over it. It talks to one address, the
application api under `/api/v1`, and draws what comes back: the rule sentence, the reasons and the suggestion
texts arrive rendered by the engine.

The list is the parent route and holds the panel; the addresses are `/` (the list), `/controls/<id>` (the
editor, `new` for a control not saved yet), `/runs/<id>` (the results of a run) and `/controls/<id>/runs` (a
control's results by the control: its newest run, or its state before a first run). The panel's X, Esc and a
click beside it lead back to `/` with the list's search, tab and page as they were.
Design: [docs/design.md](../docs/design.md); payloads: [contracts/api.md](../contracts/api.md); errors:
[contracts/errors.md](../contracts/errors.md).

Angular 21 (standalone components, signals, zoneless), Angular Material and the CDK, `@ngx-translate/core` with
`src/assets/i18n/he.json`, Vitest, Playwright. Built and tested on Node 22.

## Serve, check, build

```
npm ci
npx ng serve                 # http://localhost:4200; /api is proxied to http://localhost:5000 (proxy.conf.json)
npx ng lint
npm run typecheck:e2e        # the e2e folder has its own tsconfig; ng lint and ng build do not compile it
npx ng test --watch=false    # unit tests (Vitest), specs beside their files
npx ng build                 # production build in dist/web/browser
```

`dist/web/browser` is the folder the api serves as static files; the build has no base path of its own, so it
is served from the root of whatever hosts it. The api takes it from the `wwwroot` beside its own app, and the
folder must be there when the api starts: copy the contents of `dist/web/browser` into it and then start the
api. For an api started with `dotnet run` that is `api/src/DataControls.Api/bin/Debug/net10.0/wwwroot`; for a
published one, the `wwwroot` of the publish folder.

Without the api on port 5000 every screen shows its error state with a retry. To look at the app with no
backend at all, `npm run preview` opens a headed Chromium over the in-memory api of the mocked specs and pauses
in the Playwright inspector.

## End-to-end specs

Two folders, two purposes, one config (`playwright.config.ts`).

| Folder | Runs on | Needs | Command |
|---|---|---|---|
| `e2e/mocked/` | Route fixtures: an in-memory api (`e2e/support/routes.ts`) that answers every request in the browser | Nothing but this folder | `npm run e2e` |
| `e2e/gate/` | The real stack: the api, the engine and the database | All three healthy at the base URL | `npm run e2e:gate` |

Both run in two projects, `mobile` (390×844) and `desktop` (1440×900), in the Hebrew locale and the
`Asia/Jerusalem` time zone. There is no other viewport.

Playwright starts the dev server itself (`npx ng serve --port 4200 --prebundle=false`) or reuses one that is
already on 4200. The flag matters when you start it by hand for a spec run: with prebundling, the first time a
lazy screen brings a dependency the dev server has not bundled yet it reloads the page, in the middle of a test.

Browsers: `npx playwright install chromium` once per machine.

### The gate

```
npm run e2e:gate                                    # the dev server on 4200, proxied to the api on 5000
E2E_BASE_URL=http://localhost:5000 npm run e2e:gate # the build the api hosts; no dev server is started
```

One worker, both projects, about two minutes. The gate builds each of the six examples of `contracts/examples/` in the editor from
glossary terms, saves it, runs it on the engine and reads the violating records back one by one; it then works a
control of its own through the one page (search, open, run, filter, the picker of its runs, duplicate, archive
from the row), creates one control from the suggestions panel, and fills a new control from the engine's
suggestions for its choice without saving it.

- **Needs.** `GET /api/v1/health` at the base URL answering `database: ok` and `engine: ok`; the gate checks
  this first and stops with a message that names the failing part when it does not hold. The organization data must be the seed of
  `sql/` (the expected records are the planted rows of `sql/README.md`). The expected records hold for every run
  date from 2026-11-01 to 2027-12-31.
- **May run on any list.** A gate test touches only controls it created. It never counts, orders or pages the
  list as a whole, so a list that already holds the six examples under their real names, or what an earlier
  gate run left, does not change the outcome.
- **Leaves.** Every control a test creates carries a tag in its name, `e2e-` and six characters, and is
  archived when the test ends, also when it failed. Archived controls and their runs stay in the `dq` schema:
  after one gate run there are 18 more archived controls with `e2e-` in their names (9 per project) and none
  active. Nothing is written to organization data.

### Screenshots

`e2e/support/shots.ts` saves PNGs to `e2e/screenshots/<project>/<name>.png` (git-ignored): the whole page when
the list stands alone, the window when a panel is open over it. There are no `toHaveScreenshot` baselines: they
are per-OS and font-sensitive.

The gate leaves five names in each project: `gate-list`, `gate-editor`, `gate-results`, `gate-panel` (the
results of an earlier run, chosen in the picker) and `gate-suggestions`. The five images the top-level README
uses are `gate-list`, `gate-editor`, `gate-results` and `gate-suggestions` in `e2e/screenshots/desktop/` and
`e2e/screenshots/mobile/gate-results.png`. The editor and results shots are of example 4 and show the test's tag
in the control's name. `gate-list` is the list as the run found it, before the test creates anything: on a
system loaded with the six examples it shows them, never run.

## Where things are

```
src/app/core/       api (types mirroring contracts/api.md, services), http (interceptors), glossary,
                    definition (the draft tree, its checks and edits), i18n, text, icons
src/app/shared/     components with inputs and outputs only: the condition builder, the entity cards and
                    chain, the sentence bar, the results table, the pickers, the dialog, the states
src/app/features/   controls-list (the page, and the panel that holds the routed screens), control-editor,
                    run-results, suggestions: a page and a store each
src/styles/         tokens.scss (the design tokens), the Material theme, one partial per native component
src/assets/i18n/    he.json: every text of the interface
e2e/                fixtures, support (the in-memory api, the builder driver, the gate fixture), mocked, gate
```

Every label of an entity, a field, a relationship or an operator comes from the glossary at run time
(`GET /api/v1/glossary`); the client holds none of them.
