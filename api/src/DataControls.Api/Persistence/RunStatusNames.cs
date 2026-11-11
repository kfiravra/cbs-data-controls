namespace DataControls.Api.Persistence;

/// <summary>The four strings the <c>status</c> column accepts (its CHECK constraint).</summary>
internal static class RunStatusNames
{
    public static string ToName(RunStatus status) => status switch
    {
        RunStatus.Running => "running",
        RunStatus.Succeeded => "succeeded",
        RunStatus.Failed => "failed",
        RunStatus.TimedOut => "timed_out",
        _ => throw new ArgumentOutOfRangeException(nameof(status), status, null),
    };

    public static RunStatus Parse(string name) => name switch
    {
        "running" => RunStatus.Running,
        "succeeded" => RunStatus.Succeeded,
        "failed" => RunStatus.Failed,
        "timed_out" => RunStatus.TimedOut,
        _ => throw new ArgumentOutOfRangeException(nameof(name), name, null),
    };
}
