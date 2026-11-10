namespace DataControls.Api.Persistence;

/// <summary>A control. Its definition lives in its versions; <see cref="RowVersion"/> is the concurrency token.</summary>
internal sealed class Control
{
    private readonly List<ControlVersion> _versions = [];

    private Control()
    {
    }

    public int Id { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public string? Description { get; private set; }

    public string RootEntityKey { get; private set; } = string.Empty;

    public int CurrentVersion { get; private set; }

    public bool IsActive { get; private set; }

    public DateTime CreatedAt { get; private set; }

    public DateTime UpdatedAt { get; private set; }

    public byte[] RowVersion { get; private set; } = [];

    public IReadOnlyCollection<ControlVersion> Versions => _versions;

    public static Control Create(string name, string? description, StoredDefinition definition, DateTime now)
    {
        var control = new Control
        {
            Name = name,
            Description = description,
            RootEntityKey = definition.RootEntity,
            CurrentVersion = 1,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now,
        };
        control._versions.Add(new ControlVersion(control.CurrentVersion, definition, now));
        return control;
    }
}
