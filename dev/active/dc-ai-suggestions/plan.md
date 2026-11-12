# dc-ai-suggestions: an advisor service that proposes controls
Status: planned, not started · Created: 2026-11-11 · Branch: `feat/ai-suggestions` (main tree, cut from main)
Written without an interview, from Kfir's brief of 2026-11-11, by the dc-delivery session's planner. Decisions 1 to
9 are the brief, line for line. Decisions 10 to 23 are the planner's; Kfir read them on 2026-11-12 and they
stand. Facts were looked up in the code and the contracts and are cited by file.

## Goal

After this task a fourth service, `advisor/`, studies the glossary and aggregate statistics with a language model,
on a schedule and whenever the glossary changes, and files proposed controls in an inbox that the Hebrew client
shows. A business user reads each proposal as the engine's own sentence, with the number of records it flags today,
and accepts, edits or dismisses it. Nothing becomes a control without that. The model writes control definitions in
the contract's JSON and nothing else: each one passes the validator and the compiler that a user's definition
passes, so architecture §2.3 (no LLM between a definition and its SQL) and §10 hold unchanged. Today's heuristics
(`engine/app/suggestions/`: five generators over one aggregate SELECT per entity) stay as they are and feed the same
inbox, so the feature works with no model and no key. Why now: the assignment's optional advanced task (architecture
§18 and Appendix A) asks for a design of exactly this. This plan and its Design sections are that answer. Nothing
here is built before the submission of 2026-11-15, and architecture §6 keeps calling the LLM step "designed and not
built" until phase 8 changes it.

## Decisions

From the brief (Kfir, 2026-11-11). Each line is his; the why and the rejected alternative are the planner's reading.

1. **A fourth, small service, `advisor/`, in Python, is the only part that talks to a language model. It is
   agentic: the model works in a bounded loop with a few tools.** Why: the engine stays deterministic and keyless
   (architecture §2.3, §14), and a model outage or a leaked key cannot touch a run. (Rejected: an LLM step inside
   the engine, which puts a key and an outbound connection into the one process that reads `hr`; one prompt without
   tools, which cannot tell a rule that flags nothing from one that flags three records.)
2. **It has no database access. Its tools are HTTP calls to the engine and the api**: read one entity's slice of
   the glossary (fields, neighbours), read that entity's statistics, list the controls that exist, validate a
   definition (errors come back so it can repair, a bounded number of times), measure it (violations now). Why:
   the two-login rule of CLAUDE.md stays whole. (Rejected: a third, read-only login; a generic query tool.)
3. **The model never writes SQL.** It returns control definitions in the contract's JSON; each passes the same
   validator and compiler. Why: the public glossary carries no table or column name (`contracts/api.md` §3,
   `GET /glossary`), so the model holds no identifier to write SQL with. (Rejected: text to SQL behind a linter.)
4. **Proactive.** It runs on a schedule and when the glossary changes. Results land in a suggestions inbox (new,
   accepted, dismissed) that the interface shows; a person accepts, nothing activates alone. (Rejected: creating
   controls automatically; on request only, which is today's panel and is not proactive.)
5. **Scale: metadata and statistics only, one entity slice per prompt (retrieval over the catalogue, not over
   records), statistics precomputed and sampled for large tables.** Why: a prompt grows with the widest entity,
   not with the catalogue or the row count. (Rejected: the whole glossary in one prompt; sample rows in a prompt.)
6. **Safety: output is untrusted; no record values in a prompt; network egress only from this service; budgets on
   steps, tokens, time and cost; every run logged with its prompt version, tool calls and outcome.**
7. **Today's heuristics stay as the deterministic baseline and the fallback.** The generators do not change.
   (Rejected: replacing them with the model: the dc-engine gate rests on them, and they cost nothing.)
8. **Evaluation: on the seed it must rediscover the planted rules, including the first assignment example that
   heuristics cannot find** (dc-engine decision 1); **tests run on recorded model answers and need no key.**
9. **Deployment: an optional compose profile; the model's address and key from the environment; the model hosted
   inside the organisation's own cloud.**

Settled by the planner, open to the owner's objection:

10. **Contracts land first, as one commit on main** (CLAUDE.md, "A contract change"). Consequence, found in the
    code: `api/tests/.../Hosting/ContractConformanceTests.cs` and `Errors/ErrorCodesContractTests.cs` read the
    tables of `contracts/api.md` §4 and `contracts/errors.md`, so main's `dotnet test` is red on those tests from
    phase 1 until this branch merges. Phase 1 therefore starts only after the submission is handed in. (Rejected:
    contracts as the branch's first commit, which keeps main green. It breaks the repository rule; Kfir may prefer
    it.)
11. **The engine gains `POST /profile` and `POST /measure`.** `/run` cannot serve: it returns violations, and its
    `rowCap` is at least 1. `/measure` runs the count statement alone (`Executor.count_compiled` exists,
    `engine/app/executor/database.py`), so no path of it can return a record. (Rejected: `/run` with the rows
    thrown away by the caller: the values would still cross the wire into the service that holds the model key.)
12. **The statistics rule** (Design E): a prompt may hold counts, shares and constants that no record supplied.
    No minimum, maximum, mean, percentile, distinct value or top value, of any field. (Rejected: min and max of
    numeric and date fields: the maximum salary is one employee's salary. dc-engine's Design H planned them and
    never built them, so nothing returns one today.)
13. **The advisor calls the engine for the glossary, the profile, validate and measure, and the api for controls,
    the inbox and the run log.** `api.md` §3 ("Only the api calls the engine") is reworded. (Rejected: everything
    through the api: four pass-through endpoints under `/api/v1` with no other user.)
14. **The inbox lives in `dq`, written by the api alone**: `dq.Suggestion` and `dq.SuggestionRun` (Design G). The
    api trusts nothing in a report: it validates and measures each proposal through the engine and stores the
    engine's sentence and evidence, never the advisor's. (Rejected: a store of the advisor's own: a second place
    to back up, and a writer outside the api.)
15. **Heuristics enter the inbox through the api** (`POST /api/v1/suggestions/refresh`), so the inbox works with
    the profile off. A proposal is deduplicated by definition hash against active controls and every earlier
    suggestion, dismissed ones included. That also ends the repeat that dc-delivery decision 32 documents (the
    panel proposes controls that already exist). The stateless pair (`POST /api/v1/suggestions`, `.../accept`)
    stays; accept and `POST /api/v1/controls` gain an optional `suggestionId`.
16. **One free text from the model, `note`: plain text, at most 300 characters, in the glossary's default
    language, labelled in the interface as machine-written and unverified.** A model item's name is its rule
    sentence; sentence and evidence are the engine's. No glossary change: the glossary keeps meaning only.
    (Rejected: a model-written name and description: a persuasive name over a different rule is how a bad rule
    gets accepted. Rejected: glossary templates keyed by a reason code: they drop the one thing the model adds.)
17. **The advisor serves no request but its health probe; it pulls.** The interface's "run now" is an api endpoint
    that files a `requested` run; the advisor claims it on its next poll. One run at a time is decided in the
    api's claim transaction, where the state lives. (Rejected: the api calling the advisor: an inbound port, an
    address in the api's configuration and a second failure path.)
18. **The audit record goes through the api into `dq.SuggestionRun`**: prompt version, model id, token counts,
    cost estimate, every tool call (name, arguments, status, duration), every proposal and its outcome. Why: the
    advisor is stateless and its container's files die with it; the interface shows the last run; one store, one
    backup. Its stdout carries operational JSON lines, as the engine's does. No prompt transcript is stored.
19. **One adapter behind one small interface: the Anthropic Messages shape through the official SDK, with Vertex
    AI as the example deployment** (Design H). Model id, address and credentials come from `ADVISOR_MODEL_*`;
    `claude-opus-5-5` is only the example default. The loop is the advisor's own code. (Rejected: the SDK's tool
    runner: budgets, repair counts and the tool log are the point of the loop. Rejected: an agent framework for
    six tools. A second, OpenAI-compatible adapter is one more file behind the same interface and is not in v1.)
