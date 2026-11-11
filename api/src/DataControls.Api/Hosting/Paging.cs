using DataControls.Api.Errors;

namespace DataControls.Api.Hosting;

/// <summary>The page a paged endpoint was asked for, already inside its range.</summary>
internal sealed record Paging(int Page, int PageSize)
{
    public const int MaxPage = 1_000_000;
    public const int MaxPageSize = 200;
    public const int DefaultPageSize = 25;

    public int Skip => (Page - 1) * PageSize;

    /// <summary>Reads <c>page</c> and <c>pageSize</c>; a value outside its range is a fault of the request.</summary>
    public static Paging Read(RequestCheck check, int? page, int? pageSize) =>
        new(
            check.Number("page", page, fallback: 1, min: 1, max: MaxPage),
            check.Number("pageSize", pageSize, DefaultPageSize, min: 1, max: MaxPageSize));
}
