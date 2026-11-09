---
name: tdd
description: Test-driven development for this repo. Use when the user wants to build a feature or fix a bug test-first, mentions red-green-refactor, or asks for integration tests.
---

Adapted from mattpocock/skills `tdd` (MIT, a496f55).

## Seams first

A seam is the public boundary you test at. Before writing any test, list the seams under test with one line each
on what it catches and what it misses, and confirm them with the user. In this repo the usual seams are:

- engine: the compiler as a function (definition + glossary → SQL text with placeholders + params, a golden), the
  validator (definition → error codes and JSON paths), an endpoint through FastAPI's `TestClient`, the executor
  against the seeded db (the planted record keys);
- api: a controller through `WebApplicationFactory` with the engine stubbed at its `HttpMessageHandler`, the
  `EngineClient` against a stub handler (timeouts, 503, the breaker), persistence against the shared SQL Server
  (rowversion conflicts, paging);
- web: a component through TestBed and Material harnesses, a service with `HttpTestingController`, a Playwright flow;
- sql: `scripts/db-init.sh` on a clean container, then `scripts/db-check.sh`.

## The loop

- Red before green: one failing test, then only enough code to pass it.
- One vertical slice per cycle (one seam, one test, one implementation), each a tracer bullet that reacts to what the
  last cycle taught you. Never all tests first.
- Refactoring is not part of the loop; it belongs to `/phase-review`.
- Run the suite through `/check --tests` for the touched part only; never two suites at once.

## While a test is deliberately red

`touch .claude/state/red` so the Stop hook reports type errors instead of blocking on them, and
`rm -f .claude/state/red` as soon as the slice is green. Do not leave the marker behind.

## What a good test is

It verifies behaviour through the public interface, reads like a specification ("an employee who turns 18 on the
run date is not flagged"), and survives refactors. Expected values come from an independent source (an example in
`contracts/examples/`, a golden, a planted seed row, the spec), never recomputed the way the code computes them.

Anti-patterns to refuse: mocking internal collaborators or asserting through a side channel (querying `dq` instead
of reading the api's response); tautological assertions; testing private functions; the EF in-memory provider or
SQLite standing in for SQL Server where collation, rowversion or NULL logic matter. Mock only external dependencies:
the engine from the api, the LLM in suggestions, the network.
