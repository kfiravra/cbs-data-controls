namespace DataControls.Api.Tests.Support;

/// <summary>
/// One host and one sweep for every test that goes through the api. The tests of the collection run one
/// at a time, so they share the database and the engine stub without stepping on each other.
/// </summary>
public sealed class ApiFixture : IAsyncLifetime
{
    public ApiFactory Factory { get; } = new();

    public async Task InitializeAsync()
    {
        await TestData.EnsureDatabaseAsync(Factory.Services);
        await TestData.SweepAsync(Factory.Services);
    }

    public async Task DisposeAsync()
    {
        await TestData.SweepAsync(Factory.Services);
        await Factory.DisposeAsync();
    }
}
