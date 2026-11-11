# Assumptions, limitations and extensions

What the system takes for granted, what it does not do, what was not proven, and what could be built next. Each
item has its reason in one sentence. The design behind them is in [architecture.md](architecture.md) and, in
short, in [summarize-architecture.md](summarize-architecture.md).

## Assumptions

**About the rules**

- **A control describes the violation.** A record that matches the conditions is the exception ("find employees
  who..."), as in every example of the assignment. A rule of the form "this must always hold" is written as its
  opposite.
- **One root entity per control, and a control scans all its records.** The root entity fixes what one result
  row is, so the count and the reason per record are well defined.
- **Relationships are followed two hops at most**, and only toward "one" (the department of an employee, the
  ministry of that department). A "many" relationship is used only as "there is at least one" or "there is no"
  related record with given conditions. This keeps one result row per root record: no row is ever multiplied.
- **A comparison with a missing value never matches**, as in SQL. Missing data is found only with the explicit
  operators (`is_null`, `is_not_null`, `is_empty`, `is_not_empty`), and the interface says so beside the
  operator.
- **A rule is evaluated on a run date.** "Today" is the current day in `Asia/Jerusalem` (configurable in both
  services). Age is whole years on the run date, so a person who turns 18 on that date is 18.
- **Text is compared as the database collation compares it** (`Hebrew_CI_AS`: case-insensitive).
- **The glossary holds meaning, not rule parameters.** It says what a field is, whether it is required and in
  which state. It holds no threshold, range or other number of a rule: those belong to controls.

**About the environment**

- **The organization's data is only read.** The system detects and reports; it never fixes, updates or deletes.
- **An internal tool for trusted users.** There is no sign-in in v1, so the app is published on the local
  machine only (`APP_BIND=127.0.0.1`).
- **SQL Server authentication is available.** Least privilege rests on two SQL logins (`dq_app`, `dq_engine_ro`).
  A Windows-login fallback would run both services as one account and remove that separation, so there is none.
- **A record's key is one column**, carried as a string, so a key that is not an integer needs no contract
  change. A table with a composite key is not supported.
- **Hebrew only in v1.** The mechanism is multilingual (every text is keyed by language, in the glossary and in
  the client); only Hebrew values exist.
- **The sample dates are absolute.** The six examples flag the same records for run dates from 2026-11-01 to
  2027-12-31; after that, ages in the seed cross the examples' thresholds.

## Limitations

**Runs and results**

- **Runs are synchronous.** The request waits for the engine: two statements of at most 30 seconds each. The api
  waits for at most 75 seconds, and once more for the body. There is no queue, no progress and no cancel.
- **A run stores at most 5,000 violations** (`ENGINE_ROW_CAP`, `Runs__RowCap`). The total count stays exact, and
  the interface says how many were found and how many are shown.
- **The count and the page are two statements** at the default isolation level. On a database that is written
  between them they could differ by the rows that changed.
- **A run can stay `running`** only after a crash of the api, or when the `dq` store cannot be reached at the
  moment the run is closed. Nothing sweeps such a run.
- **Nothing limits how many runs are in flight**, and a run goes on after its client has gone.
- **A stored definition within about 36 bytes of the engine's 1 MiB body limit** can be saved and then fails its
  run with `INTERNAL_ERROR`.
- **Old runs are not removed automatically.** `sql/cleanup_runs.sql` is a script an administrator runs
  ([sql/README.md](../sql/README.md#retention)).

**The glossary and the engine**

- **A glossary change is a file change and a restart of the engine.** There is no administration screen.
- **A new computed-field kind needs engine code.** `age_years` is the only one; the list is closed on purpose
  ([glossary.md](glossary.md)).
- **Hebrew templates assume masculine singular field labels** outside the colon style ("שכר: חסר"). This holds
  while every field label is masculine.
- **An age operand beyond the range of a SQL date is clamped** to the year 0001.
- **The contract sets no maximum length for a text value** of a condition; the request size limit (1 MB) is the
  only bound.
- **A tree more than eight times past a limit** (depth, conditions or values) is answered with that limit's
  error alone, without the schema's errors beside it.
- **Suggestions are counted on today's date**, with one statement per rootable entity for the profile and one
  per candidate (about ten on the sample data), each under the statement timeout. On a database slow enough for
  the whole call to pass 75 seconds the api answers `ENGINE_UNAVAILABLE`.
- **The suggestions repeat controls that already exist.** With the six examples loaded, four of the proposals
  are the rules of examples 2 to 5, and creating one adds a second control with the same rule.
- **Example 1 is never proposed.** No heuristic invents "18" and "15,000". The language-model step that could
  is designed and not built ([summarize-architecture.md](summarize-architecture.md#the-optional-task-ai-that-proposes-controls)).

**The api**

- **Archiving cannot be undone.** An archived control can be read and duplicated, not restored. The api deletes
  nothing, so archived controls stay in the store and under the list's archive tab.
- **Control names are not unique.**
- **The schema validator is JsonSchema.Net 8.0.5**, pinned as its last MIT-licensed release.
- **The api's schema layer evaluates a tree of at most 240 nodes and 10,000 JSON values.** Anything larger is
  answered by the engine alone, with the error of the limit it breaks.

**The client**

- **Tested in Chromium only**, at 390 and 1440 pixels wide.
- **Left open by the developer on 2026-11-11, as known limitations:**
  1. on a phone the count by condition stands before the records, so the first record is below the fold;
  2. nested groups of the rule builder have no name for a screen reader;
  3. a save conflict loads the current version and discards the draft;
  4. the count on a list row may belong to an older version of the rule, when the rule was edited after its
     last run.
- **Two open points of the rule in words** (the sentence under a rule), both left for the developer's choice:
  the coloured line under a condition's words is faint, so the colours are hard to tell apart for some readers;
  and the sentence shows no bracket, so "A and (B or C)" and "(A and B) or C" read alike there. The builder
  above it shows the grouping, and the engine's own text, as [examples.md](examples.md) prints it, has the
  brackets.
- **A changed draft is not stored.** Closing the panel keeps one draft in memory for twelve seconds, and a toast
  gives it back; after that, and on a reload or a closed tab (behind the browser's own prompt), it is lost.
- **The list's search, tab and page are not in the address** while a panel is open, so a link to a run or a
  control opens it over the first page of the list.
- **The run picker offers a control's 50 newest runs.**
- **Dates are typed into the browser's date input.**
- **The page title is English until the translations load**, because the static `index.html` may hold no Hebrew.
- **The simple and the advanced form of the builder** is a state of the screen and is not stored with the
  control.
- **A run keeps the language it was made in.** Its sentences and reasons are stored as rendered, so a run made
  in one language would show that language's text to a reader of another. With Hebrew alone this cannot be seen.
- **A run that is still `running` when its page opens** shows a neutral state with a reload; the client does
  not poll.

**Security: open items of the audits**

Three audits ran: the engine alone, the api alone, and the whole composed system at the delivery gate. None left
a critical or high finding open. They found the core sound: no SQL text anywhere outside the engine's compiler,
identifiers only from the glossary and values always bound, exactly one SELECT per statement, each service on
its own login with only its own password in its container, no connection string, SQL or driver text in a
response or a log, and no `.env` in an image. Six findings of the api's audit were left open, because each is a
decision about deployment:

1. `AllowedHosts` is `*`. A web page open in a browser on the same machine could rebind its host name to
   127.0.0.1 and call the api as if it were the app: read what is stored, and also create a control and run it,
   which returns the records of `hr` that the control flags. The gate's audit rated this medium, the highest of
   the open items. A deployment sets the host names it serves (`AllowedHosts`), and sign-in closes the rest.
2. Nothing limits concurrent runs (above).
3. An unsafe method is not checked for a cross-site origin. A page could start a run with a body-less POST; it
   could not read the answer, but each such run stores a snapshot. Sign-in with anti-forgery closes it.
4. An engine answer is read whole into memory, with no cap of its own beyond the row cap.
5. The connection to SQL Server sets `TrustServerCertificate=true`, which fits the container's self-signed
   certificate and not a production server.
6. The static files carry no `nosniff`, `Content-Security-Policy` or `frame-ancestors` header.

From the gate's audit of the composed system, low and left open: all five containers share one compose network,
so the one-shot loader of the examples could reach the engine and the database, which it never calls (an
internal network for the database, the engine and the api is the fix, and part of the advisor's plan); and
`scripts/db-check.sh permissions` proves eight grants and refusals, not every combination (a write by `dq_app`
on `hr` and by `dq_engine_ro` on `dq` are covered by the explicit `DENY` of `sql/40_logins.sql` and are not
probed).

Smaller notes of the same audit, with nothing done: Swagger UI and the OpenAPI document are served in every
environment, and the engine's error parameters are relayed to the client as they come. And in the database both
schemas are owned by `dbo` and hold tables only: a view or a procedure in one schema that reads the other would
pass the `DENY` through ownership chaining, so none may be added without separating the owners first
([sql/README.md](../sql/README.md)).

Also: on the from-source path both services run as one user on one machine with `.env` beside them. Each is
started with only its own variables, but nothing stops that user from reading both passwords.

**Deployment**

- **Tested on**: SQL Server 2022 (the Linux container), Python 3.12.3 (and the engine's suite under 3.13 and
  3.14), .NET SDK 10.0, Node 22, Docker 29 with Compose v5 on WSL 2 and on Windows 10.
- **The from-source path was run on Linux (WSL) only.** What differs on Windows is named in the README: how a
  variable is set, a named instance without a port, SQL Server authentication after a default install.
- **The SQL Server image is x86-64 only.** On Apple Silicon it runs under Docker Desktop's emulation; this was
  not tried.
- **The images are not fully pinned.** The Python packages are locked with hashes; the base image tags, the
  Debian packages and the ODBC driver are whatever the repositories serve on the build day.
- **No HTTPS, no sign-in, no CI workflow, no published image.**

**Not proven**

- **The statement timeout** is tested on a fabricated driver error: the read-only login has no way to run a slow
  statement on purpose. In the client, a timeout, the row cap, an engine or a database that is down, and a save
  conflict were shown on the mocked api only, never provoked on the real stack.
- **Performance was measured once, on one machine.** On the sample data (85 employees) a run takes about 10 ms.
  On a scratch database of 200,005 employees (`scripts/scale-test.sh`) five of the six examples ran in 0.25 to
  0.6 seconds; the rule about related records ("a department with no active employee") took 9.2 seconds, and 36 ms
  once `hr.Employee` had an index on `(department_id, status)`. That index is not in v1
  ([architecture.md §11](architecture.md#11-performance-and-scale) has the table). A run of 5,000 violations is
  stored and answered by the api in about 2 seconds.
- **Windows without Docker, and macOS.** Nothing was run on a Windows host outside Docker: the engine's
  packages all have Windows wheels for Python 3.12 to 3.14 and its suite passed under those versions on Linux,
  but the engine, the published api and `db-init.sh` under Git Bash never ran there. Nothing was run on macOS;
  the bash scripts were not run under bash 3.2, its default shell.
- **The database scripts by hand.** The SSMS route of [sql/README.md](../sql/README.md) and a host `sqlcmd` were
  written from the documentation and not carried out; the scripts ran through the container's `sqlcmd` only.
- **The api's three live tests** (the real engine in place of its stub) are opt-in (`DC_LIVE=1`). They passed
  twice on 2026-11-11 and are not part of the default test command.
- **The last two commits of the client** (the rule in words as one flowing sentence) were merged with the
  client's own checks and the mocked specs only. The end-to-end specs then ran on the merged code against the
  composed system in the delivery task: 18 of 18.

## Extensions

- **Sign-in, roles and an audit of who ran what.** The first step before any shared deployment; it also closes
  two of the open security items.
- **The AI advisor**: a small service that lets a language model propose controls through the same validator
  and compiler, with an inbox a person accepts from. Designed in
  [summarize-architecture.md](summarize-architecture.md#the-optional-task-ai-that-proposes-controls), planned in
  [dev/active/dc-ai-suggestions/plan.md](../dev/active/dc-ai-suggestions/plan.md).
- **Marking a suggestion that already exists as a control.** It needs the api to compare definition hashes,
  which is a contract change.
- **Asynchronous runs with polling**, for controls over large tables, and a limit on concurrent runs.
- **Scheduling of runs**, and notifications when a control starts to find violations.
- **Export of results** (CSV, Excel).
- **A glossary in the database with an administration screen**, in place of the file and the restart.
- **A "rule must hold" mode**, where the user states the rule and the system negates it.
- **Templated controls** applied across several entities (the same "required field" rule for every entity).
- **Marking a violation as handled**, with a note, so that the next run tells new violations from known ones.
- **Restoring an archived control**, and unique names if the users ask for them.
- **Indexes for related-record rules**: an index on a child table's foreign key together with its lifecycle
  field (for the sample data, `hr.Employee (department_id, status)`), which the scale test shows is what such a
  rule needs on a large table.
- **More computed kinds** (years of service, days since a date) and more languages.
- **Horizontal scaling of the engine**, which is stateless.
