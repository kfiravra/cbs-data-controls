# Linter follow-ups (not applied; configuration for the tasks that create the projects)

Mechanical rules that should move from review and from `.claude/hooks/print-guard.sh` into the linters once
`engine/`, `api/` and `web/` exist. Each block is independent. Expect existing violations the first time, so start
with warnings or fix them in a dedicated commit.

## Ruff (`engine/pyproject.toml`)

```toml
[tool.ruff.lint]
select = ["E", "F", "I", "B", "UP", "S", "T20", "C901", "PLR0915"]

[tool.ruff.lint.per-file-ignores]
"tests/**" = ["S101", "T20"]
"scripts/**" = ["T20"]

[tool.ruff.lint.mccabe]
max-complexity = 12

[tool.ruff.lint.pylint]
max-statements = 50
```

- `T20` (`T201` print, `T203` pprint) replaces the print guard for the engine.
- `S608` (SQL built from strings) backs "never f-string SQL"; `S101` stays off in tests for plain `assert`.
- `UP` keeps `X | None` and f-strings mechanical.

## ESLint (`web/eslint.config.js`)

```js
rules: {
  'no-console': ['error', { allow: ['warn', 'error'] }],
  'no-restricted-syntax': ['error',
    { selector: 'Literal[value=/[\\u0590-\\u05FF]/]', message: 'Hebrew belongs in src/assets/i18n/*.json.' },
    { selector: 'TemplateElement[value.raw=/[\\u0590-\\u05FF]/]', message: 'Hebrew belongs in src/assets/i18n/*.json.' },
  ],
  'max-lines': ['warn', { max: 500, skipBlankLines: true, skipComments: true }],
  'max-lines-per-function': ['warn', { max: 50, skipBlankLines: true, skipComments: true }],
},
```

Keep `max-lines-per-function` off for `*.spec.ts` (describe blocks are long by design). With `no-console` in place
the print guard is redundant for `web/`; the Hebrew rule enforces "English-only code" in `.ts` (templates need
`@angular-eslint/template` coverage or a review).

## .NET (`api/Directory.Build.props`, `api/BannedSymbols.txt`)

```xml
<PropertyGroup>
  <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
  <AnalysisLevel>latest-recommended</AnalysisLevel>
  <EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>
</PropertyGroup>
```

With `Microsoft.CodeAnalysis.BannedApiAnalyzers` and a `BannedSymbols.txt` that bans `T:System.Console` (use
`ILogger<T>`) and the raw-SQL entry points of EF Core (`FromSqlRaw`, `ExecuteSqlRaw`, `SqlQueryRaw`), the print
guard is redundant for `api/` and "the api never builds SQL" becomes a build error.

## When all three land

`print-guard.sh` can go once each linter runs in the pre-commit and in the Stop check; until then it is the one
check that covers all three languages.
