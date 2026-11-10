namespace DataControls.Api.Persistence;

/// <summary>How a run that did not succeed is closed: its status, its error code and the error's params as JSON text.</summary>
internal sealed record RunFailure(RunStatus Status, string Code, string ParamsJson);
