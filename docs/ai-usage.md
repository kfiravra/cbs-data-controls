# AI usage

Which AI tools were used to build this system, what each was used for, how its output was checked, where no AI
runs, and what the developer decided himself.

## The tools

| Tool | Used for | How its output was checked |
|---|---|---|
| Claude Code (Anthropic's coding agent, in the terminal) | Wrote the code of every part: the SQL scripts, the contracts, the engine, the api, the client, the tests, the scripts and the English documents, under a plan per task. | The tests and checks of every phase; reviews by separate review agents; security audits; the developer's reads of the rendered output and of the running app. |
| The harness in `.claude/` (part of the submission) | Organises Claude Code's work: the project instructions, conventions per language, the plan interview, a check of the touched parts at every stop, review by area, the gate before a pull request, and a guard that blocks destructive git commands and asks before a push. | Its own tests (`node --test .claude/hooks/tests/*.test.mjs`, 227). |
| The claude.ai chat | To analyse the assignment's requirements, to review and revise the architecture and the work plan, to word the briefs and instructions the developer gave the Claude Code sessions, as a second opinion on their plans and reports, and to draft the submission documents in Hebrew (`submission-he/`). | Its output reached the repository only through the developer: as the architecture he committed, and as the briefs and decisions he gave the sessions, where the plans, tests and reviews then applied. The Hebrew documents he read before the submission. |
| `design-taste-frontend` and `impeccable` (third-party Claude Code skills) | The client's visual direction, and its critique, audit and polish passes. | The client's tests at phone and desktop width, and the developer's reads of the running app. |
| context7 and Playwright (MCP servers) | Looking up current library documentation, and opening the running app in a browser from a session. | They are for reference and inspection and produce no code. |

The sessions ran on Claude Fable; the review, audit and drafting agents ran on Claude Opus.

## Where no AI runs

Nowhere in the product. No service calls a model, holds a model key or depends on a model library.

- **A control definition becomes SQL by deterministic code.** The engine validates the definition against the
  JSON Schema and the glossary and compiles it into one parameterized SELECT. The same definition on the same
  data always gives the same result.
- **The sentences and the reasons** are rendered by the engine from the glossary's templates.
- **The suggestions are heuristics** over the glossary and one aggregate query per entity. The assignment's
  optional AI task is answered by a design that is not built
  ([summarize-architecture.md](summarize-architecture.md#the-optional-task-ai-that-proposes-controls)).

## How the code was written and reviewed

The code was written by Claude Code under plans the developer approved. The work was split into five tasks; each
began with a plan interview, and the developer's answers are kept in the plan as numbered decisions.

Every phase was checked by tests: 521 in the engine, 389 in the api, 390 unit tests and the end-to-end specs in
the client, 27 assertions on the database, and a run of the six examples through the whole system against their
expected records. The work was reviewed by separate, read-only review agents: at the phase ends of four of the
tasks and once at the end of the first, each review followed by a fix commit. Three security audits read
the engine, the api and the whole repository.

The developer directed the build through the plan interviews, his decisions, and repeated reads of the rendered
output and of the running app: the Hebrew sentences and reasons of the examples, after which he gave their final
wording; the Hebrew interface; and five rounds on the running client, each answered by a list of changes. Every
push, pull request and merge was made on his word. He did not review every diff line by line.

The full record of the build (what each task generated, what every review found and what happened to each
finding, the decisions the sessions took alone, and the few commits that went in without an agent review) is in
[dev/completed/ai-usage-record.md](../dev/completed/ai-usage-record.md), as written on 2026-11-12.

## What the developer decided himself

| Decision | Recorded in |
|---|---|
| The split into engine, api and client, with `contracts/` as the only channel and two database logins: only the api writes, and only to `dq`; only the engine reads `hr` | `docs/architecture.md` §3 and §10, written before the build |
| Sentences and reasons have one source, the glossary, and one renderer, the engine; the client draws what it receives (against the model's recommendation of a renderer in the client) | dc-contracts decision 3, dc-web decision 1 |
| "No department" is a field of the glossary, not a new kind of node (his design, in place of the model's) | dc-contracts decision 4 |
| The wording of the Hebrew operator texts, so that they read for a field of either gender | dc-contracts decision 12 |
| Scope: Hebrew only; suggestions by heuristics, with no language model in the product; two ways to run it | dc-contracts decisions 37 to 40 |
| The thresholds of a rule are never in the glossary or the code; a suggestion is shown only when it flags a record now | dc-engine decisions 1 and 3 |
| An archived control is read-only; a JSON body that does not parse is 400, and 415 is only for a wrong media type | dc-api decision 7 and its notes |
| The client as one page with panels, its look, and colour as status | dc-web plan, phases 9 to 13 |
| The six examples are loaded at the first start and never run; `.env` is generated; English documents, and the submission documents in Hebrew in `submission-he/` | dc-delivery decisions 5 to 8; the Hebrew folder on 2026-11-12 |
| After the scale test: the index `hr.Employee (department_id, status)` is added; `AllowedHosts` stays open for a local run | dc-delivery notes, 2026-11-12 |

The plans are under [dev/completed/](../dev/completed/) and [dev/active/](../dev/active/).
