using Microsoft.Extensions.Configuration.EnvironmentVariables;

namespace DataControls.Api.Hosting;

internal sealed class DotEnvConfigurationSource(string startDirectory) : IConfigurationSource
{
    public IConfigurationProvider Build(IConfigurationBuilder builder) => new DotEnvConfigurationProvider(startDirectory);
}

internal static class DotEnvConfigurationExtensions
{
    /// <summary>
    /// Adds the <c>.env</c> source in Development only, below the environment variables: a variable that is
    /// really set still wins. Outside Development the source does not exist.
    /// </summary>
    public static void AddDevelopmentDotEnv(this ConfigurationManager configuration, IHostEnvironment environment)
    {
        if (!environment.IsDevelopment())
        {
            return;
        }

        var sources = configuration.Sources;
        var source = new DotEnvConfigurationSource(environment.ContentRootPath);
        for (var index = sources.Count - 1; index >= 0; index--)
        {
            if (sources[index] is EnvironmentVariablesConfigurationSource { Prefix: null or "" })
            {
                sources.Insert(index, source);
                return;
            }
        }

        sources.Add(source);
    }
}
