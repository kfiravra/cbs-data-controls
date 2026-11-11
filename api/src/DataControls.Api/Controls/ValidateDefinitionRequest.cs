using System.Text.Json;

namespace DataControls.Api.Controls;

public sealed record ValidateDefinitionRequest(JsonElement? Definition);
