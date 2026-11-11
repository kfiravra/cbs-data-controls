# PR #3: feat(api): the .NET application API

State: MERGED · merged 2026-11-11T07:29:16Z · merge commit eec007d · branch `feat/api` into `main` · 13 commits · 199 files, +12764 -90

Commits (oldest first):
- 8e80f74 feat(api): host skeleton, problem details and the dq persistence model
- a781c91 fix(api): review fixes
- b89bd0b feat(api): engine client, glossary cache and definition validation
- 638787d fix(api): review fixes
- 96bc1e9 feat(api): controls with versions, optimistic concurrency and archive
- a619323 fix(api): review fixes
- f54d6c2 feat(api): runs, result snapshots and the results query
- 90a5db1 fix(api): review fixes
- 0129a3b feat(api): suggestions, openapi and static hosting
- aa3b954 fix(api): review fixes
- cc9ed8c chore(api): merge origin/main with the engine into feat/api
- f3f0335 fix(api): answer 400 for a JSON body that cannot be read and keep a d…
- a40412a fix(api): security audit fixes

---

## What

The .NET 10 application API of Data Controls (`api/`), serving every row of the application table of
`contracts/api.md` under `/api/v1`:

- **Controls** with immutable versions, a concurrency token, archive, and a list with search, filters and paging.
  A definition is checked against the shared JSON Schema by the api and then by the engine before anything is
  saved; a new version is written only when the definition's canonical form changed.
- **Runs**: the run row is opened, the engine is called once, and the snapshot and the closed run go in with one
  save. Every engine failure closes the run with its code and still answers 201. Results are paged, searched,
  filtered by condition and sorted from the snapshot; the engine is never called for them.
- **Glossary** served from a cache of the engine's body (fresh ten minutes, stale when the engine is down),
  **suggestions** passed through, and **accept**, which creates all the chosen controls or none.
- **One problem shape** for every response that is not 2xx: a code and params, no prose. A correlation id on
  every response and on every engine call.
- **Engine client** with one retry for fast failures, an attempt timeout above the engine's worst case and a
  circuit breaker that counts only an engine that does not answer.
- **Bounded input**: a body is at most 1 MB and 64 levels deep and every string in it is Unicode text (else
  413 or 400); the api's schema check evaluates a tree of at most 240 nodes and 10,000 values and leaves a
  larger one to the engine, which answers with the limit's own error; a definition reaches the engine and the
  store as the text it was sent in.
- OpenAPI at `/openapi/v1.json`, Swagger UI at `/api/docs`, `api/requests.http`, and static hosting of the client's
  build with the fallback to `index.html`.

Also in this branch: the api block of `.env.example`, the api section of `README.md`, the `dc-api` skill's test
and package lines, and the task folder `dev/active/dc-api/` (plan, notes with the review log, gate outputs).

## Why

It is the only component that writes (schema `dq` only), and the client's only server. `dc-web` builds against
this surface; the engine is reached only through `contracts/`.

## How to test

```sh
docker compose up -d db && scripts/db-init.sh          # from the main tree, once
cd api && dotnet build -warnaserror && dotnet format --verify-no-changes && dotnet test
```

370 tests pass and 3 are skipped (the live tests below). The tests run the real app against the shared
database as `dq_app` (rows marked `zz-dc-api-test-`, swept before and after) with the engine stubbed at its
HTTP handler; expected values are read from `contracts/`.

