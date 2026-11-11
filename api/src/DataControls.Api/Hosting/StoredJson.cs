using System.Runtime.InteropServices;
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

    /// <summary>
    /// The element's own text without the layout between its tokens. Member order, numbers and the
    /// spelling of every string stay as they were sent, so the result is never longer than the text it
    /// came from: a writer would spell <c>+</c>, <c>&lt;</c> or an emoji as escapes, and a definition
    /// that fitted the engine's body limit when it was validated could pass it when it is run.
    /// </summary>
    public static string Minify(JsonElement element)
    {
        var text = JsonMarshal.GetRawUtf8Value(element);
        var compact = new byte[text.Length];
        var length = 0;
        var inString = false;
        for (var index = 0; index < text.Length; index++)
        {
            var current = text[index];
            if (inString)
            {
                compact[length++] = current;
                if (current == (byte)'\\')
                {
                    // The escaped character is copied with its backslash, so an escaped quote ends nothing.
                    compact[length++] = text[++index];
                }
                else if (current == (byte)'"')
                {
                    inString = false;
                }
            }
            else if (current is not ((byte)' ' or (byte)'\t' or (byte)'\n' or (byte)'\r'))
            {
                compact[length++] = current;
                inString = current == (byte)'"';
            }
        }

        return Encoding.UTF8.GetString(compact, 0, length);
    }

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
