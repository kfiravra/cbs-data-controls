SELECT count(*) AS total, sum(CASE WHEN (q.t0 = 1) THEN 1 ELSE 0 END) AS m0, sum(CASE WHEN (q.t1 = 1) THEN 1 ELSE 0 END) AS m1 
FROM (SELECT CASE WHEN (e0.status = :p0) THEN 1 ELSE 0 END AS t0, CASE WHEN (e1.is_active = :p1) THEN 1 ELSE 0 END AS t1 
FROM hr.[Employee] AS e0 LEFT OUTER JOIN hr.[Department] AS e1 ON e0.department_id = e1.id 
WHERE e0.status = :p0 AND e1.is_active = :p1) AS q
