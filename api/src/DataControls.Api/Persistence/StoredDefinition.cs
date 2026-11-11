namespace DataControls.Api.Persistence;

/// <summary>
/// A definition as a version row keeps it: the JSON text, the hash that tells whether it changed, and the
/// root entity key the control row repeats.
/// </summary>
internal sealed record StoredDefinition(string Json, string Hash, string RootEntity);
