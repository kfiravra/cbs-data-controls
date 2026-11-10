namespace DataControls.Api.Engine;

internal static class EngineModule
{
    private static readonly TimeSpan _minAttemptTimeout = TimeSpan.FromMilliseconds(100);
    private static readonly TimeSpan _maxAttemptTimeout = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan _minBreakDuration = TimeSpan.FromMilliseconds(500);

    public static IServiceCollection AddEngine(this IServiceCollection services)
    {
        services.AddOptions<EngineOptions>()
            .BindConfiguration(EngineOptions.Section)
            .Validate(
                options => Uri.TryCreate(options.BaseUrl, UriKind.Absolute, out var uri) && uri.Scheme is "http" or "https",
                "Engine:BaseUrl must be an absolute http or https URL.")
            .Validate(
                options => options.AttemptTimeout >= _minAttemptTimeout && options.AttemptTimeout <= _maxAttemptTimeout,
                "Engine:AttemptTimeout must be between 100 milliseconds and 10 minutes.")
            .Validate(options => options.BreakerMinimumThroughput >= 2, "Engine:BreakerMinimumThroughput must be at least 2.")
            .Validate(
                options => options.BreakerBreakDuration >= _minBreakDuration,
                "Engine:BreakerBreakDuration must be at least 500 milliseconds.")
            .ValidateOnStart();
        return services;
    }
}
