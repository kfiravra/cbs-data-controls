# dc-api notes

## State
The task is at its gate and the gate is passed. All five phases are built, reviewed and fixed; the engine
(PR #2) is merged into the branch; the live pass ran twice against the real engine, the second time on the
final code (`gates/live.txt`); the security audit ran and its one critical finding is fixed, with three more
that probing showed to be real; `/check all --tests` is green (`gates/final.txt`). The push and the PR follow
this commit, on Kfir's word of 2026-11-11 ("You have my word for the push and the PR. No merge.").

## Next
1. Kfir reads the PR (`env -u GITHUB_TOKEN gh pr list --head feat/api`); the merge is his word.
2. After the merge: `/ship` step 5, the move of this folder to `dev/completed/`.
3. For Kfir or dc-delivery, from the audit, not done here because none is critical or high and each is a
   decision about deployment or the contract (decision 38): `AllowedHosts`, a limit on concurrent runs, a
   cross-site check on unsafe methods, a cap on an engine answer, `TrustServerCertificate`, security headers
   on the static files.

## Blockers
None.

## The live pass (done 2026-11-11)
The three tests of `tests/DataControls.Api.Tests/Live/LiveEngineTests.cs` run the real app with its real engine
client: the glossary is served; each of the six examples is created, run on its `runDate` and on each of its
`alternateRuns`, every page of results is read, and the keys and matched ids must equal the example's
`expected`; each semantic-layer fixture of `contracts/examples/invalid/` must come back 422 with its code and
path. They passed against the merged engine, so the stub's fixtures (`Fixtures/engine/`, generated from
`contracts/`, decision 9) agree with it on everything those tests read. To run them again: the database up,
the engine at `Engine:BaseUrl` (`cd engine && uv sync`, then the start command of the README with
`ENGINE_DB_HOST=127.0.0.1` where `.env` has no engine block), then `cd api && DC_LIVE=1 dotnet test --filter
Category=Live`. They leave marked controls that the suite's sweep deletes; a walk through `api/requests.http`
leaves two controls, one of them active.

## Unattended run (Kfir, 2026-11-11, pasted before going to sleep)
Run the task to its final gate without questions. At each phase end: review, fix, commit, tick, continue. A
decision is taken and written here. Steps that need another task's running service wait for the merge and are
listed. The SQL Server container is shared and is never stopped, recreated or reset. `contracts/` is frozen: a
doubt is noted and the api is built to the contract. Scope is the plan as it stands. Gate passed: push the
branch and open the PR (his word for both, given in that message), no merge. Gate blocked only by steps that
wait for a merge: commit, no push.

## Second message (Kfir, 2026-11-11, pasted at 05:53)
"The engine is merged to main (PR #2). Finish this task now": fetch and merge `origin/main` (merge, no rebase);
apply the lines for dc-api of `dev/active/dc-engine/notes.md`; start the engine from this worktree (`uv sync`
included), run the live tests and one walk through `api/requests.http`, stop the engine; "A JSON body that does
not parse answers what contracts/errors.md says; if the contract is silent, 400. 415 is only for a wrong
Content-Type."; run the security-auditor pass and fix critical and high findings; `/check all --tests` green,
then push and open the PR with `pr-body.md` ("You have my word for the push and the PR. No merge."). Same rules
as the night: no questions, the database container is never stopped or reset, wait if another suite runs.

## Decisions taken unattended
1. **The session ran on Fable, not Opus.** The plan gives execution to Opus; a session cannot change its own
   model and nobody was there to switch it. Reviewer agents ran on opus as the harness sets them.
2. **Request checks are explicit, not attribute messages** (plan Design D, corrected). The contract counts
   characters after trimming and wants `max`, `min` as params; `RequestCheck` collects `REQUIRED`, `TOO_LONG`
   and `OUT_OF_RANGE` with exact pointers, and the model-state mapping only turns binder failures into
   `MALFORMED`.
3. **A JSON body that does not parse is 400; 415 is only a media type that is not JSON** (taken one way, turned
   by the Phase 1 review, turned back by Kfir on 2026-11-11). `contracts/api.md` says "a body that is not JSON
   415". The first reading took that as the media type and answered unparsable text sent as `application/json`
   with 400 `MALFORMED` at `""`; the Phase 1 reviewer held it against the contract's wording and the night's
   build answered 415 for both. Kfir's rule the next morning: "A JSON body that does not parse answers what
   contracts/errors.md says; if the contract is silent, 400. 415 is only for a wrong Content-Type." errors.md
   names no status for text that does not parse, so it is 400 `REQUEST_INVALID` with `MALFORMED` at `""`, the
   same answer as a JSON value that is not an object (`[]`, `5`). The guard in front of the binders stays: it
   reads a JSON body once, so a binder failure always means a readable body with a member of the wrong type
   (400, `MALFORMED` at the member). The engine answers 415 for both (its line, decision 32).
4. **JSON is read strictly**: member names are case-sensitive (`Name` is an unknown member, ignored) and a number
   is never read from a string (`"5"` for `max` is `MALFORMED`). The web defaults of System.Text.Json accept both.
5. **The encoder is `JavaScriptEncoder.Create(UnicodeRanges.All)`**: Hebrew and `₪` are written as they are;
   `<`, `>`, `&`, `'` and `+` are still written as `\uXXXX`, which is the same JSON.
6. **`Runs:DefaultLanguage` is checked by form at start** (two or three lower-case letters). Design B asks for "a
   language the glossary lists", but the glossary is the engine's and the host never waits for the engine
   (decision 21); once the glossary is read its own `defaultLanguage` is used.
