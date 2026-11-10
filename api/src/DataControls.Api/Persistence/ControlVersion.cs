namespace DataControls.Api.Persistence;

/// <summary>One immutable version of a control's definition.</summary>
internal sealed class ControlVersion
{
    private ControlVersion()
    {
    }

    internal ControlVersion(int version, StoredDefinition definition, DateTime now)
    {
        Version = version;
        Definition = definition.Json;
        DefinitionHash = definition.Hash;
        CreatedAt = now;
    }

    public int ControlId { get; private set; }

    public int Version { get; private set; }

    public string Definition { get; private set; } = string.Empty;

    public string DefinitionHash { get; private set; } = string.Empty;

    public DateTime CreatedAt { get; private set; }
}
