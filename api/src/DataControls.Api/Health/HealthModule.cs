namespace DataControls.Api.Health;

internal static class HealthModule
{
    public static IServiceCollection AddHealth(this IServiceCollection services) => services.AddScoped<HealthService>();
}
