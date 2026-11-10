SELECT count(*) AS total, sum(CASE WHEN (q.t0 = :one) THEN :one ELSE :zero END) AS m0 
FROM (SELECT CASE WHEN (e0.termination_date < e0.hire_date) THEN :one ELSE :zero END AS t0 
FROM hr.[Employee] AS e0 
WHERE e0.termination_date < e0.hire_date) AS q
