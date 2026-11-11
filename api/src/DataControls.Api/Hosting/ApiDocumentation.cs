namespace DataControls.Api.Hosting;

/// <summary>The OpenAPI document at <c>/openapi/v1.json</c> and Swagger UI over it at <c>/api/docs</c>, in every environment.</summary>
internal static class ApiDocumentation
{
    public const string DocumentPath = "/openapi/v1.json";
    public const string UiPrefix = "api/docs";

    private const string Title = "Data Controls API";
    private const string Version = "v1";

    public static IServiceCollection AddApiDocumentation(this IServiceCollection services) =>
        services.AddOpenApi(options => options.AddDocumentTransformer((document, _, _) =>
        {
            document.Info.Title = Title;
            document.Info.Version = Version;
            document.Info.Description = "Data-quality controls: definitions, runs and their stored results. Errors are problems with a code and params; contracts/api.md and contracts/errors.md are the contract.";
            return Task.CompletedTask;
        }));

    public static void MapApiDocumentation(this WebApplication app)
    {
        app.MapOpenApi();
        app.UseSwaggerUI(options =>
        {
            options.RoutePrefix = UiPrefix;
            options.SwaggerEndpoint(DocumentPath, $"{Title} {Version}");
        });
    }
}