7. **A test-only controller at `/_probe`** (in the test assembly, outside `/api/v1`) shows what the pipeline does
   with a body, a query value and a failure. Phase 1 has no endpoint with a body, and the plan's Phase 1 tests
   need one.
8. **Build settings beyond Design A**: `GenerateDocumentationFile` with CS1591 off, because IDE0005 (unused
   usings) is only reported in such a build; every private field is `_camelCase`, static ones included; the
   template's `appsettings.Development.json` is removed (the one filter it would carry is set in code); the api's
   version is 1.0.0 and `/health` reports the assembly version.

9. **The engine fixtures are generated from the contract, not written by hand** (`Fixtures/engine/`): `run.json`
   and the 422 problem are the two examples of `contracts/api.md` §5 as they stand, `validate.json` is the same
   sentence without counts, and `glossary.json` is `contracts/glossary.json` made public by the rules of
   `GET /glossary` (no `table`, `keyColumn`, `column`, `computed` or `join`; every field's operators resolved).
   If the glossary or the example changes, the fixtures are regenerated; nothing checks that automatically.
10. **Glossary tests and the breaker test start a host of their own**, because the cache and the breaker live as
    long as their host. The shared host sets `Engine:BreakerMinimumThroughput` to 100000 so that failure tests
    never open its breaker, and `Engine:AttemptTimeout` to half a second.
11. **A success body that is not a JSON object is `INTERNAL_ERROR`** for every engine call, `/validate`
    included; beyond that the api checks only the members it reads (the glossary's version, languages and
    identifying fields).

12. **The breaker does not count an answer from a living engine** (decision 11, narrowed after the Phase 2
    review). A 503 with the engine's own problem document (`DATABASE_UNAVAILABLE`) is still retried once but is
    not counted, and `/health` is a probe that is neither retried nor counted. As planned, three failed runs or
    three health polls while `hr` was down would have opened the breaker and answered `ENGINE_UNAVAILABLE` for
    `/validate` and every save, which need no database, from an engine that was up. What still counts: a refused
    connection, an attempt timeout, a 502, and a 503 that is not a problem document (something in front of the
    engine).
13. **After a failed glossary refresh the engine is left alone for 30 seconds** (a constant, not a setting). In
    that time the held copy is served, or the same failure is answered when there is none. Without it every
    reader queued behind the one refresh made a full attempt of its own, one at a time.
14. **The engine's body has a time limit of its own**, one more attempt timeout after the headers, because the
    pipeline's limits end at the headers; a body that stalls is `ENGINE_UNAVAILABLE`.
15. **A `nodeId` comes only from a node**: the root group, a child of a group, or the `where` of a related node.
    An `id` on the definition itself or inside a field reference is ignored, as the engine's own rule has it
    (the reviewer read it on `feat/engine`).

16. **The controls list trims `search` and an empty one filters nothing**, as the contract says for the results
    search; for the controls list the contract only says "the name contains it".
17. **An archive that meets a concurrent save is applied to the row as it is now** (up to three tries). `DELETE`
    carries no token and its contract knows no conflict, so a 409 or a 500 there would be an answer the contract
    does not list.
18. **Response types are named `ControlResponse`, `ControlSummaryResponse` and so on**, because the contract's
    names (`Control`, `ControlVersion`) are the entities' names; the JSON members are the contract's.

19. **An id or a version in the path is a positive integer of any size up to 64 bits.** `contracts/api.md` answers
    404 `NOT_FOUND` only for a segment "that is not a positive integer", so `99999999999` is an id no control has
    (`CONTROL_NOT_FOUND` with that id), not an unknown path. A number of more than 19 digits no longer fits the
    route's type and is `NOT_FOUND`.
20. **`lastRun` is read in a second query, for the page's controls only**, instead of the correlated subquery of
    Design F. EF turns that subquery into a ROW_NUMBER over the whole of `dq.Run`; restricted to the page's ids
    it enters the index on `(control_id, started_at DESC)` once per control. The id stays as the tie-break of two
    runs started in the same millisecond.
21. **Two saves that race to add the same version number are a 409 as well**: the second insert meets the first
    one's key, and that is answered `CONCURRENCY_CONFLICT`, not 500.

22. **A run's request is checked before its control is read**: a malformed `runDate` is 400 also for an unknown or
    archived control, as the contract orders the checks of `PUT`. Design F named the control first.
23. **The snapshot's rows reach the context through the run's own collection and one `SaveChanges`**, which is
    one change-detection pass over them. Design F asks for "change detection off"; switched off, the context
    would not see the run's own closing either. Measured: a run of 5,000 violations is stored and answered in
    1.8 to 2.0 s (three runs, `gates/phase-4.txt`), so the batch size is the provider's default.
24. **Without a glossary the display values keep the engine's order.** `display_text` is ordered by the root
    entity's `identifyingFields`; if the glossary cannot be had right after a run (rare: the engine has just
    answered) the rows are stored in the order the engine wrote the values, and a warning is logged.
25. **A run answer outside the contract closes the run `INTERNAL_ERROR`**: a member missing or of another type, a
    record key that is empty or longer than 64 characters, fewer violations counted than returned. An engine
    version longer than its column makes the save fail, which is the "snapshot cannot be stored" case: `failed`,
    `INTERNAL_ERROR`, no rows.

26. **A run that the host cuts off is closed, not left `running`.** Decision 12 lets the host's stop cancel the
    engine call; the row is then closed `failed` with `INTERNAL_ERROR` and the request is still answered 201.
    After the row exists no write of it takes a cancellation token, the client's or the host's, so a run stays
    `running` only when the process dies or the database is gone at the moment of closing.

