using System.Text.Json;

namespace DataControls.Api.Controls;

public sealed record CreateControlRequest(string? Name, string? Description, JsonElement? Definition);
