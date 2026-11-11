using System.Text.Json;

namespace DataControls.Api.Engine;

/// <summary>
/// One violation of a run answer. The api reads the key, the matched ids and the reason text; the display
/// object and the reasons are stored and served as received.
/// </summary>
public sealed record EngineViolation(string Key, JsonElement Display, IReadOnlyList<string> Matched, JsonElement Reasons, string ReasonText);
