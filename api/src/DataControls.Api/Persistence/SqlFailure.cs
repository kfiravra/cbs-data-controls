using Microsoft.Data.SqlClient;

namespace DataControls.Api.Persistence;

internal static class SqlFailure
{
    // Severity 20 and above ends the connection. Below it, these numbers say the server was not reached
    // or would not let the login in: timeouts (-2, 258), network errors (-1, 2, 53, 64, 233, 10053, 10054,
    // 10060, 10061, 11001), a database that cannot be opened (4060) and a refused login (18456).
    private const int FatalSeverity = 20;

    private static readonly HashSet<int> _connectionNumbers =
        [-2, -1, 2, 53, 64, 233, 258, 4060, 10053, 10054, 10060, 10061, 11001, 18456];

    // A primary key or a unique index refused a second row with the same key.
    private static readonly HashSet<int> _duplicateKeyNumbers = [2601, 2627];

    /// <summary>True when a row was refused because its key already exists.</summary>
    public static bool IsDuplicateKey(Exception exception) =>
        Find(exception) is { } sql && _duplicateKeyNumbers.Contains(sql.Number);

    /// <summary>True when the failure is the database not answering, not a statement it refused.</summary>
    public static bool IsConnectionLevel(Exception exception) =>
        Find(exception) is { } sql && (sql.Class >= FatalSeverity || _connectionNumbers.Contains(sql.Number));

    private static SqlException? Find(Exception exception)
    {
        for (var current = exception; current is not null; current = current.InnerException)
        {
            if (current is SqlException sql)
            {
                return sql;
            }
        }

        return null;
    }
}