27. **`UseDefaultFiles` is left out.** The fallback route answers `/` with `index.html` itself, and the
    default-files middleware does nothing once an endpoint has matched, so it would be dead.
28. **CORS is always in the pipeline, with a policy built from `Cors:AllowedOrigins`**; with no origin it allows
    none. Design D says "CORS when origins are configured"; the outcome is the same, and the settings are read
    when first needed, not while the host is being composed.
29. **`max` of a suggestions request has a lower bound only** (`OUT_OF_RANGE` with `min`); the engine caps what it
    returns. A null item of `accept` is read as an empty one (`REQUIRED` at its name and its definition).
30. **The README gets one section, "The api (.NET 10)"**, before the repository map. The two sentences elsewhere
    in the README that say "filled by dc-api" (Configuration, Running the tests) are dc-delivery's to reword
    (decision 26), and are in the list below.
31. **A test holds `api/requests.http` to the contract's table**, one request per row, like the mapped
    endpoints and the OpenAPI document.

### After the merge of the engine (2026-11-11, Kfir's second message: finish the task, no questions)
32. **The engine's line for dc-api, clause by clause** (`dev/active/dc-engine/notes.md`, "Lines for the other
    sessions"). The 30 s statement timeout and the 65 s worst case of `/run`: the attempt timeout is 75 s, as
    api.md says; nothing changed. `/suggest` sends about ten statements, each under that timeout: it shares the
    75 s attempt, so on a database slow enough it is answered 503 `ENGINE_UNAVAILABLE` by the api before the
    engine finishes; nothing changed, listed for the limitations document. The engine's 415 and 413 for a body:
    the api never sends it text that does not parse, and decision 34 keeps what it sends under the engine's
    1 MiB. A tree more than eight times past a limit: relayed as the engine answers it, up to the api's own
    depth (decision 35). Half a surrogate pair: decision 33. `127.0.0.1:8000` with no prefix: the default
    `Engine:BaseUrl` stays `http://localhost:8000`, which api.md names, and it reached the engine on this
    machine in the live pass.
33. **A body with a string the api cannot read is 400 `MALFORMED` at `""`.** Probing the engine's last clause
    showed a fault in the api: half a surrogate pair written as an escape, or bytes that are not UTF-8, anywhere
    in a definition (a value, a node id, a field key, a member name) was a 500, because System.Text.Json accepts
    such a string as a token and fails only when its text is asked for, which the schema check does. The body
    guard now reads every string and member name of a JSON body and refuses the body. The engine answers such a
    string 422 `VALUE_TYPE_MISMATCH`; the api cannot pass it on to get that answer, because JsonSchema.Net
    cannot evaluate it, so here the two services differ (400 and 422) on an input no client of ours can build.
34. **A definition is forwarded and stored as the text it was sent in.** The api's writer spells `+`, `<`, `>`,
    `&`, `'` and every character outside the BMP as `\uXXXX`, up to six bytes for one. The engine refuses a body
    over 1 MiB with 413, which the api would have answered as 500 `INTERNAL_ERROR`: a definition of about
    180 KB of such characters passed the api's 1 MB limit and failed on the way to the engine. `EngineClient`
    now writes the definition's own text into the engine's body, and the stored text is the sent text without
    the layout between its tokens (`StoredJson.Minify`), so neither is ever longer than the request. The hash
    is unchanged (it is taken from the canonical form). What is left: a stored definition within about 36
    bytes of 1 MiB passes validation and fails its run with `INTERNAL_ERROR`, because `/run`'s body carries
    the date and the cap as well.
35. **A body nested deeper than 64 levels is 400 `MALFORMED` at `""`** (it was 415 with the night's reading of
    decision 3). The engine answers a tree far past the depth limit 422 with that limit's error; through the
    api that answer is reached up to about 30 nested groups, and beyond it the api's own limit answers first.
    Kept: the limit bounds the recursion of the schema check.
36. **The walk's two controls were archived through the api.** `api/requests.http` creates one control and
    accepts one suggestion in the shared database and archives only the first; the second (id 1463) was
    archived with one more `DELETE`, so the default list is as empty as it was. Both stay readable with
    `active=all`.

