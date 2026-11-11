using DataControls.Api.Controls;

namespace DataControls.Api.Suggestions;

/// <summary>The suggestions a user chose to keep; each becomes an ordinary control.</summary>
public sealed record AcceptSuggestionsRequest(IReadOnlyList<CreateControlRequest?>? Items);
