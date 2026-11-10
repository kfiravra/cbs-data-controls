-- The DataControls database, created with the Hebrew collation. Runs in master; re-runnable.
SET NOCOUNT ON;
USE master;
GO

IF DB_ID(N'DataControls') IS NULL
    CREATE DATABASE DataControls COLLATE Hebrew_CI_AS;
GO

-- A database left over under another collation would compare Hebrew text differently; refuse to build on it.
IF CONVERT(NVARCHAR(128), DATABASEPROPERTYEX(N'DataControls', 'Collation')) <> N'Hebrew_CI_AS'
    THROW 50000, N'DataControls exists with a collation other than Hebrew_CI_AS; recreate it with scripts/db-init.sh --reset.', 1;
GO
