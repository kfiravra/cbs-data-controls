namespace DataControls.Api.Controls;

internal static class ControlsModule
{
    public static IServiceCollection AddControls(this IServiceCollection services)
    {
        services.AddSingleton<IDefinitionSchemaValidator, DefinitionSchemaValidator>();
        services.AddScoped<DefinitionChecker>();
        return services;
    }
}
