using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Http;

namespace DataControls.Api.Tests.Support;

/// <summary>
/// The real app with only the engine replaced, at its primary HTTP handler. The DbContext, the connection
/// string and the request pipeline are the production ones.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    public EngineStub Engine { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("Glossary:WarmUpOnStart", "false");
        builder.ConfigureTestServices(services =>
        {
            services.ConfigureAll<HttpClientFactoryOptions>(options =>
                options.HttpMessageHandlerBuilderActions.Add(handler => handler.PrimaryHandler = Engine));
            services.AddControllers().AddApplicationPart(typeof(ProbeController).Assembly);
        });
    }
}
