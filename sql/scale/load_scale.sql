-- A scratch database for timing: the organization of the seed, multiplied. Not part of the init order
-- (scripts/db-init.sh runs the top level of sql/ only); scripts/scale-test.sh runs it and drops the database.
--
-- DataControlsScale gets the three hr tables with the keys and indexes of 20_hr_tables.sql and 50_indexes.sql,
-- the 5 ministries, 2,000 departments (the 16 of the seed, 125 times) and 200,005 employees (the 85 of the
-- seed, 2,353 times). Every copy keeps its original's dates, salary and status, so each example flags the
-- seed's records times the number of copies. DataControls itself is only read; its seed and the assertions
-- of scripts/db-check.sh are untouched. Runs as sa; re-runnable (it drops and rebuilds the scratch database).
SET NOCOUNT ON;
USE master;
GO

IF DB_ID(N'DataControlsScale') IS NOT NULL
BEGIN
    ALTER DATABASE DataControlsScale SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE DataControlsScale;
END;
GO
CREATE DATABASE DataControlsScale COLLATE Hebrew_CI_AS;
GO
USE DataControlsScale;
GO
CREATE SCHEMA hr AUTHORIZATION dbo;
GO

CREATE TABLE hr.Ministry
(
    id        INT           NOT NULL,
    name      NVARCHAR(100) NOT NULL,
    is_active BIT           NOT NULL,
    CONSTRAINT PK_Ministry PRIMARY KEY CLUSTERED (id)
);
CREATE TABLE hr.Department
(
    id                  INT           NOT NULL,
    ministry_id         INT           NOT NULL,
    name                NVARCHAR(100) NOT NULL,
    is_active           BIT           NOT NULL,
    manager_employee_id INT           NULL,
    CONSTRAINT PK_Department PRIMARY KEY CLUSTERED (id)
);
CREATE TABLE hr.Employee
(
    id               INT           NOT NULL,
    department_id    INT           NULL,
    national_id      NVARCHAR(9)   NOT NULL,
    first_name       NVARCHAR(50)  NOT NULL,
    last_name        NVARCHAR(50)  NOT NULL,
    email            NVARCHAR(254) NULL,
    birth_date       DATE          NOT NULL,
    hire_date        DATE          NOT NULL,
    termination_date DATE          NULL,
    salary           DECIMAL(12,2) NULL,
    status           NVARCHAR(10)  NOT NULL,
    CONSTRAINT PK_Employee PRIMARY KEY CLUSTERED (id)
);
GO

-- Copy numbers 0 to 2,352. Copy n of a department has the id of its original plus n * 1,000 (125 copies), and
-- copy n of an employee the id of its original plus n * 10,000, in department copy n modulo 125.
SELECT TOP (2353) CONVERT(INT, ROW_NUMBER() OVER (ORDER BY (SELECT NULL))) - 1 AS n
INTO #copies
FROM sys.all_objects AS a CROSS JOIN sys.all_objects AS b;

INSERT INTO hr.Ministry (id, name, is_active)
SELECT id, name, is_active FROM DataControls.hr.Ministry;

INSERT INTO hr.Department (id, ministry_id, name, is_active, manager_employee_id)
SELECT d.id + c.n * 1000, d.ministry_id, d.name, d.is_active, d.manager_employee_id + c.n * 10000
FROM DataControls.hr.Department AS d CROSS JOIN #copies AS c
WHERE c.n < 125;

INSERT INTO hr.Employee
    (id, department_id, national_id, first_name, last_name, email, birth_date, hire_date, termination_date, salary, status)
SELECT e.id + c.n * 10000,
       e.department_id + (c.n % 125) * 1000,
       RIGHT(N'000000000' + CONVERT(NVARCHAR(9), e.id + c.n * 10000), 9),
       e.first_name, e.last_name, e.email, e.birth_date, e.hire_date, e.termination_date, e.salary, e.status
FROM DataControls.hr.Employee AS e CROSS JOIN #copies AS c;
GO

ALTER TABLE hr.Department ADD CONSTRAINT FK_Department_Ministry FOREIGN KEY (ministry_id) REFERENCES hr.Ministry (id);
ALTER TABLE hr.Employee ADD CONSTRAINT FK_Employee_Department FOREIGN KEY (department_id) REFERENCES hr.Department (id);
ALTER TABLE hr.Employee ADD CONSTRAINT UQ_Employee_national_id UNIQUE (national_id);
ALTER TABLE hr.Department ADD CONSTRAINT FK_Department_Employee FOREIGN KEY (manager_employee_id) REFERENCES hr.Employee (id);
CREATE NONCLUSTERED INDEX IX_Department_ministry_id ON hr.Department (ministry_id);
CREATE NONCLUSTERED INDEX IX_Department_manager_employee_id ON hr.Department (manager_employee_id);
CREATE NONCLUSTERED INDEX IX_Employee_department_id ON hr.Employee (department_id);
CREATE NONCLUSTERED INDEX IX_Employee_department_id_status ON hr.Employee (department_id, status);
CREATE NONCLUSTERED INDEX IX_Employee_birth_date ON hr.Employee (birth_date);
CREATE NONCLUSTERED INDEX IX_Employee_status ON hr.Employee (status);
CREATE NONCLUSTERED INDEX IX_Employee_salary ON hr.Employee (salary);
GO

-- The engine's own login, with the same single permission as in DataControls.
CREATE USER dq_engine_ro FOR LOGIN dq_engine_ro WITH DEFAULT_SCHEMA = hr;
GRANT SELECT ON SCHEMA::hr TO dq_engine_ro;
GO

SELECT (SELECT COUNT(*) FROM hr.Ministry) AS ministries,
       (SELECT COUNT(*) FROM hr.Department) AS departments,
       (SELECT COUNT(*) FROM hr.Employee) AS employees;
GO
