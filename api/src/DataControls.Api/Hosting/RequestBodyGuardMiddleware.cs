using System.Text.Json;
using System.Text.Unicode;
using DataControls.Api.Errors;
using Microsoft.Net.Http.Headers;

namespace DataControls.Api.Hosting;

/// <summary>
/// Refuses a body before anything binds it: 413 when it is over the limit, 400 <c>MALFORMED</c> at the
/// root when it is sent as JSON and the api cannot read it (the text does not parse, nests deeper than
/// the serializer allows, or holds a string that is not Unicode text). What reaches the binders is
/// readable, so a binder failure always means a member of the wrong type, which is answered per member.
/// A media type that is not JSON is not read here: MVC answers it 415.
/// </summary>
internal sealed class RequestBodyGuardMiddleware(RequestDelegate next)
{
    public const int MaxBodyBytes = 1024 * 1024;

    private const int ReadBufferBytes = 16 * 1024;
    private const string TextJson = "text/json";

    public async Task InvokeAsync(HttpContext context)
    {
        var request = context.Request;
        if (request.ContentLength > MaxBodyBytes)
        {
            throw ApiException.RequestRejected(StatusCodes.Status413PayloadTooLarge);
        }

        if (IsReadAsJson(request) && request.ContentLength != 0)
        {
            // Read once, into memory (the limit bounds it), and hand the same bytes to the binders.
            var body = await ReadAsync(request.Body, context.RequestAborted);
            context.Response.RegisterForDispose(body);
            if (body.Length > 0 && !IsReadableJson(body.GetBuffer().AsSpan(0, (int)body.Length)))
            {
                throw ApiException.RequestInvalid(path: string.Empty, RequestErrorCodes.Malformed);
            }

            request.Body = body;
        }

        await next(context);
    }

    /// <summary>
    /// Every media type MVC's JSON formatter reads: <c>application/json</c>, a <c>+json</c> suffix and
    /// <c>text/json</c>. A body the formatter would read and this guard did not is the gap to avoid.
    /// </summary>
    private static bool IsReadAsJson(HttpRequest request) =>
        request.HasJsonContentType()
        || (MediaTypeHeaderValue.TryParse(request.ContentType, out var mediaType)
            && mediaType.MediaType.Equals(TextJson, StringComparison.OrdinalIgnoreCase));

    /// <summary>Reads the body to its end; a length that was not declared is still held to the limit.</summary>
    private static async Task<MemoryStream> ReadAsync(Stream source, CancellationToken cancellationToken)
    {
        var body = new MemoryStream();
        var buffer = new byte[ReadBufferBytes];
        int read;
        while ((read = await source.ReadAsync(buffer, cancellationToken)) > 0)
        {
            body.Write(buffer, 0, read);
            if (body.Length > MaxBodyBytes)
            {
                await body.DisposeAsync();
                throw ApiException.RequestRejected(StatusCodes.Status413PayloadTooLarge);
            }
        }

        body.Position = 0;
        return body;
    }

    /// <summary>
    /// One JSON value, no deeper than the serializer reads, in which every string and member name is text.
    /// System.Text.Json takes a string that holds half a surrogate pair, or bytes that are not UTF-8, as a
    /// token and fails only when the text is asked for: without this check that is a 500 from wherever
    /// the string is first read.
    /// </summary>
    private static bool IsReadableJson(ReadOnlySpan<byte> text)
    {
        var reader = new Utf8JsonReader(text, new JsonReaderOptions { MaxDepth = JsonDefaults.MaxDepth });
        try
        {
            while (reader.Read())
            {
                if (reader.TokenType is JsonTokenType.String or JsonTokenType.PropertyName && !IsText(ref reader))
                {
                    return false;
                }
            }

            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static bool IsText(ref Utf8JsonReader reader)
    {
        if (!reader.ValueIsEscaped)
        {
            return Utf8.IsValid(reader.ValueSpan);
        }

        try
        {
            // Only a string with an escape pays for a copy; unescaping is where a lone surrogate shows.
            _ = reader.GetString();
            return true;
        }
        catch (InvalidOperationException)
        {
            return false;
        }
    }
}
