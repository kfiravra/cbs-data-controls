# AI usage

Which AI tools were used to build this system, for what, and how their output was checked (architecture §18,
"General"). Every fact here comes from the records of the five tasks: each `plan.md` (its Decisions) and
`notes.md` (its Log and its list "Decisions taken unattended"), `git log`, and the five pull requests as saved in
`../dev/active/dc-delivery/gates/pr-1.md` to `pr-5.md`. The finished tasks are in `../dev/completed/dc-<name>/`,
the delivery task in [../dev/active/dc-delivery/](../dev/active/dc-delivery/). Where a record gives a verdict and
not the findings, this document says "not recorded"; it says that the developer read, reviewed or decided
something only where a record says so.

## 1. Tools

| Tool | Used for | How its output was checked |
|---|---|---|
| Claude Code (Anthropic's coding agent CLI) | All work inside the repository: the harness adaptation (`2303d2f`, 2026-11-09), the design record (`docs/PRODUCT.md`, `docs/design.md`), the five plans with their interviews, every line of SQL, contract, code, test and document, the commits, and the pushes and PRs on the developer's word. | The checks of every phase, saved under `gates/`; a review of every phase by separate read-only agents (section 4); the developer's reads of rendered output and of the running app where the records name them (section 6). |
| The harness in `.claude/` | `CLAUDE.md`: the map, the verify matrix, the gotchas, the git policy (100 lines at most). `rules/`: conventions for C#, TypeScript, Python and T-SQL, loaded by path. Skills: `dc-sql`, `dc-engine`, `dc-api`, `dc-web` (repo facts per area, loaded by path); `task-plan` (the plan interview); `resume` and `handoff` (task state); `check` (the verify matrix for the touched parts); `phase-review` (review by area on two axes, standards and plan); `ship` (the pre-PR gate); `guard`; `diagnose`; `tdd`. Hooks: `git-guard.sh` blocks stash, hard reset, clean, restore and force-push, and asks before a push, a rebase, a PR or a container stop; `post-edit.sh` records touched files and formats them; `stop-check.sh` runs the checks of the touched parts at every stop; `print-guard.sh` and the git pre-commit refuse debug output; `session-start.sh` reports branch, guard and active tasks. Agents: `reviewer` and `security-auditor`, read-only, on opus. Plans with phases and gates under `dev/`. | Its own tests (`node --test .claude/hooks/tests/*.test.mjs`): 224 at dc-contracts phase 0, 226 at its end, 227 after dc-delivery. It was adapted from the harness of an earlier project of the developer (`.claude/README.md`). |
| The claude.ai chat | Used throughout: for the architecture brainstorm, for the check against the assignment's requirements, and as a second reviewer of Claude Code's plans, interview answers and gate reports during the build. | Not recorded: no Log line records a finding relayed from the chat, although dc-web's plan (Design Q) asked for such lines. |
| design-taste-frontend (third-party Claude Code skill) | Dealt the visual direction twice: the first (palette `cool-grey-cobalt`, IBM Plex, sharp corners) for `docs/design.md` on 2026-11-10; the second ("Frost and slate", palette `cool-white-slate`, Heebo for Hebrew) in dc-web phase 9. Its rules for a UI fragment shaped the list row in phase 10. | Its finish gate, checker and copy lint are made for company websites and were not run (dc-web decision 70). The look was checked by the repository's checks, the mocked specs at 390 and 1440, `/impeccable critique`, and the developer's reads of the running app (dc-web phases 9 to 13). |
| impeccable 4.8.0 (third-party Claude Code skill) | `init` and `document` for `docs/PRODUCT.md` and `docs/design.md`. In dc-web: `audit`, three `critique` runs and `polish` (phase 8); `shape`, one `critique` and `polish` (phase 9); `typeset` and `polish` (phase 10); its `impeccable-documenter` agent brought `docs/design.md` in line with the code. | Its detector (62 rules) found nothing on the three screens at 390 and 1440. Critique scores: 28, 26 and 28 of 40 (phase 8), 29 of 40 (phase 9). What happened to each finding is in the dc-web Log (section 4). |
| context7 MCP server | Current library documentation. The dc-web plan's phase 1 step to look up the Angular Material theme token names through it is ticked. | No Log line records a lookup or any other use. |
| Playwright MCP server | Browser checks from a session (`.mcp.json`: Chromium, headless, isolated). | The Logs mention it only because its process matches the suite guard's `pgrep` pattern. They record no use of it. |

**Models, as the records give them.** The rule is Fable for planning, Opus for execution, Sonnet only for a lane
a plan names (`CLAUDE.md`, architecture §19). The dc-web and dc-delivery plans were written on Fable 5.2; the
other Logs do not name the planning model. No main execution session ran on Opus: dc-contracts ran on Fable 5.2
by the developer's choice, with three Opus lanes; dc-engine (Fable 5.2), dc-api (Fable) and dc-web (Fable 5.2)
ran their nights unattended, and a session cannot switch its own model (the first unattended decision of each);
dc-delivery runs on Fable 5.2 by the developer's night brief. The dc-web Log does not name the model of phases 9
to 13. Every reviewer, auditor, critique, documenter, lane and drafting agent ran on opus; no Log records Sonnet.

## 2. Where no AI runs

Nowhere in the product. No service calls a model, holds a model key or depends on a model SDK.

- **Definition to SQL** is deterministic code. The engine validates a definition against the JSON Schema and the
  glossary and compiles it with SQLAlchemy Core into one parameterized SELECT: identifiers only from the glossary,
  values only as bound parameters. Sentences and reasons are rendered by the engine from the glossary's templates.
- **Suggestions are heuristics.** One aggregate SELECT per entity (row count, missing count per optional field,
  order of each pair of date fields), then five generators keyed on glossary properties (`missing_required`,
  `date_order`, `active_under_inactive`, `active_without_active_children`, `missing_optional`). Each candidate is
  validated, compiled and counted like a user's control. On the seed they propose seven controls, among them the
  rules of examples 2 to 5, node for node; no proposal holds a number, so example 1 is never proposed.
- **No language model is built in.** The engine plan first had an LLM step, with Claude Sonnet 5.5 as its default
  model (dc-engine Log, 2026-11-10); the developer's scope decision of the same day removed it (dc-contracts
  decision 38). The optional AI task of the assignment is answered by a design that is not built: an advisor
  service, `advisor/`, the only part that would talk to a model, which returns definitions in the contract's JSON
  through the same validator and compiler and sees metadata and statistics, never record values
  ([summarize-architecture.md](summarize-architecture.md), "The optional task"). Its plan,
  [../dev/active/dc-ai-suggestions/plan.md](../dev/active/dc-ai-suggestions/plan.md), is marked "planned, not
  started" and was written without an interview from the developer's brief (its decisions 1 to 9); its decisions
  10 to 23 are the planner's and wait for his objection.

