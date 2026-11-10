using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Http;

namespace DataControls.Api.Tests.Support;

/// <summary>
/// The real app with the engine replaced at its primary HTTP handler and the clock made movable. The
/// DbContext, the connection string, the request pipeline and the resilience pipeline are the production ones.
/// </summary>
public sealed class ApiFactory(IReadOnlyDictionary<string, string>? settings = null) : WebApplicationFactory<Program>
{
    /// <summary>
    /// The settings every test host starts from: no warm-up, a short attempt timeout so a timeout test
    /// takes half a second, and a circuit breaker that never opens (a test of the breaker lowers it).
    /// </summary>
    private static readonly IReadOnlyDictionary<string, string> _defaults = new Dictionary<string, string>
    {
        ["Glossary:WarmUpOnStart"] = "false",
        ["Engine:AttemptTimeout"] = "00:00:00.500",
        ["Engine:BreakerMinimumThroughput"] = "100000",
    };

    public EngineStub Engine { get; } = new();

    public TestClock Clock { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        foreach (var (key, value) in _defaults.Concat(settings ?? new Dictionary<string, string>()))
        {
            builder.UseSetting(key, value);
        }

        builder.ConfigureTestServices(services =>
        {
            services.ConfigureAll<HttpClientFactoryOptions>(options =>
                options.HttpMessageHandlerBuilderActions.Add(handler => handler.PrimaryHandler = Engine));
            services.RemoveAll<TimeProvider>();
            services.AddSingleton<TimeProvider>(Clock);
            services.AddControllers().AddApplicationPart(typeof(ProbeController).Assembly);
        });
    }
}
