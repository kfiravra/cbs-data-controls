using System.Data;
using System.Reflection;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Query.SqlExpressions;
using Microsoft.EntityFrameworkCore.Storage;

namespace DataControls.Api.Persistence;

/// <summary>
/// The controls store, schema <c>dq</c>. The class is public because public services take it; the sets
/// and the entities are internal, so a service signature cannot hand an entity out.
/// </summary>
public sealed class DqDbContext(DbContextOptions<DqDbContext> options) : DbContext(options)
{
    internal const string Schema = "dq";

    /// <summary>What <c>JSON_VALUE</c> returns and what <c>TRY_CONVERT(float, ...)</c> returns, for the translation of <see cref="JsonNumber"/>.</summary>
    private static readonly StringTypeMapping _jsonText = new("nvarchar(4000)", DbType.String, unicode: true, size: 4000);
    private static readonly DoubleTypeMapping _float = new("float", DbType.Double);

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

    /// <summary>
    /// The same member as a number: <c>TRY_CONVERT(float, JSON_VALUE(...))</c>. A stored value that is not a
    /// number (the field was of another type when the run was stored) gives null, not a failed query.
    /// </summary>
    internal static double? JsonNumber(string json, string path) =>
        throw new NotSupportedException("JSON_VALUE is evaluated by the database.");

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(DqDbContext).Assembly);
        modelBuilder
            .HasDbFunction(Function(nameof(JsonValue)))
            .HasName("JSON_VALUE")
            .IsBuiltIn();
        // the type TRY_CONVERT converts to is a word of this code, not a value of any request
        modelBuilder
            .HasDbFunction(Function(nameof(JsonNumber)))
            .HasTranslation(arguments => new SqlFunctionExpression(
                "TRY_CONVERT",
                [new SqlFragmentExpression("float"), new SqlFunctionExpression("JSON_VALUE", arguments, nullable: true, [false, false], typeof(string), _jsonText)],
                nullable: true,
                [false, false],
                typeof(double),
                _float));
    }

    private static MethodInfo Function(string name) =>
        typeof(DqDbContext).GetMethod(name, BindingFlags.NonPublic | BindingFlags.Static)
        ?? throw new InvalidOperationException($"No function {name} to map.");
}