## 3. How the work was organised

Five tasks of architecture §19, each planned by `/task-plan` with an interview of the developer before any code:
dc-contracts (database, seed, contracts) first and alone; then dc-engine, dc-api and dc-web in parallel, each in
its own git worktree (`../cbs-engine`, `../cbs-api`, `../cbs-web`) with its own Claude Code session; dc-delivery
last, in the main tree (its interview: four rounds, thirteen decisions). All five plans were written on
2026-11-10. `contracts/` was frozen when dc-contracts
merged and was the only channel between the three parallel sessions; one SQL Server container, started from the
main tree, served all of them.

A need between tasks travelled as the developer's message, and another task's plan was edited only on his word:
dc-engine's contract additions and dc-api's addendum went into the dc-contracts plan before its freeze (its
decisions 26 to 29, Designs H and I); dc-web's two asks became dc-contracts decisions 30 and 31; dc-delivery sent
four lines of asks to the three sessions and records ten answers.

Every phase ended the same way: the checks with their output in `gates/`, `/phase-review` by area with read-only
`reviewer` agents on opus, one `fix(<scope>): review fixes` commit, a Log line. A review's Log line lists what was
read, the findings per severity, each critical and warning with its file, and what happened to each (dc-engine
decision 25, dc-api 27, dc-web 24, dc-delivery 33). dc-engine, dc-api and dc-web ran to their gates unattended in
the night of 2026-11-10 to 11, on instructions the developer pasted before going to sleep: no questions, decide and
write it in `notes.md`, continue, push and open the PR only if the gate passes, no merge.

`main` holds nine commits: the initial one, the architecture and kickoff (`fce7685`, 2026-11-09), the harness
(`2303d2f`), the design record and plans (`bce225b`), and the five PRs, squashed; the PRs list their 70 commits.