37. **PR #2 was still open when the message said it was merged.** At 05:53 `origin/main` was `f9928bf` and
    the PR was open and mergeable. Merging it was not mine to do. The steps that did not need it went first
    (the 400 rule, the probe of the engine's line, the start of the audit); the merge appeared at 08:36 and
    `origin/main` was merged into the branch at 08:37 (`cc9ed8c`, no conflict in `README.md` or
    `.env.example`).
38. **Of the audit, more than "critical and high" was fixed, and the rest was left on purpose.** Fixed: the
    critical finding; one rated medium and "suspected" that measuring made serious (50,000 empty children, a
    body of 146 KB: 23 s and 2.4 GB of allocations in the schema library); and two rated low that were a 500
    of the kind fixed the same morning (a number outside the decimal range, and `text/json` passing the body
    guard). Left, each named in the PR body: a limit on concurrent runs and what it answers (a contract
    question); `AllowedHosts: "*"` (the right list depends on dc-delivery's compose); a cross-site check on
    unsafe methods; a cap on the size of an engine answer; `TrustServerCertificate=true`; security headers on
    the static files.
39. **The api's schema layer evaluates a bounded tree and leaves a larger one to the engine.** More than 240
    nodes (objects and arrays that are items of an array), more than 10,000 JSON values, or a number that does
    not fit a decimal: the layer reports nothing and the engine's `/validate` answers, as it does for any
    definition before a save. The first number is eight times the glossary's 30 conditions, the point past
    which the engine itself answers with the limit's error alone (its line). The engine checks the schema too,
    and nothing is stored before it has answered, so no check is lost; what changes is who answers, and that
    such a tree gets 503 `ENGINE_UNAVAILABLE` while the engine is down instead of a schema answer. Seen live:
    241 empty children come back 422 `TOO_MANY_CONDITIONS` with `{max: 30, actual: 241}`, 50,000 in 0.05 s,
    `values: [1e30, 1]` as `VALUE_TYPE_MISMATCH`. The numbers are constants in `DefinitionSchemaValidator`; if
    the glossary's limits grow past them, trees between the two are answered by the engine, correctly.
40. **Schema errors are put in order by following only the reported paths** (`DefinitionDocument.Locate`), not
    by a pointer for every element of the definition. Same order, same `nodeId`; a pointer that leads nowhere
    still comes last with the id of the node above the place where it leaves the definition.
41. **The live pass ran twice.** The first (08:41) was on the code before the audit's fixes, which touch the
    schema layer and the body guard, so it was repeated on the final code (08:56) with the audit's inputs
    added. The engine was started and stopped for each; the second start is one more than Kfir's message
    names.

## Last reviewed
Security audit of the whole api (`git diff main -- api .env.example README.md` with the working tree, on
2026-11-11), fixes in the commit that carries this line (`fix(api): security audit fixes`). Before it:
`0129a3b` (Phase 5), fixes in `aa3b954`; `f54d6c2` (Phase 4), fixes in `90a5db1`; `96bc1e9` (Phase 3), fixes in
`a619323`; `b89bd0b` (Phase 2), fixes in `638787d`; `8e80f74` (Phase 1), fixes in `a781c91`.

## Docs for dc-delivery
Kept as the work went (plan.md decision 26) and confirmed against what was built at the gate; it is copied into
the PR body under this heading. Each entry is something a document this task does not own should say.

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

## Log
The times of 2026-11-11 are the times of the commits (`git log`): a first draft of these lines carried
estimated times that ran up to two hours ahead of the clock, and they were corrected at 01:15.
A review's line follows plan.md decision 27: the diff range, findings per axis and severity, each critical and
warning by file, what the fix changed, what was left and why, what Kfir rejected or rewrote.

- 2026-11-10 created plan. Interview in two rounds, eight questions. Kfir took the recommended option in each
  (plan.md Decisions 1 to 8) and left one optional extra unselected, the runnable stub engine.
- 2026-11-10 three corrections by Kfir during the session. (1) Before the addendum was written: re-read the
  contracts plan, write a separate section, and make the two sections agree on the `SCHEMA_VIOLATION` path.
  (2) The rendered-text parts are named `sentenceParts` and `textParts` and take their shape from the engine
  session's section; that section was not on disk when he said so (the file was unchanged since 15:12), the
  session waited, and it landed at 19:54. (3) The three asks from dc-delivery, below.
- 2026-11-10 one rule of this plan was replaced after reading the engine session's section: its H4a (the path is
  the failing keyword's location) is more precise than this plan's first rule (the nearest node), so H4a holds
  and plan.md decision 24 says what the api does to follow it.
- 2026-11-10 wrote into `dev/active/dc-contracts/plan.md`, on Kfir's word: Design I "Addendum from dc-api
  planning" (two decisions and 14 pinned details), one step in its phase 2 (the schema half of I1) and one in its
  phase 4, and a Log line in its notes.
- 2026-11-10 probed Python jsonschema 4.25.1 against JsonSchema.Net 8.0.5 on a miniature schema
  (`research/schema-probe.md`): they agree after three corrections on the api side, and only if the schema uses
  no `not`, `anyOf` or `oneOf`. That constraint is I1 in the contracts plan; Phase 2 repeats the probe on the
  real schema.
- 2026-11-10 read `dev/active/dc-engine/plan.md` and `dev/active/dc-web/plan.md` as they stood at 19:52 and 19:59.
  Engine: 30 s per statement and two statements per run (about 60 s, although its decision 18 says "exceed 30 s
  for a run"), `/suggest` up to 25 s with a key, 404 and 405 both `NOT_FOUND`, the same language rule as here; its
  gate sends this session one line with the timeouts and its contract differences. Web: it read this plan and
  agrees on the archived 409, the `sort` meanings and the `index.html` fallback; its two open asks to
  dc-contracts (the Hebrew date pattern, `identifyingFields` with the name first) change nothing here, because
  `display_text` follows the glossary's order; it already corrects the two `docs/design.md` lines noted below.
- 2026-11-10 21:16 updated the plan on Kfir's word with three asks from dc-delivery: the win-x64 self-contained
  publish must stand alone and is tried once before the gate (decision 25, Design I, a step in Phase 5);
  documents outside the api's own section are dc-delivery's and drift goes to the PR body (decision 26, the list
  above); the Log is kept factual (decision 27). Read `dev/active/dc-delivery/plan.md` as of 21:10: its
  `run-all.ps1` starts `prebuilt\api-win-x64\DataControls.Api.exe` from the script's directory with
  `ConnectionStrings__Dq` (a named instance, no port), `Engine__BaseUrl`, `ASPNETCORE_ENVIRONMENT=Production` and
  `ASPNETCORE_URLS`; compose passes `DB_HOST`, `DB_PORT`, `DQ_APP_PASSWORD` and `Engine__BaseUrl`; its
  `.env.example` will carry `DB_PORT=14330` for graders while Kfir's `.env` keeps 1433.
- 2026-11-10 21:20 scratch probe for decision 25 (a template web api and a test project, not kept):
  `ContentRootPath = AppContext.BaseDirectory` in `WebApplicationOptions` works under `WebApplicationFactory`
  (two tests passed; the content root was the test output folder, the app's `appsettings.json` was read there,
  `UseWebRoot` served `/` and a deep link from a temporary folder), and the built app started from another
  directory ran in Production and read the `appsettings.json` beside it. The win-x64 publish itself was not
  run: that is the Phase 5 trial.
- 2026-11-10 found while orienting:
  - `Skill(dc-api)` is path-scoped and not loadable before a file under `api/` exists; read the `SKILL.md` file.
  - NuGet, checked today: JsonSchema.Net 8.0.5 is the last MIT release (9.0.0 and later ship `OSMFEULA.txt`);
    its dependencies JsonPointer.Net 6.0.1 and Json.More.Net 2.2.0 are MIT, Json.More.Net 3.0.0 is not. .NET 11
    packages are published (EF Core and ASP.NET Core 11.0.0), the 10.0 line is at 10.0.15, the local SDK is
    10.0.114 with runtime 10.0.14.
  - Templates on this machine: `dotnet new sln` writes `.slnx`; `dotnet new webapi --use-controllers` gives
    `AddOpenApi`, `MapOpenApi` in Development only, `UseHttpsRedirection` and a random port; `dotnet new xunit`
    gives xunit 2.9.3.
  - `docs/design.md` (States table) names `GLOSSARY_MISMATCH` for a control whose field left the glossary (in
    dc-contracts Design F that is the run error `CONTROL_DEFINITION_OUTDATED`) and says the breakdown counts the
    shown rows under the cap (Kfir kept Design E: exact counts). Both are the web task's lines (its decisions 15
    and 16).
  - The suite guard's `pgrep` pattern also matches the `playwright-mcp` servers every session starts; they are
    not suites.
  - The Windows host (Windows 10 Home, build 19045) is reachable from WSL through `cmd.exe` and
    `powershell.exe` from a `/mnt/c` working directory and had no .NET on 2026-11-10, so it is where the publish
    trial shows whether the folder is self-contained.
- 2026-11-11 00:05 resumed in `../cbs-api` on `feat/api` (level with main at `f9928bf`), unattended on Kfir's
  word. Contract diff of Phase 1: `sql/30_dq_tables.sql` matches Design C column for column; Design H holds except
  three lines, corrected in the plan: request errors need params and trimmed lengths (Design D), `active` also
  takes `all` (H3), and a bad query value is `OUT_OF_RANGE` or `MALFORMED` by kind (H4). Nothing the api needs is
  left open by the contract, so no blocker was raised.
- 2026-11-11 00:20 Phase 1 gate green: build with `-warnaserror`, format, 64 tests, print guard
  (`gates/phase-1.txt`). NuGet on 2026-11-11: the three Microsoft packages at 10.0.15 (11.0.0 exists),
  Resilience 10.11.0, SwaggerUI 10.3.1 (11.0.0 exists), JsonSchema.Net 8.0.5 pinned (9.6.0 exists).
- 2026-11-11 00:30 Phase 1 review (diff `f9928bf..8e80f74`, one reviewer on opus): standards 0 critical, 2
  warning, 4 info; plan 0, 2, 2. Warnings: `Errors/ModelStateErrors.cs` passes a key without `$` as a query
  name, so MVC's implicit `[Required]` on a non-nullable member would answer `MALFORMED` under the C# name;
  `Errors/ProblemShapeTests.cs` shows decision 3 against the contract's "a body that is not JSON 415";
  `Health/HealthTests.cs` derives the expected status from the response's own `engine` member;
  `Hosting/DotEnvConfigurationProvider.cs` loads every key of `.env`, the sa and the engine passwords included.
  Fixed in `a781c91`: implicit required switched off, with the probe's `Name` made non-nullable to prove it; a
  body guard answers 415 for JSON text that does not parse (decision 3 rewritten) and holds an undeclared
  length to 1 MB; the health test asserts fixed values; the `.env` source takes the three database keys and
  `Section__Key` keys only. Info fixed in the same commit: the two foreign keys that have no ON DELETE are
  mapped `NoAction`, one public type per file in four test files, six test names given a condition, the
  `Run.Succeed` comment. Changed without a finding: Hebrew literals in test code replaced by the example's
  Hebrew name read from `contracts/examples/`. Left: `SupportedLanguages` copies its set to a local (info),
  because Phase 2 makes the set replaceable; decision 1 (Fable for execution, info) cannot be changed from
  inside the session. Kfir rejected or rewrote: nothing; he was not present.
- 2026-11-11 00:27 schema probe repeated on the real schema before Phase 2 (`research/schema-probe.md`): the two
  corrections put all five schema-layer fixtures on their expected path. Two facts found on the way:
  `JsonSchema.FromText` refuses to register the same `$id` twice in one process ("Overwriting registered schemas
  is not permitted"), so the built schema is held statically; and 40,000 evaluations of one schema instance on
  16 threads gave no mismatch and no exception, so evaluation is not locked.
- 2026-11-11 00:36 Phase 2 gate green: build, format, 159 tests, print guard (`gates/phase-2.txt`). Transitive
  packages as pinned: JsonSchema.Net 8.0.5, JsonPointer.Net 6.0.1, Json.More.Net 2.2.0, Resilience 10.11.0.
- 2026-11-11 00:50 Phase 2 review (diff `a781c91..b89bd0b`, one reviewer on opus): plan 1 critical, 3 warning, 0
  info; standards 0 critical, 1 warning, 4 info. Critical: `Engine/EngineModule.cs` retried and counted every
  503, so the engine's own `DATABASE_UNAVAILABLE` and three `/health` polls would open the one breaker and
  `/validate` would answer `ENGINE_UNAVAILABLE` from an engine that was up. Warnings: `Glossary/GlossaryService.cs`
  no back-off after a failed refresh, readers queue for an attempt each; `Controls/DefinitionDocument.cs` any
  object on the path gave a `nodeId`, the definition and a field reference included; `Engine/EngineModule.cs` no
  limit on the body read after the headers; `Health/HealthTests.cs` the 2-second probe limit and the 503 retry
  were not actually tested. Fixed in the commit `fix(api): review fixes` after `b89bd0b`: probes marked and
  skipped by both predicates, a problem-document 503 not counted (decision 12, plan decision 11 and Design E
  amended); a 30-second back-off with the failure remembered (decision 13); `ResponseHeadersRead` with a body
  limit of one attempt timeout (decision 14); node positions tracked along the pointer (decision 15); health
  tests assert one call and the two seconds on a host with a one-minute attempt timeout; four breaker tests, four
  glossary tests, a stalled-body test, node-id cases. Info fixed: the `!` in `DefinitionSchemaValidator`, the
  correlation id in its warning, the startup probe's filter on the stopping token. Left: `EngineErrorMap` knows
  `RunStatus` and `RunFailure` and its run column has no caller until Phase 4 (info), because the plan asks for
  one table. Kfir rejected or rewrote: nothing; he was not present.
- 2026-11-11 00:52 Phase 3 gate green: build, format, 239 tests, print guard (`gates/phase-3.txt`).
- 2026-11-11 01:03 Phase 3 review (diff `638787d..96bc1e9`, one reviewer on opus): standards 0 critical, 3
  warning, 3 info; plan 0, 2, 2. Warnings: `Controls/ControlUpdateTests.cs` a hand-typed copy of an example's
  definition and hard-coded entity keys in three test files (genericity); `Controls/DefinitionHasherTests.cs` no
  case with a string spelled by an escape; `Controls/ControlService.cs` `ListAsync` 61 lines in five phases;
  `ControlService.cs` the `lastRun` subquery is not served by the index as Design F says;
  `Controls/ControlsController.cs` an id beyond 32 bits answered `NOT_FOUND` where the contract's wording gives
  `CONTROL_NOT_FOUND`. Fixed in the commit `fix(api): review fixes` after `96bc1e9`: the reordered definition is
  built from the example and entity keys are read from the examples; the escape case is in the file (the
  finding was right: the escape had been decoded on its way into the file, so the case was a duplicate of the
  reference); `ListAsync` split into filter, page, last runs and mapping; last runs read for the page's ids
  with four columns (decision 20; the SQL was printed with `ToQueryString` and read: ROW_NUMBER partitioned by
  control, restricted by `control_id IN (...)`; `LIKE @p ESCAPE '\'` for the search; `OPENJSON` for the
  condition filter); ids and versions bound as 64-bit (decision 19). Info fixed: the redundant
  `OriginalValue = token` removed (the check before it already proved the token is the loaded row version);
  five test names given a condition; the wildcard search test now searches by its own test id; a duplicate
  version key in a race answers 409 (decision 21), with a test of two racing definition changes. Left:
  `LastRunResponse` uses `Persistence.RunStatus` on the wire (info), because the enum's four names are the
  contract's and the column's, and a second enum would only be converted to and from the first. Kfir rejected
  or rewrote: nothing; he was not present.
- 2026-11-11 01:06 Phase 4 gate green: build, format, 290 tests, print guard (`gates/phase-4.txt`). One run of
  5,000 violations (the stub's answer of about 3 MB, parsed, 5,000 rows inserted with the provider's default
  batch size, the run read back): 2011 ms, 1813 ms and 1880 ms in three runs of the test alone.
- 2026-11-11 01:20 Phase 4 review (diff `a619323..f54d6c2`, one reviewer on opus): plan 0 critical, 2 warning, 1
  info; standards 0 critical, 3 warning, 1 info. Warnings: `Runs/RunService.cs` a host that stops during the
  engine call left the run `running` and answered 500; `RunService.cs` the catch around the snapshot save took
  only two exception types, so a raw `SqlException` skipped the close; `Runs/RunResultsTests.cs` the display
  sort never tied (the tie-break was not exercised) and one "not the contract" case failed before the check it
  named; `Runs/DisplayText.cs` and five behaviours without a test (the value rules, the glossary version drop,
  the no-glossary order, the client's disconnect, the row cap, the same-millisecond order);
  `Support/RunAnswers.cs` chose a value's type by a field name's ending and the tests named two fields. Fixed in
  the commit `fix(api): review fixes` after `f54d6c2`: the run is closed on a host stop and no write of the row
  takes a token (decision 26); any failed snapshot save tries the close; `RunAnswers` reads the identifying
  fields and their types from the glossary fixture and takes display values by position; six `DisplayText`
  unit tests with literal expectations; `RunLifetimeTests` (client leaves, host stops, cap below the answer,
  another glossary version, no glossary); a tie in the display sort; three answers outside the contract, each
  failing on the check it names; three runs at one pinned instant. Info fixed: the insert of the run row no
  longer listens to the client (found on the implementer's own re-read before the review arrived, as was the
  wider catch); `DisplayTextOf`, which repeated the join, is gone: the order test now searches for two
  adjacent values in the glossary's order and in the order written. Found without a finding: two fake
  passwords in `ConfigurationTests` tripped the secrets scan of `/ship` and became one named placeholder; the
  host-stop test goes through `RunService` with a lifetime the test signals, because the test server is torn
  down at once where Kestrel drains its requests. Kfir rejected or rewrote: nothing; he was not present.
- 2026-11-11 01:21 the start of the published app from another directory (plan Design I), once, on WSL.
  Command: `cd api && dotnet publish src/DataControls.Api -c Release -o <dir outside the repository>/published-api`,
  a one-line `index.html` put into its `wwwroot`, then from the working directory `<dir>/run-from-here`, with
  an environment emptied but for `PATH`, `HOME`, `DB_HOST=localhost`, `DB_PORT` and `DQ_APP_PASSWORD` (read
  from `.env` into the child only), `Engine__BaseUrl=http://127.0.0.1:59999` (nothing listens there),
  `ASPNETCORE_ENVIRONMENT=Production` and `ASPNETCORE_URLS=http://127.0.0.1:5087`:
  `dotnet <dir>/published-api/DataControls.Api.dll`. The folder held 67 files, no schema file and no `.env`.
  Requests: `GET /api/v1/health` 200 (`database` ok, `engine` unavailable, `degraded`); `POST
  /api/v1/controls/validate` with the fixture `value-with-is-null.json` 422 `SCHEMA_VIOLATION` (the embedded
  schema, no engine); `GET /openapi/v1.json` 200; `GET /api/docs/index.html` 200; `GET /` and `GET /runs/1` 200
  with the index page; `GET /api/v1/controls?pageSize=1` 200; `GET /api/v1/glossary` 503 `ENGINE_UNAVAILABLE`;
  `GET /api/v1/nothing-here` 404 `NOT_FOUND`. The log: "Hosting environment: Production", "Content root path:"
  the published folder, no SQL statement, no password, one `fail:` line, which is the resilience library's own
  record of the refused connection. The process was stopped and the copied folder deleted. The same script had
  been tried once before on a scratch copy of `api/` at 01:13, with the same answers.
- 2026-11-11 01:22 Phase 5 gate green: build, format, 344 tests passed and 3 skipped (the live tests), print
  guard (`gates/phase-5.txt`).
- 2026-11-11 01:27 two suites at once, against the rule. To look for flaky tests while the Phase 5 review ran,
  this session ran `dotnet test` twice (both 344 passed) while the web session's `playwright test e2e/mocked`
  was running: the loop printed the other run and did not wait for it. The web session was told in one message
  to distrust and repeat that Playwright run. From then on every test run here waited for a clear machine (a
  guard script in the scratchpad); the last run before the gate waited 10 s for another Playwright run.
- 2026-11-11 01:33 Phase 5 review (diff `90a5db1..0129a3b`, one reviewer on opus): standards 0 critical, 1
  warning, 5 info; plan 0 critical, 1 warning, 1 info. Warnings: `Controls/DefinitionChecker.cs` the new
  `index` parameter sat after the cancellation token; `Hosting/ContractConformanceTests.cs` an endpoint mapped
  for every method carries no method metadata and would not have shown in "nothing else is under `/api/v1`".
  Fixed in the commit that carries this line (`fix(api): review fixes` after `0129a3b`): `index` before the
  token; an endpoint without method metadata is listed as `ANY`. Info fixed in the same commit:
  `ControlLocation` holds the path both controllers put in `Location`; the problem writer serialises
  `ProblemResponse`, the type the OpenAPI document describes, with `errors` left out when there are none, so
  the two cannot drift; every action that takes a body documents 413 and 415, and the status test expects them
  (the contract's §1 gives them to every request with a body); the docs test checks that Swagger UI is pointed
  at `/openapi/v1.json`; two sentences of the README section and the header of `requests.http` corrected (with
  the engine down a run is 201 with a failed run, not 503; the archive request is last, out of the table's
  order). Left: nothing. Kfir rejected or rewrote: nothing; he was not present.
- 2026-11-11 01:35 the gate. `/check all --tests` from the worktree, green (`gates/final.txt`): `db-check.sh`,
  `contracts-check.py`, build with `-warnaserror`, format, 344 tests passed and 3 skipped (the live tests),
  the print guard over all sources, the hook tests; `sql-init` skipped, as in every worktree. Packages:
  JsonSchema.Net 8.0.5, JsonPointer.Net 6.0.1, Json.More.Net 2.2.0, no Microsoft package at 11.x. `/ship` as
  far as it goes without another task: checks green, the secrets scan of `git diff main...HEAD` without a hit
  (two fake passwords in a test had tripped it earlier and were replaced), docs drift written as the list
  above, the PR body drafted in `pr-body.md`. Not done: the live pass (no engine on this machine,
  `feat/engine` not merged), and therefore no push and no PR, by Kfir's rule for the night. Not run because the
  plan does not ask for it: the `security-auditor` agent that `CLAUDE.md` names for work on error responses
  and a network boundary; it is a candidate before the merge.
- 2026-11-11 05:53 Kfir's second message (above). `git fetch`: `origin/main` still `f9928bf`, PR #2 open and
  mergeable, so step 1 had nothing to merge (decision 37). Done while it was open: decision 3 turned as he
  ruled (a JSON body that does not parse is 400 `MALFORMED` at `""`); the engine's line read from
  `origin/feat/engine` and probed, which showed two faults in the api (decisions 33 and 34: a 500 for half a
  surrogate pair anywhere in a definition; a definition made longer on its way to the engine and into the
  store); the security audit started.
- 2026-11-11 08:37 `origin/main` (`0e07fca`, PR #2, merged on GitHub at 08:36) merged into `feat/api` as
  `cc9ed8c`, no conflict. The line for dc-api in the merged `dev/active/dc-engine/notes.md` is the one already
  read; applied as decision 32.
- 2026-11-11 08:41 to 08:43 the live pass, first time (`gates/live.txt`). Engine from this worktree (`uv sync`,
  then the README's start command with `ENGINE_DB_HOST=127.0.0.1 ENGINE_DB_PORT=1433`, because this
  worktree's `.env` has no engine block). `DC_LIVE=1 dotnet test --filter Category=Live`: 3 passed in 4.2 s.
  The walk through `api/requests.http` against the api started as the file says: 16 of 16 as expected (201
  for the create, the run and the accept, 204 for the archive, 200 for the rest; the run of the updated
  control flags record 1052). Engine and api stopped; the second control of the walk archived (decision 36).
- 2026-11-11 08:45 `f3f0335`: the 400 rule, the unreadable-string check, the definition's text kept as sent,
  with their tests (355 passed, 3 skipped), the live gate and decisions 3 and 32 to 36.
- 2026-11-11 the security audit (started before the merge appeared, reported after `f3f0335`; no clock time
  was taken): one `security-auditor` agent on opus, read-only, 569 s by its own count, over the whole api
  (`git diff main -- api .env.example README.md` with the working tree as it stood before `f3f0335`). It
  ran nothing; its line numbers are of that tree. 1 critical, 0 high, 3 medium, 5 low, 4 info.
  Critical: `Controls/DefinitionSchemaValidator.cs:54` with `Controls/DefinitionDocument.cs:67,75`, the order
  of schema errors was taken from a pointer string built for every element of the definition, so one
  schema-invalid definition under 1 MB (a member name of 500,000 characters over an array of 250,000 items)
  asks for about 250 GB. Read in the code and true. Fixed in the commit that carries this line (decision
  40); the same request, with 9,000 items, is answered in 0.02 s in the second live pass.
  Medium: `Controls/DefinitionSchemaValidator.cs:37`, a wide `children` costs the schema library a lot
  (reported as suspected). Measured: 1,000 empty children 47 MB, 10,000 5.9 s and 480 MB, 50,000 23 s and
  2.4 GB, from a body of 146 KB. Fixed in the same commit, not as the audit proposed (a refusal at the
  array's path) but by leaving the tree to the engine (decision 39). `Runs/RunService.cs:46-58`, nothing
  limits concurrent runs and a run outlives its client: left, a contract question (decision 38).
  `appsettings.json:8`, `AllowedHosts` is `*`: left for dc-delivery (decision 38).
  Low: `Runs/RunsController.cs:23`, a cross-site page can start a run: left.
  `Hosting/RequestBodyGuardMiddleware.cs:28`, `text/json` passed the new guard and reached the 500 of
  decision 33: fixed in the same commit. A number outside the decimal range (reported as suspected): probed,
  `System.FormatException` from the library's `const`, `enum` and `uniqueItems`, a 500 for `"values":[1e30,1]`;
  fixed in the same commit (decision 39). `Engine/EngineClient.cs:108`, an engine answer has no size cap:
  left. `Persistence/DatabaseOptions.cs:47` `TrustServerCertificate=true` and `Hosting/StaticHosting.cs` no
  security headers: left.
  Info, nothing done: the engine's `errors` and `params` are relayed as they come; `.env` is looked for up to
  the filesystem root in Development; Swagger UI is served in Production; the body guard's 400 where the
  contract's sentence says 415, which is Kfir's rule (decision 3).
  Found sound: listed under "Docs for dc-delivery". Kfir rejected or rewrote: nothing; he was not present.
  What was left is my decision 38, his to overrule.
- 2026-11-11 08:56 to 08:57 the live pass, second time, on the final code (`gates/live.txt`, second part): 3
  live tests passed in 4.6 s; the walk 16 of 16; and the inputs of the morning against the real engine: 240
  empty children answered by the api with 241 schema errors; 241 and 50,000 answered by the engine with
  `TOO_MANY_CONDITIONS` alone (0.05 s for 50,000); `values: [1e30, 1]` `VALUE_TYPE_MISMATCH`; half a surrogate
  pair 400, also as `text/json`; unparsable JSON 400; a wrong media type 415. Both services stopped, the
  walk's second control archived; the database container untouched throughout.
- 2026-11-11 09:05 the gate, again, on the final code. `/check all --tests` from the worktree, green
  (`gates/final.txt`), ten checks, and now with the engine's three because `engine/` is in the tree:
  `db-check.sh`, `contracts-check.py`, the engine's ruff, pyright and pytest, the api's build with
  `-warnaserror`, format and 370 tests passed with 3 skipped (the live tests, which ran on their own at
  08:56), the print guard over all sources, the hook tests; `sql-init` skipped, as in every worktree. The
  engine's tests were given `ENGINE_DB_HOST=127.0.0.1` and `ENGINE_DB_PORT=1433` in the environment, the
  values of `.env.example`: this worktree's `.env` was written before the engine block existed. The secrets
  scan of `git diff origin/main...HEAD` was repeated before the push. Then the push and the PR, on Kfir's
  word of that morning; no merge.