20. **"Rediscover" means: the canonical definition hash equals the example's, or the proposal flags exactly the
    example's keys on every run date the example lists.** Target set: the six files of `contracts/examples/`.
    Expected: the four marked `heuristic: true` from the baseline, `minor-high-salary` from the model (the named
    must-find), `inactive-ministry-salary-out-of-range` reported and not required (Design F says why).
21. **Filter and rank.** A proposal that flags no record is dropped, as the heuristics do (dc-engine decision 3);
    so is one that flags more than `ADVISOR_MAX_FLAGGED_SHARE` (0.2) of the entity: it describes the population.
    Rank: smaller flagged share first, then fewer nodes, then canonical JSON; cut to 10 per run.
22. **Three compose networks, and an honest limit** (Design L). A service that publishes a host port needs a
    bridge network, and Docker gives a bridge a route out, so compose alone cannot prove "egress only from the
    advisor" for `db` and `api`. Compose proves it for the engine; the deployment's firewall proves the rest.
23. **The branch lives in the main tree** (new `dq` tables need `scripts/db-init.sh`, which a worktree may not
    run), and `advisor/` joins the harness: `.claude/hooks/lib/pkgmap.sh`, the print guard, CLAUDE.md's Map.

## Contract changes

Written into `contracts/api.md` and `contracts/errors.md` in phase 1. `contracts/glossary.json` and
`contracts/control-definition.schema.json` do not change.

**Engine (`api.md` §3).** The opening sentence becomes: "The api calls the engine. The advisor, where it is
deployed, calls `GET /health`, `GET /glossary`, `POST /profile`, `POST /validate` and `POST /measure`, and nothing
else. The client never calls it." Two rows join the table:

| Method and path | Request body | Success | Errors |
|---|---|---|---|
| `POST /profile` | `{ entity, runDate? }` | 200 `EntityProfile` | 503 `DATABASE_UNAVAILABLE`, 504 `QUERY_TIMEOUT` |
| `POST /measure` | `{ definition, runDate? }` | 200 the measure answer | 422 `DEFINITION_INVALID`, 504 `QUERY_TIMEOUT`, 503 `DATABASE_UNAVAILABLE` |

`POST /profile`: `entity` is the key of a visible entity (anything else is 400, `MALFORMED` at `/entity`);
`runDate` as on `/run`. Every number is a count of records or a boundary of the engine's fixed grid (Design E).

| `EntityProfile` member | Type | Notes |
|---|---|---|
| `entity`, `glossaryVersion` | string | |
| `runDate` | date | the date computed fields were evaluated on |
| `computedAt` | timestamp | a profile is kept in memory for `ENGINE_PROFILE_TTL_SECONDS` |
| `rows` | integer | the records counted: all of them, or the sample |
| `sampled` | boolean | true above `ENGINE_PROFILE_SAMPLE_ABOVE` rows; then every count is of the sample |
| `fields` | object[] | one per visible field: `{ key, missing?, values?, other?, buckets? }` |
| `datePairs` | object[] | per pair of comparable date fields: `{ first, second, both, firstEarlier, secondEarlier }` |
| `relationships` | object[] | per usable relationship from the entity: `{ key, withoutRelated }` |

`missing`: records where the field fails its missing test (`is_empty` for text, `is_null` otherwise), present when
the field has that operator. `values`: `{ value, count }` per `enumValues` entry of the glossary, or for `true` and
`false`. `other`: enum only, the records holding a value the glossary does not list; the value is never returned.
`buckets`: for a `number` that is not an `identifier` and for a `date`, computed fields included:
`{ from, to, count }` with `from` inclusive and `to` exclusive, empty buckets left out. A text field has `missing`
alone.

`POST /measure`: validates and compiles like `/run`, then runs the count statement and one count of the root
entity. 200: `{ runDate, totalCount, entityCount, durationMs, engineVersion, glossaryVersion, sentence,
sentenceParts, conditions, evidence }`, where `conditions` carry `count` and `evidence` holds `violations_found`.
There is no page statement on this path: no key, display value or reason can be returned.

