using System.Globalization;
using System.Net.Http.Headers;
using System.Text.Json;
using DataControls.Api.Hosting;
using Microsoft.Extensions.Options;
using Polly;

namespace DataControls.Api.Engine;

/// <summary>
/// The api's one way to the engine. It returns the engine's JSON as received where the api only passes
/// it on, and typed members only for what the api reads. Every failure is an <see cref="EngineException"/>.
/// </summary>
public sealed class EngineClient(HttpClient http, IOptions<EngineOptions> options)
{
    private static readonly MediaTypeHeaderValue _json = new("application/json");
    private static readonly HttpRequestOptionsKey<bool> _probe = new("DataControls.EngineProbe");

    /// <summary>
    /// Asks the engine whether it is well. The call is a probe: the resilience pipeline neither retries
    /// it nor counts it, so asking about health never changes it.
    /// </summary>
    public Task<byte[]> GetHealthAsync(CancellationToken cancellationToken) =>
        SendAsync(HttpMethod.Get, "/health", null, cancellationToken, probe: true);

    public async Task<EngineGlossary> GetGlossaryAsync(CancellationToken cancellationToken) =>
        EngineGlossary.Parse(await SendAsync(HttpMethod.Get, "/glossary", null, cancellationToken));

    /// <summary>The engine's <c>/validate</c> body: <c>{ valid, sentence, sentenceParts, conditions }</c>.</summary>
    public Task<byte[]> ValidateAsync(JsonElement definition, CancellationToken cancellationToken) =>
        SendAsync(HttpMethod.Post, "/validate", Body(writer => WriteDefinition(writer, definition)), cancellationToken);

    /// <summary>
    /// Runs a definition. The date and the cap are always sent: the api decides the date, because the run
    /// row needs it before the engine answers.
    /// </summary>
    public async Task<EngineRunAnswer> RunAsync(JsonElement definition, DateOnly runDate, int rowCap, CancellationToken cancellationToken)
    {
        var body = Body(writer =>
        {
            WriteDefinition(writer, definition);
            writer.WriteString("runDate", runDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
            writer.WriteNumber("rowCap", rowCap);
        });
        return EngineRunAnswer.Parse(await SendAsync(HttpMethod.Post, "/run", body, cancellationToken));
    }

    /// <summary>
    /// The engine's <c>/suggest</c> body. Exactly the two members the contract names are sent, and one
    /// that was not given is left out: the engine refuses a member it does not know.
    /// </summary>
    public Task<byte[]> SuggestAsync(string? rootEntity, int? max, CancellationToken cancellationToken)
    {
        var body = Body(writer =>
        {
            if (rootEntity is not null)
            {
                writer.WriteString("rootEntity", rootEntity);
            }

            if (max is not null)
            {
                writer.WriteNumber("max", max.Value);
            }
        });
        return SendAsync(HttpMethod.Post, "/suggest", body, cancellationToken);
    }

    internal static bool IsProbe(HttpRequestMessage? request) =>
        request is not null && request.Options.TryGetValue(_probe, out var probe) && probe;

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

    private async Task<byte[]> SendAsync(HttpMethod method, string path, byte[]? body, CancellationToken cancellationToken, bool probe = false)
    {
        using var request = new HttpRequestMessage(method, path);
        request.Options.Set(_probe, probe);
        if (body is not null)
        {
            request.Content = new ByteArrayContent(body);
            request.Content.Headers.ContentType = _json;
        }

        // The pipeline's time limits end when the headers arrive, so the body gets a limit of its own:
        // one more attempt timeout. Without it a body that stalls would wait for the caller for ever.
        using var bodyTimeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        try
        {
            using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            bodyTimeout.CancelAfter(options.Value.AttemptTimeout);
            var answer = await response.Content.ReadAsByteArrayAsync(bodyTimeout.Token);
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
        catch (OperationCanceledException exception) when (bodyTimeout.IsCancellationRequested && !cancellationToken.IsCancellationRequested)
        {
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
