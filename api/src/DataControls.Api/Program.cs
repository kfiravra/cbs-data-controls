using DataControls.Api.Engine;
using DataControls.Api.Errors;
using DataControls.Api.Glossary;
using DataControls.Api.Health;
using DataControls.Api.Hosting;
using DataControls.Api.Persistence;
using DataControls.Api.Runs;

// The content root is the app's own folder, not the working directory: a script that starts the
// published app from elsewhere still finds the appsettings.json and the wwwroot beside it.
var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = AppContext.BaseDirectory,
});

builder.Configuration.AddDevelopmentDotEnv(builder.Environment);
// Set in code, so statements stay out of Information logs whatever settings file is deployed.
builder.Logging.AddFilter("Microsoft.EntityFrameworkCore.Database.Command", LogLevel.Warning);
builder.WebHost.ConfigureKestrel(kestrel => kestrel.Limits.MaxRequestBodySize = RequestBodyLimitMiddleware.MaxBodyBytes);

builder.Services
    .AddRequestPipeline()
    .AddApiErrors()
    .AddPersistence()
    .AddEngine()
    .AddGlossary()
    .AddRuns()
    .AddHealth();

var app = builder.Build();

app.UseExceptionHandler(_ => { });
app.UseMiddleware<RequestContextMiddleware>();
app.UseMiddleware<RequestBodyLimitMiddleware>();
app.UseStatusCodePages(StatusCodeProblems.WriteAsync);

app.MapControllers();
app.MapApiNotFound();

app.Run();
