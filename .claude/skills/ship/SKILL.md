---
name: ship
description: "Pre-PR gate for the current branch: full checks, secrets and docs drift, PR body, task archive. Never pushes or opens the PR itself."
argument-hint: "[task-name]"
disable-model-invocation: true
---

Task: $ARGUMENTS

## 1. Checks

Call the Skill tool with `check` and the argument `all --tests`. Stop here if anything is red. If `.claude/` changed
on this branch, `node --test .claude/hooks/tests/*.test.mjs` is part of it. If `web/` changed, the Playwright e2e
at 390 and 1440 is part of it too (state the minutes first; it needs the api, the engine and the db running).

## 2. Secrets

`git diff main...HEAD` plus the working tree, grep for `ghp_`, `github_pat_`, `sk-`, `sk-ant-`, `eyJhbGciOi`,
`AKIA`, `Password=` or `Pwd=` with a value, `MSSQL_SA_PASSWORD=` with a value, and any `.env` content. Example env
files carry placeholders only. A hit stops the gate.

## 3. Docs drift

Map what changed to what must be updated, and propose the edits (apply them when they are mechanical):

| Change | Update |
|---|---|
| Endpoints, payloads, status codes | `contracts/api.md` (one commit on main, one line to the other sessions) |
| Error codes, reason keys | `contracts/errors.md`, `web/src/assets/i18n/he.json` and `en.json` |
| Entities, fields, relationships, operators | `contracts/glossary.json`, `docs/glossary.md` |
| Definition shape, limits, NULL semantics | `contracts/control-definition.schema.json`, `docs/control-definition.md` |
| Tables, logins, seed, planted rows | `sql/README.md`, `contracts/examples/`, `docs/examples.md` |
| Compose, env vars, ports, the manual path | `README.md`, `.env.example`, [docs/architecture.md](../../../docs/architecture.md) §14 |
| Components, responsibilities, flows, decisions | [docs/architecture.md](../../../docs/architecture.md) |
| Visual direction, tokens, components | `docs/design.md` |
| Assumptions, limitations, extensions | `docs/assumptions-limitations-extensions.md` |
| AI tools, the harness, the review policy | `docs/ai-usage.md` |
| New gotcha the code cannot tell you | [.claude/CLAUDE.md](../../CLAUDE.md) gotchas, or the domain skill |

## 4. PR body

Draft it from the commits and the plan, in this shape, with no attribution line:

```
## What
## Why
## How to test
## Risks and rollback
```

## 5. Archive the task

If `dev/active/<task>/` exists and every phase is ticked, offer to move it to `dev/completed/<task>/` and append
`ARCHIVED <date>: <reason>` to `notes.md`. Task folders are local; this is a filesystem move, not a commit.

## 6. Hand back

State plainly: checks green, secrets clean, docs updated or listed, PR body ready. Pushing the branch and opening the
PR need an explicit verb from the user ("push", "open the PR"); do not do either here.
