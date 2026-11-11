namespace DataControls.Api.Errors;

/// <summary>The codes of one fault inside a <c>REQUEST_INVALID</c> problem.</summary>
public static class RequestErrorCodes
{
    public const string Required = "REQUIRED";
    public const string TooLong = "TOO_LONG";
    public const string OutOfRange = "OUT_OF_RANGE";
    public const string Malformed = "MALFORMED";

    public static IReadOnlySet<string> All { get; } = new HashSet<string> { Required, TooLong, OutOfRange, Malformed };
}
