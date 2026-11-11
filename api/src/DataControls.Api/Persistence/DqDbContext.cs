using System.Reflection;
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

    /// <summary>
    /// SQL Server's <c>JSON_VALUE</c>, for a query to read one member of a stored JSON text. The path is a
    /// value of the query like any other and is sent bound. It has no body: it exists to be translated.
    /// </summary>
    internal static string? JsonValue(string json, string path) =>
        throw new NotSupportedException("JSON_VALUE is evaluated by the database.");

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(DqDbContext).Assembly);
        modelBuilder
            .HasDbFunction(typeof(DqDbContext).GetMethod(nameof(JsonValue), BindingFlags.NonPublic | BindingFlags.Static)!)
            .HasName("JSON_VALUE")
            .IsBuiltIn();
    }
}
