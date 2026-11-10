-- Oracle for contracts/examples/active-in-inactive-department.json:
-- active employees assigned to a department that is not active.
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
           CASE WHEN e.status = N'active' THEN 1 ELSE 0 END AS c1,
           -- An employee with no department has no department status: NULL, not "inactive".
           CASE WHEN d.is_active = 0 THEN 1 ELSE 0 END AS c2
    FROM hr.Employee AS e
    LEFT JOIN hr.Department AS d
        ON d.id = e.department_id
)
SELECT t.id AS record_key,
       CONCAT(t.first_name, N' ', t.last_name) AS display_name,
       CONCAT_WS(N',', IIF(t.c1 = 1, N'c1', NULL), IIF(t.c2 = 1, N'c2', NULL)) AS matched
FROM truth AS t
WHERE t.c1 = 1
  AND t.c2 = 1
ORDER BY t.id;
