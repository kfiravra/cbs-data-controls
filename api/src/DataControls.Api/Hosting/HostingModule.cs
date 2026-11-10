using Microsoft.Extensions.DependencyInjection.Extensions;

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
        return services;
    }
}
