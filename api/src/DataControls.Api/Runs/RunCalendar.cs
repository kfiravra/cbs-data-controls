using Microsoft.Extensions.Options;

namespace DataControls.Api.Runs;

/// <summary>Decides the date of a run that names none: today in the configured zone, resolved once.</summary>
public sealed class RunCalendar(TimeProvider time, IOptions<RunsOptions> options)
{
    private readonly TimeZoneInfo _zone = RunTimeZone.TryResolve(options.Value.TimeZone, out var zone)
        ? zone
        : throw new InvalidOperationException("Runs:TimeZone does not name a time zone this machine knows.");

    public DateOnly Today => DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(time.GetUtcNow(), _zone).DateTime);
}