**Application (`api.md` §4).** Seven rows join the table; two change.

| Method and path | Request | Success | Errors |
|---|---|---|---|
| `GET /api/v1/suggestions` | query `status`, `source`, `rootEntity`, `page`, `pageSize` | 200 `Page<Suggestion>` | 503 `DATABASE_UNAVAILABLE` |
| `POST /api/v1/suggestions/refresh` | none | 200 `{ added, known }` | 503 `ENGINE_UNAVAILABLE`, 503 `DATABASE_UNAVAILABLE`, 504 `QUERY_TIMEOUT` |
| `POST /api/v1/suggestions/{id}/dismiss` | none | 200 `Suggestion` | 404 `SUGGESTION_NOT_FOUND`, 409 `SUGGESTION_DECIDED`, 503 `DATABASE_UNAVAILABLE` |
| `GET /api/v1/suggestions/runs` | query `page`, `pageSize` | 200 `Page<SuggestionRun>` | 503 `DATABASE_UNAVAILABLE` |
| `POST /api/v1/suggestions/runs` | none | 202 `SuggestionRun` | 409 `SUGGESTION_RUN_ACTIVE`, 503 `ADVISOR_UNAVAILABLE`, 503 `DATABASE_UNAVAILABLE` |
| `POST /api/v1/suggestions/runs/claim` | `{ trigger?, glossaryVersion, promptVersion, modelId }` | 200 `{ run }` | 409 `SUGGESTION_RUN_ACTIVE`, 503 `DATABASE_UNAVAILABLE` |
| `PUT /api/v1/suggestions/runs/{id}` | the run report | 200 `{ run, outcomes }` | 404 `SUGGESTION_RUN_NOT_FOUND`, 409 `SUGGESTION_RUN_CLOSED`, 503 `ENGINE_UNAVAILABLE`, 503 `DATABASE_UNAVAILABLE` |

- `GET /api/v1/suggestions`: `status` is `new` (default), `accepted`, `dismissed` or `all`; `source` is
  `heuristic` or `model`. Newest first by `createdAt`, then `id`. `new` leaves out a suggestion whose hash is the
  current version of an active control. Stored text is served in the language it was stored in, as for a run.
- `refresh`: the api asks the engine's `/suggest` (max 20) and files what is not known yet as `heuristic`;
  `known` counts the items whose hash already exists as a suggestion or a control.
- `POST .../runs` is the interface's "run now": it files a run with status `requested` and trigger `manual`. 503
  `ADVISOR_UNAVAILABLE` when no advisor has polled within `Suggestions__AdvisorSeenSeconds` (120).
- `claim` is the advisor's poll. A `requested` run becomes `running` and is returned; else, with a `trigger`
  (`schedule` or `glossary_change`), a new `running` run is created; else `run` is null. A `running` run older
  than `Suggestions__RunLeaseMinutes` (15) is closed `failed` first; a younger one answers 409.
- The report: `{ status, error?, usage, toolCalls, proposals }`. `status` is `succeeded`, `degraded` or `failed`;
  `error` is `{ code, params }` with an advisor code of `errors.md`; `usage` is `{ steps, inputTokens,
  outputTokens, costEstimate, durationMs }`; `toolCalls` holds at most 500 of `{ seq, entity, name, arguments,
  status, durationMs }`; `proposals` holds at most 20 of `{ definition, note? }`, in rank order. Per proposal the
  api checks the schema, calls the engine's `/measure`, drops a zero count, hashes, deduplicates and stores.
  `outcomes[i]` is `{ outcome, suggestionId? }` with `stored`, `duplicate_control`, `duplicate_suggestion`,
  `invalid` or `no_violations`.
- Changed: `POST /api/v1/controls` and each item of `POST /api/v1/suggestions/accept` take an optional
  `suggestionId`. A `new` suggestion with that id becomes `accepted` with the control's id, in the same
  transaction; 404 `SUGGESTION_NOT_FOUND`, 409 `SUGGESTION_DECIDED`.

`Suggestion` is `SuggestionItem` with `description` and `rationale` as "string or null" (null on a `model` item,
whose `name` is the sentence cut to 200 characters), plus:

| Member | Type | Notes |
|---|---|---|
| `id` | integer | |
| `status`, `source` | string | `new`, `accepted`, `dismissed`; `heuristic`, `model` |
| `rootEntity`, `language`, `glossaryVersion` | string | |
| `note` | string or null | the model's own words: plain text, at most 300 characters, not verified by anything |
| `measuredOn` | date | the date of the stored evidence |
| `runId`, `promptVersion`, `modelId` | integer or null, string or null | null on a `heuristic` item |
| `createdAt`, `decidedAt`, `controlId` | timestamp, timestamp or null, integer or null | |

`SuggestionRun`: `{ id, trigger, status, createdAt, startedAt, finishedAt, glossaryVersion, promptVersion, modelId,
usage, proposed, stored, error }`; `status` is `requested`, `running`, `succeeded`, `degraded` or `failed`.

**`errors.md`.** The "From" column gains `advisor`: derived by the advisor, stored in a run's `error`, never sent
as a `Problem`. `MALFORMED` also covers an `entity` that is not a visible entity key. New rows of Codes:

| Code | Status | From | Params | Meaning |
|---|---|---|---|---|
| `SUGGESTION_NOT_FOUND` | 404 | api | `id` | No suggestion has this id |
| `SUGGESTION_DECIDED` | 409 | api | `id`, `status` | The suggestion was already accepted or dismissed |
| `SUGGESTION_RUN_NOT_FOUND` | 404 | api | `id` | No advisor run has this id |
| `SUGGESTION_RUN_ACTIVE` | 409 | api | `id` | A run is requested or running; one at a time |
| `SUGGESTION_RUN_CLOSED` | 409 | api | `id` | A report for a run that is not running |
| `ADVISOR_UNAVAILABLE` | 503 | api | none | No advisor is deployed, or it has stopped polling |
| `MODEL_UNAVAILABLE` | none | advisor | none | The model endpoint is not configured or did not answer after the retries |
| `MODEL_REFUSED` | none | advisor | none | The model declined the request |
| `ADVISOR_BUDGET_EXCEEDED` | none | advisor | `budget` | `steps`, `tokens`, `time`, `cost_run` or `cost_day` ran out |

