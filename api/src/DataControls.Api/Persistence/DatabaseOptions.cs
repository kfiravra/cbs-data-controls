using Microsoft.Data.SqlClient;

namespace DataControls.Api.Persistence;

/// <summary>
/// Where the <c>dq</c> store is. The connection string is built from the database block of <c>.env</c>
/// (<c>DB_HOST</c>, <c>DB_PORT</c>, <c>DQ_APP_PASSWORD</c>), so the password lives in one place, unless
/// <c>ConnectionStrings:Dq</c> replaces it whole (a named instance has no port).
/// </summary>
public sealed class DatabaseOptions
{
    public const string HostKey = "DB_HOST";
    public const string PortKey = "DB_PORT";
    public const string PasswordKey = "DQ_APP_PASSWORD";
    public const string ConnectionStringName = "Dq";

    private const string DatabaseName = "DataControls";
    private const string Login = "dq_app";

    public string? ConnectionString { get; set; }

    public string Host { get; set; } = "localhost";

    public string Port { get; set; } = "1433";

    public string? Password { get; set; }

    internal bool HasValidPort => int.TryParse(Port, out var port) && port is > 0 and <= 65535;

    internal bool HasCredentials => !string.IsNullOrWhiteSpace(ConnectionString) || !string.IsNullOrEmpty(Password);

    internal string Resolve()
    {
        if (!string.IsNullOrWhiteSpace(ConnectionString))
        {
            return ConnectionString;
        }

        // SqlClient encrypts by default and the container's certificate is self-signed.
        return new SqlConnectionStringBuilder
        {
            DataSource = $"tcp:{Host},{Port}",
            InitialCatalog = DatabaseName,
            UserID = Login,
            Password = Password,
            Encrypt = true,
            TrustServerCertificate = true,
        }.ConnectionString;
    }
}
