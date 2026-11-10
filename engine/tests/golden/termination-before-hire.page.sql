SELECT TOP 5000 q.k, q.d0, q.d1, q.d2, q.a0, q.a1, CASE WHEN (q.t0 = 1) THEN 1 ELSE 0 END AS m0 
FROM (SELECT e0.id AS k, e0.first_name AS d0, e0.last_name AS d1, e0.id AS d2, e0.termination_date AS a0, e0.hire_date AS a1, CASE WHEN (e0.termination_date < e0.hire_date) THEN 1 ELSE 0 END AS t0 
FROM hr.[Employee] AS e0 
WHERE e0.termination_date < e0.hire_date) AS q ORDER BY q.k
