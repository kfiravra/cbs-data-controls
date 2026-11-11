namespace DataControls.Api.Glossary;

public sealed class GlossaryOptions
{
    public const string Section = "Glossary";

    /// <summary>How long a fetched glossary is served before the engine is asked again.</summary>
    public int CacheMinutes { get; set; } = 10;

    /// <summary>Whether the glossary is fetched once at startup; a failure there never stops the host.</summary>
    public bool WarmUpOnStart { get; set; } = true;
}