Against the real engine, merged from main (PR #2) and started from this branch's tree:

```sh
cd api && DC_LIVE=1 dotnet test --filter Category=Live   # the six examples and the semantic fixtures, for real
```

and one walk through `api/requests.http`. Both were run twice on 2026-11-11, the second time on the final code:
3 live tests passed, 16 of 16 requests answered as the contract's table says
(`dev/active/dc-api/gates/live.txt`). `/check all --tests` is green (`dev/active/dc-api/gates/final.txt`).

## Security audit

One read-only `security-auditor` pass over the whole api (the Log in `dev/active/dc-api/notes.md` lists every
finding): 1 critical, 0 high, 3 medium, 5 low.

- Fixed, critical: the order of schema errors was taken from a pointer built for every element of the
  definition, so one invalid definition under 1 MB could ask for hundreds of gigabytes. Only the reported
  paths are followed now.
- Fixed, rated medium and measured as worse: 50,000 empty children (146 KB) cost the schema library 23 s and
  2.4 GB of allocations. A tree past 240 nodes or 10,000 values is left to the engine (0.05 s, live).
- Fixed, low: a number outside the decimal range in a `values` list was a 500; `text/json` passed the body
  guard.
- Left open, none critical or high, each a deployment or contract decision: `AllowedHosts` is `*`; nothing
  limits concurrent runs; an unsafe method is not checked for a cross-site origin; an engine answer has no
  size cap; `TrustServerCertificate=true`; no security headers on the static files.

## Risks and rollback

- The engine fixtures are generated from the contract's examples and glossary, not recorded from the engine.
  The live tests are the check; they pass against the merged engine.
- Where the contract is silent the two services differ on three inputs no client of ours builds: JSON text
  that does not parse (api 400, engine 415), half a surrogate pair in a string (api 400, engine 422) and a
  body nested deeper than 64 levels (api 400).
- The items the security audit left open, above.
- The tests write to the shared `DataControls` database; a killed run leaves marked rows until the next run.
- JsonSchema.Net is pinned to 8.0.5, its last MIT release, behind one class.
- Rollback: the branch adds `api/` and touches nothing another component reads; reverting the merge removes it.

## Docs for dc-delivery

Documents this task does not own, and what each should say about the api as built (plan decision 26):

- `docs/architecture.md` §7, EngineClient: one retry after 500 ms, only for a connection error or a 408, 429,
  502 or 503, and never for a health probe. The breaker opens at 5 calls with half of them failed inside two
  attempt timeouts; it counts a refused connection, an attempt timeout, a 502 and a 503 that is not a problem
  document, and does not count a 504, the engine's own 503 problem (its database is down) or a health probe
  (plan decisions 10 and 11, unattended decision 12). The response body has a limit of one more attempt timeout
  (decision 14). After a failed glossary refresh the engine is not asked again for 30 seconds (decision 13).
- `docs/architecture.md` §7 and §9, runs: once the control is found, nothing listens to the client; the row is
  opened and closed without a cancellation token, and the snapshot and the closed run go in with one save. A
  host that stops during the engine call, and a snapshot that cannot be stored, both close the run `failed`
  with `INTERNAL_ERROR` (decisions 25 and 26). The limitation for
  `docs/assumptions-limitations-extensions.md`: a run stays `running` only after a crash, or when `dq` cannot
  be reached at the moment the run is closed; there is no sweeper.
- `docs/architecture.md` §7, controls: `lastRun` of the list is read in a second query for the page's controls
  (decision 20); two saves that race are a 409 whether the row version or the version number collides
  (decision 21); an archive that meets a concurrent save is applied to the row as it is now (decision 17).
- `docs/architecture.md` §12 or `contracts/api.md` §1 and the `REQUEST_INVALID` row of `contracts/errors.md`,
  wording only: "a body that is not JSON 415". In the api 415 is a media type that is not JSON; a body sent as
  JSON that does not parse, nests deeper than 64 levels, or holds a string that is not Unicode text (half a
  surrogate pair, bytes that are not UTF-8) is 400 `REQUEST_INVALID` with `MALFORMED` at `""` (decisions 3,
  33 and 35). The engine answers 415 for text that does not parse and 422 `VALUE_TYPE_MISMATCH` for half a
  surrogate pair (its notes), so the sentence needs one clause per service. In the same place: an id or a
  version in the path may be any positive integer up to 64 bits, and one beyond 32 bits is
  `CONTROL_NOT_FOUND`, `VERSION_NOT_FOUND` or `RUN_NOT_FOUND`, not `NOT_FOUND` (decision 19).
- For the limitations document (decisions 32 and 34): `/suggest` shares the api's 75 s attempt timeout, so on a
  database slow enough for its ten statements to pass it the api answers 503 `ENGINE_UNAVAILABLE`; a stored
  definition within about 36 bytes of the engine's 1 MiB body limit can be saved and then fails its run with
  `INTERNAL_ERROR`.
- `docs/architecture.md` §13: the api's tests run the real app against the shared database as `dq_app`, with
  rows marked `zz-dc-api-test-` that the suite deletes before and after; the engine is a stub at the HTTP
  handler whose fixtures are generated from `contracts/` (decision 9); three tests against the real engine are
  opt-in (`DC_LIVE=1`) and have not run yet.
- `docs/architecture.md` §8 and §14: the api serves the client's build from the `wwwroot` beside the published
  app, which must be there before the start (a folder added later is not seen until a restart); a path with a
  file extension that names no file is a 404 problem, every other path outside `/api` is `index.html`, served
  with `Cache-Control: no-cache`. Swagger UI is at `/api/docs` (its page is `/api/docs/index.html`) and the
  document at `/openapi/v1.json`, in every environment.
- `docs/architecture.md` §14 and the README's Configuration: the api's variables are the table of the README
  section "The api (.NET 10)"; the connection string is built from `DB_HOST`, `DB_PORT` and `DQ_APP_PASSWORD`
  unless `ConnectionStrings__Dq` is set; in Development the api reads only its own keys from `.env`; the
  published app reads no `.env` and its content root is its own folder (started once from another directory,
  Log of 2026-11-11 01:21).
- `README.md`, Configuration and Running the tests: the two sentences "filled by dc-engine and dc-api" and
  "one command each, filled by ..." can now point to the section "The api (.NET 10)".
- `docs/assumptions-limitations-extensions.md`: no un-archive (an extension); control names are not unique; the
  JSON Schema validator is JsonSchema.Net 8.0.5, pinned as its last MIT release; a synchronous run waits for
  the engine for at most the attempt timeout (75 s by default) and one more for the body; a run of 5,000
  violations is stored and answered in about 2 s on the development machine.
- `docs/ai-usage.md`: the Log below, and "Decisions taken unattended" above. The night of 2026-11-11 ran on
  Fable where the plan names Opus for execution (decision 1); the five phase reviews ran on opus. The
  morning after (the merge of the engine, the live pass, the audit's fixes) ran in the same Fable session,
  and the security audit was one `security-auditor` agent on opus.
- `docs/architecture.md` §5, validation layers (decision 39): the api's schema layer evaluates a tree of at
  most 240 nodes and 10,000 JSON values whose numbers fit a decimal; anything larger is answered by the
  engine alone, with the limit's own error. In the same place (decisions 33 and 34): a body with a string that
  is not Unicode text is refused before any layer, and a definition reaches the engine and the store as the
  text it was sent in.
- `docs/architecture.md` §10 or the limitations document, from the security audit (decision 38), each open:
  `AllowedHosts` is `*` (a page can rebind its name to 127.0.0.1 and read the api of a developer machine;
  `localhost;127.0.0.1` or what compose needs); nothing limits how many runs are in flight, and a run goes on
  after its client has gone; an unsafe method is not checked for a cross-site origin (a page can start a run
  with a body-less POST; it cannot read the answer); an engine answer is read whole into memory without a cap;
  the connection string sets `TrustServerCertificate=true`; the static files carry no `nosniff`,
  `Content-Security-Policy` or `frame-ancestors`. Sound, per the same audit: no SQL text anywhere, the search
  is a bound `LIKE` with its wildcards escaped, only `dq_app` and only `dq`, no connection string or driver
  text in a response or a log, CORS by explicit origins without credentials, no path traversal in static
  hosting, no secret in the diff.

