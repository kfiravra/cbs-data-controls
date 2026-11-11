namespace DataControls.Api.Tests.Support;

/// <summary>
/// The host's clock. It runs with the system's unless a test moves it forward or pins it to an instant;
/// timers stay real, so timeouts and delays inside the host behave as in production.
/// </summary>
public sealed class TestClock : TimeProvider
{
    private TimeSpan _offset = TimeSpan.Zero;
    private DateTimeOffset? _pinned;

    public override DateTimeOffset GetUtcNow() => _pinned ?? (DateTimeOffset.UtcNow + _offset);

    public void Advance(TimeSpan by) => _offset += by;

    public void Pin(DateTimeOffset instant) => _pinned = instant;

    public void Reset()
    {
        _offset = TimeSpan.Zero;
        _pinned = null;
    }
}
