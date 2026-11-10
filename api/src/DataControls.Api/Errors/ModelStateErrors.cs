using System.Text;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace DataControls.Api.Errors;

/// <summary>
/// Turns what the binders rejected into request errors. A binder only fails on a value of the wrong JSON
/// type or form, and its message is an English sentence, so every entry is <c>MALFORMED</c>; the rules
/// that have a code of their own are checked by <see cref="RequestCheck"/>.
/// </summary>
internal static class ModelStateErrors
{
    public static IReadOnlyList<RequestError> From(ModelStateDictionary modelState) =>
        [.. modelState
            .Where(entry => entry.Value is { Errors.Count: > 0 })
            .Select(entry => new RequestError(ToPath(entry.Key), RequestErrorCodes.Malformed, new RequestErrorParams()))];

    /// <summary>
    /// The JSON formatter keys a fault by a JSON path (<c>$.items[2].name</c>), which becomes a JSON Pointer
    /// (<c>/items/2/name</c>); a query parameter is keyed by its name and stays as it is.
    /// </summary>
    internal static string ToPath(string key)
    {
        if (!key.StartsWith('$'))
        {
            return key;
        }

        var pointer = new StringBuilder();
        foreach (var segment in key[1..].Split(['.', '['], StringSplitOptions.RemoveEmptyEntries))
        {
            pointer.Append('/').Append(segment.TrimEnd(']').Replace("~", "~0").Replace("/", "~1"));
        }

        return pointer.ToString();
    }
}
