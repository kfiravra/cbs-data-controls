namespace DataControls.Api.Hosting;

internal static class RawJson
{
    /// <summary>Answers 200 with JSON the api did not write: the engine's body, byte for byte.</summary>
    public static IResult Ok(byte[] body) => Results.Bytes(body, "application/json");
}
