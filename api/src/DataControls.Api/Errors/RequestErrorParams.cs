using System.Text.Json.Serialization;

namespace DataControls.Api.Errors;

/// <summary>The bounds a value broke; each is written only where it applies.</summary>
public sealed record RequestErrorParams(
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? Min = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? Max = null);
