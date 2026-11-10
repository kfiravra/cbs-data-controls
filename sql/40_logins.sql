-- The two application logins, their database users and their permissions. Re-runnable: an existing login gets
-- its password reset. The passwords arrive as the sqlcmd variables DQ_APP_PASSWORD and DQ_ENGINE_RO_PASSWORD
-- (from the environment, as scripts/db-init.sh passes them, or :setvar in SSMS SQLCMD Mode); they are never
-- written into this file.
--   dq_app        the api: reads and writes schema dq, nothing on hr
--   dq_engine_ro  the engine: reads schema hr, nothing else
-- Permissions go on schemas, so tables added later inherit them. No DDL, no EXECUTE, nothing to public.
SET NOCOUNT ON;
USE DataControls;
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'dq_app')
    CREATE LOGIN dq_app WITH PASSWORD = N'$(DQ_APP_PASSWORD)', DEFAULT_DATABASE = DataControls, CHECK_POLICY = ON;
ELSE
    ALTER LOGIN dq_app WITH PASSWORD = N'$(DQ_APP_PASSWORD)';
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'dq_engine_ro')
    CREATE LOGIN dq_engine_ro WITH PASSWORD = N'$(DQ_ENGINE_RO_PASSWORD)', DEFAULT_DATABASE = DataControls, CHECK_POLICY = ON;
ELSE
    ALTER LOGIN dq_engine_ro WITH PASSWORD = N'$(DQ_ENGINE_RO_PASSWORD)';
GO

-- A user whose login was dropped and recreated keeps the old SID; it is re-mapped to the login of its name.
IF DATABASE_PRINCIPAL_ID(N'dq_app') IS NULL
    CREATE USER dq_app FOR LOGIN dq_app WITH DEFAULT_SCHEMA = dq;
ELSE IF SUSER_SID(N'dq_app') <> (SELECT sid FROM sys.database_principals WHERE name = N'dq_app')
    ALTER USER dq_app WITH LOGIN = dq_app;
GO

IF DATABASE_PRINCIPAL_ID(N'dq_engine_ro') IS NULL
    CREATE USER dq_engine_ro FOR LOGIN dq_engine_ro WITH DEFAULT_SCHEMA = hr;
ELSE IF SUSER_SID(N'dq_engine_ro') <> (SELECT sid FROM sys.database_principals WHERE name = N'dq_engine_ro')
    ALTER USER dq_engine_ro WITH LOGIN = dq_engine_ro;
GO

GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::dq TO dq_app;
DENY SELECT, INSERT, UPDATE, DELETE ON SCHEMA::hr TO dq_app;

GRANT SELECT ON SCHEMA::hr TO dq_engine_ro;
DENY INSERT, UPDATE, DELETE ON SCHEMA::hr TO dq_engine_ro;
DENY SELECT, INSERT, UPDATE, DELETE ON SCHEMA::dq TO dq_engine_ro;
GO
