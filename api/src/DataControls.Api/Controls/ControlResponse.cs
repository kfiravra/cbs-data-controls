using System.Text.Json;

namespace DataControls.Api.Controls;

/// <summary>The contract's <c>Control</c>: the control with its current version's definition.</summary>
public sealed record ControlResponse(
    int Id,
    string Name,
    string? Description,
    string RootEntity,
    int Version,
    bool IsActive,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    string ConcurrencyToken,
    JsonElement Definition);
