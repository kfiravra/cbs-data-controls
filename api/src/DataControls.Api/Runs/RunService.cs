using System.Diagnostics;
using System.Globalization;
using DataControls.Api.Controls;
using DataControls.Api.Engine;
using DataControls.Api.Errors;
using DataControls.Api.Glossary;
using DataControls.Api.Hosting;
using DataControls.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DataControls.Api.Runs;

/// <summary>
/// Starts a run: opens its row, asks the engine once, stores the snapshot and closes the row. A run is
/// synchronous, and its failure is its status and error, not an error response.
/// </summary>
public sealed class RunService(
    DqDbContext db,
    ControlService controls,
    EngineClient engine,
    GlossaryService glossary,
    RunQueries queries,
    RunCalendar calendar,
    UtcClock clock,
    RequestContextAccessor requests,
    IOptions<RunsOptions> options,
    IHostApplicationLifetime lifetime,
    ILogger<RunService> logger)
{
    private const string DateFormat = "yyyy-MM-dd";

    private static readonly RunFailure _snapshotNotStored = new(RunStatus.Failed, ErrorCodes.InternalError, "{}");

    /// <summary>Runs the control's current version and returns the closed run.</summary>
    public async Task<RunResponse> StartAsync(long controlId, StartRunRequest? request, CancellationToken cancellationToken)
    {
        var runDate = ReadRunDate(request?.RunDate);
        var control = await controls.GetAsync(controlId, cancellationToken);
        if (!control.IsActive)
        {
            throw ApiException.ControlArchived(control.Id);
        }

        var context = requests.Current;
        var run = Run.Start(control.Id, control.Version, runDate, context.Language, context.CorrelationId, clock.Now);
        db.Runs.Add(run);
        await db.SaveChangesAsync(cancellationToken);

        // The row exists, so the run now outlives its request: a closed tab must not leave it `running`.
        // Only the host stopping cancels it.
        var stopping = lifetime.ApplicationStopping;
        var started = Stopwatch.GetTimestamp();
        try
        {
            var answer = await engine.RunAsync(control.Definition, runDate, options.Value.RowCap, stopping);
            await StoreSnapshotAsync(run, control.RootEntity, answer, started, stopping);
        }
        catch (EngineException failure)
        {
            logger.LogWarning(failure, "Run {RunId} failed in the engine ({Failure}) {CorrelationId}", run.Id, failure.Failure, context.CorrelationId);
            run.Fail(EngineErrorMap.ToRunFailure(failure), ElapsedMs(started), clock.Now);
            await db.SaveChangesAsync(stopping);
        }

        return await queries.GetAsync(run.Id, stopping);
    }

    /// <summary>
    /// The rows and the closed run go in with one save. When that save fails the run is closed failed with
    /// no rows, so only a crash can leave a run `running`.
    /// </summary>
    private async Task StoreSnapshotAsync(Run run, string rootEntity, EngineRunAnswer answer, long started, CancellationToken cancellationToken)
    {
        var identifyingFields = await IdentifyingFieldsAsync(rootEntity, answer.GlossaryVersion, cancellationToken);
        var rows = RunSnapshot.Rows(answer, identifyingFields, options.Value.RowCap);
        run.Succeed(new RunOutcome(answer.TotalCount, answer.DurationMs, RunSnapshot.Summary(answer), answer.EngineVersion), rows, clock.Now);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (Exception failure) when (failure is DbUpdateException or InvalidOperationException)
        {
            logger.LogError(failure, "The snapshot of run {RunId} could not be stored {CorrelationId}", run.Id, run.CorrelationId);
            db.ChangeTracker.Clear();
            var reopened = await db.Runs.SingleAsync(candidate => candidate.Id == run.Id, cancellationToken);
            reopened.Fail(_snapshotNotStored, ElapsedMs(started), clock.Now);
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    private async Task<IReadOnlyList<string>?> IdentifyingFieldsAsync(string rootEntity, string glossaryVersion, CancellationToken cancellationToken)
    {
        try
        {
            return await glossary.IdentifyingFieldsAsync(rootEntity, glossaryVersion, cancellationToken);
        }
        catch (EngineException failure)
        {
            // The engine has just answered the run, so this is rare, and the rows are still worth storing:
            // without the glossary the display values keep the order the engine wrote them in.
            logger.LogWarning(failure, "No glossary for the display order of a run ({Failure}) {CorrelationId}", failure.Failure, requests.Current.CorrelationId);
            return null;
        }
    }

    /// <summary>The date asked for, which must be a real calendar date, or today in the configured zone.</summary>
    private DateOnly ReadRunDate(string? requested)
    {
        if (requested is null)
        {
            return calendar.Today;
        }

        return DateOnly.TryParseExact(requested, DateFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)
            ? date
            : throw ApiException.RequestInvalid("/runDate", RequestErrorCodes.Malformed);
    }

    private static int ElapsedMs(long started) => (int)Math.Min(Stopwatch.GetElapsedTime(started).TotalMilliseconds, int.MaxValue);
}