| | dc-contracts | dc-engine | dc-api | dc-web |
|---|---|---|---|---|
| Pull request, merged | #1, 2026-11-10 23:56 | #2, 2026-11-11 08:36 | #3, 2026-11-11 09:29 | #4, 11:20 and #5, 22:19 (2026-11-11) |
| Commits in the PR | 8 | 14 | 13 | 20 and 15 |
| Files changed, lines added | 75, 7,547 | 121, 13,141 | 199, 12,764 | 231, 34,453 and 178, 27,920 |
| Interview | 2 rounds, decisions 1 to 7 | 2 rounds, decisions 1 to 5 | 2 rounds, 8 questions | 2 rounds and 2 messages, decisions 1 to 8 |
| Phases | 0 to 4 | 0 to 5 and 7 (6 removed) | 1 to 5 | 1 to 13 |
| Review agents (opus) | 6 | 7 | 6 | 13 reviewers, 8 critique, 1 documenter |
| Tests at the end | db-check 27, contracts-check 5, hook tests 226 | 521 | 370 and 3 live (389 after PR #5) | 390 unit, 221 mocked e2e, 18 gate e2e |
| Decisions the model took alone | plan decisions 32 to 36 | 25 | 41 | 118 |

## 4. Per task

### dc-contracts

**Generated.** `sql/` (schemas `hr` and `dq`, two logins, indexes, a Hebrew seed of 5 ministries, 16 departments
and 85 employees with planted violations, six hand-written oracle queries), the `db-init`, `db-check` and
`contracts-check` scripts, and `contracts/` (schema, glossary, six examples with their expected records, 13 invalid
fixtures, `api.md`, `errors.md`). Three Opus lanes wrote phases 1 and 2 and the phase 4 documents; the
orchestrating session wrote phase 3 and verified the lanes.

**Reviews.** None per phase, by the developer's choice: one review at the end over `main...aafe9ca`, five
`reviewer` agents on Opus (sql, engine, api, web, infra), one fix commit (`dd6eb34`), not reviewed again. The Log
names these findings; it does not count the info findings.

- infra: one critical, `contracts-check.py` ended in a traceback on a malformed glossary or schema; three warnings
  (fixtures matched by path and not by code, two functions over the size standard, a wrong code in §6). All fixed.
- sql, warnings: the login passwords on the sqlcmd command line (fixed: through the environment); Git Bash would
  rewrite container paths (a guard added, not verified: no Git Bash on the machine).
- api, engine and web, warnings: gaps of the contract, each pinned in it (a run whose snapshot cannot be stored,
  bounds on `page`, keys and literals, the age rule, `NETWORK_ERROR`, identifiers without separators), and wording.
- web, left to the developer: every predicate was masculine singular; the reviewer proposed wording without gender.
  At his read of `contracts-check.py --render` the developer gave the final wording, 57 texts, with the rule that
  every operator text reads correctly for a field of either gender.

A second `reviewer` on Opus read the scope decision's diff: stale numbers, leftovers of English and the LLM, one
over-deletion (reversed). The gate ran from a clean container: db-check 27 of 27, contracts-check 5, hook tests
226, and 47 mutations of the examples, fixtures and catalogue, each reported.

**The developer.** Decisions 1 to 7 of the interview. Decision 4 is his own design in place of the model's
recommendation (dc-delivery Design K): "no department" is a visible employee field, `department_assignment`, with
only `is_null` and `is_not_null`, so the contract and the compiler need nothing new (rejected: a `related` node on
a many-to-one relationship, a NULL check on the department's name). After the review, the scope decision
(decisions 37 to 40; 177 English values left the glossary) and his final wording. `43745cc`, which keeps three
former local passwords in its history, stays without a rebase (they were rotated before the push).

**Taken alone.** No night ran unattended. Plan decisions 32 to 36 were made by the orchestrator while fixing
findings, open to the developer's objection; lane 3 pinned eleven details in `api.md` and `errors.md` where the
plan was silent (phase 4 Log line). The records hold no objection to either.

### dc-engine

**Generated.** `engine/`: the FastAPI service with the glossary loader and startup check, validator, compiler,
executor, explainer, compile cache, the five suggestion generators, all endpoints, the image (Debian 13, 249 MB)
and the README's Engine section. Tests by phase: 137, 220, 343, 460, 493, 521; the suite also passed under Python
3.13.14 and 3.14.6. One unattended night, 14 commits.

**Reviews.** Seven agents on opus, reports saved in `reviews/`. Findings as critical or high, warnings, info:

- Phase 1: 0, 3, 7. Warnings fixed (a raw Hebrew literal in a test, a bodiless 307 on `/health/`, the
  missing-driver message); one info rejected by the session.
- Phase 2: 1, 3, 2. Critical: 170 nested groups ended in `RecursionError` and a 500 (`app/validator/schema.py:34`).
  Fixed: deeper than 32 groups is answered `TOO_DEEP` before the schema, tested to 5,000 levels. Warnings fixed.
- Phase 3: 1, 2, 5. Critical: the flag constants were bound as parameters on every use, so a valid definition of
  thirty conditions three groups deep passed SQL Server's parameter limit and answered 500
  (`app/compiler/build.py:332`). Fixed: SQLAlchemy renders the constants, tests pin the count. Warnings fixed.
- Phase 4: 0, 1, 11; phase 5: 0, 2, 5; image: 0, 1, 6. Every warning fixed (a row-cap test that passed for any cap
  of ten or more; one field that dropped a whole proposal; equal dates counted for both orders; a wrong start
  condition in the note for dc-delivery).
- Security audit (`origin/main...85bfa53`): 0 critical, 1 high, 1 medium, 2 low; nothing on injection, the login or
  leakage. High: a list mixing a string with numbers made the schema library compare every pair (150,000 values,
  about 1.7 hours); fixed (decision 22). Medium: a megabyte operand was cached as a 3 MB plan; such plans are no
  longer cached, and a length limit for text literals is left to the developer as a contract question (decision
  23). Both lows fixed.

**The developer.** Decisions 1 to 5 of the interview (the Log does not say which were the recommended options):
`lifecycle` and `required` as the only suggestion knowledge, only candidates that flag a record now, 1.5 days.
His scope decision removed the LLM lane of decision 2. Nothing of the night was rejected or rewritten by him; he
was not present. His read of the Hebrew golden texts and the `/suggest` answer was open at the merge.

**Taken alone.** 25 decisions, `notes.md` "Decisions taken unattended"; the PR body flags 10, 18, 22 and 23 to read.

### dc-api

**Generated.** `api/`: the .NET 10 Web API with EF Core on `dq`, controls with immutable versions and optimistic
concurrency, runs and result snapshots with paging, search, filter and sort, the engine client with one retry and
a breaker, problem details with codes, OpenAPI and Swagger UI, static hosting of the client, `api/requests.http`
and its README section. Tests by phase: 64, 159, 239, 290, 344, then 370 at the gate, plus three live tests
against the real engine, run twice. A night and a morning in one session, 13 commits.

**Reviews.** Five phase reviews (one `reviewer` on opus each) and one security audit. Critical, warnings, info:

- Phase 1: 0, 4, 6. Fixed in `a781c91`, among them a `.env` source that loaded the `sa` and engine passwords too.
- Phase 2: 1, 4, 4. Critical: every 503 was counted, so the engine's own `DATABASE_UNAVAILABLE` would open the
  breaker against an engine that was up (`Engine/EngineModule.cs`). Fixed in `638787d` with the four warnings.
- Phase 3: 0, 5, 5 (fixed in `a619323`); phase 4: 0, 5, 2 (fixed in `90a5db1`, among them a host stop that left a
  run `running` and answered 500); phase 5: 0, 2, 6 (fixed in `aa3b954`).
- Security audit (the whole api): 1 critical, 0 high, 3 medium, 5 low, 4 info. Critical: ordering the schema
  errors built a pointer string for every element, so one body under 1 MB asked for about 250 GB
  (`Controls/DefinitionSchemaValidator.cs:54`); fixed (decision 40). Also fixed: a wide `children` list (23 s and
  2.4 GB from 146 KB), `text/json` past the body guard, a number outside the decimal range. Left open and named in
  the PR body: `AllowedHosts: *`, no limit on concurrent runs, no cross-site check on unsafe methods, no size cap
  on an engine answer, `TrustServerCertificate=true`, no security headers on the static files.

**The developer.** Every review line of the night ends "Kfir rejected or rewrote: nothing; he was not present."
In the interview, eight questions, the recommended option taken in each (decisions 1 to 8), the runnable stub
engine left out; three corrections during planning. Unattended decision 3 turned three times: the
session answered 400, the phase 1 reviewer held that against the contract's "a body that is not JSON 415", the
night built 415, and the developer's rule of the morning restored 400: "A JSON body that does not parse answers
what contracts/errors.md says; if the contract is silent, 400. 415 is only for a wrong Content-Type."

**Taken alone.** 41 decisions, `notes.md` "Decisions taken unattended"; decision 38 left six audit findings open.

### dc-web

**Generated.** `web/`: the Angular 21 client in Hebrew, right to left (list, editor with its condition builder,
results, suggestions, every error state, `he.json`); unit tests, mocked Playwright specs and gate specs on the real
stack at 390 and 1440; `web/README.md`; `docs/design.md` kept in line. In PR #5, on the developer's word, two api
and contract changes rode on the branch: the sort of the controls list (`15658ca`) and of a run's results
(`929ff6f`). PR #4 (phases 1 to 8): unit tests 11 to 296, mocked specs 156, gate 16 of 16. PR #5 (phases 9 to
13): 390, 221, 18 of 18.

**Reviews.** Thirteen `reviewer` agents on opus. Every critical and what happened to it:

- Phase 1: two. A toast placed at `start` without a direction stood at the wrong edge in RTL; the toolbar
  swallowed a term typed again after the search was cleared. Fixed.
- Phase 2: one. A related node was allowed in at one node under the limit, so a draft could reach 31 nodes. Fixed.
- Phases 3 and 6: one each (the same limit in another adder; a trimmed search written back into the field), both
  already fixed when the review was read, because reviews ran while the next phase was built (decision 16).
- Phase 4: two. "Try again" after a failed glossary read did nothing; removing a row left the server's error for it
  in place. Fixed.
- Phase 8 with the gate specs: one. The way back from a removal could be taken after the control was read again, so
  a save would overwrite a newer version unasked. Fixed.
- Phase 10 (two reviewers, api and web): one. A draft asked back was lost when a copy was open. Fixed.
- Phase 11: one. The drawing took apart every bracket in a rule, also one inside a value the user typed. Fixed.
- Phase 12: one, kept on the developer's word: at 50% the coloured line under a condition is faint (1.2 to 1.4:1 on
  the light grounds), some colours are close for a colour-blind reader, and the set repeats after eight. Reported to
  him with the numbers and a fix (decision 103).
