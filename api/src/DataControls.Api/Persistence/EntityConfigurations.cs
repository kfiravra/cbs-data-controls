using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataControls.Api.Persistence;

// The model maps the tables that sql/30_dq_tables.sql creates; there are no migrations and the login has no DDL rights.

internal sealed class ControlConfiguration : IEntityTypeConfiguration<Control>
{
    public void Configure(EntityTypeBuilder<Control> builder)
    {
        builder.ToTable("Control", DqDbContext.Schema);
        builder.HasKey(control => control.Id);
        builder.Property(control => control.Id).HasColumnName("id");
        builder.Property(control => control.Name).HasColumnName("name").HasMaxLength(200);
        builder.Property(control => control.Description).HasColumnName("description").HasMaxLength(1000);
        builder.Property(control => control.RootEntityKey).HasColumnName("root_entity_key").HasMaxLength(64);
        builder.Property(control => control.CurrentVersion).HasColumnName("current_version");
        builder.Property(control => control.IsActive).HasColumnName("is_active");
        builder.Property(control => control.CreatedAt).HasColumnName("created_at");
        builder.Property(control => control.UpdatedAt).HasColumnName("updated_at");
        builder.Property(control => control.RowVersion).HasColumnName("row_version").IsRowVersion();
        builder.HasMany(control => control.Versions).WithOne().HasForeignKey(version => version.ControlId);
    }
}

internal sealed class ControlVersionConfiguration : IEntityTypeConfiguration<ControlVersion>
{
    public void Configure(EntityTypeBuilder<ControlVersion> builder)
    {
        builder.ToTable("ControlVersion", DqDbContext.Schema);
        builder.HasKey(version => new { version.ControlId, version.Version });
        builder.Property(version => version.ControlId).HasColumnName("control_id");
        builder.Property(version => version.Version).HasColumnName("version");
        builder.Property(version => version.Definition).HasColumnName("definition");
        builder.Property(version => version.DefinitionHash).HasColumnName("definition_hash").HasMaxLength(64);
        builder.Property(version => version.CreatedAt).HasColumnName("created_at");
    }
}

internal sealed class RunConfiguration : IEntityTypeConfiguration<Run>
{
    public void Configure(EntityTypeBuilder<Run> builder)
    {
        builder.ToTable("Run", DqDbContext.Schema);
        builder.HasKey(run => run.Id);
        builder.Property(run => run.Id).HasColumnName("id");
        builder.Property(run => run.ControlId).HasColumnName("control_id");
        builder.Property(run => run.VersionNumber).HasColumnName("control_version");
        builder.Property(run => run.RunDate).HasColumnName("run_date");
        builder.Property(run => run.Language).HasColumnName("language").HasMaxLength(5);
        builder.Property(run => run.StartedAt).HasColumnName("started_at");
        builder.Property(run => run.FinishedAt).HasColumnName("finished_at");
        builder.Property(run => run.Status)
            .HasColumnName("status")
            .HasMaxLength(20)
            .HasConversion(status => RunStatusNames.ToName(status), name => RunStatusNames.Parse(name));
        builder.Property(run => run.TotalCount).HasColumnName("total_count");
        builder.Property(run => run.StoredCount).HasColumnName("stored_count");
        builder.Property(run => run.DurationMs).HasColumnName("duration_ms");
        builder.Property(run => run.Summary).HasColumnName("summary");
        builder.Property(run => run.ErrorCode).HasColumnName("error_code").HasMaxLength(64);
        builder.Property(run => run.ErrorParams).HasColumnName("error_params");
        builder.Property(run => run.EngineVersion).HasColumnName("engine_version").HasMaxLength(32);
        builder.Property(run => run.CorrelationId).HasColumnName("correlation_id").HasMaxLength(64);
        builder.HasOne<ControlVersion>().WithMany().HasForeignKey(run => new { run.ControlId, run.VersionNumber });
        builder.HasMany(run => run.Results).WithOne().HasForeignKey(result => result.RunId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class RunResultConfiguration : IEntityTypeConfiguration<RunResult>
{
    public void Configure(EntityTypeBuilder<RunResult> builder)
    {
        builder.ToTable("RunResult", DqDbContext.Schema);
        builder.HasKey(result => result.Id);
        builder.Property(result => result.Id).HasColumnName("id");
        builder.Property(result => result.RunId).HasColumnName("run_id");
        builder.Property(result => result.Seq).HasColumnName("seq");
        builder.Property(result => result.RecordKey).HasColumnName("record_key").HasMaxLength(64);
        builder.Property(result => result.RecordDisplay).HasColumnName("record_display");
        builder.Property(result => result.DisplayText).HasColumnName("display_text").HasMaxLength(400);
        builder.PrimitiveCollection(result => result.MatchedConditionIds).HasColumnName("matched_condition_ids");
        builder.Property(result => result.Reasons).HasColumnName("reasons");
        builder.Property(result => result.ReasonText).HasColumnName("reason_text");
    }
}
