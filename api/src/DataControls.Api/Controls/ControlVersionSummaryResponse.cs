namespace DataControls.Api.Controls;

/// <summary>A row of a control's versions list. Equal hashes mean equal definitions.</summary>
public sealed record ControlVersionSummaryResponse(int Version, DateTime CreatedAt, string DefinitionHash);
