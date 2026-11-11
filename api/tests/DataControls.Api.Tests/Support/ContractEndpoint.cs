namespace DataControls.Api.Tests.Support;

/// <summary>One row of the contract's application table: what is served, its success status and the error statuses it names.</summary>
public sealed record ContractEndpoint(string Method, string Path, int SuccessStatus, IReadOnlyList<int> ErrorStatuses)
{
    public override string ToString() => $"{Method} {Path}";
}
