# sql: the DataControls database

Plain T-SQL for SQL Server 2022. The scripts build one database, `DataControls`, with the collation
`Hebrew_CI_AS`, two schemas and two logins:

- `hr`: the sample organization (Ministry, Department, Employee), seeded once with valid and invalid Hebrew data.
  The running system never writes it.
- `dq`: the controls store (Control, ControlVersion, Run, RunResult), written only by the api.

Every script can run again: a second run changes nothing in the database (an existing login gets its password
reset).

## Script order

`scripts/db-init.sh` runs the top-level `sql/NN_*.sql` files in lexical order; subfolders such as `sql/checks/`
are not part of the init.

| Script | Creates |
|---|---|
| `00_database.sql` | the database `DataControls`, collation `Hebrew_CI_AS` (runs in `master`; refuses an existing database with another collation) |
| `10_schemas.sql` | the schemas `hr` and `dq` |
| `20_hr_tables.sql` | `hr.Ministry`, `hr.Department`, `hr.Employee`: keys, foreign keys, the unique national id and the status domain, nothing else (the business rules are what the controls detect, so the data must be able to break them); explicit ids, no IDENTITY |
| `30_dq_tables.sql` | `dq.Control` (with a `ROWVERSION` concurrency token), `dq.ControlVersion`, `dq.Run`, `dq.RunResult` (cascading from its run); JSON columns carry `ISJSON` checks |
| `40_logins.sql` | the logins and users `dq_app` and `dq_engine_ro` and their schema permissions |
| `50_indexes.sql` | an index per foreign key column, `hr.Employee` `birth_date`, `status` and `salary`, and `dq.Run (control_id, started_at DESC)` |
| `60_seed_hr.sql` | the Hebrew seed with planted violations, in one transaction |

`cleanup_runs.sql` is outside the init order: see [Retention](#retention).

## The two logins

| Login | Used by | Can | Cannot |
|---|---|---|---|
| `dq_app` | the api | `SELECT`, `INSERT`, `UPDATE`, `DELETE` on schema `dq` | anything on `hr` (explicit `DENY`) |
| `dq_engine_ro` | the engine | `SELECT` on schema `hr` | write to `hr`, or touch `dq` at all (explicit `DENY`) |

Neither has DDL or `EXECUTE`, and nothing is granted to `public`. Permissions are granted on schemas, so a table
added later inherits them. The passwords arrive as the sqlcmd variables `DQ_APP_PASSWORD` and
`DQ_ENGINE_RO_PASSWORD` and are never written into a script. `scripts/db-check.sh permissions` proves each grant
and each refusal: a denied read or write must fail with error 229, a `CREATE TABLE` with error 262.

## Running the scripts

```sh
scripts/db-init.sh            # create what is missing
scripts/db-init.sh --reset    # drop DataControls and build it again
scripts/db-check.sh           # structure and permissions (and, as they land, glossary, hebrew, examples)
```

`db-init.sh` decides by where it runs. With `DB_HOST` set in the environment and `sqlcmd` available, it runs the
scripts itself against `DB_HOST` (and `DB_PORT` when set), as `sa`, with the passwords from the environment or
from `.env`. That is the `db-init` container of `docker-compose.yml`, and the manual path on a machine with its
own SQL Server and sqlcmd. Otherwise it runs `docker compose run --rm db-init`, which starts `db` first if needed.

- **`--reset`** sets the database to single-user (closing every open session), drops it and runs all scripts.
  Seed inserts are keyed, so a changed seed row needs it. It deletes every saved control and run, for every
  session that shares the container: say so to the other sessions first.
- **Worktrees**: the container is one per machine and is initialised from the main checkout only. `db-init.sh`
  refuses to run in a linked git worktree and says why; `db-check.sh` works from anywhere once `.env` is copied
  in, because the compose project name is fixed (`data-controls`).
- **Hebrew**: the files are UTF-8, and every Hebrew literal is `N'…'`. sqlcmd runs with `-f 65001`. The Linux
  sqlcmd of the image reads and writes UTF-8 with or without that flag (tested on 2026-11-10); the Windows sqlcmd
  needs it, or it reads a file without a byte-order mark in the console's code page and the Hebrew turns into
  mojibake.

### By hand in SSMS

1. Connect to the server as an administrator.
2. Open the scripts in the order of the table above and run each one with **Query > SQLCMD Mode** switched on
   (the scripts contain `GO` and sqlcmd variables).
3. In the window of `40_logins.sql`, add these two lines at the top before running it, and do not save them:

   ```
   :setvar DQ_APP_PASSWORD <the dq_app password>
   :setvar DQ_ENGINE_RO_PASSWORD <the dq_engine_ro password>
   ```

4. Before running `60_seed_hr.sql`, check that its Hebrew reads correctly in the editor. If it shows as mojibake,
   reopen it with **File > Open > File…**, the arrow beside **Open**, **Open With… > SQL Query Editor with
   Encoding**, and **Unicode (UTF-8 without signature) - Codepage 65001**.

The same order works with sqlcmd on Windows, for example with a Windows administrator login:

```
sqlcmd -S localhost -E -b -I -f 65001 -v DQ_APP_PASSWORD=<password> -v DQ_ENGINE_RO_PASSWORD=<password> -i sql\00_database.sql
```

and so on for each script in order.

## Retention

`cleanup_runs.sql` deletes every run of a control beyond its newest `KEEP_LAST_RUNS`, and every run that started
more than `KEEP_DAYS` days ago; their results go with them. Both values must be 1 or more. Run it as `dq_app`:

```sh
sqlcmd -S localhost,1433 -U dq_app -d DataControls -C -b -f 65001 \
  -v KEEP_LAST_RUNS=20 -v KEEP_DAYS=90 -i sql/cleanup_runs.sql
```

Without a local sqlcmd, through the container (the password is read from the environment, not the command line):

```sh
set -a; . ./.env; set +a
SQLCMDPASSWORD="$DQ_APP_PASSWORD" docker compose exec -T -e SQLCMDPASSWORD db \
  /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U dq_app -d DataControls -b -f 65001 \
  -v KEEP_LAST_RUNS=20 -v KEEP_DAYS=90 -i /dev/stdin < sql/cleanup_runs.sql
```

## Planted and boundary rows

<!-- dc-contracts phase 3 fills this section: the planted and boundary rows per example, the run date and its
stability window, and the seed sanity lines. -->
To be written with the seed in dc-contracts.
