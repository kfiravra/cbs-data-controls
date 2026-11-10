SELECT TOP 5000 q.k, q.d0, q.d1, q.d2, q.a0, q.a1, CASE WHEN (q.t0 = :one) THEN :one ELSE :zero END AS m0, CASE WHEN (q.t1 = :one) THEN :one ELSE :zero END AS m1 
FROM (SELECT e0.id AS k, e0.first_name AS d0, e0.last_name AS d1, e0.id AS d2, e0.status AS a0, e1.is_active AS a1, CASE WHEN (e0.status = :p0) THEN :one ELSE :zero END AS t0, CASE WHEN (e1.is_active = :p1) THEN :one ELSE :zero END AS t1 
FROM hr.[Employee] AS e0 LEFT OUTER JOIN hr.[Department] AS e1 ON e0.department_id = e1.id 
WHERE e0.status = :p0 AND e1.is_active = :p1) AS q ORDER BY q.k
