using Microsoft.Extensions.Http.Resilience;
using Microsoft.Extensions.Options;
using Polly;
using Polly.Timeout;

namespace DataControls.Api.Engine;

internal static class EngineModule
{
    private static readonly TimeSpan _minAttemptTimeout = TimeSpan.FromMilliseconds(100);
    private static readonly TimeSpan _maxAttemptTimeout = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan _minBreakDuration = TimeSpan.FromMilliseconds(500);
    private static readonly TimeSpan _minSamplingDuration = TimeSpan.FromMilliseconds(500);
    private static readonly TimeSpan _retryDelay = TimeSpan.FromMilliseconds(500);
    private static readonly TimeSpan _totalTimeoutMargin = TimeSpan.FromSeconds(5);

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

        services.AddTransient<EngineForwardingHandler>();
        services
            .AddHttpClient<EngineClient>((provider, client) =>
            {
                client.BaseAddress = new Uri(provider.GetRequiredService<IOptions<EngineOptions>>().Value.BaseUrl);
                // The resilience pipeline owns every time limit; the client's own 100 seconds would cut a long run.
                client.Timeout = Timeout.InfiniteTimeSpan;
            })
            .AddHttpMessageHandler<EngineForwardingHandler>()
            .AddStandardResilienceHandler()
            .Configure((resilience, provider) =>
                ConfigureResilience(resilience, provider.GetRequiredService<IOptions<EngineOptions>>().Value));
        return services;
    }

    private static void ConfigureResilience(HttpStandardResilienceOptions resilience, EngineOptions engine)
    {
        resilience.AttemptTimeout.Timeout = engine.AttemptTimeout;
        resilience.TotalRequestTimeout.Timeout = (engine.AttemptTimeout * 2) + _totalTimeoutMargin;

        // One retry, and only for a failure that came back fast. After an attempt timeout, a 504 or a 500
        // a second attempt would only double the wait for the same answer.
        resilience.Retry.MaxRetryAttempts = 1;
        resilience.Retry.Delay = _retryDelay;
        resilience.Retry.BackoffType = DelayBackoffType.Constant;
        resilience.Retry.UseJitter = false;
        resilience.Retry.ShouldRetryAfterHeader = false;
        resilience.Retry.ShouldHandle = arguments => ValueTask.FromResult(
            arguments.Outcome.Exception is HttpRequestException
            || (int?)arguments.Outcome.Result?.StatusCode is 408 or 429 or 502 or 503);

        // A 504 is one control's slow query, not an unhealthy engine, so it does not count. The library's
        // defaults need 100 calls in 30 seconds and would never open here.
        resilience.CircuitBreaker.MinimumThroughput = engine.BreakerMinimumThroughput;
        resilience.CircuitBreaker.FailureRatio = 0.5;
        resilience.CircuitBreaker.BreakDuration = engine.BreakerBreakDuration;
        var sampling = engine.AttemptTimeout * 2;
        resilience.CircuitBreaker.SamplingDuration = sampling > _minSamplingDuration ? sampling : _minSamplingDuration;
        resilience.CircuitBreaker.ShouldHandle = arguments => ValueTask.FromResult(
            arguments.Outcome.Exception is HttpRequestException or TimeoutRejectedException
            || (int?)arguments.Outcome.Result?.StatusCode is 502 or 503);
    }
}
