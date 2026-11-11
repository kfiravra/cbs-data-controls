using System.Linq.Expressions;
using System.Text.Json;
using DataControls.Api.Errors;
using DataControls.Api.Glossary;
using DataControls.Api.Hosting;
using DataControls.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DataControls.Api.Runs;

/// <summary>
/// Reads runs and their stored results. Everything here is answered from the snapshot in <c>dq</c>; the
/// engine is never called for a page, a search or a filter. A sort by a field needs the glossary, to check
/// the field and learn its type: the api's held copy serves, and the engine is asked only when there is none.
/// </summary>
public sealed class RunQueries(DqDbContext db, GlossaryService glossary)
{
    private const string SortByKey = "key";
    private const string SortByDisplay = "display";
    private const string SortByField = "field";
    private const string SortByReasons = "reasons";
    private const string NumberType = "number";
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
        var sort = check.Word("sort", query.Sort, SortByKey, SortByDisplay, SortByField, SortByReasons);
        var descending = check.Word("dir", query.Dir, Ascending, Descending) == Descending;
        if (sort == SortByField && string.IsNullOrEmpty(query.Field))
        {
            check.Add("field", RequestErrorCodes.Required);
        }

        check.ThrowIfInvalid();
        if (KeyOf(runId) is not { } runKey || !await db.Runs.AnyAsync(run => run.Id == runKey, cancellationToken))
        {
            throw ApiException.RunNotFound(runId);
        }

        var order = sort == SortByField
            ? await ByFieldAsync(runKey, query.Field!, descending, cancellationToken)
            : results => Order(results, sort, descending);

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
        var page = await order(results).Skip(paging.Skip).Take(paging.PageSize).ToListAsync(cancellationToken);
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

    /// <summary>
    /// Under <c>key</c> and <c>display</c> the direction applies to both sort keys; under <c>reasons</c> it
    /// applies to the number of reasons and to their text, and equal violations stand by <c>seq</c>, ascending.
    /// Either way a page is the same page whenever it is asked for.
    /// </summary>
    private static IQueryable<RunResult> Order(IQueryable<RunResult> results, string sort, bool descending) =>
        (sort, descending) switch
        {
            (SortByDisplay, false) => results.OrderBy(result => result.DisplayText).ThenBy(result => result.Seq),
            (SortByDisplay, true) => results.OrderByDescending(result => result.DisplayText).ThenByDescending(result => result.Seq),
            (SortByReasons, false) => results.OrderBy(result => result.MatchedConditionIds.Count).ThenBy(result => result.ReasonText).ThenBy(result => result.Seq),
            (SortByReasons, true) => results.OrderByDescending(result => result.MatchedConditionIds.Count).ThenByDescending(result => result.ReasonText).ThenBy(result => result.Seq),
            (_, false) => results.OrderBy(result => result.Seq),
            _ => results.OrderByDescending(result => result.Seq),
        };

    /// <summary>
    /// The order by one identifying field of the record. The field is one the request named, so it is
    /// checked first against the glossary's identifying fields of the run's root entity; then its value is
    /// read from the stored display by a JSON path that is sent bound, like every value of the query: no
    /// part of it is written into the statement. A number is ordered by value and anything else as text (a
    /// date is ISO text, so by date); a violation without the value, or whose stored value is no number in
    /// a number field, comes last in both directions, and equal ones stand by <c>seq</c>.
    /// </summary>
    private async Task<Func<IQueryable<RunResult>, IQueryable<RunResult>>> ByFieldAsync(int runKey, string field, bool descending, CancellationToken cancellationToken)
    {
        var definition = await (
            from run in db.Runs
            where run.Id == runKey
            join version in db.ControlVersions
                on new { run.ControlId, Version = run.VersionNumber } equals new { version.ControlId, version.Version }
            select version.Definition).SingleAsync(cancellationToken);
        var rootEntity = StoredJson.Parse(definition).GetProperty(RootEntityMember).GetString() ?? string.Empty;
        var type = await glossary.IdentifyingFieldTypeAsync(rootEntity, field, cancellationToken)
            ?? throw ApiException.RequestInvalid("field", RequestErrorCodes.Malformed);

        var path = $"$.\"{field}\"";
        var isNumber = type == NumberType;
        Expression<Func<RunResult, string?>> asText = result => DqDbContext.JsonValue(result.RecordDisplay, path);
        Expression<Func<RunResult, double?>> asNumber = result => DqDbContext.JsonNumber(result.RecordDisplay, path);
        // missing as the order reads the value: a number field's value that is no number has no place either
        Expression<Func<RunResult, bool>> missing = isNumber
            ? result => DqDbContext.JsonNumber(result.RecordDisplay, path) == null
            : result => DqDbContext.JsonValue(result.RecordDisplay, path) == null;
        return results =>
        {
            var placed = results.OrderBy(missing);
            var ordered = (isNumber, descending) switch
            {
                (true, false) => placed.ThenBy(asNumber),
                (true, true) => placed.ThenByDescending(asNumber),
                (false, false) => placed.ThenBy(asText),
                _ => placed.ThenByDescending(asText),
            };
            return ordered.ThenBy(result => result.Seq);
        };
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
