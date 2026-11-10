using System.Text.Json;

namespace DataControls.Api.Controls;

public sealed record UpdateControlRequest(string? Name, string? Description, JsonElement? Definition, string? ConcurrencyToken);
