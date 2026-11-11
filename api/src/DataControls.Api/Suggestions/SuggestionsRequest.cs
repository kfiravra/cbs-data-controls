namespace DataControls.Api.Suggestions;

/// <summary>Both members are optional: an entity to keep suggestions for, and how many to ask for.</summary>
public sealed record SuggestionsRequest(string? RootEntity, int? Max);
