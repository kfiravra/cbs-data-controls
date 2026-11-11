using Microsoft.EntityFrameworkCore;

namespace DataControls.Api.Persistence;

/// <summary>
/// The controls store, schema <c>dq</c>. The class is public because public services take it; the sets
/// and the entities are internal, so a service signature cannot hand an entity out.
/// </summary>
public sealed class DqDbContext(DbContextOptions<DqDbContext> options) : DbContext(options)
{
    internal const string Schema = "dq";

    internal DbSet<Control> Controls => Set<Control>();

    internal DbSet<ControlVersion> ControlVersions => Set<ControlVersion>();

    internal DbSet<Run> Runs => Set<Run>();

    internal DbSet<RunResult> RunResults => Set<RunResult>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder) =>
        configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>().HavePrecision(3);

    protected override void OnModelCreating(ModelBuilder modelBuilder) =>
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(DqDbContext).Assembly);
}
