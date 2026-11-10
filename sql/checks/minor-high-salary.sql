-- Oracle for contracts/examples/minor-high-salary.json:
-- employees under 18 on the run date whose salary is above 15,000.
--
-- Hand-written and static; it shares nothing with the engine. scripts/db-check.sh runs it as
-- dq_engine_ro with -v RUN_DATE=<the example's runDate> and compares the rows with the example's
-- expected set. One row per violating record: the key, a name to read, and the ids of the
-- conditions that contribute (true, with every group above them true).
SET NOCOUNT ON;

DECLARE @run_date DATE = '$(RUN_DATE)';

WITH truth AS (
    SELECT e.id,
           e.first_name,
           e.last_name,
           -- Under 18: the 18th birthday is still ahead of the run date.
           CASE WHEN e.birth_date > DATEADD(YEAR, -18, @run_date) THEN 1 ELSE 0 END AS c1,
           CASE WHEN e.salary > 15000 THEN 1 ELSE 0 END AS c2
    FROM hr.Employee AS e
)
SELECT t.id AS record_key,
       CONCAT(t.first_name, N' ', t.last_name) AS display_name,
       CONCAT_WS(N',', IIF(t.c1 = 1, N'c1', NULL), IIF(t.c2 = 1, N'c2', NULL)) AS matched
FROM truth AS t
WHERE t.c1 = 1
  AND t.c2 = 1
ORDER BY t.id;
