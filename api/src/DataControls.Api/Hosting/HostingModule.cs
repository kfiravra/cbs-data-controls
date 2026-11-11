using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using Microsoft.Net.Http.Headers;

namespace DataControls.Api.Hosting;

internal static class HostingModule
{
    public static IServiceCollection AddRequestPipeline(this IServiceCollection services)
    {
        services.AddHttpContextAccessor();
        services.TryAddSingleton(TimeProvider.System);
        services.AddSingleton<UtcClock>();
        services.AddSingleton<SupportedLanguages>();
        services.AddSingleton<RequestContextAccessor>();
        services.AddHostedService<StartupProbe>();

        services.AddControllers().AddJsonOptions(options => JsonDefaults.Apply(options.JsonSerializerOptions));
        services.ConfigureHttpJsonOptions(options => JsonDefaults.Apply(options.SerializerOptions));

        services.AddOptions<CorsSettings>()
            .BindConfiguration(CorsSettings.Section)
            .Validate(
                settings => settings.AllowedOrigins.All(CorsSettings.IsOrigin),
                "Cors:AllowedOrigins takes absolute origins such as http://localhost:4200, without a path and never *.")
            .ValidateOnStart();

        // The policy is built from the validated settings when it is first needed. With no origin
        // configured it allows none, which is the default: ng serve proxies /api.
        services.AddCors();
        services.AddOptions<CorsOptions>().Configure<IOptions<CorsSettings>>((cors, settings) =>
            cors.AddDefaultPolicy(policy => policy
                .WithOrigins(settings.Value.AllowedOrigins)
                .AllowAnyHeader()
                .AllowAnyMethod()
                .WithExposedHeaders(CorrelationId.HeaderName, HeaderNames.Location)));
        return services;
    }
}
