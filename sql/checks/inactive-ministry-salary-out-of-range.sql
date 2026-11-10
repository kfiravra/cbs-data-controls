-- Oracle for contracts/examples/inactive-ministry-salary-out-of-range.json:
-- active employees of an inactive ministry whose salary is below 6,000 or above 40,000.
--
-- Hand-written and static; it shares nothing with the engine. scripts/db-check.sh runs it as
-- dq_engine_ro and compares the rows with the example's expected set. The run date plays no part
-- in this rule. One row per violating record: the key, a name to read, and the ids of the
-- conditions that contribute. Of c3 and c4 only the one that is true is a reason.
SET NOCOUNT ON;

WITH truth AS (
    SELECT e.id,
           e.first_name,
           e.last_name,
           CASE WHEN e.status = N'active' THEN 1 ELSE 0 END AS c1,
           -- No department, and so no ministry, gives NULL: not "inactive".
           CASE WHEN m.is_active = 0 THEN 1 ELSE 0 END AS c2,
           -- No salary gives NULL: neither below nor above.
           CASE WHEN e.salary < 6000 THEN 1 ELSE 0 END AS c3,
           CASE WHEN e.salary > 40000 THEN 1 ELSE 0 END AS c4
    FROM hr.Employee AS e
    LEFT JOIN hr.Department AS d
        ON d.id = e.department_id
    LEFT JOIN hr.Ministry AS m
        ON m.id = d.ministry_id
)
SELECT t.id AS record_key,
       CONCAT(t.first_name, N' ', t.last_name) AS display_name,
       CONCAT_WS(N',',
                 IIF(t.c1 = 1, N'c1', NULL),
                 IIF(t.c2 = 1, N'c2', NULL),
                 IIF(t.c3 = 1, N'c3', NULL),
                 IIF(t.c4 = 1, N'c4', NULL)) AS matched
FROM truth AS t
WHERE t.c1 = 1
  AND t.c2 = 1
  AND (t.c3 = 1 OR t.c4 = 1)
ORDER BY t.id;
