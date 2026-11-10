using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Unicode;

namespace DataControls.Api.Hosting;

/// <summary>The one JSON configuration: controllers, problems and the JSON columns of <c>dq</c> share it.</summary>
internal static class JsonDefaults
{
    /// <summary>Leaves Hebrew as it is; the default encoder writes every non-ASCII letter as \uXXXX.</summary>
    public static JavaScriptEncoder Encoder { get; } = JavaScriptEncoder.Create(UnicodeRanges.All);

    public static JsonWriterOptions WriterOptions { get; } = new() { Encoder = Encoder };

    public static JsonSerializerOptions Options { get; } = Create();

    public static void Apply(JsonSerializerOptions options)
    {
        options.Encoder = Encoder;
        options.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        // The contract's member names are exact and a number is never a string: the web defaults
        // would accept "Name" for "name" and "5" for 5.
        options.PropertyNameCaseInsensitive = false;
        options.NumberHandling = JsonNumberHandling.Strict;
        options.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower, allowIntegerValues: false));
        options.Converters.Add(new UtcTimestampJsonConverter());
    }

    private static JsonSerializerOptions Create()
    {
        var options = new JsonSerializerOptions();
        Apply(options);
        return options;
    }
}