- Phases 5, 7 and 9: none. Phase 13: no reviewer; his message named none (decision 113).

Phases 1 to 12 had 63 warnings, each named in the Log with what happened to it. All were fixed except, in part,
three: `mapFor` (phase 2, answered by its comment and `docs/design.md`), the keyboard driver (phase 3) and the
cost of the `violations` sort (phase 10, whose index would be a `sql/` change). Critiques, two agents a run:
phase 8, the list 28, the editor 26, the results 28 of 40; phase 9, 29 of 40. Their P1 findings were fixed (a run
from the list ended silently for a screen reader; removing a group had no way back; arrow keys on the entity
cards reset the conditions); each P2 and minor finding is fixed or left with its reason in the Log.

**The developer.** Decision 1 overrode the model's recommendation of a client-side renderer: the engine returns
parts and the client only draws. Decision 2 is his wording; decision 6 declined a restore endpoint. In the morning:
"Keep decision 38 (the leave prompt). The four items you left open stay open; delivery lists them as limitations."
Then five rounds from his reads of the running app. Phase 9: ten items and "this design looks not 2026, quite
boring"; one dealt direction and no stop, in place of three directions and a stop. Phase 10: seventeen items,
"after this round only bugs", no findings summary, shortcuts or bulk actions; colour is status (decision 78,
retiring the rule that a count is never red). Phase 11: seven items. Phase 12: six items and four notes (colours
at 50%, faded ends). Phase 13: the flowing sentence and three notes; the last took back his own item 2 of that
round, so only a condition's own words are underlined (decision 117).

