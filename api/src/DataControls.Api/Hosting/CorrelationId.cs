using System.Text.RegularExpressions;

namespace DataControls.Api.Hosting;

internal static partial class CorrelationId
{
    public const string HeaderName = "X-Correlation-Id";

    /// <summary>The caller's id when it has the contract's form, else a new one of 32 hexadecimal characters.</summary>
    public static string AcceptOrCreate(string? candidate) =>
        candidate is not null && Accepted().IsMatch(candidate) ? candidate : Create();

    public static string Create() => Guid.NewGuid().ToString("N");

    [GeneratedRegex(@"\A[A-Za-z0-9._-]{1,64}\z")]
    private static partial Regex Accepted();
}
