using System.Text.Json;

namespace DataControls.Api.Runs;

/// <summary>A stored violation as the engine returned it, plus its position in the engine's order.</summary>
public sealed record ResultItemResponse(
    int Seq,
    string Key,
    JsonElement Display,
    IReadOnlyList<string> Matched,
    JsonElement Reasons,
    string ReasonText);
