namespace DataControls.Api.Glossary;

internal static class GlossaryModule
{
    public static IServiceCollection AddGlossary(this IServiceCollection services)
    {
        services.AddOptions<GlossaryOptions>()
            .BindConfiguration(GlossaryOptions.Section)
            .Validate(options => options.CacheMinutes >= 0, "Glossary:CacheMinutes must not be negative.")
            .ValidateOnStart();
        services.AddSingleton<GlossaryCache>();
        services.AddScoped<GlossaryService>();
        return services;
    }
}
