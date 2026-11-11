namespace DataControls.Api.Health;

/// <summary><c>status</c> is <c>ok</c>, or <c>degraded</c> when the database or the engine is not.</summary>
public sealed record HealthResponse(string Status, string Database, string Engine, string Version);
