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

`60_seed_hr.sql` holds 5 ministries, 16 departments and 85 employees, all invented. National ids fail the
control-digit check on purpose, emails are ASCII at `example.org`, and nobody is born on 29 February. Forty
employees (1001 to 1040) are a clean baseline; the rest are placed for the six example controls of
`contracts/examples/`. Above every such row the seed carries a comment:

```sql
-- PLANTED minor-high-salary: 16 on the run date, salary 16,500 [c1, c2]
-- BOUNDARY minor-high-salary: a minor at exactly 15,000 (greater-than is strict)
```

`PLANTED` rows are exactly the records an example expects, with the condition ids that match; `BOUNDARY` rows are
the near misses that a wrong operator, a wrong NULL rule or a wrong join would flag.

| Example | Flags | Planted (matched ids) | Boundary rows, not flagged |
|---|---|---|---|
| `minor-high-salary` | 3 employees | 1051, 1052, 1053 (c1, c2) | 1054 turns 18 on the run date; 1055 turned 18 the day before; 1056 earns exactly 15,000; 1057 earns 9,000; 1058 has no salary |
| `termination-before-hire` | 3 employees | 1061, 1062, 1063 (c1) | 1064 terminated on the hire date; 1065 one day after it; every employee without a termination date |
| `active-in-inactive-department` | 6 employees | 1071, 1072 in department 103; 1076, 1077 in 402; 1117, 1118 in 502 (c1, c2) | 1073, 1074, 1075, 1078: inactive employees of inactive departments; 1085 has no department |
| `missing-mandatory-data` | 10 employees | 1081, 1082, 1083: no email, an empty one, spaces only (c1, c2); 1058, 1084, 1115: no salary (c1, c3); 1085: no department (c1, c4); 1086: no email and no salary (c1, c2, c3); 1087, 1088: inactive with no termination date (c5, c6) | 1089: inactive with an empty email; 1090: inactive with no salary. 1088 also has an empty email, which is not one of its reasons: that condition sits under the "active" branch |
| `department-without-active-employees` | 3 departments | 104 and 403: only inactive employees; 204: no employees (c1, r1) | 303 has one active employee; 103, 203, 402 and 502 are inactive departments |
| `inactive-ministry-salary-out-of-range` | 3 employees | 1111: 4,500 (c1, c2, c3); 1112: 52,000 (c1, c2, c4); 1117: 3,000 (c1, c2, c3) | 1113 earns exactly 6,000; 1114 exactly 40,000; 1115 has no salary; 1116 is inactive; 1118 is in range; 1023 (5,500) and 1026 (45,000) work in active ministries |

A matched id is a condition that is true while every group above it is true (`contracts/errors.md`).

### The run date and its window

The seed uses absolute dates and every example carries `runDate: "2026-11-01"`. Only `minor-high-salary` depends
on the date, through the age. The planted minors are born on 2010-01-01 or later, so each example flags the same
records on every run date from 2026-11-01 to 2027-12-31; on 2028-01-01 employee 1053 turns 18 and the first
example drops to two records. Employee 1054 turns 18 on 2026-11-01 itself: the example's alternate run of
2026-10-31 expects four records, 1054 among them.

### What the checks prove

`scripts/db-check.sh examples` runs one hand-written query per example (`sql/checks/<id>.sql`) as `dq_engine_ro`
and compares its rows, key by key and matched id by matched id, with the example file; `minor-high-salary` runs on
both of its dates. The queries share no code with the engine, so they are an independent statement of what each
rule means. `scripts/db-check.sh hebrew` proves that the names survived the trip through sqlcmd. A seed edit that
changes a flagged record changes the example file in the same commit, and needs `scripts/db-init.sh --reset`.

### What the suggestion heuristics rely on

- Of the 25 employees who have both a hire date and a termination date, 22 have the termination on or after the
  hire (21 after it, one on the same day) and three before it: the planted rows of `termination-before-hire`.
  That is 88%, above the 80% the engine's date-order heuristic asks for before it proposes that rule.
- Nobody is hired or terminated on or before their birth date, so no other pair of dates is proposed.
- Department 204 is the only one without a manager.
