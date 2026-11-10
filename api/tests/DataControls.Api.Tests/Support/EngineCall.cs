namespace DataControls.Api.Tests.Support;

/// <summary>One request the api made to the engine: its route (<c>"POST /run"</c>), headers and body.</summary>
public sealed record EngineCall(string Route, IReadOnlyDictionary<string, string> Headers, string Body);
