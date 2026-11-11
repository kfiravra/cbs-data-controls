namespace DataControls.Api.Hosting;

/// <summary>What every request carries: its correlation id and the language its text is rendered in.</summary>
public sealed record RequestContext(string CorrelationId, string Language);
