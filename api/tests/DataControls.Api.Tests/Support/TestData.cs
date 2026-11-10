using DataControls.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DataControls.Api.Tests.Support;

/// <summary>
/// The tests write to the shared database. Every control they create is named with the marker, and the
/// sweep deletes marked controls with their versions and runs.
/// </summary>
internal static class TestData
{
    public const string Marker = "zz-dc-api-test-";

    /// <summary>A marked name that no other test uses; a list test searches by <paramref name="testId"/>.</summary>
    public static string Name(string testId, string label = "control") => $"{Marker}{testId}-{label}";

    public static string NewTestId() => Guid.NewGuid().ToString("N")[..12];

    public static async Task EnsureDatabaseAsync(IServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<DqDbContext>();
        if (!await db.Database.CanConnectAsync())
        {
            throw new InvalidOperationException(
                "SQL Server is not reachable as dq_app with the database block of .env. Start and initialise it from the main tree: docker compose up -d db && scripts/db-init.sh");
        }
    }

    public static async Task SweepAsync(IServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<DqDbContext>();
        var marked = db.Controls.Where(control => control.Name.StartsWith(Marker));
        await db.Runs.Where(run => marked.Any(control => control.Id == run.ControlId)).ExecuteDeleteAsync();
        await db.ControlVersions.Where(version => marked.Any(control => control.Id == version.ControlId)).ExecuteDeleteAsync();
        await marked.ExecuteDeleteAsync();
    }
}
