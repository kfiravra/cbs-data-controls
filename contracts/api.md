# HTTP APIs

Both HTTP surfaces of the system: the engine's (internal; the api is its only caller) and the application api under
`/api/v1` (the client's only server). Codes, their params, the path of every definition error and the rendering
rules are in [errors.md](errors.md); the definition is [control-definition.schema.json](control-definition.schema.json);
keys, labels, templates and limits are in [glossary.json](glossary.json). Where `docs/architecture.md` says otherwise,
this file and `errors.md` win.

Each row of the two endpoint tables (§3 and §4) starts with the method and the full path in one code span, so a test
can list them with one regular expression per line; no other line of this file matches it. The application table is
the complete list of what is served under `/api/v1`.

```
^\| `(GET|POST|PUT|DELETE) (/[^`]*)` \|
```

## 1. Common rules

- **Format.** JSON in UTF-8 with camelCase member names. A request sends `Content-Type: application/json`; a success
  answers `application/json`, an error `application/problem+json`. Glossary keys, node ids and record keys are data
  and keep their own spelling (`display` is keyed by field keys such as `first_name`).
- **Notation.** In the shape tables `name?` marks a member that may be absent: a response leaves it out when it has
  no value and never sends it as null. `T or null` marks a member that is always present. In a request an optional
  member may be absent or null, and both mean "not given". `date` is a `YYYY-MM-DD` string, `timestamp` an ISO 8601
  string.
- **Language.** The primary subtag of the first range of `Accept-Language` when it is `he` or `en`; anything else, or
  no header, is `he`. It selects the language of rendered text (sentences, reasons, suggestion texts, evidence). The
  api forwards the resolved value, `he` or `en`, to the engine.
- **Correlation id.** `X-Correlation-Id` is used when it matches `^[A-Za-z0-9._-]{1,64}$`; otherwise the service
  creates one (32 hexadecimal characters). It is returned on every response, carried by every problem as
  `correlationId`, and forwarded by the api on every engine call.
- **Time.** Timestamps are UTC with `Z`, to the millisecond (`2026-11-10T19:44:03.120Z`). Dates must be real calendar
  dates. "Today" is the current date in `Asia/Jerusalem` (configurable in both services).
- **Ids and keys.** Control and run ids are positive integers. Record keys are strings (`"1051"`) everywhere, so a key
  that is not an integer needs no contract change.
- **Definitions.** `definition` in a request must be a JSON object: absent or null is `REQUIRED`, any other value
  `MALFORMED` (400 `REQUEST_INVALID`). Everything about the object itself is a definition check, answered 422
  `DEFINITION_INVALID` with `DefinitionError` items (errors.md, Order of checks).
- **Unknown members.** The engine rejects a request member it does not know (400, `MALFORMED` at that member); the api
  ignores it.
- **Errors.** Every response that is not 2xx is a `Problem`: codes and params only, never prose, SQL, a stack trace or
  a driver message. The text for a code is the client's, from its translation files. Every endpoint except
  `GET /api/v1/health` (always 200) may also answer 400 `REQUEST_INVALID` for a malformed request and 500
  `INTERNAL_ERROR`; the endpoint tables list every other error.
  An unknown path, a known path with a method it does not serve, and an `{id}` or `{version}` segment that is not a
  positive integer are 404 `NOT_FOUND`, in both services.
- **Rendered text** comes only from the engine, which renders the glossary's templates (errors.md, Rendering). Every
  `sentence` comes with `sentenceParts` and every reason's `text` with `textParts`. The api passes rendered members
  through unchanged, stores them with a run as received, and serves stored text in the run's language whatever the
  request's `Accept-Language`.

## 2. Shared shapes

### `Definition` and `FieldRef`

`Definition` is a control definition as the schema defines it: `{ schemaVersion: 1, rootEntity, where }`, a tree of
`group`, `condition` and `related` nodes. A field reference, as the schema defines it:

| Member | Type | Notes |
|---|---|---|
| `path?` | string[] | relationship keys from the scope entity, at most `limits.maxPathHops` (2) |
| `field` | string | a field key of the entity the path reaches |

### `TextPart`

| Member | Type | Notes |
|---|---|---|
| `text` | string | never empty; joining the `text` of a list of parts gives the plain string exactly |
| `nodeId?` | string | the node whose clause the part belongs to (a condition, or the phrase of a related node); absent on joining words and brackets |
| `role?` | string | the placeholder the part came from: `field`, `value`, `actual`, `other`, `otherActual` or `relationship` (errors.md, Text part roles); absent on template text |

### `DefinitionError`

| Member | Type | Notes |
|---|---|---|
| `code` | string | errors.md, Definition error codes |
| `path` | string | JSON Pointer into the definition, not into the request body (`""` is the definition); the location per code is pinned in errors.md |
| `nodeId?` | string | the `id` of the nearest node at or above `path` that has one; absent when there is none and on `DUPLICATE_NODE_ID` |
| `params` | object | per code, `{}` when it has none |

### `RequestError`

| Member | Type | Notes |
|---|---|---|
| `path` | string | JSON Pointer into the request body (`/name`, `/items/2/name`), or the name of a query parameter (`pageSize`) |
| `code` | string | `REQUIRED`, `TOO_LONG`, `OUT_OF_RANGE` or `MALFORMED` (errors.md, Request error codes) |
| `params` | object | per code, `{}` when it has none |

### `Problem`

| Member | Type | Notes |
|---|---|---|
| `type` | string | always `about:blank` |
| `title` | string | the code, again |
| `status` | integer | the HTTP status |
| `code` | string | errors.md, Codes |
| `params` | object | per code, `{}` when it has none |
| `errors?` | array | `RequestError[]` with `REQUEST_INVALID`, `DefinitionError[]` with `DEFINITION_INVALID`; absent otherwise |
| `correlationId` | string | the request's correlation id |

### `ConditionSummary`

| Member | Type | Notes |
|---|---|---|
| `id` | string | the node's id |
| `sentence` | string | the node's clause alone, in the request language |
| `sentenceParts` | TextPart[] | |
| `count?` | integer | in `/run` and `Run` only: the number of violations in which the node is matched, over all violations, also when only the capped rows are returned or stored |

A `conditions` list (in `/validate`, `/run` and `Run`) holds the nodes that can be matched, in document order: every
`condition` and every `related` node that is not inside a related node's `where` (errors.md, Matched). It feeds the
per-condition breakdown; the order of all nodes comes from the definition.

### `Reason`

| Member | Type | Notes |
|---|---|---|
| `conditionId` | string | the id of the matched node (a condition or a related node) |
| `reasonKey` | string | the operator key, or `related_any` or `related_none` (errors.md, Reason keys) |
| `params` | object | keys and raw values: `{ left, actual, value }`, `{ left, actual, values }`, `{ left, actual, right, rightActual }` or `{ left, actual }`; `{ relationship }` for the two related keys |
| `text` | string | the rendered reason |
| `textParts` | TextPart[] | |

### `Violation`

| Member | Type | Notes |
|---|---|---|
| `key` | string | the root record's key |
| `display` | object | the root entity's identifying fields (`identifyingFields` in the glossary), field key to value: a JSON number, string, boolean, enum value, date, or null |
| `matched` | string[] | the ids of the matched nodes, in document order |
| `reasons` | Reason[] | one per id of `matched`, in the same order |
| `reasonText` | string | the reasons' texts joined by `phrases.reasonSeparator` |

The identifying fields are name first: employee `first_name`, `last_name`, `employee_number`; department `name`,
`department_number`; ministry `name`. A JSON object has no order, so a client lays out `display` in
`identifyingFields` order. The api stores, per violation, `display_text`: the `display` values in `identifyingFields`
order joined by one space (a number as in JSON, a date as `YYYY-MM-DD`, a boolean as `true` or `false`, a null left
out), cut to 400 characters. Results `search` and `sort=display` read it (§4, results).

### `ResultItem`

A `Violation` as the engine returned it, plus `seq`:

| Member | Type | Notes |
|---|---|---|
| `seq` | integer | from 1, the violation's position in the engine's order (the root key as the database orders it) |
| `key`, `display`, `matched`, `reasons`, `reasonText` | | as in `Violation`, stored as received |

### `Evidence`

| Member | Type | Notes |
|---|---|---|
| `key` | string | errors.md, Evidence keys |
| `params` | object | per key; `field` is a field key |
| `text` | string | rendered from `suggestions.evidence.<key>` |

### `SuggestionItem`

| Member | Type | Notes |
|---|---|---|
| `name` | string | in the request language, at most 200 characters |
| `description` | string | in the request language |
| `rationale` | string | why the engine proposes it, in the request language |
| `evidence` | Evidence[] | `violations_found` always, then the kind's own |
| `definition` | Definition | valid, and flags at least one record on today's date |
| `sentence` | string | the definition's rule sentence |
| `sentenceParts` | TextPart[] | |

### `Page<T>`

| Member | Type | Notes |
|---|---|---|
| `items` | T[] | the page; empty past the last page |
| `total` | integer | the number of items over all pages, after filters |
| `page` | integer | as asked, from 1 |
| `pageSize` | integer | as asked |

Query parameters of every paged endpoint: `page?` integer, at least 1, default 1; `pageSize?` integer, 1 to 200,
default 25. A value outside its range is 400 (`OUT_OF_RANGE`), one that is not an integer 400 (`MALFORMED`); a page
past the end is 200 with empty `items`.

### `Control`

| Member | Type | Notes |
|---|---|---|
| `id` | integer | |
| `name` | string | 1 to 200 characters, trimmed; names are not unique |
| `description` | string or null | at most 1000 characters, trimmed; empty is stored as null |
| `rootEntity` | string | the current version's root entity key |
| `version` | integer | the current version, from 1 |
| `isActive` | boolean | false once archived |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | the last change of name, description, definition or archive state |
| `concurrencyToken` | string | the base64 of the row version; opaque to the client, sent back on `PUT` |
| `definition` | Definition | the current version's definition |

### `ControlSummary`

`Control` without `definition` and `concurrencyToken`, plus:

| Member | Type | Notes |
|---|---|---|
| `lastRun` | `LastRun` or null | the control's newest run of any status (by `startedAt`); null before the first run |

`LastRun`:

| Member | Type | Notes |
|---|---|---|
| `id` | integer | the run's id |
| `startedAt` | timestamp | |
| `status` | string | as `Run.status` |
| `totalCount` | integer or null | as `Run.totalCount` |

### `ControlVersionSummary` and `ControlVersion`

| Member | Type | Notes |
|---|---|---|
| `version` | integer | from 1 |
| `createdAt` | timestamp | |
| `definitionHash` | string | in `ControlVersionSummary` only: opaque; equal hashes mean equal definitions |
| `definition` | Definition | in `ControlVersion` only |

### `Run`

| Member | Type | Notes |
|---|---|---|
| `id` | integer | |
| `controlId` | integer | |
| `controlName` | string | the control's current name |
| `controlVersion` | integer | the version that ran |
| `rootEntity` | string | that version's root entity key |
| `runDate` | date | the date the rules were evaluated on |
| `language` | string | `he` or `en`: the language its text was rendered and stored in |
| `startedAt` | timestamp | |
| `finishedAt` | timestamp or null | null while running |
| `status` | string | `running`, `succeeded`, `failed` or `timed_out` |
| `totalCount` | integer or null | all violations; null unless succeeded |
| `storedCount` | integer or null | the violations stored (at most the row cap); null unless succeeded |
| `capExceeded` | boolean | `totalCount` above `storedCount`; false unless succeeded. The client shows it as `ROW_CAP_EXCEEDED` with `{ total, stored }` |
| `durationMs` | integer or null | the engine's `durationMs` for a succeeded run, the api's elapsed time for a failed or timed-out one, null while running |
| `sentence` | string or null | the rule sentence; null unless succeeded |
| `sentenceParts` | TextPart[] or null | null unless succeeded |
| `conditions` | ConditionSummary[] or null | with `count`, exact over all violations also when `capExceeded`; null unless succeeded |
| `error` | `RunError` or null | null unless failed or timed out |
| `previousRun` | `PreviousRun` or null | the control's newest succeeded run that started before this one |

`RunError` is `{ code, params }`, a code of errors.md marked "Run error": `QUERY_TIMEOUT` with `{ timeoutSeconds }`
(status `timed_out`); `CONTROL_DEFINITION_OUTDATED` with `{ errors: DefinitionError[] }`, `DATABASE_UNAVAILABLE`,
`ENGINE_UNAVAILABLE` and `INTERNAL_ERROR` with `{}` (status `failed`). Which engine answer gives which is in §4,
Engine failures. A run is `running` only while its request is in progress, or after a crash cut it off.

`PreviousRun`:

| Member | Type | Notes |
|---|---|---|
| `id` | integer | |
| `startedAt` | timestamp | |
| `totalCount` | integer | |

## 3. Engine API

The base URL is configuration (`http://localhost:8000` in development) and there is no path prefix. Only the api calls
the engine; the client never does.

| Method and path | Request body | Success | Errors |
|---|---|---|---|
| `GET /health` | none | 200 `{ status, database, glossaryVersion, engineVersion }` | 503 `DATABASE_UNAVAILABLE`, 503 `GLOSSARY_MISMATCH` |
| `GET /glossary` | none | 200 the public glossary | none |
| `POST /validate` | `{ definition }` | 200 `{ valid, sentence, sentenceParts, conditions }` | 422 `DEFINITION_INVALID` |
| `POST /run` | `{ definition, runDate?, rowCap? }` | 200 the run answer | 422 `DEFINITION_INVALID`, 504 `QUERY_TIMEOUT`, 503 `DATABASE_UNAVAILABLE` |
| `POST /suggest` | `{ rootEntity?, max? }` | 200 `{ source, items }` | 503 `DATABASE_UNAVAILABLE`, 504 `QUERY_TIMEOUT` |
| `POST /debug/compile` | `{ definition, runDate? }` | 200 `{ sql, params, countSql, countParams }` | 404 `DEBUG_DISABLED`, 422 `DEFINITION_INVALID` |

**Time limits.** Every statement runs under the engine's statement timeout, 30 s by default
(`QUERY_TIMEOUT.timeoutSeconds` reports it). `/run` runs two statements (the count, then the page), so its worst case
is about 60 s; `/suggest` takes up to about 25 s when an LLM key is configured. The api's attempt timeout (75 s by
default) stays above both.

### `GET /health`

200 `{ status: "ok", database: "ok", glossaryVersion: string, engineVersion: string }`. 503 `DATABASE_UNAVAILABLE`
when the database does not answer; 503 `GLOSSARY_MISMATCH` with `{ table, column }` when the glossary no longer fits
the database (checked again at most once a minute).

### `GET /glossary`

200 the public glossary: `contracts/glossary.json` with `table`, `keyColumn`, `column`, `computed` and `join` removed;
entities and fields with `visible: false` removed, and the relationships that start or end at a removed entity; and
every field given `operators`, its resolved operator keys (the field's override, else every operator whose `types`
include the field's type, minus `is_null` and `is_not_null` when the field is not nullable). Everything else is served
as in the file: `glossaryVersion`, `languages`, `defaultLanguage`, `limits`, `formats`, `phrases`, `operators`,
`suggestions`, and per entity and field `label`, `identifyingFields`, `rootable`, `lifecycle`, `required`,
`comparable` (absent means true), `unit`, `enumValues` and `valueLabels`. Labels and templates come in both
languages; nothing is rendered.

### `POST /validate`

A dry compile; it does not touch the database.

| Request member | Type | Notes |
|---|---|---|
| `definition` | Definition | |

200:

| Member | Type | Notes |
|---|---|---|
| `valid` | boolean | always `true` |
| `sentence` | string | the rule sentence |
| `sentenceParts` | TextPart[] | |
| `conditions` | ConditionSummary[] | without `count` |

422 `DEFINITION_INVALID` with every error found (errors.md, Order of checks).

### `POST /run`

| Request member | Type | Notes |
|---|---|---|
| `definition` | Definition | |
| `runDate?` | date | default today; a value that is not a real date is 400 `MALFORMED` |
| `rowCap?` | integer | at least 1 (else 400 `OUT_OF_RANGE`); absent, or above the engine's configured maximum (5,000 by default), it is that maximum |

200, the run answer:

| Member | Type | Notes |
|---|---|---|
| `runDate` | date | the date used |
| `totalCount` | integer | all violations |
| `returnedCount` | integer | the number of `violations`: the smaller of `totalCount` and the cap |
| `capExceeded` | boolean | `totalCount` above `returnedCount` |
| `durationMs` | integer | the engine's time for the run, in milliseconds |
| `engineVersion` | string | |
| `glossaryVersion` | string | |
| `sentence` | string | the rule sentence |
| `sentenceParts` | TextPart[] | |
| `conditions` | ConditionSummary[] | with `count` over all violations |
| `violations` | Violation[] | ordered by the root key as the database orders the key column; the first `returnedCount` |

Errors: 422 `DEFINITION_INVALID`; 504 `QUERY_TIMEOUT` with `{ timeoutSeconds }`; 503 `DATABASE_UNAVAILABLE`. A run is
stateless: nothing is stored by the engine.

### `POST /suggest`

| Request member | Type | Notes |
|---|---|---|
| `rootEntity?` | string | keeps only suggestions rooted at this entity; a key that is not a rootable entity gives no items |
| `max?` | integer | at least 1 (else 400 `OUT_OF_RANGE`); default 10 (configurable); at most 20 items are returned |

200:

| Member | Type | Notes |
|---|---|---|
| `source` | string | `heuristics`, or `heuristics+llm` when an LLM call succeeded (whatever survived validation) |
| `items` | SuggestionItem[] | the heuristic ones first, then the LLM's; each one validated, compiled and counted on today's date, and dropped when it flags no record |

Errors: 503 `DATABASE_UNAVAILABLE`; 504 `QUERY_TIMEOUT`. With no LLM key, or when the LLM call fails or takes longer
than 20 s, the answer is the heuristic list, with the same shape and status.

### `POST /debug/compile`

Developer only, off by default (`ENGINE_DEBUG_COMPILE`); when off, every call is 404 `DEBUG_DISABLED`. It shows the
two statements of a run and executes nothing. The api does not expose it.

| Request member | Type | Notes |
|---|---|---|
| `definition` | Definition | |
| `runDate?` | date | default today; the date the parameters are computed for |

200:

| Member | Type | Notes |
|---|---|---|
| `sql` | string | the page statement's text, with placeholders and never a value |
| `params` | array | the page statement's parameters, in placeholder order: `{ name, type, value }`, `type` the bound type's name, `value` as JSON (a date as `YYYY-MM-DD`) |
| `countSql` | string | the count statement's text |
| `countParams` | array | the count statement's parameters, as `params` |

Errors: 404 `DEBUG_DISABLED`; 422 `DEFINITION_INVALID`.

## 4. Application API (`/api/v1`)

| Method and path | Request | Success | Errors |
|---|---|---|---|
| `GET /api/v1/health` | none | 200 `{ status, database, engine, version }` | none: always 200 |
| `GET /api/v1/glossary` | none | 200 the engine's public glossary | 503 `ENGINE_UNAVAILABLE` |
| `GET /api/v1/controls` | query `search`, `rootEntity`, `active`, `page`, `pageSize` | 200 `Page<ControlSummary>` | 503 `DATABASE_UNAVAILABLE` |
| `POST /api/v1/controls` | `{ name, description?, definition }` | 201 `Control` | 422 `DEFINITION_INVALID`, 503 `ENGINE_UNAVAILABLE`, 503 `DATABASE_UNAVAILABLE` |
| `GET /api/v1/controls/{id}` | none | 200 `Control` | 404 `CONTROL_NOT_FOUND`, 503 `DATABASE_UNAVAILABLE` |
| `PUT /api/v1/controls/{id}` | `{ name, description?, definition, concurrencyToken }` | 200 `Control` | 404 `CONTROL_NOT_FOUND`, 409 `CONTROL_ARCHIVED`, 409 `CONCURRENCY_CONFLICT`, 422 `DEFINITION_INVALID`, 503 `ENGINE_UNAVAILABLE`, 503 `DATABASE_UNAVAILABLE` |
| `DELETE /api/v1/controls/{id}` | none | 204 | 404 `CONTROL_NOT_FOUND`, 503 `DATABASE_UNAVAILABLE` |
| `GET /api/v1/controls/{id}/versions` | none | 200 `ControlVersionSummary[]` | 404 `CONTROL_NOT_FOUND`, 503 `DATABASE_UNAVAILABLE` |
| `GET /api/v1/controls/{id}/versions/{version}` | none | 200 `ControlVersion` | 404 `CONTROL_NOT_FOUND`, 404 `VERSION_NOT_FOUND`, 503 `DATABASE_UNAVAILABLE` |
| `POST /api/v1/controls/validate` | `{ definition }` | 200 the engine's `/validate` body | 422 `DEFINITION_INVALID`, 503 `ENGINE_UNAVAILABLE` |
| `POST /api/v1/controls/{id}/runs` | `{ runDate? }` or no body | 201 `Run`, also when the run failed | 404 `CONTROL_NOT_FOUND`, 409 `CONTROL_ARCHIVED`, 503 `DATABASE_UNAVAILABLE` |
| `GET /api/v1/controls/{id}/runs` | query `page`, `pageSize` | 200 `Page<Run>` | 404 `CONTROL_NOT_FOUND`, 503 `DATABASE_UNAVAILABLE` |
| `GET /api/v1/runs/{id}` | none | 200 `Run` | 404 `RUN_NOT_FOUND`, 503 `DATABASE_UNAVAILABLE` |
| `GET /api/v1/runs/{id}/results` | query `page`, `pageSize`, `search`, `condition`, `sort`, `dir` | 200 `Page<ResultItem>` | 404 `RUN_NOT_FOUND`, 503 `DATABASE_UNAVAILABLE` |
| `POST /api/v1/suggestions` | `{ rootEntity?, max? }` or no body | 200 the engine's `/suggest` body | 503 `ENGINE_UNAVAILABLE`, 503 `DATABASE_UNAVAILABLE`, 504 `QUERY_TIMEOUT` |
| `POST /api/v1/suggestions/accept` | `{ items: [{ name, description?, definition }] }` | 201 `{ items: Control[] }` | 422 `DEFINITION_INVALID`, 503 `ENGINE_UNAVAILABLE`, 503 `DATABASE_UNAVAILABLE` |

Every 201 carries `Location`: `/api/v1/controls/{id}` for a created control (on accept, the first one),
`/api/v1/runs/{id}` for a run. Runs are synchronous: the POST answers when the run has finished.

### Engine failures

How the api answers when the engine fails, in a request (validate, save, suggestions) and in a run (the run is closed
with that status and error, and the POST still answers 201):

| Engine answer | In a request | In a run |
|---|---|---|
| 422 `DEFINITION_INVALID` | 422 `DEFINITION_INVALID`, the engine's `errors` unchanged | `failed`, `CONTROL_DEFINITION_OUTDATED` with `{ errors }` (the engine's errors) |
| 504 `QUERY_TIMEOUT` | 504 `QUERY_TIMEOUT`, `{ timeoutSeconds }` | `timed_out`, `QUERY_TIMEOUT` with `{ timeoutSeconds }` |
| 503 `DATABASE_UNAVAILABLE` | 503 `DATABASE_UNAVAILABLE` | `failed`, `DATABASE_UNAVAILABLE` |
| not reachable, attempt timed out, circuit open | 503 `ENGINE_UNAVAILABLE` | `failed`, `ENGINE_UNAVAILABLE` |
| anything else | 500 `INTERNAL_ERROR` | `failed`, `INTERNAL_ERROR` |

### `GET /api/v1/health`

Always 200:

| Member | Type | Notes |
|---|---|---|
| `status` | string | `ok`, or `degraded` when `database` or `engine` is not `ok` |
| `database` | string | `ok` or `unavailable` (the api's `dq` connection) |
| `engine` | string | `ok` or `unavailable` (the engine's `GET /health`) |
| `version` | string | the api's version |

### `GET /api/v1/glossary`

200 the engine's public glossary (§3) unchanged; the api caches it. 503 `ENGINE_UNAVAILABLE` when the api holds no
copy and the engine does not answer.

### `GET /api/v1/controls`

| Query parameter | Type | Notes |
|---|---|---|
| `search?` | string | the name contains it; case-insensitive, `%` and `_` taken literally |
| `rootEntity?` | string | the root entity key, exact |
| `active?` | string | `true` (default): active controls; `false`: archived ones; `all`: both. Any other value is 400 `MALFORMED` |
| `page?`, `pageSize?` | integer | `Page<T>` |

200 `Page<ControlSummary>`, ordered by name, then id.

### `POST /api/v1/controls`

| Body member | Type | Notes |
|---|---|---|
| `name` | string | 1 to 200 characters after trimming (`REQUIRED`, `TOO_LONG`) |
| `description?` | string | at most 1000 characters after trimming (`TOO_LONG`) |
| `definition` | Definition | |

The api checks the request, then the definition against the schema (422, without calling the engine), then through
the engine's `/validate` (422 relayed, or 503 `ENGINE_UNAVAILABLE`), and stores the control with version 1. 201
`Control`.

### `GET /api/v1/controls/{id}`

200 `Control`, archived ones included. 404 `CONTROL_NOT_FOUND` with `{ id }`.

### `PUT /api/v1/controls/{id}`

| Body member | Type | Notes |
|---|---|---|
| `name` | string | as on `POST` |
| `description?` | string | as on `POST`; absent or null clears it |
| `definition` | Definition | |
| `concurrencyToken` | string | from the `Control` the client read |

Checks in this order: the request members (400); 404 `CONTROL_NOT_FOUND`; 409 `CONTROL_ARCHIVED` (an archived
control is read-only); the token, before the definition is looked at: 400 `MALFORMED` at `/concurrencyToken` when it
is not a token, 409 `CONCURRENCY_CONFLICT` with `{ id }` when it is not the current one; the schema (422). A new version is written only when the definition differs from the current version's
(compared by a hash of a canonical form); only then is the engine's `/validate` asked (422 relayed, 503
`ENGINE_UNAVAILABLE`). A name or description change keeps the version and works while the engine is down. 200
`Control` with a new `concurrencyToken`; when nothing changed, 200 with the control as it is and nothing written. A
save that loses a race after the check is 409 `CONCURRENCY_CONFLICT` as well.

### `DELETE /api/v1/controls/{id}`

Archives the control (`isActive` becomes false); its versions and runs stay readable. 204, and 204 again on a repeat.
404 `CONTROL_NOT_FOUND`. There is no un-archive in v1.

### `GET /api/v1/controls/{id}/versions`

200 `ControlVersionSummary[]`, newest first, not paged. 404 `CONTROL_NOT_FOUND`.

### `GET /api/v1/controls/{id}/versions/{version}`

200 `ControlVersion`. 404 `CONTROL_NOT_FOUND` with `{ id }`, or `VERSION_NOT_FOUND` with `{ id, version }`.

### `POST /api/v1/controls/validate`

Body `{ definition }`, nothing stored. The schema is checked by the api (422 without calling the engine), then the
engine's `/validate` answers: 200 its body unchanged (`{ valid, sentence, sentenceParts, conditions }`), 422 relayed,
or 503 `ENGINE_UNAVAILABLE`.

### `POST /api/v1/controls/{id}/runs`

| Body member | Type | Notes |
|---|---|---|
| `runDate?` | date | default today; a value that is not a real date is 400 `MALFORMED`. The body may be empty |

404 `CONTROL_NOT_FOUND`; 409 `CONTROL_ARCHIVED`. Otherwise the api resolves the run date itself, opens a run
(`running`, in the request's language), calls the engine's `/run` with the current version's definition, always
sending `runDate` and `rowCap` (its configured cap, 5,000 by default), stores the snapshot and closes the run. 201
`Run` whatever the outcome: an engine failure is the run's `status` and `error` (Engine failures), not an error
response.

### `GET /api/v1/controls/{id}/runs`

200 `Page<Run>` of the control's runs, newest first (by `startedAt`, then `id`). 404 `CONTROL_NOT_FOUND`.

### `GET /api/v1/runs/{id}`

200 `Run`. 404 `RUN_NOT_FOUND` with `{ id }`.

### `GET /api/v1/runs/{id}/results`

Served from the run's stored snapshot; the engine is not called. A run with no stored rows gives an empty page.

| Query parameter | Type | Notes |
|---|---|---|
| `search?` | string | a substring of the violation's `display_text` (`Violation`) or of its `reasonText`; case-insensitive, `%` and `_` taken literally |
| `condition?` | string | a node id: keeps the violations whose `matched` holds it |
| `sort?` | string | `key` (default): the engine's order, `seq`; `display`: `display_text`, then `seq` |
| `dir?` | string | `asc` (default) or `desc`, applied to both sort keys |
| `page?`, `pageSize?` | integer | `Page<T>` |

A `sort` or `dir` outside its words is 400 `MALFORMED`. 200 `Page<ResultItem>`; `total` counts the violations that
pass `search` and `condition`. 404 `RUN_NOT_FOUND`.

### `POST /api/v1/suggestions`

| Body member | Type | Notes |
|---|---|---|
| `rootEntity?` | string | as on the engine's `/suggest` |
| `max?` | integer | at least 1 (400 `OUT_OF_RANGE`); as on the engine's `/suggest` |

The body may be empty; nothing is stored or run. The api checks these two members and sends exactly them to the
engine's `/suggest`. 200 the engine's body unchanged (`{ source, items: SuggestionItem[] }`). Errors as in the
endpoint table.

### `POST /api/v1/suggestions/accept`

| Body member | Type | Notes |
|---|---|---|
| `items` | array | 1 to 20 items (`OUT_OF_RANGE` at `/items`) |
| `items[].name` | string | as on `POST /api/v1/controls` |
| `items[].description?` | string | as on `POST /api/v1/controls` |
| `items[].definition` | Definition | |

Each item is checked like `POST /api/v1/controls`. All controls are created or none: 201 `{ items: Control[] }` in
the request's order. The first item whose definition fails answers 422 `DEFINITION_INVALID` with `params.index`
(from 0) and `errors` whose paths are relative to that item's definition.

## 5. Examples

The shapes, member names and types below are normative. The records are the first two that the example
`contracts/examples/minor-high-salary.json` flags in the seed, and the wording is the glossary's at version 1.0.0;
both follow the seed and the glossary when those change.

### A `/run` answer

Request: `POST /run` with `Accept-Language: en` and this body.

```json
{
  "definition": {
    "schemaVersion": 1,
    "rootEntity": "employee",
    "where": {
      "type": "group",
      "op": "and",
      "children": [
        { "type": "condition", "id": "c1", "left": { "field": "age" }, "operator": "lt", "value": 18 },
        { "type": "condition", "id": "c2", "left": { "field": "salary" }, "operator": "gt", "value": 15000 }
      ]
    }
  },
  "runDate": "2026-11-01",
  "rowCap": 2
}
```

Answer: 200, three violations found and two returned, the counts over all three.

```json
{
  "runDate": "2026-11-01",
  "totalCount": 3,
  "returnedCount": 2,
  "capExceeded": true,
  "durationMs": 41,
  "engineVersion": "0.1.0",
  "glossaryVersion": "1.0.0",
  "sentence": "Age is less than 18 and Salary is greater than 15,000 ILS",
  "sentenceParts": [
    { "text": "Age", "nodeId": "c1", "role": "field" },
    { "text": " is less than ", "nodeId": "c1" },
    { "text": "18", "nodeId": "c1", "role": "value" },
    { "text": " and " },
    { "text": "Salary", "nodeId": "c2", "role": "field" },
    { "text": " is greater than ", "nodeId": "c2" },
    { "text": "15,000 ILS", "nodeId": "c2", "role": "value" }
  ],
  "conditions": [
    {
      "id": "c1",
      "sentence": "Age is less than 18",
      "sentenceParts": [
        { "text": "Age", "nodeId": "c1", "role": "field" },
        { "text": " is less than ", "nodeId": "c1" },
        { "text": "18", "nodeId": "c1", "role": "value" }
      ],
      "count": 3
    },
    {
      "id": "c2",
      "sentence": "Salary is greater than 15,000 ILS",
      "sentenceParts": [
        { "text": "Salary", "nodeId": "c2", "role": "field" },
        { "text": " is greater than ", "nodeId": "c2" },
        { "text": "15,000 ILS", "nodeId": "c2", "role": "value" }
      ],
      "count": 3
    }
  ],
  "violations": [
    {
      "key": "1051",
      "display": { "first_name": "אריאל", "last_name": "מור", "employee_number": 1051 },
      "matched": ["c1", "c2"],
      "reasons": [
        {
          "conditionId": "c1",
          "reasonKey": "lt",
          "params": { "left": { "field": "age" }, "actual": 16, "value": 18 },
          "text": "Age: 16 (less than 18)",
          "textParts": [
            { "text": "Age", "nodeId": "c1", "role": "field" },
            { "text": ": ", "nodeId": "c1" },
            { "text": "16", "nodeId": "c1", "role": "actual" },
            { "text": " (less than ", "nodeId": "c1" },
            { "text": "18", "nodeId": "c1", "role": "value" },
            { "text": ")", "nodeId": "c1" }
          ]
        },
        {
          "conditionId": "c2",
          "reasonKey": "gt",
          "params": { "left": { "field": "salary" }, "actual": 16500, "value": 15000 },
          "text": "Salary: 16,500 ILS (greater than 15,000 ILS)",
          "textParts": [
            { "text": "Salary", "nodeId": "c2", "role": "field" },
            { "text": ": ", "nodeId": "c2" },
            { "text": "16,500 ILS", "nodeId": "c2", "role": "actual" },
            { "text": " (greater than ", "nodeId": "c2" },
            { "text": "15,000 ILS", "nodeId": "c2", "role": "value" },
            { "text": ")", "nodeId": "c2" }
          ]
        }
      ],
      "reasonText": "Age: 16 (less than 18); Salary: 16,500 ILS (greater than 15,000 ILS)"
    },
    {
      "key": "1052",
      "display": { "first_name": "רותם", "last_name": "יוסף", "employee_number": 1052 },
      "matched": ["c1", "c2"],
      "reasons": [
        {
          "conditionId": "c1",
          "reasonKey": "lt",
          "params": { "left": { "field": "age" }, "actual": 15, "value": 18 },
          "text": "Age: 15 (less than 18)",
          "textParts": [
            { "text": "Age", "nodeId": "c1", "role": "field" },
            { "text": ": ", "nodeId": "c1" },
            { "text": "15", "nodeId": "c1", "role": "actual" },
            { "text": " (less than ", "nodeId": "c1" },
            { "text": "18", "nodeId": "c1", "role": "value" },
            { "text": ")", "nodeId": "c1" }
          ]
        },
        {
          "conditionId": "c2",
          "reasonKey": "gt",
          "params": { "left": { "field": "salary" }, "actual": 22000, "value": 15000 },
          "text": "Salary: 22,000 ILS (greater than 15,000 ILS)",
          "textParts": [
            { "text": "Salary", "nodeId": "c2", "role": "field" },
            { "text": ": ", "nodeId": "c2" },
            { "text": "22,000 ILS", "nodeId": "c2", "role": "actual" },
            { "text": " (greater than ", "nodeId": "c2" },
            { "text": "15,000 ILS", "nodeId": "c2", "role": "value" },
            { "text": ")", "nodeId": "c2" }
          ]
        }
      ],
      "reasonText": "Age: 15 (less than 18); Salary: 22,000 ILS (greater than 15,000 ILS)"
    }
  ]
}
```

The api stores these two rows with `seq` 1 and 2, each with `display_text` its first name, last name and employee
number joined by one space (the first ends in ` 1051`); the run answers `totalCount` 3, `storedCount` 2,
`capExceeded` true, and both `conditions` with `count` 3.

### A problem with a definition error

`POST /api/v1/controls` whose definition names a field the employee entity does not have (the fixture
`contracts/examples/invalid/unknown-field.json`). Answer: 422 with `Content-Type: application/problem+json` and the
`X-Correlation-Id` header.

```json
{
  "type": "about:blank",
  "title": "DEFINITION_INVALID",
  "status": 422,
  "code": "DEFINITION_INVALID",
  "params": {},
  "errors": [
    {
      "code": "UNKNOWN_FIELD",
      "path": "/where/children/1/left",
      "nodeId": "c2",
      "params": { "entity": "employee", "field": "nickname" }
    }
  ],
  "correlationId": "5f2c0d8e9a7b4c1d8e3f6a2b7c9d0e1f"
}
```