**Taken alone.** 118 decisions, `notes.md` "Decisions taken unattended": 1 to 44 in the night, 45 to 52 the
morning after, 53 to 118 in phases 9 to 13 under "no questions", many of them readings of his items, marked "mine"
where they go past his words. Among them the second direction: the palette "Frost and slate" and the face Heebo
were dealt by the skill and taken by the session (decisions 69 to 71).

### dc-delivery

**Generated.** The composed system (`docker-compose.yml` with the engine, the api and the example loader,
`api/Dockerfile`, `.dockerignore`), the start scripts for bash and for Windows PowerShell, `scripts/examples.py`
(load, verify and document the six examples through the api), `scripts/scale-test.sh`, the README, and the
documents of the submission: this one, `summarize-architecture.md`, `control-definition.md`, `glossary.md`,
`examples.md` (its tables generated from real runs), `assumptions-limitations-extensions.md`, the Hebrew cover
page, the corrections of `architecture.md`, and the plan of the AI suggestions task. One unattended night
(2026-11-11 to 12) on Fable 5.2, on a brief the developer pasted before going to sleep; one message from him
during the night (to stop the `gh pr` prompts). Four drafting sub-agents on opus wrote the two contract
documents, the first version of this document, the plan of dc-ai-suggestions, and the ticks that closed the four
finished plans.

