SELECT count(*) AS total, sum(CASE WHEN (q.t0 = :one) THEN :one ELSE :zero END) AS m0, sum(CASE WHEN (q.t1 = :one) THEN :one ELSE :zero END) AS m1 
FROM (SELECT CASE WHEN (e0.birth_date > :p0) THEN :one ELSE :zero END AS t0, CASE WHEN (e0.salary > :p1) THEN :one ELSE :zero END AS t1 
FROM hr.[Employee] AS e0 
WHERE e0.birth_date > :p0 AND e0.salary > :p1) AS q
