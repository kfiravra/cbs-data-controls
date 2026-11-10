using System.Net.Http.Headers;
using System.Text.Json;
using DataControls.Api.Hosting;
using Polly;

namespace DataControls.Api.Engine;

/// <summary>
/// The api's one way to the engine. It returns the engine's JSON as received where the api only passes
/// it on, and typed members only for what the api reads. Every failure is an <see cref="EngineException"/>.
/// </summary>
public sealed class EngineClient(HttpClient http)
{
    private static readonly MediaTypeHeaderValue _json = new("application/json");

    public Task<byte[]> GetHealthAsync(CancellationToken cancellationToken) =>
        SendAsync(HttpMethod.Get, "/health", null, cancellationToken);

    public async Task<EngineGlossary> GetGlossaryAsync(CancellationToken cancellationToken) =>
        EngineGlossary.Parse(await SendAsync(HttpMethod.Get, "/glossary", null, cancellationToken));

    /// <summary>The engine's <c>/validate</c> body: <c>{ valid, sentence, sentenceParts, conditions }</c>.</summary>
    public Task<byte[]> ValidateAsync(JsonElement definition, CancellationToken cancellationToken) =>
        SendAsync(HttpMethod.Post, "/validate", Body(writer => WriteDefinition(writer, definition)), cancellationToken);

    private static void WriteDefinition(Utf8JsonWriter writer, JsonElement definition)
    {
        writer.WritePropertyName("definition");
        definition.WriteTo(writer);
    }

    private static byte[] Body(Action<Utf8JsonWriter> writeMembers)
    {
        using var buffer = new MemoryStream();
        using (var writer = new Utf8JsonWriter(buffer, JsonDefaults.WriterOptions))
        {
            writer.WriteStartObject();
            writeMembers(writer);
            writer.WriteEndObject();
        }

        return buffer.ToArray();
    }

    private async Task<byte[]> SendAsync(HttpMethod method, string path, byte[]? body, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(method, path);
        if (body is not null)
        {
            request.Content = new ByteArrayContent(body);
            request.Content.Headers.ContentType = _json;
        }

        try
        {
            using var response = await http.SendAsync(request, cancellationToken);
            var answer = await response.Content.ReadAsByteArrayAsync(cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                throw EngineException.FromResponse((int)response.StatusCode, answer);
            }

            return IsJsonObject(answer) ? answer : throw EngineException.Unexpected("a success without a JSON object");
        }
        catch (Exception exception) when (exception is HttpRequestException or ExecutionRejectedException or IOException)
        {
            // Not reachable, an attempt that timed out, or an open circuit: all are "the engine did not answer".
            throw EngineException.Unavailable(exception);
        }
    }

    private static bool IsJsonObject(byte[] body)
    {
        try
        {
            using var document = JsonDocument.Parse(body);
            return document.RootElement.ValueKind == JsonValueKind.Object;
        }
        catch (JsonException)
        {
            return false;
        }
    }
}
