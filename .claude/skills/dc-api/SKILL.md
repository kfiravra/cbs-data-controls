---
name: dc-api
description: "Repo facts for api/, the .NET 10 Web API (controllers, EF Core on schema dq, the resilient engine client, ProblemDetails with code and params, xUnit with WebApplicationFactory), and contracts/api.md and contracts/errors.md. Loads on its own when those files are touched. Use when adding endpoints, persistence, runs and snapshots, the engine client, error mapping, OpenAPI or static hosting."
paths:
  - "api/**"
  - "contracts/api.md"
  - "contracts/errors.md"
---

# dc-api

ASP.NET Core on .NET 10 (LTS): controllers (`[ApiController]`, routes under `/api/v1`), EF Core with the SQL Server
provider for schema `dq` only, a typed `EngineClient` over `HttpClient` with `Microsoft.Extensions.Http.Resilience`,
ProblemDetails for every error, built-in OpenAPI, xUnit with `WebApplicationFactory<Program>`. Modules follow
architecture §7: Glossary, Controls, Runs, Suggestions, EngineClient, error handling, static hosting of the Angular
build. Layout: one solution file (`.slnx` or `.sln`) at `api/`, projects in `api/src/`, tests in `*.Tests` projects
in `api/tests/`. Conventions: [.claude/rules/csharp.md](../../rules/csharp.md).

## Verify

```
cd api && dotnet build -warnaserror && dotnet format --verify-no-changes && dotnet test
```

`dotnet` finds the single solution at `api/`; pkgmap skips the api checks when there is none or more than one.
`build`, `test` and `format` share `obj/`: never two of them at once.

## Facts that bite

- `dq_app` has DML on `dq` and nothing else. Without DDL rights `Database.Migrate()` and `EnsureCreated()` fail, so
  there are no EF migrations: `sql/` owns the schema and the EF model maps it (`ToTable("Control", "dq")`,
  snake_case column names through `HasColumnName`).
- The api never builds or runs SQL text: no `FromSqlRaw`, `ExecuteSqlRaw`, `SqlQueryRaw` or `SqlCommand`. LINQ only,
  and never against `hr`.
- Concurrency: `Control` carries a `rowversion` mapped with `.IsRowVersion()`; a stale token raises
  `DbUpdateConcurrencyException` → 409 with the conflict code. Every edit inserts a new immutable `ControlVersion`
  in the same transaction as the `Control` update.
- `[ApiController]` answers model-binding failures itself with `ValidationProblemDetails` full of English prose.
  Replace `ApiBehaviorOptions.InvalidModelStateResponseFactory` so those carry `code` and `params` as well.
- Every error is ProblemDetails with `code`, `params` and, for definition errors, the JSON `path`, all in
  `Extensions`. One `IExceptionHandler` maps domain exceptions; engine codes map to statuses through one table that
  follows `contracts/errors.md`. No user-facing prose, stack traces, SQL or engine internals reach the client.
- EngineClient: the standard resilience handler defaults to 3 retries, a 10 s attempt timeout and a 30 s total,
  shorter than a long run. Configure one retry (runs are read-only, so a retry is safe), an attempt timeout above
  the engine's statement timeout and a total above two attempts. `HttpClient.Timeout` (100 s by default) wraps the
  whole pipeline: keep the total under it or raise it.
- Forward `Accept-Language` and the correlation id on every engine call (a `DelegatingHandler` reading
  `IHttpContextAccessor`), and log the correlation id with every failure.
- Paging, filtering, search and sorting of results run on the `dq.RunResult` snapshot, never through the engine.
  Order by the sort key and then the row id so pages are stable; text matching follows the column collation, so
  search is case-insensitive under `Hebrew_CI_AS`.
- Structural validation reads `contracts/control-definition.schema.json` itself (linked into the build or
  embedded) with a validator that supports the schema's declared draft; the engine's `/validate` runs before
  anything is saved.
- Static hosting: the Angular build lands in `web/dist/web/browser/` and is copied to `wwwroot`.
  `MapFallbackToFile("index.html")` also answers unknown `/api/...` paths with the SPA page and a 200; map a
  ProblemDetails 404 for `/api/{**rest}` ahead of the fallback.
- OpenAPI: `AddOpenApi()` and `MapOpenApi()` serve `/openapi/v1.json`; the template carries no Swagger UI.
- Containers: the aspnet image listens on 8080 (`ASPNETCORE_HTTP_PORTS`), so compose maps 5000 to it. The image
  builds from the repo root: it needs `contracts/` and the web build.
- Tests: .NET 10 generates `public partial class Program` for top-level statements; do not declare it (ASP0027).
  Swap the engine for a stub `HttpMessageHandler` in `ConfigureTestServices`. The EF in-memory provider has no
  rowversion, no collation and no SQL translation, so persistence tests run against the shared `DataControls`
  database as `dq_app`, through the real app. Every control a test creates is named with the marker
  `zz-dc-api-test-`, and the suite deletes marked controls with their versions and runs before the first test and
  after the last. With SQL Server down the tests fail with one sentence; they never skip.
- Packages are pinned in `api/Directory.Packages.props` and nowhere else. Microsoft packages stay on 10.0.x (a bare
  `dotnet add package` takes 11.x); `Microsoft.Extensions.Http.Resilience` is 10.11.0 (versioned apart from the
  runtime); `JsonSchema.Net` is 8.0.5 exactly, the last MIT release, with `JsonPointer.Net` 6.0.1 and
  `Json.More.Net` 2.2.0 (do not raise any of the three); `Swashbuckle.AspNetCore.SwaggerUI` 10.3.1 is the UI
  alone; xunit is 2.9.3.

## Read before changing

[architecture.md](../../../docs/architecture.md) §5 (validation layers), §7 (api), §9 (flows), §12 (errors);
`contracts/api.md`, `contracts/errors.md`, `contracts/control-definition.schema.json`.
