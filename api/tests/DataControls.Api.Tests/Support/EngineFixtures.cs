using System.Text;

namespace DataControls.Api.Tests.Support;

/// <summary>
/// Canned engine answers, shaped by <c>contracts/api.md</c>: the run answer and the 422 problem are the
/// contract's own examples, and the glossary is <c>contracts/glossary.json</c> made public by the rules of
/// <c>GET /glossary</c>.
/// </summary>
internal static class EngineFixtures
{
    private static readonly string _root = Path.Combine(AppContext.BaseDirectory, "Fixtures", "engine");

    public static string Read(string name) => File.ReadAllText(Path.Combine(_root, name), Encoding.UTF8);

    public static byte[] ReadBytes(string name) => Encoding.UTF8.GetBytes(Read(name));

    /// <summary>An engine problem with a code, its status and params, and optionally definition errors.</summary>
    public static string Problem(string code, int status, string parameters = "{}", string? errors = null)
    {
        var errorsMember = errors is null ? string.Empty : $",\"errors\":{errors}";
        return $"{{\"type\":\"about:blank\",\"title\":\"{code}\",\"status\":{status},\"code\":\"{code}\",\"params\":{parameters}{errorsMember},\"correlationId\":\"engine-stub\"}}";
    }
}
