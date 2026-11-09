---
paths:
  - "api/**/*.cs"
---

# C# conventions (judgment calls only)

Already enforced by tooling, so do not restate them in reviews: compiler and analyzer warnings as errors
(`dotnet build -warnaserror`, nullable reference types included), `.editorconfig` style through
`dotnet format --verify-no-changes`, and `Console.Write*` outside test projects through the print guard.

- File-scoped namespaces; one public type per file, the file named after it.
- Controllers stay thin: bind, call one service method, map the result. Rules live in services; a `DbContext`
  never appears in a controller. The modules (Glossary, Controls, Runs, Suggestions, EngineClient) do not reach
  into each other's internals.
- `async` all the way: I/O methods return `Task<T>`, end in `Async`, take a `CancellationToken` last and pass it on
  to EF and `HttpClient`. Never `.Result`, `.Wait()` or `async void`.
- Domain failures are typed exceptions (or one result type, chosen once) that carry a code and parameters, turned
  into ProblemDetails by one `IExceptionHandler`. No `try`/`catch` in a controller that returns `BadRequest("text")`.
- `sealed record` for DTOs and value objects. Entities are classes whose invariants are set by constructors and
  methods, not by public setters.
- Configuration through `IOptions<T>` with validation and `ValidateOnStart()` for every section (engine URL,
  timeouts, row cap, retention), so a bad setting fails at boot instead of on the first run.
- `ILogger<T>` with message templates (`"Engine call failed {Code} {CorrelationId}"`), never interpolated strings
  in the template; no definition JSON, row values or connection strings in logs.
- `System.Text.Json` only, camelCase on the wire, enums as strings. DTOs are the contract in `contracts/api.md`;
  EF entities never leave the service layer.
- Classes are `sealed` unless designed for inheritance; private fields are `_camelCase`; no `#region`; no `!` to
  silence nullability outside tests.
- Tests: xUnit, behaviour through HTTP with `WebApplicationFactory` or through a service's public methods, named
  `Action_result_when_condition` (`Update_returns_409_when_the_token_is_stale`).
