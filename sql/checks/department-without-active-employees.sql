-- Oracle for contracts/examples/department-without-active-employees.json:
-- active departments that have no active employee.
--
-- Hand-written and static; it shares nothing with the engine. scripts/db-check.sh runs it as
-- dq_engine_ro and compares the rows with the example's expected set. The run date plays no part
-- in this rule. One row per violating record: the key, a name to read, and the ids of the nodes
-- that contribute. r1 is the "none of the employees" node; the condition inside it (c2) describes
-- the employees looked for and is never a reason of its own.
SET NOCOUNT ON;

WITH truth AS (
    SELECT d.id,
           d.name,
           CASE WHEN d.is_active = 1 THEN 1 ELSE 0 END AS c1,
           CASE WHEN NOT EXISTS (
                    SELECT 1
                    FROM hr.Employee AS e
                    WHERE e.department_id = d.id
                      AND e.status = N'active'
                ) THEN 1 ELSE 0 END AS r1
    FROM hr.Department AS d
)
SELECT t.id AS record_key,
       t.name AS display_name,
       CONCAT_WS(N',', IIF(t.c1 = 1, N'c1', NULL), IIF(t.r1 = 1, N'r1', NULL)) AS matched
FROM truth AS t
WHERE t.c1 = 1
  AND t.r1 = 1
ORDER BY t.id;
