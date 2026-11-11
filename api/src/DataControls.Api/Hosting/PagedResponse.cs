namespace DataControls.Api.Hosting;

/// <summary>The contract's <c>Page&lt;T&gt;</c>: one page, and the number of items over all pages after the filters.</summary>
public sealed record PagedResponse<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);
