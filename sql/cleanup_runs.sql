-- Retention: deletes every run of a control beyond its newest KEEP_LAST_RUNS, and every run that started more
-- than KEEP_DAYS days ago. Their results go with them (ON DELETE CASCADE). Not part of the init order.
-- Run as dq_app with both sqlcmd variables, for example:
--   sqlcmd -S localhost,1433 -U dq_app -d DataControls -C -b -f 65001
--          -v KEEP_LAST_RUNS=20 -v KEEP_DAYS=90 -i sql/cleanup_runs.sql
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @keep_last_runs INT = $(KEEP_LAST_RUNS);
DECLARE @keep_days INT = $(KEEP_DAYS);

IF @keep_last_runs < 1 OR @keep_days < 1
    THROW 50000, N'KEEP_LAST_RUNS and KEEP_DAYS must both be 1 or more.', 1;

DECLARE @cutoff DATETIME2(3) = DATEADD(DAY, -@keep_days, SYSUTCDATETIME());
DECLARE @deleted INT;

WITH ranked AS
(
    SELECT r.started_at,
           ROW_NUMBER() OVER (PARTITION BY r.control_id ORDER BY r.started_at DESC, r.id DESC) AS position
    FROM dq.Run AS r
)
DELETE FROM ranked
WHERE position > @keep_last_runs
   OR started_at < @cutoff;

SET @deleted = @@ROWCOUNT;
PRINT CONCAT(N'cleanup_runs: deleted ', @deleted, N' runs (kept the newest ', @keep_last_runs,
             N' per control, none older than ', @keep_days, N' days).');
