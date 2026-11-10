# Coding standards (read by reviewers, not loaded every session)

`/phase-review` and `/ship` hand this file to the reviewer. It holds the judgment calls a linter cannot make.
Anything a tool already enforces is listed first so reviewers skip it.

## Enforced by tooling, skip in review

- C#: compiler and analyzer warnings as errors (`dotnet build -warnaserror`, nullable included); `.editorconfig`
  style through `dotnet format --verify-no-changes`.
- TypeScript: strict TypeScript and strict templates through the Angular compiler (`ngc`, `ng build`); angular-eslint.
- Python: ruff and pyright with the configuration in `engine/pyproject.toml`.
- Debug output: `.claude/hooks/print-guard.sh` (Stop hook, `/check`, git pre-commit) flags `Console.Write*`,
  `console.log` and `print(` outside tests.
- Git: the PreToolUse hook and the `ask` rules enforce the working-tree policy.
- Per-language conventions live in [csharp](../rules/csharp.md), [typescript](../rules/typescript.md),
  [python](../rules/python.md) and [sql](../rules/sql.md); reviewers read the one matching the diff, plus the
  matching `dc-*` skill.

## Genericity (graded first)

- No rule-specific branch anywhere: no code path keyed on a control name, an example id, an entity key or a field
  key outside the glossary module and the closed lists of operators and computed kinds. A test that needs a
  particular field reads it from the glossary or the examples.
- A new entity is a glossary change and a `sql/` change, nothing else. A diff that adds an entity and touches the
  compiler is a finding unless it adds an operator or a computed kind.
- The definition JSON is the source of truth; SQL is derived at run time and never stored or sent.
- An error crosses a service boundary as a code, keys and parameters, and its text is the client's. Rule sentences
  and reasons are the one exception: the engine renders them from the glossary and they cross as text and parts.

## Size and structure

- Files stay under about 500 lines, functions under about 50 with few mutable locals. Beyond that, split by
  responsibility; a function with three or more phases becomes a pipeline of named steps with explicit inputs and
  outputs.
- One reason to change per module. Controllers handle HTTP, services hold rules, data access sits behind them
  (api); routes call modules (engine); components render, services talk to the server (web). Layers never skip.
- Duplicate once is fine; the third copy gets extracted. The wrong abstraction costs more than duplication.
- No dead code lands: unused imports or usings, commented-out blocks, TODOs without a tracking reference, debug
  output.
- Names say what a thing is: PascalCase for C# types and members and for TS classes, camelCase for TS values,
  snake_case for Python and for SQL columns, SCREAMING_SNAKE_CASE for constants in TS and Python.
- Comments explain why, not what. If a comment explains what the code does, extract a named function instead.

## Errors

- Validate at the boundary (JSON Schema and DTO validation in the api, the validator in the engine), then trust the
  value inside.
- Typed domain errors, one mapping to problem details per service; never stack traces, SQL, connection strings or
  engine internals to a client.
- No empty catch blocks and no returning null for failures. Non-blocking failures log a warning with the
  correlation id and continue.
- Every error a user can see has a code in `contracts/errors.md` and a message in both translation files.

## Tests

- New behaviour ships with tests; bug fixes ship with a regression test that fails before the fix.
- Test behaviour through public interfaces, not implementation. Names say "<behaviour> when <condition>".
- Expected values come from an independent source (`contracts/examples/`, goldens, the planted seed rows), never
  recomputed the way the code computes them.
- Mock only external dependencies (the engine from the api, the LLM, the network); never the unit under test, and
  never the database where collation, rowversion or NULL logic matter.

## Security (architecture §10)

- Identifiers only from the glossary; values only bound; one SELECT; the read-only login; bounded execution (row
  cap, timeout, depth and size limits).
- No SQL text in a response, an inter-service payload or an Information-level log; `/debug/compile` is off by
  default.
- Each service uses only its own login; `sa` only in the init path.
- Secrets from the environment only; no connection string or key in code, fixtures or logs.
- CORS from configuration, never `*`.
- The LLM sees the glossary and aggregates, never row values, and its suggestions go through the compiler like any
  user definition.

## Git

- Conventional commits: `type(scope): description`, one logical change per commit, one green phase per commit. No
  attribution trailers (a setting disables them).
- Feature branches; push, PR and history rewrites need an explicit verb from the user in the current turn.
