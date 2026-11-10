-- Oracle for contracts/examples/missing-mandatory-data.json:
-- an active employee without an email, a salary or a department,
-- or an inactive employee without a termination date.
--
-- Hand-written and static; it shares nothing with the engine. scripts/db-check.sh runs it as
-- dq_engine_ro and compares the rows with the example's expected set. The run date plays no part
-- in this rule. One row per violating record: the key, a name to read, and the ids of the
-- conditions that contribute: a condition that is true under a branch that fails is not a reason
-- (an inactive employee with an empty email is flagged for c5 and c6 only).
SET NOCOUNT ON;

WITH truth AS (
    SELECT e.id,
           e.first_name,
           e.last_name,
           CASE WHEN e.status = N'active' THEN 1 ELSE 0 END AS c1,
           -- Empty: NULL, or no characters besides spaces (SQL Server ignores trailing spaces in "=").
           CASE WHEN e.email IS NULL OR e.email = N'' THEN 1 ELSE 0 END AS c2,
           CASE WHEN e.salary IS NULL THEN 1 ELSE 0 END AS c3,
           CASE WHEN e.department_id IS NULL THEN 1 ELSE 0 END AS c4,
           CASE WHEN e.status = N'inactive' THEN 1 ELSE 0 END AS c5,
           CASE WHEN e.termination_date IS NULL THEN 1 ELSE 0 END AS c6
    FROM hr.Employee AS e
),
branches AS (
    SELECT t.id,
           t.first_name,
           t.last_name,
           t.c1, t.c2, t.c3, t.c4, t.c5, t.c6,
           CASE WHEN t.c1 = 1 AND (t.c2 = 1 OR t.c3 = 1 OR t.c4 = 1) THEN 1 ELSE 0 END AS active_branch,
           CASE WHEN t.c5 = 1 AND t.c6 = 1 THEN 1 ELSE 0 END AS inactive_branch
    FROM truth AS t
)
SELECT b.id AS record_key,
       CONCAT(b.first_name, N' ', b.last_name) AS display_name,
       CONCAT_WS(N',',
                 IIF(b.active_branch = 1 AND b.c1 = 1, N'c1', NULL),
                 IIF(b.active_branch = 1 AND b.c2 = 1, N'c2', NULL),
                 IIF(b.active_branch = 1 AND b.c3 = 1, N'c3', NULL),
                 IIF(b.active_branch = 1 AND b.c4 = 1, N'c4', NULL),
                 IIF(b.inactive_branch = 1 AND b.c5 = 1, N'c5', NULL),
                 IIF(b.inactive_branch = 1 AND b.c6 = 1, N'c6', NULL)) AS matched
FROM branches AS b
WHERE b.active_branch = 1
   OR b.inactive_branch = 1
ORDER BY b.id;
