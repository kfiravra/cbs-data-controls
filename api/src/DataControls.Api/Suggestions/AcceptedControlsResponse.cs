using DataControls.Api.Controls;

namespace DataControls.Api.Suggestions;

/// <summary>The controls created from accepted suggestions, in the request's order.</summary>
public sealed record AcceptedControlsResponse(IReadOnlyList<ControlResponse> Items);
