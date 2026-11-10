using System.Text.Json;

namespace DataControls.Api.Errors;

/// <summary>
/// Collects the faults of one request, so the answer lists all of them, and throws once. A path is a JSON
/// Pointer into the body or the name of a query parameter.
/// </summary>
internal sealed class RequestCheck
{
    private readonly List<RequestError> _errors = [];

    public void Add(string path, string code, int? min = null, int? max = null) =>
        _errors.Add(new RequestError(path, code, new RequestErrorParams(min, max)));

    /// <summary>A required string: trimmed, not empty and at most <paramref name="max"/> characters.</summary>
    public string Text(string path, string? value, int max)
    {
        var trimmed = OptionalText(path, value, max);
        if (trimmed is null)
        {
            Add(path, RequestErrorCodes.Required);
        }

        return trimmed ?? string.Empty;
    }

    /// <summary>An optional string, trimmed; absent, null and empty all come back as null.</summary>
    public string? OptionalText(string path, string? value, int max)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            return null;
        }

        if (trimmed.Length > max)
        {
            Add(path, RequestErrorCodes.TooLong, max: max);
        }

        return trimmed;
    }

    /// <summary>
    /// A definition must be a JSON object: absent or null is <c>REQUIRED</c>, any other value <c>MALFORMED</c>.
    /// Everything about the object itself is a definition check, not a request check.
    /// </summary>
    public JsonElement Definition(string path, JsonElement? value)
    {
        switch (value?.ValueKind)
        {
            case JsonValueKind.Object:
                return value.Value;
            case null or JsonValueKind.Null or JsonValueKind.Undefined:
                Add(path, RequestErrorCodes.Required);
                return default;
            default:
                Add(path, RequestErrorCodes.Malformed);
                return default;
        }
    }

    /// <summary>An optional integer inside its range; absent is <paramref name="fallback"/>.</summary>
    public int Number(string path, int? value, int fallback, int min, int max)
    {
        if (value is null)
        {
            return fallback;
        }

        if (value < min || value > max)
        {
            Add(path, RequestErrorCodes.OutOfRange, min, max);
        }

        return value.Value;
    }

    /// <summary>An optional integer with a lower bound only; absent stays absent.</summary>
    public int? AtLeast(string path, int? value, int min)
    {
        if (value < min)
        {
            Add(path, RequestErrorCodes.OutOfRange, min: min);
        }

        return value;
    }

    public void ThrowIfInvalid()
    {
        if (_errors.Count > 0)
        {
            throw ApiException.RequestInvalid(_errors);
        }
    }
}
