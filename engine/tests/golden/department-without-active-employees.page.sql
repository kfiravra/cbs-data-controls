SELECT TOP 5000 q.k, q.d0, q.d1, q.a0, CASE WHEN (q.t0 = 1) THEN 1 ELSE 0 END AS m0, CASE WHEN (q.t1 = 1) THEN 1 ELSE 0 END AS m1 
FROM (SELECT e0.id AS k, e0.name AS d0, e0.id AS d1, e0.is_active AS a0, CASE WHEN (e0.is_active = :p0) THEN 1 ELSE 0 END AS t0, CASE WHEN (NOT (EXISTS (SELECT * 
FROM hr.[Employee] AS e1 
WHERE e1.department_id = e0.id AND e1.status = :p1))) THEN 1 ELSE 0 END AS t1 
FROM hr.[Department] AS e0 
WHERE e0.is_active = :p0 AND NOT (EXISTS (SELECT * 
FROM hr.[Employee] AS e1 
WHERE e1.department_id = e0.id AND e1.status = :p1))) AS q ORDER BY q.k
