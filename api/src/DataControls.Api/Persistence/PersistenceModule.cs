using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DataControls.Api.Persistence;

internal static class PersistenceModule
{
    public static IServiceCollection AddPersistence(this IServiceCollection services)
    {
        services.AddOptions<DatabaseOptions>()
            .Configure<IConfiguration>((options, configuration) =>
            {
                options.ConnectionString = configuration.GetConnectionString(DatabaseOptions.ConnectionStringName);
                options.Host = configuration[DatabaseOptions.HostKey] ?? options.Host;
                options.Port = configuration[DatabaseOptions.PortKey] ?? options.Port;
                options.Password = configuration[DatabaseOptions.PasswordKey];
            })
            .Validate(
                options => options.HasCredentials,
                $"The password of the dq_app login is missing: set {DatabaseOptions.PasswordKey} in the environment or in the repository's .env (a new worktree has no .env), or set ConnectionStrings__{DatabaseOptions.ConnectionStringName}.")
            .Validate(
                options => options.HasValidPort,
                $"{DatabaseOptions.PortKey} must be a port number between 1 and 65535.")
            .ValidateOnStart();

        services.AddDbContext<DqDbContext>((provider, options) =>
            options.UseSqlServer(provider.GetRequiredService<IOptions<DatabaseOptions>>().Value.Resolve()));
        return services;
    }
}
