-- The sample organization: Ministry -> Department -> Employee. Re-runnable.
-- Only structural constraints (keys, foreign keys, the status domain) and explicit ids without IDENTITY: the
-- business rules are what the controls detect, so the database must let the seed break them.
SET NOCOUNT ON;
USE DataControls;
GO

IF OBJECT_ID(N'hr.Ministry', N'U') IS NULL
BEGIN
    CREATE TABLE hr.Ministry
    (
        id        INT           NOT NULL,
        name      NVARCHAR(100) NOT NULL,
        is_active BIT           NOT NULL CONSTRAINT DF_Ministry_is_active DEFAULT (1),
        CONSTRAINT PK_Ministry PRIMARY KEY CLUSTERED (id)
    );
END;
GO

IF OBJECT_ID(N'hr.Department', N'U') IS NULL
BEGIN
    CREATE TABLE hr.Department
    (
        id                  INT           NOT NULL,
        ministry_id         INT           NOT NULL,
        name                NVARCHAR(100) NOT NULL,
        is_active           BIT           NOT NULL CONSTRAINT DF_Department_is_active DEFAULT (1),
        manager_employee_id INT           NULL,
        CONSTRAINT PK_Department PRIMARY KEY CLUSTERED (id),
        CONSTRAINT FK_Department_Ministry FOREIGN KEY (ministry_id) REFERENCES hr.Ministry (id)
    );
END;
GO

IF OBJECT_ID(N'hr.Employee', N'U') IS NULL
BEGIN
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
        CONSTRAINT PK_Employee PRIMARY KEY CLUSTERED (id),
        CONSTRAINT FK_Employee_Department FOREIGN KEY (department_id) REFERENCES hr.Department (id),
        CONSTRAINT UQ_Employee_national_id UNIQUE (national_id),
        CONSTRAINT CK_Employee_status CHECK (status IN (N'active', N'inactive'))
    );
END;
GO

-- Department and Employee reference each other, so the manager key is added once both tables exist.
IF OBJECT_ID(N'hr.FK_Department_Employee', N'F') IS NULL
    ALTER TABLE hr.Department
        ADD CONSTRAINT FK_Department_Employee FOREIGN KEY (manager_employee_id) REFERENCES hr.Employee (id);
GO
