---
name: dc-sql
description: "Repo facts for sql/ (SQL Server 2022 scripts: the Hebrew_CI_AS database, schemas hr and dq, two logins, the Hebrew seed with planted violations, indexes), scripts/db-*.sh and docker-compose.yml. Loads on its own when those files are touched. Use when changing tables, seed rows, logins, indexes, the init and check scripts or the database container."
paths:
  - "sql/**"
  - "scripts/db-*.sh"
  - "docker-compose.yml"
---

# dc-sql

SQL Server 2022 in the `mcr.microsoft.com/mssql/server:2022-latest` Linux container (x86-64 only), published on
127.0.0.1 at `DB_PORT`: 14330 by default (so a grader's own SQL Server keeps 1433), and 1433 in this repository's
development `.env`, which the harness, the worktrees and the tests assume. One
database with collation `Hebrew_CI_AS`: schema `hr` holds the sample organization (Ministry → Department →
Employee), schema `dq` the controls store (Control, ControlVersion, Run, RunResult); two logins. Plain T-SQL run by
sqlcmd. Nothing lints it, so `scripts/db-init.sh` on a clean container plus `scripts/db-check.sh` is the test.
Conventions: [.claude/rules/sql.md](../../rules/sql.md).

## Script order

`sql/NN_name.sql`, run in lexical order by `db-init.sh` (and by hand in the same order on the manual path). The
numbers leave gaps for later inserts, and every script is re-runnable.

```
00_database.sql   CREATE DATABASE … COLLATE Hebrew_CI_AS
10_schemas.sql    hr, dq
20_hr_tables.sql  Ministry, Department, Employee, with keys and checks
30_dq_tables.sql  Control, ControlVersion, Run, RunResult
40_logins.sql     dq_app, dq_engine_ro: logins, users, grants, denies
50_indexes.sql    every FK column; birth_date, status, salary (what the examples filter by)
60_seed_hr.sql    the Hebrew seed with planted violations
```

Only top-level `sql/NN_*.sql` files are in the order (`sql/checks/` is not). Retention cleanup is
`sql/cleanup_runs.sql`, outside the init order. `scripts/db-init.sh --reset` drops `DataControls` and runs the
order again: a changed seed row needs it (inserts are keyed), and it deletes every session's `dq` rows.
`sql/README.md` documents the order, the cleanup and the expected violations per example.

## Naming

- Tables PascalCase singular, columns snake_case, every reference schema-qualified: `hr.Employee.department_id`.
- Constraints and indexes are named: `PK_Employee`, `FK_Employee_Department`, `UQ_Employee_national_id`,
  `CK_Employee_status`, `DF_Run_status`, `IX_Employee_birth_date`.
- Each login and its database user share the name: `dq_app`, `dq_engine_ro`.

## Planted violations

Every seed row that an example must flag, or must not, says so on the line above it and names the example id from
`contracts/examples/<id>.json`:

```sql
-- PLANTED minor-high-salary: 17 on the run date, salary 16000
-- BOUNDARY minor-high-salary: turns 18 on the run date, must not be flagged
```

`PLANTED` rows are exactly the record keys the example lists. `BOUNDARY` rows are the near misses: the 18th
birthday on the run date, a NULL salary, a NULL termination date, no department, an empty email, inactive without a
termination date. `db-check.sh` prints the violating keys per example, and a seed edit that changes them changes the
example in the same commit.

Boundary rows depend on the run date. Either the examples carry a fixed `runDate` and the seed uses absolute dates,
or the seed computes its dates at init and the tests read them back. dc-contracts decides and `sql/README.md` records
it; `GETDATE()` scattered through the seed makes the expected keys drift with the day of the init.

## Hebrew seed

- Hebrew where a CBS user expects it (ministry and department names, first and last names), English in every
  identifier, ASCII emails. Fake people only: invented names and invented 9-digit ids.
- `NVARCHAR` columns and `N'…'` literals. A bare `'…'` goes through the current database's code page: Hebrew
  survives under `Hebrew_CI_AS` and turns into `?` anywhere else (a script run from `master`, say).
- Files are UTF-8 and `db-init.sh` runs `sqlcmd -f 65001`. Hebrew that reads back as `?` or as mojibake means a
  missing `N` or a file read in another code page.
- Explicit ids (`SET IDENTITY_INSERT … ON`, or keys without identity), so examples and tests can name records.

## Facts that bite

- The 2022 image ships sqlcmd at `/opt/mssql-tools18/bin/sqlcmd` (since CU 14, instead of `/opt/mssql-tools/bin`),
  and the ODBC 18 tools need `-C` to trust the container's self-signed certificate.
- `MSSQL_SA_PASSWORD` must pass the complexity policy (8+ characters mixing upper case, lower case and digits or
  symbols) or the container exits right after it starts; `docker compose logs db` says why. `ACCEPT_EULA=Y` is
  required.
- Set `MSSQL_COLLATION=Hebrew_CI_AS` on the container too, so tempdb (and any `#temp` table) shares the database
  collation instead of raising collation conflicts.
- The two logins' passwords arrive as sqlcmd variables (`$(DQ_APP_PASSWORD)`, passed with `-v`), never as literals
  in `sql/`. SSMS expands them only in SQLCMD Mode (Query menu), which the manual path has to say.
- `CREATE SCHEMA` must start its batch, and `CREATE VIEW` or `CREATE PROCEDURE` must be alone in theirs: `GO`
  around them.
- Logins: `dq_app` gets `SELECT, INSERT, UPDATE, DELETE ON SCHEMA::dq` and an explicit `DENY` on `hr`;
  `dq_engine_ro` gets `SELECT ON SCHEMA::hr` and an explicit `DENY` on `dq`. Neither gets DDL or `EXECUTE`, and
  nothing is granted to `public`. `db-check.sh` proves the denials as well as the violations.
- `INFORMATION_SCHEMA` shows each login only what it may read, so the engine's startup check sees `hr` alone, by
  design.
- One container per machine, started and initialised from the main tree. The compose project name is fixed
  (`name: data-controls`), so compose in a worktree addresses that same container instead of starting a second one:
  `exec`, `ps` and `scripts/db-check.sh` work from anywhere (with `.env` copied in), but `down` stops it for every
  session, and `up` from a worktree whose `docker-compose.yml` differs recreates it. `scripts/db-init.sh` refuses
  to run in a linked worktree (the test of `dc_linked_worktree`), pkgmap skips `sql-init` there, and the git guard
  asks before `docker compose down` (`down -v` deletes the seeded database).
- `docker-compose.yml` holds the whole stack since dc-delivery: `db`, `db-init` (one-shot), `engine` (no host port;
  starts after `db-init` completed), `api` (the client inside it; host `APP_BIND:APP_PORT`, 127.0.0.1:5000) and
  `examples` (one-shot: `scripts/examples.py load` through the api). `docker compose up -d db` still starts the
  database alone. Each service gets only its own settings under `environment:`, never `env_file`: the engine is
  given `ENGINE_DB_HOST=db` and port 1433 whatever `.env` says, and never the `sa` or `dq_app` password; the api
  never the `sa` or `dq_engine_ro` one. No service has a restart policy. `scripts/start.sh` (and `start.cmd`)
  creates `.env` with random passwords only when there is none.

## Read before changing

[architecture.md](../../../docs/architecture.md) §3.1 (logins), §4.1 (`hr`), §4.2 (`dq`), §10 (security), §14 (compose
and the manual path); `contracts/examples/` for the record keys the seed must produce.
