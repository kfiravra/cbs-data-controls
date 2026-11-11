namespace DataControls.Api.Errors;

/// <summary>
/// One fault of a request: <paramref name="Path"/> is a JSON Pointer into the body or the name of a query
/// parameter.
/// </summary>
public sealed record RequestError(string Path, string Code, RequestErrorParams Params);
