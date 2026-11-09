---
paths:
  - "sql/**/*.sql"
---

# T-SQL conventions (judgment calls only)

Nothing lints these scripts: `scripts/db-init.sh` on a clean container plus `scripts/db-check.sh` is the test.
Naming, the script order and the planted-row comment format live in the `dc-sql` skill.

- Keywords upper case, identifiers as declared, every name schema-qualified (`hr.Employee`, never a bare `Employee`).
- Text is `NVARCHAR(n)` with a deliberate length (`NVARCHAR(MAX)` only for JSON and rendered reasons); literals are
  `N'…'`; no `VARCHAR`, `TEXT` or `NTEXT`.
- Amounts are `DECIMAL(12,2)`, never `FLOAT` or `MONEY`; business dates `DATE`; timestamps `DATETIME2(3)` in UTC
  (`SYSUTCDATETIME()`); flags `BIT NOT NULL` with a default.
- Every constraint and index has a name, and every column states its nullability.
- Re-runnable: `IF NOT EXISTS`, `CREATE OR ALTER` and `DROP … IF EXISTS` guards; seed inserts are keyed so a second
  run changes nothing.
- `SET XACT_ABORT ON` and one transaction per seed script, so a failed insert leaves nothing half-seeded.
- JSON columns carry `CHECK (ISJSON(column) = 1)`.
- No dynamic SQL (`EXEC(@sql)`, or `sp_executesql` over concatenated text); passwords only as sqlcmd variables.
- Permissions go on schemas (`GRANT SELECT ON SCHEMA::hr`), never per table and never to `public`.
- Comments give the business reason (`-- PLANTED …`, `-- BOUNDARY …`); no commented-out statements.
