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
