using Microsoft.AspNetCore.Mvc;

namespace DataControls.Api.Errors;

internal static class ErrorsModule
{
    public static IServiceCollection AddApiErrors(this IServiceCollection services)
    {
        services.AddSingleton<ProblemWriter>();
        services.AddExceptionHandler<ApiExceptionHandler>();
        // Every rule of a request has a code of its own and is checked by RequestCheck. MVC's implicit
        // [Required] on non-nullable members would report the same fault first, as an English sentence
        // under the member's C# name.
        services.Configure<MvcOptions>(options => options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true);
        services.Configure<ApiBehaviorOptions>(options =>
        {
            options.InvalidModelStateResponseFactory = context =>
                new ProblemResult(ApiException.RequestInvalid(ModelStateErrors.From(context.ModelState)));
            // MVC would turn a bare 415 or 404 into its own problem document; the status-code pages
            // write ours instead.
            options.SuppressMapClientErrors = true;
        });
        return services;
    }

    /// <summary>
    /// An unknown path under <c>/api</c>, and a known one asked with a method it does not serve, are a 404
    /// problem. Mapped ahead of the fallback to <c>index.html</c>, which would answer them with the client's page.
    /// </summary>
    public static void MapApiNotFound(this IEndpointRouteBuilder endpoints) =>
        endpoints
            .Map("/api/{**rest}", (HttpContext context, ProblemWriter writer) =>
                writer.WriteAsync(context, ApiException.NotFound(), context.RequestAborted))
            .ExcludeFromDescription();
}
