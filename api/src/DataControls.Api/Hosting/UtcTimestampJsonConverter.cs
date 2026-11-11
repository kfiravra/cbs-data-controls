using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace DataControls.Api.Hosting;

/// <summary>
/// Writes a timestamp as UTC with <c>Z</c> and exactly three fraction digits. The default converter drops
/// trailing zeros, so the same instant would be written in three different lengths.
/// </summary>
internal sealed class UtcTimestampJsonConverter : JsonConverter<DateTime>
{
    private const string Format = "yyyy-MM-dd'T'HH:mm:ss.fff'Z'";

    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        reader.GetDateTime().ToUniversalTime();

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
    {
        var utc = value.Kind == DateTimeKind.Local ? value.ToUniversalTime() : value;
        writer.WriteStringValue(utc.ToString(Format, CultureInfo.InvariantCulture));
    }
}
