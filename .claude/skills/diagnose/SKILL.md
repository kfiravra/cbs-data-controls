---
name: diagnose
description: Diagnosis loop for hard bugs and performance regressions. Use when the user says "diagnose" or "debug this", or reports something broken, throwing, failing, flaky or slow. Builds a red feedback loop before any theory.
---

Adapted from mattpocock/skills `diagnosing-bugs` (MIT, a496f55), plus the 3-fix rule.

## 0. Check what is already known

The auto-memory index and the "Facts that bite" of the matching `dc-*` skill first: in this stack many bugs that
look new are not. Hebrew that reads back as `?` (a literal without `N`, or a `String` bind instead of `Unicode`);
every label rendered as its key (`src/assets` missing from `angular.json`, or a missing translation key); an engine
that will not start (the glossary does not match the database); `SSL Provider` errors (ODBC 18 without
`TrustServerCertificate`); a permission error (the code runs under the other service's login); `index.html`
returned for an api path (the SPA fallback); an engine that never answers on :8000 (another stack holds the port);
an age off by one (`DATEDIFF` instead of a date range). Redact secrets in everything you show.

## 1. Build a feedback loop (this is the skill)

A tight pass/fail signal that goes red on this bug. Spend disproportionate effort here. In order of preference: a
failing test at the nearest seam; a curl against the running service (engine :8000 `/health`, `/validate`, `/run`;
api :5000 `/api/v1/...`); the SQL a definition compiles to, through `/debug/compile` with its flag on; sqlcmd
against the container as the service's own login (permission bugs reproduce only under the right login); a
Playwright script on the dev server; replaying a captured definition JSON or problem-details body; a bisection
harness (`git bisect run`) when the bug appeared between two known states; a differential run (old vs new glossary
or definition).

For non-deterministic bugs raise the reproduction rate (loop 100 times, add load, narrow timing) until it is
debuggable. Tighten the loop: faster, sharper assertion, deterministic (fixed run date, pinned seed, no network).

Done when you can name one command you have already run, that drives the real code path, asserts the user's exact
symptom, and finishes in seconds. No red-capable command, no Phase 2. If you genuinely cannot build one, say so,
list what you tried, and ask for an artifact (log lines with the correlation id, the definition JSON, the
problem-details body, a screenshot at the width it broke).

## 2. Reproduce and minimise

Confirm the loop shows the user's failure, not a neighbour. Then cut inputs, callers, config and steps one at a
time, re-running after each cut, until every remaining element is load-bearing.

## 3. Hypothesise

Write three to five ranked, falsifiable hypotheses: "if X is the cause, then changing Y makes the bug disappear".
Show the list to the user before testing; they often re-rank it instantly. Do not block on the answer.

## 4. Instrument

One variable at a time, each probe tied to a prediction. Prefer a debugger or REPL; otherwise targeted logs tagged
`[DEBUG-xxxx]` so cleanup is one grep (the print guard flags a stray `print(` or `console.log` anyway). For
performance, measure a baseline first (the run's recorded duration, `SET STATISTICS TIME, IO ON` and the actual
execution plan of the compiled SELECT), then bisect.

## 5. Fix with a regression test

Write the regression test before the fix if a correct seam exists (one that exercises the real bug pattern); if
the only seam is too shallow, say so, that is a finding. Watch it fail, apply the fix, watch it pass, re-run the
original loop. The 3-fix rule: after three failed fixes, stop, write down what each attempt ruled out, and go back
to Phase 3.

## 6. Clean up

Original repro no longer reproduces; regression test passes or its absence is documented; every `[DEBUG-` tag
removed; throwaway harnesses deleted or parked under `dev/diagnostics/`; the confirmed hypothesis stated in the
commit message; a new gotcha recorded in auto-memory or in the matching `dc-*` skill.