**Checked.** Both paths were run from a fresh clone: Docker on WSL and from a Windows folder, and the
from-source path on WSL (`gates/G1-docker-wsl.txt`, `G2-docker-windows.txt`, `G3-manual.txt` under
`../dev/active/dc-delivery/`). The client's end-to-end specs ran against the composed system, 18 of 18. The
worked example of `glossary.md` was carried out on a scratch stack before it was committed. Every backticked key,
code and path of the two contract documents was checked against the tree by a script.

**Reviews.** `reviewer` agents on opus, reports under `../dev/active/dc-delivery/reviews/`:

- Compose, the api image and the scripts (two agents): 0 critical, 3 warnings, 11 info. The warnings: the api's
  row cap and time zone did not follow the engine's settings under compose; `scripts/examples.py` named the six
  example ids in code; a Hebrew literal in a tool. All three fixed, with eight of the info findings and one more
  in part.
- The documents (two agents): 1 critical, 9 warnings, 11 info. The critical: the README said that every
  from-source step had been run as written, and one had not (the database script against a host server: the
  machine has no `sqlcmd`). The sentence now says which steps ran. The warnings were gaps in the "how to add"
  recipes of `glossary.md`, a password instruction that misled on a reader's own server, start times that no
  run had measured, and a checklist item with the wrong evidence. All fixed.
- The security audit of the whole composed system (one `security-auditor`): 0 critical, 0 high, 1 medium, 2 low,
  3 info. The medium is an item the api's audit had left open (`AllowedHosts: *`), found to reach further than
  the documents said; the limitations document was corrected and the setting was left for the developer, with
  the one-line fix named.

**The developer.** The thirteen decisions of the interview (2026-11-10), among them two changes of the
recommended option: the early lane in the main tree with no fourth worktree, and the hybrid bundle, which his
scope decision later removed. The night brief changed the plan in six places (its items a to f): a new short
architecture document beside the long one, the AI task answered by a design and a plan, the open items of the
other tasks listed as limitations, the four finished tasks closed, screenshots from a clean list, and the scale
test. His read of this document, of the cover page and of the README's first screen is item G7 of the gate.

**Taken alone.** The decisions of the night are listed in the delivery notes under "Decisions taken unattended".
One of them left a finding open for him: the scale test showed that one example takes 9 seconds on 200,000
employees and 36 ms with one more index, and the index was not added, because his brief asked that the seed and
its checks stay untouched.

## 5. Decisions the developer made himself

