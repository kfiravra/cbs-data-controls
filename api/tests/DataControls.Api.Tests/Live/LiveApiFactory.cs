using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace DataControls.Api.Tests.Live;

/// <summary>The app with nothing replaced: its engine client calls the engine at <c>Engine:BaseUrl</c>.</summary>
public sealed class LiveApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder) => builder.UseSetting("Glossary:WarmUpOnStart", "false");
}
