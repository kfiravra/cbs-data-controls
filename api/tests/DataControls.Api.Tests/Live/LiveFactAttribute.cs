namespace DataControls.Api.Tests.Live;

/// <summary>
/// A test against the real engine. It runs only when <c>DC_LIVE=1</c>, because it needs the engine
/// answering at <c>Engine:BaseUrl</c> with the seeded database behind it.
/// </summary>
public sealed class LiveFactAttribute : FactAttribute
{
    public const string Variable = "DC_LIVE";

    public LiveFactAttribute()
    {
        if (Environment.GetEnvironmentVariable(Variable) != "1")
        {
            Skip = $"Set {Variable}=1 with the engine running to include the live tests.";
        }
    }
}
