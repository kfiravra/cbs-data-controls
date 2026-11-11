using System.Text.Json;
using DataControls.Api.Errors;
using DataControls.Api.Hosting;
using DataControls.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DataControls.Api.Runs;

/// <summary>
/// Reads runs and their stored results. Everything here is answered from the snapshot in <c>dq</c>; the
/// engine is never called for a page, a search, a filter or a sort.
/// </summary>
public sealed class RunQueries(DqDbContext db)
{
    private const string SortByKey = "key";
    private const string SortByDisplay = "display";
    private const string Ascending = "asc";
    private const string Descending = "desc";
    private const string RootEntityMember = "rootEntity";

    public async Task<RunResponse> GetAsync(long id, CancellationToken cancellationToken)
    {
        var row = KeyOf(id) is { } key
            ? await Rows(db.Runs.Where(run => run.Id == key)).SingleOrDefaultAsync(cancellationToken)
            : null;
        return row is null ? throw ApiException.RunNotFound(id) : ToResponse(row);
    }

    /// <summary>A control's runs, newest first.</summary>
    public async Task<PagedResponse<RunResponse>> ListAsync(long controlId, int? page, int? pageSize, CancellationToken cancellationToken)
    {
        var check = new RequestCheck();
        var paging = Paging.Read(check, page, pageSize);
        check.ThrowIfInvalid();
        if (KeyOf(controlId) is not { } controlKey || !await db.Controls.AnyAsync(control => control.Id == controlKey, cancellationToken))
        {
            throw ApiException.ControlNotFound(controlId);
        }

        var runs = db.Runs.Where(run => run.ControlId == controlKey);
        var total = await runs.CountAsync(cancellationToken);
        var rows = await Rows(runs)
            .OrderByDescending(row => row.Run.StartedAt)
            .ThenByDescending(row => row.Run.Id)
            .Skip(paging.Skip)
            .Take(paging.PageSize)
            .ToListAsync(cancellationToken);
        return new PagedResponse<RunResponse>([.. rows.Select(ToResponse)], total, paging.Page, paging.PageSize);
    }

    public async Task<PagedResponse<ResultItemResponse>> ResultsAsync(long runId, ResultsQuery query, CancellationToken cancellationToken)
    {
        var check = new RequestCheck();
        var paging = Paging.Read(check, query.Page, query.PageSize);
        var sort = Word(check, "sort", query.Sort, SortByKey, SortByDisplay);
        var direction = Word(check, "dir", query.Dir, Ascending, Descending);
        check.ThrowIfInvalid();
        if (KeyOf(runId) is not { } runKey || !await db.Runs.AnyAsync(run => run.Id == runKey, cancellationToken))
        {
            throw ApiException.RunNotFound(runId);
        }

        var results = db.RunResults.AsNoTracking().Where(result => result.RunId == runKey);
        var search = query.Search?.Trim();
        if (!string.IsNullOrEmpty(search))
        {
            // Contains is sent as a parameter with its wildcards escaped, so %, _ and [ are taken literally.
            results = results.Where(result => result.DisplayText.Contains(search) || result.ReasonText.Contains(search));
        }

        if (!string.IsNullOrEmpty(query.Condition))
        {
            results = results.Where(result => result.MatchedConditionIds.Contains(query.Condition));
        }

        var total = await results.CountAsync(cancellationToken);
        var page = await Order(results, sort, direction).Skip(paging.Skip).Take(paging.PageSize).ToListAsync(cancellationToken);
        var items = page.Select(result => new ResultItemResponse(
            result.Seq,
            result.RecordKey,
            StoredJson.Parse(result.RecordDisplay),
            result.MatchedConditionIds,
            StoredJson.Parse(result.Reasons),
            result.ReasonText));
        return new PagedResponse<ResultItemResponse>([.. items], total, paging.Page, paging.PageSize);
    }

    /// <summary>An id of the path as a key of the table, or null when no row can have it (it is beyond 32 bits).</summary>
    private static int? KeyOf(long id) => id <= int.MaxValue ? (int)id : null;

    /// <summary>The direction applies to both sort keys, so a page is stable either way.</summary>
    private static IQueryable<RunResult> Order(IQueryable<RunResult> results, string sort, string direction) =>
        (sort, direction) switch
        {
            (SortByDisplay, Ascending) => results.OrderBy(result => result.DisplayText).ThenBy(result => result.Seq),
            (SortByDisplay, _) => results.OrderByDescending(result => result.DisplayText).ThenByDescending(result => result.Seq),
            (_, Ascending) => results.OrderBy(result => result.Seq),
            _ => results.OrderByDescending(result => result.Seq),
        };

    /// <summary>A query word: absent is the first accepted word, anything outside the list is malformed.</summary>
    private static string Word(RequestCheck check, string parameter, string? value, params string[] accepted)
    {
        if (value is null)
        {
            return accepted[0];
        }

        if (!accepted.Contains(value))
        {
            check.Add(parameter, RequestErrorCodes.Malformed);
        }

        return value;
    }

    /// <summary>
    /// Each run with what its response needs from other rows: the control's current name, the definition
    /// of the version that ran (its root entity has no column) and the newest earlier succeeded run.
    /// </summary>
    private IQueryable<RunRow> Rows(IQueryable<Run> runs) =>
        from run in runs.AsNoTracking()
        join control in db.Controls on run.ControlId equals control.Id
        join version in db.ControlVersions
            on new { run.ControlId, Version = run.VersionNumber } equals new { version.ControlId, version.Version }
        select new RunRow
        {
            Run = run,
            ControlName = control.Name,
            Definition = version.Definition,
            Previous = db.Runs
                .Where(earlier => earlier.ControlId == run.ControlId
                    && earlier.Status == RunStatus.Succeeded
                    && (earlier.StartedAt < run.StartedAt || (earlier.StartedAt == run.StartedAt && earlier.Id < run.Id)))
                .OrderByDescending(earlier => earlier.StartedAt)
                .ThenByDescending(earlier => earlier.Id)
                .Select(earlier => new PreviousRunResponse(earlier.Id, earlier.StartedAt, earlier.TotalCount ?? 0))
                .FirstOrDefault(),
        };

    private static RunResponse ToResponse(RunRow row)
    {
        var run = row.Run;
        var succeeded = run.Status == RunStatus.Succeeded;
        var summary = succeeded && run.Summary is not null ? StoredJson.Parse(run.Summary) : (JsonElement?)null;
        return new RunResponse(
            run.Id,
            run.ControlId,
            row.ControlName,
            run.VersionNumber,
            StoredJson.Parse(row.Definition).GetProperty(RootEntityMember).GetString() ?? string.Empty,
            run.RunDate,
            run.Language,
            run.StartedAt,
            run.FinishedAt,
            run.Status,
            succeeded ? run.TotalCount : null,
            succeeded ? run.StoredCount : null,
            succeeded && run.TotalCount > run.StoredCount,
            run.DurationMs,
            summary?.GetProperty(RunSummary.Sentence),
            summary?.GetProperty(RunSummary.SentenceParts),
            summary?.GetProperty(RunSummary.Conditions),
            run.ErrorCode is null ? null : new RunErrorResponse(run.ErrorCode, StoredJson.Parse(run.ErrorParams ?? "{}")),
            row.Previous);
    }

    private sealed class RunRow
    {
        public required Run Run { get; init; }

        public required string ControlName { get; init; }

        public required string Definition { get; init; }

        public PreviousRunResponse? Previous { get; init; }
    }
}
