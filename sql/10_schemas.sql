-- Schema hr holds the organization data, schema dq the controls store. Re-runnable.
-- CREATE SCHEMA must open its batch, so an existing schema skips the batch with NOEXEC instead of wrapping the
-- statement in EXEC.
SET NOCOUNT ON;
USE DataControls;
GO

IF SCHEMA_ID(N'hr') IS NOT NULL SET NOEXEC ON;
GO
CREATE SCHEMA hr AUTHORIZATION dbo;
GO
SET NOEXEC OFF;
GO

IF SCHEMA_ID(N'dq') IS NOT NULL SET NOEXEC ON;
GO
CREATE SCHEMA dq AUTHORIZATION dbo;
GO
SET NOEXEC OFF;
GO
