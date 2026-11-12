-- Indexes: every foreign key column, the hr.Employee columns the example controls filter by, and the pair a
-- related-records rule reads. Re-runnable.
-- Foreign keys already served by the leading columns of a key are not indexed again:
-- dq.ControlVersion.control_id (PK_ControlVersion) and dq.RunResult.run_id (UQ_RunResult_run_id_seq).
SET NOCOUNT ON;
USE DataControls;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'hr.Department') AND name = N'IX_Department_ministry_id')
    CREATE NONCLUSTERED INDEX IX_Department_ministry_id ON hr.Department (ministry_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'hr.Department') AND name = N'IX_Department_manager_employee_id')
    CREATE NONCLUSTERED INDEX IX_Department_manager_employee_id ON hr.Department (manager_employee_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'hr.Employee') AND name = N'IX_Employee_department_id')
    CREATE NONCLUSTERED INDEX IX_Employee_department_id ON hr.Employee (department_id);

-- A rule about related records ("a department with no active employee") compiles to NOT EXISTS over the
-- employees of each department with a status test: one seek per department here. Without it that rule took
-- 9 seconds on 200,000 employees (scripts/scale-test.sh).
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'hr.Employee') AND name = N'IX_Employee_department_id_status')
    CREATE NONCLUSTERED INDEX IX_Employee_department_id_status ON hr.Employee (department_id, status);

-- Age is compiled into a range on birth_date, so "under 18" can seek.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'hr.Employee') AND name = N'IX_Employee_birth_date')
    CREATE NONCLUSTERED INDEX IX_Employee_birth_date ON hr.Employee (birth_date);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'hr.Employee') AND name = N'IX_Employee_status')
    CREATE NONCLUSTERED INDEX IX_Employee_status ON hr.Employee (status);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'hr.Employee') AND name = N'IX_Employee_salary')
    CREATE NONCLUSTERED INDEX IX_Employee_salary ON hr.Employee (salary);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dq.Run') AND name = N'IX_Run_control_id_control_version')
    CREATE NONCLUSTERED INDEX IX_Run_control_id_control_version ON dq.Run (control_id, control_version);

-- The run history of a control, newest first.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dq.Run') AND name = N'IX_Run_control_id_started_at')
    CREATE NONCLUSTERED INDEX IX_Run_control_id_started_at ON dq.Run (control_id, started_at DESC);
GO
