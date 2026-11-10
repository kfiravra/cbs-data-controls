-- The controls store, written only by the api (login dq_app). Re-runnable.
-- JSON columns are checked with ISJSON; a NULL passes, so optional JSON columns stay nullable.
SET NOCOUNT ON;
USE DataControls;
GO

-- A control; its definition lives in the versions. row_version is the optimistic concurrency token.
IF OBJECT_ID(N'dq.Control', N'U') IS NULL
BEGIN
    CREATE TABLE dq.Control
    (
        id              INT            IDENTITY(1, 1) NOT NULL,
        name            NVARCHAR(200)  NOT NULL,
        description     NVARCHAR(1000) NULL,
        root_entity_key NVARCHAR(64)   NOT NULL,
        current_version INT            NOT NULL,
        is_active       BIT            NOT NULL CONSTRAINT DF_Control_is_active DEFAULT (1),
        created_at      DATETIME2(3)   NOT NULL CONSTRAINT DF_Control_created_at DEFAULT (SYSUTCDATETIME()),
        updated_at      DATETIME2(3)   NOT NULL CONSTRAINT DF_Control_updated_at DEFAULT (SYSUTCDATETIME()),
        row_version     ROWVERSION     NOT NULL,
        CONSTRAINT PK_Control PRIMARY KEY CLUSTERED (id)
    );
END;
GO

-- Immutable: a new row only when the definition hash changes.
IF OBJECT_ID(N'dq.ControlVersion', N'U') IS NULL
BEGIN
    CREATE TABLE dq.ControlVersion
    (
        control_id      INT           NOT NULL,
        version         INT           NOT NULL,
        definition      NVARCHAR(MAX) NOT NULL,
        definition_hash NVARCHAR(64)  NOT NULL,
        created_at      DATETIME2(3)  NOT NULL CONSTRAINT DF_ControlVersion_created_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_ControlVersion PRIMARY KEY CLUSTERED (control_id, version),
        CONSTRAINT FK_ControlVersion_Control FOREIGN KEY (control_id) REFERENCES dq.Control (id),
        CONSTRAINT CK_ControlVersion_definition CHECK (ISJSON(definition) = 1)
    );
END;
GO

-- One run of one control version. summary holds the rule sentence and the per-condition sentences and counts,
-- because the results screen never calls the engine.
IF OBJECT_ID(N'dq.Run', N'U') IS NULL
BEGIN
    CREATE TABLE dq.Run
    (
        id              INT           IDENTITY(1, 1) NOT NULL,
        control_id      INT           NOT NULL,
        control_version INT           NOT NULL,
        run_date        DATE          NOT NULL,
        language        NVARCHAR(5)   NOT NULL,
        started_at      DATETIME2(3)  NOT NULL CONSTRAINT DF_Run_started_at DEFAULT (SYSUTCDATETIME()),
        finished_at     DATETIME2(3)  NULL,
        status          NVARCHAR(20)  NOT NULL CONSTRAINT DF_Run_status DEFAULT (N'running'),
        total_count     INT           NULL,
        stored_count    INT           NULL,
        duration_ms     INT           NULL,
        summary         NVARCHAR(MAX) NULL,
        error_code      NVARCHAR(64)  NULL,
        error_params    NVARCHAR(MAX) NULL,
        engine_version  NVARCHAR(32)  NULL,
        correlation_id  NVARCHAR(64)  NOT NULL,
        CONSTRAINT PK_Run PRIMARY KEY CLUSTERED (id),
        CONSTRAINT FK_Run_ControlVersion FOREIGN KEY (control_id, control_version)
            REFERENCES dq.ControlVersion (control_id, version),
        CONSTRAINT CK_Run_language CHECK (language IN (N'he', N'en')),
        CONSTRAINT CK_Run_status CHECK (status IN (N'running', N'succeeded', N'failed', N'timed_out')),
        CONSTRAINT CK_Run_summary CHECK (ISJSON(summary) = 1),
        CONSTRAINT CK_Run_error_params CHECK (ISJSON(error_params) = 1)
    );
END;
GO

-- The stored violations of a run, a snapshot for paging and search. seq is the engine's key order.
IF OBJECT_ID(N'dq.RunResult', N'U') IS NULL
BEGIN
    CREATE TABLE dq.RunResult
    (
        id                    BIGINT        IDENTITY(1, 1) NOT NULL,
        run_id                INT           NOT NULL,
        seq                   INT           NOT NULL,
        record_key            NVARCHAR(64)  NOT NULL,
        record_display        NVARCHAR(MAX) NOT NULL,
        display_text          NVARCHAR(400) NOT NULL,
        matched_condition_ids NVARCHAR(MAX) NOT NULL,
        reasons               NVARCHAR(MAX) NOT NULL,
        reason_text           NVARCHAR(MAX) NOT NULL,
        CONSTRAINT PK_RunResult PRIMARY KEY CLUSTERED (id),
        CONSTRAINT FK_RunResult_Run FOREIGN KEY (run_id) REFERENCES dq.Run (id) ON DELETE CASCADE,
        CONSTRAINT UQ_RunResult_run_id_seq UNIQUE (run_id, seq),
        CONSTRAINT CK_RunResult_record_display CHECK (ISJSON(record_display) = 1),
        CONSTRAINT CK_RunResult_matched_condition_ids CHECK (ISJSON(matched_condition_ids) = 1),
        CONSTRAINT CK_RunResult_reasons CHECK (ISJSON(reasons) = 1)
    );
END;
GO
