using System.Text.Json;

namespace DataControls.Api.Runs;

/// <summary>Why a run failed or timed out: a code of <c>contracts/errors.md</c> marked "Run error", and its params.</summary>
public sealed record RunErrorResponse(string Code, JsonElement Params);
