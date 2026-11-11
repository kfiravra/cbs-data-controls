namespace DataControls.Api.Tests.Support;

/// <summary><c>Name</c> is declared non-nullable on purpose: its absence must still be reported by the request check, not by MVC.</summary>
public sealed record ProbeRequest(string Name, string? Note);
