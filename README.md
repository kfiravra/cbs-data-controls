# Data Controls

Generic data-quality controls for business users. A user builds a rule from business terms in a Hebrew
interface, the engine compiles it into one parameterized SELECT, and the records that break the rule come back
with a reason each. The system only reads the organization's data.

This README is a skeleton while the system is being built: each section below says which task fills it. The
design is in [docs/architecture.md](docs/architecture.md).

## What the system is

Three paragraphs on the problem, the approach and what a business user can do. Filled by dc-delivery.

## Architecture

The component diagram and the boundaries between web, api, engine and database. Filled by dc-delivery; until
then, [docs/architecture.md §3](docs/architecture.md#3-system-overview).

## Quick start with Docker

### The database (available now)

Needs Docker with Compose v2. The SQL Server 2022 image is x86-64 only: on Apple Silicon, Docker Desktop runs it
under emulation. The first pull takes about 2.2 GB of disk.

```sh
cp .env.example .env        # then set the three passwords in .env: the example file holds none
docker compose up -d db     # SQL Server on 127.0.0.1:1433 (DB_PORT in .env moves it)
scripts/db-init.sh          # creates DataControls; running it again changes nothing
scripts/db-check.sh         # one PASS or FAIL line per assertion, exit 1 on any FAIL
```

This gives the database `DataControls` (collation `Hebrew_CI_AS`) with the schema `hr`, the sample organization,
and the schema `dq`, the controls store, plus two logins that can each do only their own job: `dq_app` for the
api and `dq_engine_ro` for the engine. [sql/README.md](sql/README.md) lists the scripts, the logins, the planted
violations and how to run everything by hand.

- `scripts/db-init.sh --reset` drops `DataControls` and builds it again, which a changed seed row needs. Every
  saved control and run goes with it.
- `docker compose stop db` stops the server and keeps the data; `docker compose down -v` deletes the data volume
  as well.
- One SQL Server container per machine, initialised from the main checkout: `db-init.sh` refuses to run in a
  linked git worktree, and a worktree needs its own copy of `.env`.

### The whole system

The engine, the api and the client join `docker-compose.yml`, with one command to start them. Filled by
dc-delivery.

## Manual run path

Running without Docker: the SQL scripts on a local SQL Server (by hand, see [sql/README.md](sql/README.md)), the
engine from a local Python environment, the api with the client already built. Filled by dc-delivery.

## Engine

`engine/` is the Python control engine: FastAPI, SQLAlchemy Core and pyodbc. It validates a control definition
against the schema and the glossary, compiles it into one parameterized SELECT, runs it as the read-only login
`dq_engine_ro` under a row cap and a statement timeout, and returns the violating records with a reason each,
rendered from the glossary's templates. Only the api calls it; its endpoints are in
[contracts/api.md §3](contracts/api.md#3-engine-api).

It needs:

- Python 3.12 or later.
- Microsoft ODBC Driver 18 for SQL Server (17 works too): the package `msodbcsql18` with `unixodbc` on Linux, the
  installer from Microsoft on Windows and macOS. `odbcinst -q -d` (Linux, macOS) lists what is installed.
- The database of [Quick start](#the-database-available-now), initialised, and `.env` in the repository root with
  `DQ_ENGINE_RO_PASSWORD` and the engine block of `.env.example`.

Start it with Python and pip alone. On Windows the first command is `py -m venv .venv` and the interpreter of the
environment is `.venv\Scripts\python`:

```sh
cd engine
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000
```

or with [uv](https://docs.astral.sh/uv/), which installs the same locked versions and the development tools:

```sh
cd engine
uv sync
uv run python -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000
```

At startup the engine waits up to 30 seconds for the database, then checks every table and column the glossary
names against it. It exits with a non-zero status, and one log line that says why, when the database does not
answer, when the glossary and the database disagree, or when no ODBC driver is installed. Once it is up, from the
repository root (the second command needs `jq`):

```sh
curl -s localhost:8000/health
curl -s -X POST localhost:8000/run -H 'content-type: application/json' \
  -d "{\"definition\": $(jq -c .definition contracts/examples/minor-high-salary.json), \"runDate\": \"2026-11-01\"}" \
  | jq '.totalCount, [.violations[].key]'
```

The first answers `{"status":"ok","database":"ok",...}`; the second prints `3` and the keys `1051`, `1052` and
`1053`, the three minors of the seed who earn more than 15,000.

The engine reads these variables, from the environment first and then from `.env`. An empty value means the
default, and the login is always `dq_engine_ro`:

| Variable | Default | Meaning |
|---|---|---|
| `DQ_ENGINE_RO_PASSWORD` | none, required | password of the login `dq_engine_ro`; never logged |
| `ENGINE_DB_HOST` | `localhost` | goes into the ODBC `Server=` as written: `127.0.0.1` for the compose database (what `.env.example` holds), `db` inside compose, a named instance such as `.\SQLEXPRESS` |
| `ENGINE_DB_PORT` | empty | empty: no port in `Server=` (1433 over TCP, or the named instance's own protocol); a number from 1 to 65535: `host,port` |
| `ENGINE_DB_NAME` | `DataControls` | the database |
| `ENGINE_DB_DRIVER` | empty | empty: ODBC Driver 18 for SQL Server when it is installed, else 17; set: that driver name as written |
| `ENGINE_PORT` | `8000` | the port to give to `--port` when starting the engine (the commands above write 8000); the engine itself does not read it |
| `ENGINE_ROW_CAP` | `5000` | default and maximum of a run's `rowCap`; the total count stays exact above it |
| `ENGINE_QUERY_TIMEOUT_SECONDS` | `30` | per statement; a run sends two |
| `ENGINE_STARTUP_DB_WAIT_SECONDS` | `30` | how long startup waits for the database before it exits |
| `ENGINE_TIME_ZONE` | `Asia/Jerusalem` | where "today" is taken for a run that names no date |
| `ENGINE_DEBUG_COMPILE` | `false` | `true` turns on `POST /debug/compile`, the one endpoint that shows SQL text |
| `ENGINE_CONTRACTS_DIR` | `contracts/` beside `engine/` | where `glossary.json` and the definition schema are read from |
| `ENGINE_LOG_LEVEL` | `INFO` | SQL text is logged only at `DEBUG`, and parameter values never |
| `ENGINE_SUGGEST_MAX` | `10` | how many suggestions `POST /suggest` returns when the request names no `max` (at most 20) |

Where `localhost` resolves to `::1` first (WSL with Docker Desktop does), the ODBC driver does not fall back to
IPv4 and the login times out: use `127.0.0.1`, the address compose publishes SQL Server on.

Tests, lint and types, from `engine/` after `uv sync`:

```sh
uv run python -m pytest
uv run ruff check .
uv run pyright
```

`pytest` runs the unit tests, the golden tests (the SQL and the parameters each example of `contracts/examples/`
compiles to, in `engine/tests/golden/*.sql` and `*.params.json`) and the integration tests. Those run every
example against the seeded database, compare the flagged records with the example files and the rendered Hebrew
text with `engine/tests/golden/*.text.json`, and check `/suggest` against the examples. They fail, and
never skip, when the database is down. One path is proven without the database: a statement that runs past the
timeout is answered `QUERY_TIMEOUT`, and that mapping is tested on a fabricated driver error, because the
read-only login has no way to run a slow statement on purpose.

## Configuration

All configuration is environment variables; `.env.example` lists them in one block per component and `.env`
(git-ignored) holds the local values. A variable set in the environment wins over `.env`.

| Variable | Used by | Meaning |
|---|---|---|
| `MSSQL_SA_PASSWORD` | the `db` container, `db-init.sh`, `db-check.sh` | the administrator password; SQL Server refuses a weak one and the container exits (`docker compose logs db`) |
| `DQ_APP_PASSWORD` | `40_logins.sql`, the api | password of the `dq_app` login |
| `DQ_ENGINE_RO_PASSWORD` | `40_logins.sql`, the engine | password of the `dq_engine_ro` login |
| `DB_PORT` | compose | the host port SQL Server is published on, 1433 by default |

The engine and api blocks are filled by dc-engine and dc-api.

## Running the tests

- Database: `scripts/db-check.sh` (needs `jq`). Five sections: `structure`, `permissions`, `glossary` (every table
  and column the glossary names exists as the engine's login sees it), `hebrew` (the seeded names survived sqlcmd)
  and `examples` (each of the six example controls flags exactly the records its file expects, checked by a
  hand-written query per example).
- Engine, api and web: one command each, filled by dc-engine, dc-api and dc-web.

## Demo walkthrough

Create a control, run it, read the results and their reasons, try the suggestions. Filled by dc-delivery.

## Contracts

`contracts/` is the only channel between the three services. No service imports another's code and no SQL text
crosses a boundary: the engine, the api and the client are each built against these files alone.

| File | What it fixes |
|---|---|
| [`control-definition.schema.json`](contracts/control-definition.schema.json) | The JSON of a control: a root entity and a tree of groups, conditions and related-record nodes; the eighteen operators and the shape of each one's operand. The api and the engine validate with this very file |
| [`glossary.json`](contracts/glossary.json) | The business language: entities, fields, relationships and operators with Hebrew and English labels, the sentence and reason templates, the limits, the formats, and the texts of suggestions. Table and column names appear only here, and the engine never sends them out |
| [`examples/*.json`](contracts/examples) | Six controls (the four of the assignment and two more), each with the records it must flag in the seed data and the condition ids that match per record |
| [`examples/invalid/*.json`](contracts/examples/invalid) | Definitions that must be rejected, each with the layer that rejects it, the error code and the JSON pointer |
| [`api.md`](contracts/api.md) | Both HTTP APIs: the engine's and the application's (`/api/v1`), every request, response and error |
| [`errors.md`](contracts/errors.md) | The closed lists: error codes, definition error codes, reason keys, evidence keys and part roles, with their parameters, and the rules they share (what "matched" means, NULL, depth and count, rendering) |

Two checks keep the folder honest, and one command prints its text to read:

```sh
uv run scripts/contracts-check.py            # the schema, the glossary, the examples and the fixtures agree
scripts/db-check.sh examples                 # each example flags exactly its expected records in the database
uv run scripts/contracts-check.py --render   # no check: the rule sentence and the reasons of each example, he and en
```

A contract change is one commit to `contracts/` on `main`, with both checks green, and one line to every session
that builds against it. Adding a field, an entity or a relationship is a change to `glossary.json` (and to `sql/`
when the column is new) and to nothing else: no service code names a table, a column or a business term.

## The api (.NET 10)

`api/` is the application API under `/api/v1`: controls with immutable versions, runs with their stored results,
the glossary and the suggestions, exactly as [contracts/api.md](contracts/api.md) lists them. It is the only
component that writes, and it writes only schema `dq`. It checks a definition against the shared JSON Schema
itself and through the engine before anything is saved, runs a control through the engine once and answers
every page, search, filter and sort of the results from the snapshot it stored. It also serves the built client
from the `wwwroot` folder beside it, so one process answers both.

### Run it from a checkout

Needs the .NET 10 SDK, the database up and initialised (above) and `.env` at the repository root.

```sh
cd api
dotnet run --project src/DataControls.Api    # http://localhost:5000
```

- The api starts whether or not the database and the engine answer. `GET /api/v1/health` is always 200 and says
  which of the two is `ok`. While the database is down, a call that needs it answers 503
  `DATABASE_UNAVAILABLE`. While the engine is down, validating, saving a changed definition, the glossary (when
  none is cached) and suggestions answer 503 `ENGINE_UNAVAILABLE`; a run is still answered 201, as a run that
  failed with that code.
- `http://localhost:5000/api/docs` is Swagger UI over `/openapi/v1.json`, in every environment.
- [`api/requests.http`](api/requests.http) holds one request per endpoint, in the contract's order except for
  the archive, which comes last because an archived control cannot be run.
- Every error is a problem with a `code` and `params` and no prose; the codes are in
  [contracts/errors.md](contracts/errors.md).

### Configure

Settings are environment variables. In Development the api also reads the repository's `.env`, taking only its
own keys from it; a variable that is really set wins. Outside Development it reads no file but the
`appsettings.json` beside it. A setting outside its bounds stops the start with a message that names it.

| Variable | Default | Meaning |
|---|---|---|
| `DQ_APP_PASSWORD` | none | password of the `dq_app` login; the start fails without it unless `ConnectionStrings__Dq` is set |
| `DB_HOST`, `DB_PORT` | `localhost`, `1433` | where SQL Server listens; the connection string is built from these and the password |
| `ConnectionStrings__Dq` | unset | replaces the built connection string whole, for a server without a port (a named instance) |
| `Engine__BaseUrl` | `http://localhost:8000` | where the engine listens; port 8000 may be taken on a developer machine |
| `Engine__AttemptTimeout` | `00:01:15` | the longest one engine call may take; above the engine's worst case for a run (two statements of 30 s) |
| `Engine__BreakerMinimumThroughput`, `Engine__BreakerBreakDuration` | `5`, `00:00:15` | the circuit breaker opens after this many calls with half of them failed, for this long |
| `Runs__RowCap` | `5000` | the most violations a run stores |
| `Runs__TimeZone` | `Asia/Jerusalem` | the zone that decides "today" for a run without a date |
| `Runs__DefaultLanguage` | `he` | stands in for the glossary's default language until the glossary has been read |
| `Glossary__CacheMinutes`, `Glossary__WarmUpOnStart` | `10`, `true` | how long the glossary is cached, and whether it is fetched once at startup |
| `Cors__AllowedOrigins__0`, `__1`, ... | none | origins allowed to call the api from a browser; none are needed behind `ng serve`, which proxies `/api` |
| `ASPNETCORE_URLS` | `http://localhost:5000` | where the api listens; change it when the port is taken or blocked |

### Test

```sh
cd api
dotnet build -warnaserror && dotnet format --verify-no-changes && dotnet test
```

The tests run the real app against the shared `DataControls` database as `dq_app`, with the engine replaced by a
stub shaped by the contract, so SQL Server must be up; without it they fail with one sentence that says so.
Every control a test creates is named `zz-dc-api-test-...`, and the suite deletes those controls with their
versions and runs before and after it runs. Expected values come from `contracts/`. Three tests go to the real
engine and are skipped unless asked for:

```sh
DC_LIVE=1 dotnet test --filter Category=Live    # needs the engine at Engine__BaseUrl and the seeded database
```

### Publish

```sh
cd api
dotnet publish src/DataControls.Api -c Release   # src/DataControls.Api/bin/Release/net10.0/publish/
```

The published folder stands alone: it needs the .NET 10 ASP.NET Core runtime, and at run time it opens only its
own folder, the database and the engine. The schema is inside the assembly, and the content root is the app's
own folder, so it can be started from any working directory:

```sh
ConnectionStrings__Dq='...' Engine__BaseUrl=http://localhost:8000 \
ASPNETCORE_ENVIRONMENT=Production ASPNETCORE_URLS=http://localhost:5000 \
dotnet /path/to/publish/DataControls.Api.dll
```

Copy the client build into `wwwroot` inside that folder before the start; a folder added later is not seen until
a restart. On Linux the default time zone needs `tzdata`; on a Windows without ICU the api falls back to the
Windows name of the default zone.

## Repository map

```
.claude/              Claude Code harness: CLAUDE.md, skills, rules, hooks
contracts/            definition schema, glossary, examples, api.md, errors.md: the only channel between services
docs/                 architecture, design and the documents listed below
sql/                  database scripts, run in order by scripts/db-init.sh
scripts/              db-init.sh, db-check.sh and contracts-check.py; the run-all scripts arrive with dc-delivery
engine/               Python FastAPI control engine (dc-engine)
api/                  .NET 10 Web API, which also serves the built client (dc-api)
web/                  Angular client (dc-web)
dev/                  task plans and briefs
docker-compose.yml    SQL Server and its init container; the services join in dc-delivery
.env.example          configuration template, copied to .env
```

## Documentation

- [docs/architecture.md](docs/architecture.md): components, boundaries, data model, flows, security, decisions
- [docs/design.md](docs/design.md): the visual design of the client
- [sql/README.md](sql/README.md): the database scripts, the logins and the expected results per example
- `docs/control-definition.md`, `docs/glossary.md`, `docs/examples.md`,
  `docs/assumptions-limitations-extensions.md` and `docs/ai-usage.md`: written by dc-delivery
