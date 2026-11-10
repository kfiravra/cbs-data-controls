using DataControls.Api.Engine;
using DataControls.Api.Hosting;
using DataControls.Api.Persistence;
using DataControls.Api.Runs;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace DataControls.Api.Tests.Hosting;

public sealed class ConfigurationTests
{
    [Fact]
    public void Connection_string_is_built_from_the_database_block_when_no_override_is_set()
    {
        var options = Options<DatabaseOptions>(
            services => services.AddPersistence(),
            ("DB_HOST", "db"), ("DB_PORT", "14330"), ("DQ_APP_PASSWORD", "Secret123"));

        var resolved = options.Value.Resolve();

        Assert.Contains("Data Source=tcp:db,14330", resolved);
        Assert.Contains("Initial Catalog=DataControls", resolved);
        Assert.Contains("User ID=dq_app", resolved);
        Assert.Contains("Password=Secret123", resolved);
    }

    [Fact]
    public void Connection_string_override_replaces_the_built_one_and_needs_no_password()
    {
        const string named = @"Server=.\SQLEXPRESS;Database=DataControls;User ID=dq_app;Password=x";
        var options = Options<DatabaseOptions>(services => services.AddPersistence(), ("ConnectionStrings:Dq", named));

        Assert.Equal(named, options.Value.Resolve());
    }

    [Fact]
    public void Start_fails_naming_the_variable_and_the_env_file_when_the_password_is_missing()
    {
        var options = Options<DatabaseOptions>(services => services.AddPersistence());

        var failure = Assert.Throws<OptionsValidationException>(() => options.Value);

        Assert.Contains("DQ_APP_PASSWORD", failure.Message);
        Assert.Contains(".env", failure.Message);
    }

    [Theory]
    [InlineData("Engine:BaseUrl", "localhost:8000")]
    [InlineData("Engine:BaseUrl", "ftp://engine")]
    [InlineData("Engine:AttemptTimeout", "00:00:00.050")]
    [InlineData("Engine:AttemptTimeout", "00:11:00")]
    [InlineData("Engine:BreakerMinimumThroughput", "1")]
    [InlineData("Engine:BreakerBreakDuration", "00:00:00.100")]
    public void Engine_setting_fails_validation_when_it_is_outside_its_bounds(string key, string value)
    {
        var options = Options<EngineOptions>(services => services.AddEngine(), (key, value));

        var failure = Assert.Throws<OptionsValidationException>(() => options.Value);

        Assert.Contains(key, failure.Message);
    }

    [Theory]
    [InlineData("Runs:RowCap", "0")]
    [InlineData("Runs:RowCap", "100001")]
    [InlineData("Runs:TimeZone", "Mars/Olympus")]
    [InlineData("Runs:DefaultLanguage", "Hebrew")]
    public void Runs_setting_fails_validation_when_it_is_outside_its_bounds(string key, string value)
    {
        var options = Options<RunsOptions>(services => services.AddRuns(), (key, value));

        var failure = Assert.Throws<OptionsValidationException>(() => options.Value);

        Assert.Contains(key, failure.Message);
    }

    [Theory]
    [InlineData("*")]
    [InlineData("http://localhost:4200/app")]
    [InlineData("localhost:4200")]
    public void Cors_origin_fails_validation_when_it_is_a_wildcard_or_not_an_origin(string origin)
    {
        var options = Options<CorsSettings>(services => services.AddRequestPipeline(), ("Cors:AllowedOrigins:0", origin));

        Assert.Throws<OptionsValidationException>(() => options.Value);
    }

    [Fact]
    public void Defaults_pass_validation()
    {
        Assert.Equal("http://localhost:8000", Options<EngineOptions>(services => services.AddEngine()).Value.BaseUrl);
        Assert.Equal(5000, Options<RunsOptions>(services => services.AddRuns()).Value.RowCap);
        Assert.Empty(Options<CorsSettings>(services => services.AddRequestPipeline()).Value.AllowedOrigins);
    }

    private static IOptions<T> Options<T>(Action<IServiceCollection> register, params (string Key, string Value)[] settings)
        where T : class
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(settings.Select(setting => KeyValuePair.Create(setting.Key, (string?)setting.Value)))
            .Build();
        var services = new ServiceCollection();
        services.AddSingleton<IConfiguration>(configuration);
        register(services);
        return services.BuildServiceProvider().GetRequiredService<IOptions<T>>();
    }
}
