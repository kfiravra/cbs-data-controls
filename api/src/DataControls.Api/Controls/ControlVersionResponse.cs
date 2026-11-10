using System.Text.Json;

namespace DataControls.Api.Controls;

public sealed record ControlVersionResponse(int Version, DateTime CreatedAt, JsonElement Definition);