## Phases

Every code phase ends the same way: tick each step as it finishes and update `notes.md`, `/check --tests`, save
the output as `gates/phase-N.txt`, `/phase-review` for the area, one review-fix commit, a Log line. Before every
suite: `pgrep -fa "pytest|dotnet test|ng test|vitest|playwright test"`. Before anything that costs money or
minutes (a recording, the live evaluation, an image build, Playwright) say so in one line and wait for the word.

### Phase 0: preconditions (no commit)
- [ ] The submission of 2026-11-15 is handed in (decision 10: main's api suite goes red in phase 1).
- [ ] dc-delivery is merged: `docker-compose.yml` holds `engine` and `api` (on 2026-11-11 it holds `db` and
      `db-init` only), and the §17 documents exist.
- [x] Kfir has answered decisions 10 to 23, or let them stand. (2026-11-12: they stand.)
- [ ] Read `contracts/api.md` §2 to §4 and `contracts/errors.md` again; write any drift from "Contract changes"
      into `notes.md`. `contracts/` wins.

### Phase 1: contracts, on main
- [ ] `contracts/api.md`: the reworded §3 opening, the two engine rows with their sections, `EntityProfile`,
      `Suggestion`, `SuggestionRun`, the seven application rows with their sections, `suggestionId`.
- [ ] `contracts/errors.md`: the nine codes, the `advisor` value of "From", the `MALFORMED` line.
- [ ] `api/requests.http` is not touched here: its test goes red with the others and phase 3 turns it green.
- [ ] `git switch -c feat/ai-suggestions` from that commit.

Verify: `uv run scripts/contracts-check.py` · `cd api && dotnet test` fails in `ContractConformanceTests` and
`ErrorCodesContractTests` and nowhere else (save the list as `gates/phase-1.txt`)
Commit: `feat(contracts): entity profile, measure and the suggestions inbox` (on main, on Kfir's word)

### Phase 2: engine, profile and measure
- [ ] `compiler/profile.py`: a second profile statement with enum and bool counts, `other`, bucket counts on the
      fixed grid (Design E) and `withoutRelated`. The existing statement and the five generators stay as they are.
- [ ] Buckets of a computed field: age boundaries become birth-date ranges through `compiler/computed.py`.
- [ ] Sampling behind `ENGINE_PROFILE_SAMPLE_ABOVE` and `ENGINE_PROFILE_SAMPLE_PERCENT`; the in-memory profile
      cache keyed by entity, run date and glossary version, with `ENGINE_PROFILE_TTL_SECONDS`.
- [ ] `POST /profile` and `POST /measure` in `routes.py`, request models in `web.py`, the settings, `.env.example`.
- [ ] Tests: the sentinel test of Design E; `/measure` of each example equals its `expected.total` and its answer
      has no `violations` member; the profile of a synthetic glossary names nothing of the real one; a forced
      sample answers `sampled: true`; an unknown entity is 400 `MALFORMED` at `/entity`.

Verify: `/check --tests` · with the engine up: `curl -s -X POST localhost:8000/measure -H 'content-type:
application/json' -d "{\"definition\": $(jq .definition contracts/examples/minor-high-salary.json), \"runDate\":
\"2026-11-01\"}" | jq '.totalCount, .entityCount, has("violations")'` prints `3`, `85`, `false`
Commit: `feat(engine): entity profile and count-only measure`

### Phase 3: database and api, the inbox
- [ ] `sql/35_dq_suggestions.sql` (Design G, re-runnable like `30_dq_tables.sql`), the indexes in
      `sql/50_indexes.sql`, the new names in `scripts/db-check.sh` (`EXPECTED_TABLES`, `EXPECTED_INDEXES`),
      `sql/README.md`.
- [ ] `Persistence/`: `Suggestion`, `SuggestionRun`, their configurations. No migration: `sql/` owns the schema.
- [ ] `Engine/EngineClient`: `MeasureAsync`. `Suggestions/`: inbox list, refresh, dismiss, run now, claim, report.
- [ ] `ControlService.CreateManyAsync` and create take `suggestionId` and mark the suggestion in the transaction.
- [ ] `api/requests.http`: one request per new row. OpenAPI statuses per row.
- [ ] Tests: the two contract test classes are green again; dedupe against an active control, a `new` and a
      dismissed suggestion; a report whose proposal fails the schema, flags nothing or repeats is answered per
      item and never stored; a note of 301 characters is cut and one with a control character is dropped; claim
      under a live lease is 409 and past it closes the old run; run now without a recent poll is 503.

Verify: `docker compose up -d db && scripts/db-init.sh` · `scripts/db-check.sh` · `/check --tests` · with the stack
up: `curl -s -X POST localhost:5000/api/v1/suggestions/refresh | jq` then `curl -s
'localhost:5000/api/v1/suggestions?status=new' | jq '[.items[] | {source, name}]'`
Commit: `feat(api): suggestions inbox and advisor run log`

### Phase 4: advisor, skeleton, tools and loop (no model yet)
- [ ] `advisor/` per Design A: `pyproject.toml`, `uv.lock`, `.python-version`, `requirements.txt`, Ruff and
      pyright strict as in `engine/`, `encoding="utf-8"` by name.
- [ ] `clients/`: the closed call lists of Design B, each answer parsed into a closed model (`extra="forbid"`).
- [ ] `tools.py`, `pipeline.py`, `loop.py`, `budget.py`, `scheduler.py` per Designs B, C and I.
- [ ] `model/port.py` and a scripted model for tests: the loop is proven before any adapter exists.
- [ ] `prompts/suggest.v1.md` per Design D.
- [ ] Harness: `advisor-ruff`, `advisor-pyright` and `advisor-test` in `.claude/hooks/lib/pkgmap.sh`, `print(`
      guarded in `advisor/`, the Map and Verify lines of `.claude/CLAUDE.md`, the hook tests.
- [ ] Tests: every budget stops the loop with its code; a third repair of one chain is answered `final`; an
      unknown tool or malformed arguments is an error result, not a crash; the engine client has no method for
      `/run`, `/suggest` or `/debug/compile`; the prompt file holds no key of `contracts/glossary.json`; ids are
      renumbered in document order; rank and cut.

Verify: `cd advisor && .venv/bin/python -m pytest && .venv/bin/ruff check . && pyright` · `node --test
.claude/hooks/tests/*.test.mjs` · `bash .claude/hooks/lib/pkgmap.sh --all --tests | grep advisor`
Commit: `feat(advisor): service skeleton, tools and the bounded loop`

### Phase 5: the model adapter and recorded tests
- [ ] `model/anthropic_messages.py` per Design H; the `anthropic` dependency with its Vertex extra.
- [ ] `model/replay.py`: the recorder and the player of Design K.
- [ ] Record one run per rootable entity on the seed (state the spend first; needs the endpoint of Blockers).
- [ ] Tests: the player feeds the loop the recorded turns and the recorded tool answers; a changed prompt or
      tool list fails with "cassette stale"; a refusal turn and a 5xx close the run `degraded` with their codes.

Verify: `cd advisor && env -u ADVISOR_MODEL_API_KEY -u GOOGLE_APPLICATION_CREDENTIALS .venv/bin/python -m pytest`
· `.venv/bin/ruff check . && pyright`
Commit: `feat(advisor): model adapter and recorded runs`

### Phase 6: evaluation on the seed
- [ ] `tests/eval/`: the recorded turns against the live engine, api and seed (Design K), no key.
- [ ] The matcher of decision 20; the report table per example: found by, exact, same keys, near, missed.
- [ ] The scan: no first name, last name, email or national id of the seed occurs in any cassette.
- [ ] The live evaluation, opt-in (`ADVISOR_EVAL_LIVE=1`): five runs, the same report plus tokens and cost.

Verify: with db, engine and api up: `cd advisor && .venv/bin/python -m pytest tests/eval -m seed` · on Kfir's word
only: `ADVISOR_EVAL_LIVE=1 .venv/bin/python -m pytest tests/eval -m live`
Commit: `test(advisor): evaluation against the six examples`

### Phase 7: client, the inbox
- [ ] `core/api/suggestions.api.ts` and `api.types.ts`: inbox, refresh, dismiss, runs, run now, `suggestionId`.
- [ ] `features/suggestions/`: the dialog opens with refresh, then reads `status=new`; the card gains the source
      chip, the note under its "machine-written" label (interpolated text, never `innerHTML`), the evidence date
      and dismiss; the head shows the last run and "run now".
- [ ] "Open in editor" carries `suggestionId` to the save (`core/suggestions/suggestions-opener.ts`,
      `control-editor/editor.store.ts`).
- [ ] `assets/i18n/he.json`: the new texts and the six api codes. Logical CSS only.
- [ ] Specs: the dialog and card specs; `e2e/mocked/suggestions.spec.ts`; `e2e/gate/suggestions.spec.ts` (it
      waits for `POST /api/v1/suggestions` today); screenshots at 390 and 1440.

Verify: `cd web && npx ng lint && npx ng test --watch=false && npx ng build` · `npx playwright test` (minutes: say
so first)
Commit: `feat(web): suggestions inbox with dismiss and run now`

### Phase 8: compose profile and documents
- [ ] `advisor/Dockerfile` (`python:3.12-slim`, no ODBC driver, non-root, the repository root as context).
- [ ] `docker-compose.yml`: the three networks and the `advisor` service under `profiles: ["advisor"]` (Design L).
- [ ] `.env.example`: the advisor block of Design A, every value empty or a default, no key.
- [ ] `docs/architecture.md` §3, §6, §7, §9, §10, §14, §16 and §20; the README's section on the profile; the
      assumptions document's lines on the model step.

Verify: `docker compose config -q && docker compose --profile advisor config -q` · `docker compose --profile
advisor up -d --build` (minutes: say so first) · `docker compose exec advisor env | grep -c 'DQ_\|MSSQL_'` prints
`0` · `docker compose exec engine python -c "import urllib.request as u; u.urlopen('https://example.org',
timeout=5)"` fails, and the same line in `advisor` succeeds · `curl -s localhost:5000/api/v1/health`
Commit: `feat(compose): optional advisor profile`

### Gate
- [ ] `/check all --tests` with the advisor rows, nothing skipped; save as `gates/final.txt`.
- [ ] The seed evaluation: the four `heuristic: true` examples are in the inbox with source `heuristic`;
      `minor-high-salary` with source `model`, by hash or by keys on 2026-11-01 and 2026-10-31; the sixth reported.
- [ ] The sentinel test and the cassette scan are green: no record value in an answer or a prompt.
- [ ] Profile off: no advisor container, the inbox shows the baseline, "run now" answers `ADVISOR_UNAVAILABLE`.
- [ ] Profile on, no model configured: runs close `degraded` with `MODEL_UNAVAILABLE` and the baseline stands.
- [ ] One live evaluation on Kfir's word; its table goes into the Log, with example 1's exact and near counts.
- [ ] Kfir reads the recorded notes in Hebrew and the inbox at 390 and 1440. The Log says what he changed.
- [ ] `security-auditor` on `git diff origin/main...HEAD` (one agent on opus: say so); fix critical and high.
- [ ] `/ship dc-ai-suggestions`. Push, PR and merge on Kfir's word.

## Design

### A. Service layout and settings

```
advisor/
  pyproject.toml  uv.lock  .python-version  requirements.txt  Dockerfile
  app/
    main.py        create_app(): GET /health, and the scheduler thread in the lifespan
    settings.py    ADVISOR_* (pydantic-settings, as the engine reads ENGINE_*)
    scheduler.py   poll, claim, run, report
    clients/       engine.py, api.py: closed lists of calls, closed answer models
    tools.py       the six tools: schema, handler, log entry
    loop.py        one entity's conversation        pipeline.py   check, validate, measure, filter, rank
    budget.py      steps, measures, tokens, time, cost
    model/         port.py, anthropic_messages.py, replay.py
  prompts/suggest.v1.md
  tests/           unit/  cassettes/  eval/
```

It imports nothing from `engine/`; it reads `contracts/control-definition.schema.json` from `ADVISOR_CONTRACTS_DIR`.
Its `/health` is compose's probe and is in no contract. Settings (all `ADVISOR_`): `ENGINE_URL`, `API_URL`,
`INTERVAL_MINUTES` (1440), `POLL_SECONDS` (30), `MODEL_PLATFORM`, `MODEL_ID`, `MODEL_PROJECT`, `MODEL_REGION`,
`MODEL_BASE_URL`, `MODEL_API_KEY`, `MODEL_EFFORT`, `PRICE_INPUT_PER_MTOK`, `PRICE_OUTPUT_PER_MTOK`, `MAX_STEPS`
(12), `MAX_MEASURES` (8), `MAX_REPAIRS` (2), `MAX_TOKENS_PER_RUN` (300000), `MAX_SECONDS_PER_RUN` (600),
`MAX_COST_PER_RUN`, `MAX_COST_PER_DAY`, `MAX_ENTITIES_PER_RUN` (5), `MAX_PROPOSALS` (10), `MAX_FLAGGED_SHARE` (0.2).
Step, measure and repair limits are per entity conversation. The numbers are defaults to tune in phase 5.

### B. Tools

| Tool | Calls | Returns to the model | Never returns |
|---|---|---|---|
| `get_entity(entity)` | engine `GET /glossary`, read once per run, cut to one entity | labels, description, fields (key, label, type, operators, unit, enum values, `required`, `comparable`), lifecycle, the relationships from it and each neighbour's field list, the limits | a table or column name (the public glossary has none); entities that are not neighbours; templates |
| `get_profile(entity)` | engine `POST /profile` | the `EntityProfile` | a value, a key or a text of a record |
| `list_controls(entity)` | api `GET /api/v1/controls?rootEntity=` then `GET /api/v1/controls/{id}` (at most 50); `GET /api/v1/suggestions?status=dismissed` | definitions only | names and descriptions that users typed; ids; run history |
| `validate(definition)` | the schema locally, then engine `POST /validate` | `valid` and the sentence, or the errors as code, path and params | |
| `measure(definition)` | as `validate`, then engine `POST /measure` | `totalCount`, `entityCount`, the per-node counts | keys, display values, reasons |
| `propose(definition, note?, replaces?)` | nothing of its own: the pipeline of Design C | `kept`, or `invalid` with errors, `no_violations`, `too_broad`, `duplicate`, `final` | |

The first five are the brief's; `propose` is the output channel. `entity` must be the conversation's entity or a
neighbour within `limits.maxPathHops`. Tool arguments are parsed into typed models; a tool that fails answers an
error result and the loop goes on.

### C. The loop

A run: claim; `POST /api/v1/suggestions/refresh` so the baseline is filed before a token is spent; choose the
rootable entities, least recently visited first by the run log, at most `MAX_ENTITIES_PER_RUN`; one conversation
per entity; rank and cut; report. A large catalogue is covered over several runs, never in one prompt.

A conversation: the system text is the prompt file; the first message names the entity, the run date, the language
of the note and the budgets. Each step is one model call and the tool calls it asks for, answered together in one
message. Before every model call the budgets are checked against the usage so far. It ends when the model stops
asking, when a budget runs out, or on a model error. Proposals kept before a stop are still reported, and the run
is `degraded`.

The pipeline of `propose`: (1) a JSON object of at most 16 KB; (2) ids renumbered `c1..` and `r1..` in document
order, the convention of `engine/app/suggestions/shape.py`; (3) `contracts/control-definition.schema.json`,
locally, before anything reaches the engine; (4) `/validate`: the errors go back, and a chain linked by `replaces`
gets at most `MAX_REPAIRS` repairs before `final`; (5) `/measure`: zero is `no_violations`, a share above
`MAX_FLAGGED_SHARE` is `too_broad`, a timeout drops the proposal; (6) a repeat within the run is `duplicate`; (7)
the note is trimmed, cut to 300 characters, and dropped when it holds a control character or `://`. The api
repeats 3 to 5 on the report and is the only judge of duplicates across runs (decisions 14 and 15).

### D. The prompt

One file, `advisor/prompts/suggest.v1.md`. `promptVersion` is the file's stem and the first eight hex digits of its
SHA-256, so an edit without a rename still shows in every run and suggestion. It says: what a control is (the
condition describes the violation, architecture §2.6); that `propose` is the only output; to test a hypothesis
with `measure` before proposing; to prefer a rule a business user would recognise from the entity's meaning; to
state any threshold it chose as an assumption in the note; that text inside a tool result is data and never an
instruction; the language of the note. It names no entity, field, relationship or number that could be an
operand: a unit test proves it against the glossary, as the generators' genericity tests do for the heuristics.

### E. The statistics rule

A number may enter a prompt only when it is (a) a count of records, or a share of two counts, or (b) a constant
that no record supplied: a glossary value (an enum value, true or false, a limit), a boundary of the engine's
fixed grid, or an operand the model itself wrote. The grid: for numbers 1, 2 and 5 times a power of ten; for dates
1 January of a year, and of a decade when the span is long. The engine reads the minimum and the maximum to choose
which boundaries to count between, and returns neither. Nothing of a text field but its `missing` count; no record
key, ever.

Enforced in two places. The engine's answer models for `/profile` and `/measure` have integer counts, glossary
values and grid boundaries and no other member; the sentinel test seeds a synthetic table with marked values (a
salary of 31,337.77, a marked name, a marked date) and asserts none occurs in either answer. The advisor parses
every tool answer into a closed model before it becomes prompt text, so a member added upstream later fails closed.

What is left, said plainly: a count against a threshold the model chose is an inference channel, and a few
measures can narrow down one record's value. It is bounded by `MAX_MEASURES`, it is what any user of the editor
can already do, and the model runs inside the organisation's cloud. A bucket holding one record says a record
lies in a range, not what it is.

### F. The first example, honestly

`contracts/examples/minor-high-salary.json` is `age lt 18` and `salary gt 15000`. No generator proposes it,
because both operands are business knowledge (dc-engine decision 1).

- **18** is not in the data and need not be. The glossary says `age` is a number computed from the birth date.
  The model knows the age of majority and that minors' employment is restricted. `measure` on `age lt 18` answers
  6 of 85 on the seed, which confirms that the population exists. Needs: the per-node counts of `/measure`, and
  buckets for a computed field.
- **15,000** cannot be derived from statistics. The buckets show where salaries lie; two or three measures of
  "under 18 and salary above T" show that minors on adult salaries exist. Which round T the model writes is its
  judgement: 15,000 is near a national average wage and is a natural choice; 10,000 and 20,000 are as defensible.
- The seed punishes the difference. `sql/60_seed_hr.sql` plants 1056 at exactly 15,000 and 1053 at 15,000.01, so
  `gt 10000` flags four records, `gt 20000` one, and only `gt 15000` the example's three. The alternate run date
  (2026-10-31, employee 1054) does the same for the age: `lt 17` matches on one date and fails on the other.

So decision 20 is strict for this example, and that strictness is the owner's line. The recorded run that the
tests replay must be a real run that reached it. The live evaluation says how often a live model does, and how
often it lands on the same shape with another threshold ("near"). `inactive-ministry-salary-out-of-range` joins
two arbitrary bounds (6,000 and 40,000) to an inactive ministry: it was written to exercise two-hop paths, and no
analysis of structure leads to it. It is reported, not required.

### G. The inbox data model

`dq.Suggestion`: `id`, `run_id` (null for `heuristic`), `source`, `status`, `root_entity_key`, `definition`,
`definition_hash` (unique: one suggestion per definition, ever, so a dismissal is remembered), `language`, `name`,
`description`, `rationale`, `note`, `sentence`, `sentence_parts`, `evidence`, `violation_count`, `entity_count`,
`measured_on`, `glossary_version`, `created_at`, `decided_at`, `control_id`. Checks: the two domains, `ISJSON`,
`decided_at` set exactly when the status is not `new`, `run_id` set when the source is `model`.

`dq.SuggestionRun`: `id`, `trigger`, `status`, `created_at`, `started_at`, `finished_at`, `glossary_version`,
`prompt_version`, `model_id`, `steps`, `input_tokens`, `output_tokens`, `cost_estimate`, `duration_ms`,
`tool_calls` (JSON), `outcomes` (JSON: hash and outcome per proposal), `error_code`, `error_params`,
`correlation_id`.

Indexes: `dq.Suggestion (status, root_entity_key, id)`; `dq.ControlVersion (definition_hash)` for the "already a
control" test. The hash is the api's (`Controls/DefinitionHasher.cs`: SHA-256 of the canonical form) and no other
service computes it. It covers node ids, which is why the advisor renumbers them, and the heuristics already
number them the same way.

### H. Model access

`model/port.py` is the whole interface: one call that takes the system text, the tool schemas and the messages,
and returns the tool calls, the text, the stop reason, the usage (input and output tokens) and the provider's raw
blocks. The loop keeps the raw blocks and sends them back unchanged, because current models bind their reasoning
blocks to the conversation. The one adapter speaks the Anthropic Messages shape through the official SDK.
`ADVISOR_MODEL_PLATFORM=vertex` builds the SDK's Vertex client from `MODEL_PROJECT` and `MODEL_REGION`; its
credential is Google's application default credential (a workload identity, or a service-account file named by
the environment), not a vendor key. `gateway` builds the plain client from `MODEL_BASE_URL` and `MODEL_API_KEY`,
for an organisation's own gateway of the same shape. `MODEL_ID` has `claude-opus-5-5` as its example default.

Facts the adapter is built on (the SDK's documentation as read on 2026-11-11; phase 5 checks them again): forcing
a tool is rejected by the current models, so the loop uses automatic tool choice and the prompt names `propose`;
sampling parameters are rejected, so no "temperature 0" exists and determinism in tests comes from recordings
alone; effort is set explicitly; `stop_reason: "refusal"` is an answer, not an exception, and closes the
conversation with `MODEL_REFUSED`. The cost estimate is tokens times the two configured prices: Vertex bills at
its own rates, so no price is written in code. No fallback model in v1: the baseline is the fallback (decision 7).

### I. Scheduling and the run lifecycle

Every `POLL_SECONDS` the advisor reads the engine's `/health` (the glossary version) and the newest run
(`GET /api/v1/suggestions/runs?pageSize=1`), then calls claim: with `schedule` when `INTERVAL_MINUTES` have passed
since that run started, with `glossary_change` when no run has seen this glossary version, else with no trigger,
which still picks up a `requested` run and tells the api the advisor is alive. The glossary changes only with an
engine deployment (architecture §4.3), so that trigger fires once per version. The advisor keeps no state: the
last run, the visit order of entities and today's spend are all read from the run log. When today's
`costEstimate` total has reached `MAX_COST_PER_DAY`, a claimed run files the baseline and closes `degraded` with
`ADVISOR_BUDGET_EXCEEDED` and `cost_day`. A crash leaves a `running` run; the lease closes it.

### J. Security model

| Threat | Path | What stops it | What is left |
|---|---|---|---|
| Prompt injection through glossary text | a label or a description carries instructions | the glossary is a reviewed file of the repository; the model has no tool that writes, runs or reads a record; its only output is a definition the validator accepts or rejects | a wasted run, a junk proposal that a person dismisses |
| Injection through statistics | a record value written to carry text | no text of a record reaches a prompt (Design E); an enum value the glossary does not list is counted under `other` and never named | nothing by this path |
| Injection through existing controls | a text operand a user typed | names and descriptions are not sent; operands are, inside definitions, marked as data | as the first row |
| Records reaching the model | prompt content | Design E; six tools and no other; closed answer models; no database login; no `/run` in the client; the model inside the organisation's cloud | counts and metadata do leave the advisor; the measure channel of Design E |
| A compromised advisor process | it calls the engine's `/run` itself | not stopped in v1: the engine authenticates no caller (architecture §10). The egress allow-list limits where data could go | named here; caller authentication is the extension |
| Cost runaway | a loop that does not end, a trigger that refires, repeated "run now" | budgets checked before every model call; one run at a time; the per-day cap; one glossary trigger per version | at most the day's cap |
| A malicious or absurd definition | a huge or heavy tree | the schema and the glossary limits; one SELECT under the read-only login and the statement timeout; stored as `new` and never run until a person accepts | a slow count, bounded by `MAX_MEASURES` |
| A misleading note | persuasive text beside another rule | name and sentence are the engine's rendering of the definition; the note is capped, plain and labelled | a person can still be persuaded |
| Model outage or refusal | endpoint down, rate limit, refusal | the SDK's retries, then `degraded`; the baseline was filed first | no model items that day |
| A forged report | anyone who reaches the api posts one | each proposal is validated and measured by the api; 20 per report; `new` only | inbox noise; caller authentication again |

### K. Tests and evaluation

A cassette is one conversation: the model's turns as the port returns them, the tool answers, and a hash of the
prompt version and the tool schemas. Three tiers. Unit: turns and tool answers both replayed; no key, no database,
runs in `/check`. Seed (`-m seed`): turns replayed, tools live against the engine, the api and the seed; no key;
it proves the recorded proposals still validate, measure, deduplicate and match on today's seed. Live (`-m live`):
a real model, opt-in, costs money. The matcher needs record keys for "same keys": the evaluation harness, which is
test code, calls the engine's `/run` for that; the advisor's own client cannot. A stale cassette fails by name and
is recorded again on Kfir's word.

### L. Compose

| Network | Kind | Members | For |
|---|---|---|---|
| `data` | `internal: true` | `db`, `db-init`, `engine`, `api`, `examples`, `advisor` | everything the services say to each other |
| `edge` | bridge | `db`, `api` | their host ports, published on 127.0.0.1 |
| `egress` | bridge | `advisor` | the route to the model endpoint |

The `advisor` service sits under `profiles: ["advisor"]`, starts after `api` is healthy, publishes no port and
receives only `ADVISOR_*` and the model credential: no `DQ_*` password, no `MSSQL_SA_PASSWORD`. Without the profile
nothing of it exists and the stack behaves as dc-delivery built it. The engine is on `data` alone and has no
route out, which phase 8 proves. `db` and `api` keep a bridge because Docker sets up no forwarding for an internal
network, and a bridge has a route out; closing that is the deployment's job. On GCP: an egress rule that lets
only the advisor's workload reach the Vertex AI endpoint, over private access.

## Risks

- **No recorded run reaches example 1 exactly** (Design F). Then the gate item stays open and Kfir chooses:
  accept "near" for this example, with "open in editor" as the way to the exact number; or add a deployment's own
  context file of rules of thumb to the prompt, outside the glossary. The plan does not choose for him.
- **Main is red in the api suite from phase 1 to the merge** (decision 10). Phase 0 waits for the submission.
- **The provider's strict tool schemas may not accept the contract schema**: it relies on `if`/`then`
  (`contracts/control-definition.schema.json`). `propose` therefore takes a plain object and the local check is
  the guarantee; phase 5 tries strict mode and keeps it only if it works.
- **Sampling in SQLAlchemy Core on SQL Server** (`TABLESAMPLE`, a constant percentage, a row estimate that
  `dq_engine_ro` may read) is untried. Fallback: no sampling, and the profile's two statements run under the
  statement timeout; the limitations document then says so. The seed has 85 rows, so this risk is about scale.
- **Internal networks and published ports**: Design L assumes Docker's documented behaviour; phase 8 proves it
  with `curl` on Docker Desktop under WSL, where host access differs from Linux.
- **Cassettes go stale** with any change to the prompt, a tool schema or a seed row a conversation touched. Each
  new recording costs money and Kfir's word; the stale check names the cassette.
- **Duplicates that differ only in the order of a group's children** hash differently and reach the inbox twice.
  Accepted for v1; a person dismisses one.
- **Stale evidence**: counts are as of `measuredOn`. The card shows the date; accept validates again, as today.
- **The note's Hebrew** is requested, not verified, and no code may name a language. Kfir reads the recorded notes.
- **SDK and model drift**: the facts of Design H were read on 2026-11-11 and are checked again in phase 5.
- **Four suites on one machine** now: `pgrep` first, and never the advisor's `pytest` beside the engine's.

## Out of scope

- Caller authentication between services, and per-user audit (architecture §10 and §20).
- A second adapter, a fallback model, more than one model per run, several agents.
- A model-written name or description; thresholds or rule parameters in the glossary.
- Activating a control or running an accepted one automatically.
- Restoring a dismissed suggestion; removing the stateless `POST /api/v1/suggestions` pair; an endpoint that
  serves a run's tool calls (they are read from `dq`).
- Suppressing small counts or adding noise to them; retention of `dq.SuggestionRun`.
- Vector search over a large catalogue; choosing entities by anything but rotation.
- New operators the model might want (uniqueness, patterns, outliers): a contract change of its own.
- The advisor on the manual, from-source path and on Windows: it ships in compose only.
- Feeding accept and dismiss decisions back into the prompt; fine-tuning.
