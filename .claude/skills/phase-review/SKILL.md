---
name: phase-review
description: Phase-end code review by area with read-only reviewer agents on two axes, standards and plan, followed by one review-fix commit.
argument-hint: "[sql|engine|api|web|infra ...] [--since ref] [--double]"
disable-model-invocation: true
---

Adapted from mattpocock/skills `code-review` (MIT, a496f55). Arguments: $ARGUMENTS

## 1. Pin the diff

- `--since <ref>` given → `git diff <ref>...HEAD` plus the working tree.
- Otherwise, if the tree is dirty → working tree vs `HEAD` (`git diff HEAD`); if clean →
  `git diff HEAD~1..HEAD`.
- Confirm the ref resolves and the diff is non-empty before spawning anything. Record the commit
  list with `git log --oneline`.

## 2. Areas

Group changed files: `sql` (sql/, scripts/db-*.sh, docker-compose.yml), `engine` (engine/),
`api` (api/), `web` (web/), `infra` (.claude/, other scripts, CI, docs). Files in `contracts/` go to
every area that reads them: the glossary, schema and examples to `engine` and `api` (and `web` when
labels or payloads change), `api.md` and `errors.md` to `api` and `web`. Review only the areas present,
or the ones named in the arguments.

## 3. Sources for each reviewer

- Standards: [.claude/standards/CODING-STANDARDS.md](../../standards/CODING-STANDARDS.md), the matching `.claude/rules/*.md`
  and `dc-*` skill, [docs/architecture.md](../../../docs/architecture.md) §10 for anything touching SQL, logins,
  errors or the network.
- Plan: `dev/active/<task>/plan.md` when the branch has one (Goal, Decisions, current phase).
- Paste the smell baseline into the brief; the agent has no other access to it: mysterious name,
  duplicated code, feature envy, data clumps, primitive obsession, repeated switches, shotgun
  surgery, divergent change, speculative generality, message chains, middle man, refused bequest.
  Baseline smells are judgment calls; a documented repo standard overrides them; skip anything
  tooling already enforces.

## 4. Spawn reviewers

One `reviewer` agent per area (subagent type `reviewer`, model `opus`), all in one message so they
run concurrently, at most five at once (one per area). Each brief contains: the diff command, the commit list,
the standards sources, the plan excerpt, and the two-axis instruction:

- **Standards**: every place the diff breaks a documented standard (cite file and rule) and any
  baseline smell (name it, quote the hunk). Hard violations vs judgment calls, labelled.
- **Plan**: requirements that are missing or partial, behaviour nobody asked for, requirements
  that look implemented but wrong. Quote the plan line.
- Findings as `path:line`, severity (critical / warning / info), under 400 words.

`--double` adds a second pass per area with `model: sonnet` for a cheap independent read.

## 5. Aggregate and act

Present `## Standards` and `## Plan` per area, verbatim or lightly cleaned, never reranked across
axes. End with totals per axis and the worst item in each. Then fix critical and warning findings,
run `/check`, and land one `fix(<scope>): review fixes` commit. Record `Last reviewed: <sha>` in
`notes.md`. Do not re-run the review on the fix commit.
