namespace DataControls.Api.Runs;

public sealed class RunsOptions
{
    public const string Section = "Runs";

    /// <summary>The most violations a run stores; the engine is asked for no more.</summary>
    public int RowCap { get; set; } = 5000;

    /// <summary>The zone in which "today" is decided when a run names no date.</summary>
    public string TimeZone { get; set; } = RunTimeZone.DefaultId;

    /// <summary>Stands in for the glossary's default language until the glossary has been read.</summary>
    public string DefaultLanguage { get; set; } = "he";
}
