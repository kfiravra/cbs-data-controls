namespace DataControls.Api.Hosting;

public sealed class UtcClock(TimeProvider time)
{
    /// <summary>
    /// Now in UTC, cut to the millisecond that a <c>datetime2(3)</c> column keeps, so a timestamp in a
    /// response equals the one a later read returns.
    /// </summary>
    public DateTime Now
    {
        get
        {
            var now = time.GetUtcNow().UtcDateTime;
            return new DateTime(now.Ticks - (now.Ticks % TimeSpan.TicksPerMillisecond), DateTimeKind.Utc);
        }
    }
}