| Decision | Where |
|---|---|
| The split: engine, api and client, `contracts/` the only channel, only the api writes and only to `dq`, only the engine reads `hr`, two logins | `docs/architecture.md` §3, §3.2 and §10, committed by the developer on 2026-11-09 (`fce7685`), before the harness and the plans |
| Run date 2026-11-01 with the expected records stable to 2027-12-31; examples 5 and 6 | dc-contracts decisions 1 and 2 |
| Rule sentences and reasons have one source, the glossary, rendered by the engine (not i18n keys, as the architecture first said) | dc-contracts decision 3 |
| "No department" as a glossary field, not a new node kind (his design, in place of the model's recommendation) | dc-contracts decision 4 |
| Operator texts that read for a field of either gender; the final wording of 57 texts | dc-contracts decision 12, Log of 2026-11-10 |
| dc-contracts in one run on Fable with three Opus lanes and one review at the end; no rebase of `43745cc` | dc-contracts plan, "Execution"; notes, Next 4 |
| Hebrew only; suggestions by heuristics only, no LLM lane; two delivery paths and no offline Windows bundle; screenshots at 390 and 1440 | dc-contracts decisions 37 to 40, the "Scope decision" section of every plan |
| Suggestion knowledge is `lifecycle` and `required` alone, so the thresholds of example 1 are never in the glossary or the code; only suggestions that flag a record now | dc-engine decisions 1 and 3 |
| Api tests on the shared database through the real app; one project; JsonSchema.Net 8.0.5, the last MIT release; an archived control is read-only (the recommended options, taken by him) | dc-api decisions 1, 2, 3 and 7 |
| 400 for a JSON body that does not parse, 415 only for a wrong media type | dc-api notes, unattended decision 3 |
| The engine renders, the client draws (against the model's recommendation of a client renderer); the editor's sentence is the engine's; no restore endpoint | dc-web decisions 1, 2 and 6 |
| The client as one page with panels, the new look, colour as status, condition colours at 50%, only a condition's words underlined; no findings summary, shortcuts or bulk actions | dc-web plan, phases 9 to 13; notes decisions 78, 97 and 117 |
| Delivery in two lanes, the early one in the main tree with no fourth worktree (a change of the recommended option) | dc-delivery decision 1, Log of 2026-11-10 |
| The six examples loaded through the api on first start and never run; `.env` generated on first start; English documents and one Hebrew cover page | dc-delivery decisions 5 to 8 |
| A review's Log line lists its findings, never a verdict | dc-delivery decision 33, carried to the three sessions (dc-engine 25, dc-api 27, dc-web 24) |
| A new short architecture document beside the long one; the AI task answered by a design and a plan; README screenshots from a clean list | dc-delivery notes, the night brief, items a, b and e |

## 6. Review policy and its limits

**In place.**

- A plan interview before every task, its answers kept as numbered decisions; the checks of every phase saved
  under `gates/`, and a gate before every PR. The rules and hooks of section 1 run on every edit, stop and commit.
- A review at every phase end by read-only `reviewer` agents on opus, on two axes (the coding standards and the
  plan), then one fix commit; a `security-auditor` on opus over the whole branch of the engine and of the api.
- Push, PR, merge and rebase only on the developer's word, behind the git guard's question. The records give every
  merge to him; none says that a session merged.
- The developer's reads that the records name: the rendered Hebrew sentences and reasons of the six examples before
  PR #1 (`contracts-check.py --render`, after which he gave the final wording); the Hebrew interface on 2026-11-11
  (dc-delivery night brief, item d); five reads of the running app during PR #5, each answered by a list of items.

**Not in place, or not recorded.**

- No Log or PR body records a read of the code or of a diff by the developer before any of the five merges.
  The policy set before the build (architecture §15) is that all generated code is reviewed by him before merge;
  the records do not show such a read.
- PR #1 was merged one minute after its last commit (`46ecf63`, 23:55). PR #2 was merged while its body said "The
  Hebrew text has not been read by a person"; the developer read the Hebrew interface later that day (the
  delivery night brief), and no record says that he read the engine's golden text files themselves. The last
  commit of PR #5 (`9b5f79a`, 22:18:13) was pushed on his word ("great push it the pr5", the last line of the
  dc-web Log) and merged at 22:19:51, a minute and a half after it was committed.
- Code merged without a review: dc-contracts had no review per phase. dc-web phase 13 had no reviewer, so its three
  commits (`3a49090`, `9471424`, `9b5f79a`) went into PR #5 unreviewed, and the last two had no gate run on the
  real stack (decision 116). No fix commit was reviewed again by its phase reviewer; the two audits covered their
  whole branches, earlier fix commits included, and the commits that fixed the audits were not reviewed again. No
  audit read `sql/`, `contracts/` or `web/`; a whole-repository audit is item G5 of the delivery gate.
- Every main execution session ran on Fable, where the rule gives execution to Opus. The model took 25, 41 and
  118 decisions alone in dc-engine, dc-api and dc-web; the engine's notes say the developer "reads these first",
  and no record says that he did.
- In the nights a spend line was written and the run started at once, as the night instructions allowed
  (dc-engine and dc-web, unattended decision 2). Twice two test suites ran at once against the rule (dc-engine at
  00:23 and dc-api at 01:27 on 2026-11-11); both sessions then started every run through a waiting script.
- What the claude.ai chat found as a second reviewer is not recorded. This document was drafted by an opus
  sub-agent of the delivery session from the records above (dc-delivery, unattended decision 1); item G7 of the
  delivery gate is the developer's read of it.
