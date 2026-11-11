SELECT count(*) AS total, sum(CASE WHEN (q.t0 = 1) THEN 1 ELSE 0 END) AS m0, sum(CASE WHEN (q.t1 = 1) THEN 1 ELSE 0 END) AS m1, sum(CASE WHEN (q.t2 = 1 AND (q.t2 = 1 OR q.t3 = 1)) THEN 1 ELSE 0 END) AS m2, sum(CASE WHEN (q.t3 = 1 AND (q.t2 = 1 OR q.t3 = 1)) THEN 1 ELSE 0 END) AS m3 
FROM (SELECT CASE WHEN (e0.status = :p0) THEN 1 ELSE 0 END AS t0, CASE WHEN (e2.is_active = :p1) THEN 1 ELSE 0 END AS t1, CASE WHEN (e0.salary < :p2) THEN 1 ELSE 0 END AS t2, CASE WHEN (e0.salary > :p3) THEN 1 ELSE 0 END AS t3 
FROM hr.[Employee] AS e0 LEFT OUTER JOIN hr.[Department] AS e1 ON e0.department_id = e1.id LEFT OUTER JOIN hr.[Ministry] AS e2 ON e1.ministry_id = e2.id 
WHERE e0.status = :p0 AND e2.is_active = :p1 AND (e0.salary < :p2 OR e0.salary > :p3)) AS q
