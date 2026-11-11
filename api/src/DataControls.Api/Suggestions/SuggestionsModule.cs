namespace DataControls.Api.Suggestions;

internal static class SuggestionsModule
{
    public static IServiceCollection AddSuggestions(this IServiceCollection services) =>
        services.AddScoped<SuggestionService>();
}
