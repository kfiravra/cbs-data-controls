using System.Text.Json;
using DataControls.Api.Errors;

namespace DataControls.Api.Hosting;

/// <summary>
/// Refuses a body before anything binds it: 413 when it is over the limit, 415 when it is sent as JSON
/// and its text is not JSON. What reaches the binders is well-formed, so a binder failure always means a
/// member of the wrong type, which is answered per member.
/// </summary>
internal sealed class RequestBodyGuardMiddleware(RequestDelegate next)
{
    public const int MaxBodyBytes = 1024 * 1024;

    private const int ReadBufferBytes = 16 * 1024;

    public async Task InvokeAsync(HttpContext context)
    {
        var request = context.Request;
        if (request.ContentLength > MaxBodyBytes)
        {
            throw ApiException.RequestRejected(StatusCodes.Status413PayloadTooLarge);
        }

        if (request.HasJsonContentType() && request.ContentLength != 0)
        {
            // Read once, into memory (the limit bounds it), and hand the same bytes to the binders.
            var body = await ReadAsync(request.Body, context.RequestAborted);
            context.Response.RegisterForDispose(body);
            if (body.Length > 0 && !IsJson(body.GetBuffer().AsMemory(0, (int)body.Length)))
            {
                throw ApiException.RequestRejected(StatusCodes.Status415UnsupportedMediaType);
            }

            request.Body = body;
        }

        await next(context);
    }

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

    private static bool IsJson(ReadOnlyMemory<byte> text)
    {
        try
        {
            using var document = JsonDocument.Parse(text, new JsonDocumentOptions { MaxDepth = JsonDefaults.MaxDepth });
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }
}
