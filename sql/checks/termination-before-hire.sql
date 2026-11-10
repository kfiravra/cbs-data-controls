-- Oracle for contracts/examples/termination-before-hire.json:
-- employees whose termination date is earlier than their hire date.
--
-- Hand-written and static; it shares nothing with the engine. scripts/db-check.sh runs it as
-- dq_engine_ro and compares the rows with the example's expected set. The run date plays no part
-- in this rule. One row per violating record: the key, a name to read, and the ids of the
-- conditions that contribute.
SET NOCOUNT ON;

WITH truth AS (
    SELECT e.id,
           e.first_name,
           e.last_name,
           -- No termination date gives NULL, which is not "earlier".
           CASE WHEN e.termination_date < e.hire_date THEN 1 ELSE 0 END AS c1
    FROM hr.Employee AS e
)
SELECT t.id AS record_key,
       CONCAT(t.first_name, N' ', t.last_name) AS display_name,
       IIF(t.c1 = 1, N'c1', N'') AS matched
FROM truth AS t
WHERE t.c1 = 1
ORDER BY t.id;
