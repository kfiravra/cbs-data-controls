using System.Text;
using System.Text.Json;

namespace DataControls.Api.Hosting;

/// <summary>JSON kept as text in a <c>dq</c> column, on its way in and out.</summary>
internal static class StoredJson
{
    /// <summary>The text as an element a response can carry; the document is not held open.</summary>
    public static JsonElement Parse(string json)
    {
        using var document = JsonDocument.Parse(json);
        return document.RootElement.Clone();
    }

    /// <summary>Compact text in the order the members were sent, with Hebrew written as it is.</summary>
    public static string Minify(JsonElement element) => Write(element.WriteTo);

    public static string Write(Action<Utf8JsonWriter> write)
    {
        using var buffer = new MemoryStream();
        using (var writer = new Utf8JsonWriter(buffer, JsonDefaults.WriterOptions))
        {
            write(writer);
        }

        return Encoding.UTF8.GetString(buffer.GetBuffer(), 0, (int)buffer.Length);
    }
}
