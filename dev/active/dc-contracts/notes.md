# dc-contracts notes

## State
Every phase is done and committed on `feat/contracts`: `43745cc` (phase 1), `b0d3015` (phase 2), `16824ce`
(phase 3), `aafe9ca` (phase 4), `dd6eb34` (the review fixes), then one commit for Kfir's scope decision of
2026-11-10 (plan decisions 37 to 40: Hebrew only, heuristic suggestions only, two delivery paths, screenshots at
390 and 1440) with the fixes of its own review. The Gate ran from a clean container on the tree of that last
commit, with rotated local passwords: `gates/final.txt`, db-check 27 passed, contracts-check 5 checks, hook tests
226 pass. The branch is pushed and the PR to main is open, on Kfir's word. Not merged.

## Next
1. Kfir read the `--render` output on 2026-11-10 and settled the wording (the last Log line). A wording change
   from here on is a contract change: one commit to `contracts/` on main and one line to each session.
2. The merge, on Kfir's word. Then on main: `scripts/db-init.sh --reset` (the seed is new there), and the three
   worktrees of kickoff §5 with `.env` copied into each. The local `.env` holds new passwords since the rotation.
3. The lines for the engine, api, web and delivery sessions are written into their plans ("Lines from dc-contracts
   as it merges"); nothing more has to be carried by hand.
4. `README.md` was left as it is by the scope decision: its `--render` comment still says "he and en".
5. History: `43745cc` shows three former local dev passwords in `.env.example` (removed in `dd6eb34`, rotated
   locally before the push, so they open nothing). Taking them out of the branch's history is a rebase, which
   needs Kfir's word.

## Blockers
(none)

## Last reviewed
`aafe9ca` (2026-11-10, sql, engine, api, web, infra; the fix commit is not re-reviewed)

## Log
- 2026-11-10 created plan. Interview in two rounds, seven decisions by Kfir (plan.md Decisions 1 to 7); `main`
  pushed (`fce7685..2303d2f`) on Kfir's word and `feat/contracts` cut from it.
- 2026-11-10 found while orienting: `Skill(dc-sql)` fails with "Unknown skill" because the four `dc-*` skills are
  path-scoped and no file of their area exists yet. Read the `SKILL.md` files directly; Phase 0 fixes the
  instruction in `/task-plan`.
- 2026-11-10 machine facts: Docker 29.9, compose v5.6, uv 0.11, jq 1.7, node 22, .NET 10.0.114, no host `sqlcmd`,
  port 1433 free, port 8000 held by another project's container (not needed in this task).
- 2026-11-10 amended during `/task-plan dc-engine`, on Kfir's word: plan.md decisions 26 to 29, Design H (which
  wins over B to F), one new step in each of phases 2, 3 and 4, two architecture steps reworded, one risk line.
  Nothing was executed. The engine plan (`dev/active/dc-engine/plan.md`, Design J) assumes exactly these shapes.
- 2026-11-10 amended during `/task-plan dc-api`, on Kfir's word: plan.md Design I (it adds to E and F; where it
  and H both speak of the `SCHEMA_VIOLATION` path, H4a holds), one new step in each of phases 2 and 4. Nothing was
  executed. The api plan (`dev/active/dc-api/plan.md`, Design H) assumes exactly these lines.
- 2026-11-10 phase 0 done on Fable 5.2, inside `bce225b` on main (`docs: design, product and task plans;
  chore(claude): track task folders`, pushed on Kfir's word): `/task-plan` reads the `dc-*` skills by file and the
  README row says "or by reading the file". The same commit tracks the task folders (`.gitignore`, CLAUDE.md,
  `/task-plan`, `/ship`) and narrows the suite guard to `playwright test`. Hook tests 224 pass, 0 fail:
  `gates/phase-0.txt`. No review ran, as the plan says for this phase. `feat/contracts` fast-forwarded to `bce225b`.
- 2026-11-10 phase 1 done (lane 1 on Opus, verified again by the orchestrator): `gates/phase-1.txt`, db-check 13
  passed, 0 failed, a second init changes nothing. Differences from Design A, all kept: a refused CREATE TABLE is
  error 262 (229 is for objects), so db-check asserts 262; one more index, `IX_Run_control_id_control_version`, for
  the composite FK; `platform: linux/amd64` in compose; db-check also asserts the server collation, the index set and
  that `public` holds nothing; `.env.example` carries working dev passwords (dc-delivery wants them empty later).
  Hebrew round trip through db-init and db-check proven before the seed: `-f 65001` in, UTF-8 out. Not verified:
  shellcheck (not installed), bash 3.2, a host sqlcmd, SSMS. No review here: one review at the end, on Kfir's word.
- 2026-11-10 phase 2 done (lane 2 on Opus; the db-check `glossary` section and architecture §4.3 by the
  orchestrator): `gates/phase-2.txt`, contracts-check 3 checks passed, db-check 16 passed, hook tests 226 pass.
  The schema says "exactly one of value or right" with two `if`/`then` pairs and no `not`, `anyOf` or `oneOf`;
  `allOf` holds the list of `if`/`then` pairs. `jsonschema` is pinned to 4.26.0. Lane 3 reported that 4.26.0 puts
  a member forbidden with `properties: { member: false }` at the member; checked by the orchestrator against the
  final schema on 4.26.0 and 4.25.1: one error at the node in both, all five schema-layer fixtures at their expected
  path, so the schema stays. Lane 2 also ran JsonSchema.Net 8.0.5 in a scratch console app: 41 cases agree with
  Python after the api's three corrections. db-check `glossary` also asserts the type family per stored field and
  that `dq_engine_ro` sees `hr` alone. For Kfir's read at the Gate: numbers say "קטן מ" and "גדול מ" (decision 12)
  where the assignment says "נמוך מ" and "גבוה מ"; `is_active` is labelled "סטטוס"; a two-hop path names the last
  relationship only ("סטטוס של המשרד"). For the engine session: the glossary has entity `description` and field
  `label` and `description`, which its plan's list (Design J) leaves out; `arity` is 0, 1, 2 or the string "list".
- 2026-11-10 phase 3 done (orchestrator, Fable 5.2): `gates/phase-3.txt`, db-check 27 passed, 0 failed over five
  sections after `db-init.sh --reset` and a second init; contracts-check 4 checks passed. Seed: 5 ministries, 16
  departments, 85 employees; expected totals 3 (4 on 2026-10-31), 3, 6, 10, 3, 3, each matched by its hand-written
  query; the first example holds its three records to 2027-12-31 and drops to two on 2028-01-01. Seed sanity: 22 of
  25 terminations on or after the hire date (21 after, 1 same day, 3 before). Choices of the orchestrator: only
  department 204 has no manager, so the engine's `missing_optional` has one record to find; the oracle returns
  `key|name|matched ids` (the flags per condition id live in its CTE); examples omit `path` for a field of the
  scope's own entity; `--render` takes the actual values of its reasons from a small table in the script (the
  first planted record per example). Check 4 was mutation-tested: 19 mutations of the examples, each reported.
  Phase 3's verify used `--reset` instead of `down -v`; the clean-container run is the Gate's.
- 2026-11-10 phase 4 done (lane 3 on Opus wrote `api.md`, `errors.md` and 13 fixtures; check 5, the alignment
  lines and the README section by the orchestrator): `gates/phase-4.txt`, db-check 27 passed, contracts-check 5
  checks passed, hook tests 226 pass. Check 5 goes past Design G: a schema-layer fixture must give one schema error
  at its path, a semantic-layer one must pass the schema and be rejected by check 4's glossary walk at its path, the
  fixture's layer must be the catalogue's, and the reason and evidence keys of `errors.md` must equal the
  glossary's; 12 mutations, each reported. The `/run` example of `api.md` now uses records 1051 and 1052 and the
  glossary's wording. Pinned by lane 3 where the plan was silent, for Kfir to object to before the freeze: the
  path per definition error code (a semantic error names the member the editor edits as one input; a duplicate id
  is at `<node>/id` of every later node); a related node whose relationship does not start at the scope entity is
  `PATH_NOT_REACHABLE`; a unit follows the value after one space, in the same part; a NULL value renders as
  nothing; a child group is bracketed and a related node's `where` is not; a method the path does not serve is 404
  `NOT_FOUND` in both services; the api sends the engine exactly `rootEntity` and `max` for suggestions; `/suggest`
  defaults `max` to 10 with a ceiling of 20; on a run that did not succeed the counts, sentence and conditions are
  null; `display_text` writes a number as in JSON and leaves a null out; an empty description is stored as null.
  One fixture beyond the plan's list: `computed-field-in-field-comparison` (H3). Open for other sessions: the web
  plan (line 531) assumes an error path ends in `left`, `operator`, `value`, `values`, `right` or `relationship`,
  but schema-layer paths and `DUPLICATE_NODE_ID` end elsewhere; `docs/design.md` (lines 654, 657) still contradicts
  the contract on breakdown counts and on `GLOSSARY_MISMATCH`.
- 2026-11-10 one review over `main...aafe9ca` by area, five `reviewer` agents on Opus (four at once, infra after the
  first returned), then one fix commit. Findings and what happened to each:
  - **infra, critical**: `contracts-check.py` ended in a traceback on a malformed glossary or schema (six cases),
    losing the failure lines. Fixed: lookups go through `dig`, the checks after schema and glossary are skipped
    while those two have failures, and a check that raises becomes a failure line. Twelve malformed cases re-run:
    failure lines, no traceback.
  - **infra, warning**: semantic fixtures were matched by path and not by code. Fixed: the walk records the
    definition error code of every fault and check 5 compares both; four relabelled fixtures are now reported.
  - **infra, warning**: `check_field` (77 lines) and `check_agreement` (71) over the size standard. Fixed: split.
    The file stays one file of about 1,640 lines, as Design G asks; not changed.
  - **infra, warning**: architecture §6 listed `ROW_CAP_EXCEEDED` as an engine code. Fixed.
  - **infra, info**: the no-uv test dropped the whole directory that holds uv (fixed: a mirror without uv); the
    Verify line and two README sentences were stale (fixed). The README's 2.2 GB is the image's real size.
  - **sql, warning**: the two login passwords were on the sqlcmd command line. Fixed: sqlcmd reads them from the
    environment (proved from a clean container); the Windows example in `sql/README.md` does the same.
  - **sql, warning, not verified**: Git Bash would rewrite the container paths in db-check. Added
    `MSYS_NO_PATHCONV` and `MSYS2_ARG_CONV_EXCL` to that call; there is no Git Bash here to prove it.
  - **sql, info**: nothing enforced the password rule (fixed: both scripts refuse spaces, quotes, `$`, `;`, a
    backslash); the wait loop hid sqlcmd's error and miscounted its two minutes (fixed: real seconds, last error
    shown); `dbo` owns both schemas, so a module would pass the DENY by ownership chaining (documented in
    `sql/README.md`; no module exists); one stale line in `sql/README.md` (fixed). The seed and the six oracle
    queries were checked row by row: clean.
  - **api, warning**: the standards said no text crosses a service boundary (fixed in CODING-STANDARDS and the
    reviewer agent: errors as codes, rendered sentences and reasons as the one exception); a run whose snapshot
    cannot be stored had no state (pinned: closed `failed` with `INTERNAL_ERROR`); a non-object `definition` was
    400 in `api.md` and "goes to the schema" in `errors.md` (now 400 in both); no code for an oversized body or a
    wrong content type (pinned: `REQUEST_INVALID` with 413 and 415); `page` unbounded (1 to 1,000,000); record keys
    had no length (64, the column). `Run.rootEntity` is not a column: answered with a note that it is read from
    the version's definition; no column added.
  - **api, info**: two lists repeated glossary data (reworded); results search now takes `[` literally and is
    trimmed. The fallback language stays `he`: the api plan's `Runs:DefaultLanguage` must default to it.
  - **engine, warning**: the age rule was written for the field `age` (reworded for the function `age_years`); the
    enum label had no fallback under the case-insensitive collation (pinned: found without regard to case, else
    shown as stored); the placeholders of suggestion texts were defined only in the plan (a Suggestions rule in
    Rendering); number literals were unbounded (below 10^15, else `VALUE_TYPE_MISMATCH`). `actual` and
    `rightActual` are on every reason also when the template shows neither: kept and said outright; the engine
    plan fetches less today.
  - **engine, info**: errors sharing a path had no order (now the order of the code table, then `params.index`);
    a related node's conditions read into the sibling after it (also lane 2 and the web reviewer; decision 33).
    Kept as the contract has them, for the engine session: `/suggest` may answer 504; a bad related relationship
    is `UNKNOWN_RELATIONSHIP` or `PATH_NOT_REACHABLE`, not `RELATIONSHIP_NOT_QUANTIFIABLE`.
  - **web, warning**: identifiers got thousands separators while `display_text` held plain digits (decision 32);
    no code for "the api did not answer" (`NETWORK_ERROR`, client-derived); the public glossary had no shape table
    (added to `api.md`). Wording fixed: the department's value labels, `ne` before a Hebrew word, "חסר" against
    "ריק" (decision 34), the reasons of `in` and `not_in`, "שהמחלקה שלהן", the quoted field name in two suggestion
    texts, the maqaf on picker labels that end in a prefix.
  - **web, not changed, for Kfir**: every predicate outside the colon style is masculine singular, which holds only
    because all eighteen labels are masculine; the reviewer proposes wording without gender ("מתחת ל־", "מעל",
    "לכל היותר", "לפחות", "לפני"). Decision 12 names today's words, so they stand until Kfir says otherwise. The
    descriptions of examples 1 and 6 say ש"ח where the sentences say ₪: example 1 quotes the assignment.
  - **web, for the web session**: `Run.status` can be `running` (another user's run, or a crashed one) and the
    plan has no screen state for it; set `dir` from `Run.language` on stored text and keep a value part on one
    line; `docs/design.md` draws a reason as "גיל [15] נמוך מ־16" where the engine renders "גיל: 15 (קטן מ־16)".
  - **found by the orchestrator against `/ship`**: `.env.example` carried working passwords. Emptied (decision 35).
- 2026-11-10 the Gate from a clean container, on the tree of the fix commit: `gates/final.txt`. `down -v`, `up`,
  init twice (7 scripts each), db-check 27 passed 0 failed, contracts-check 5 checks passed, hook tests 226 pass 0
  fail. Mutation runs after the fixes: 16 malformed or relabelled cases, 19 example mutations, 12 fixture and
  catalogue mutations, each reported.
- 2026-11-10 scope decision by Kfir, given after the review and before the push (plan decisions 37 to 40), carried
  through `contracts/`, `docs/`, `.claude/` and the five plans in one commit. Removed: 177 English values of the
  glossary and the `en` format, the English names and descriptions of the six examples, the `source` member of
  `/suggest` and the keyed timings, the English `/run` example of `api.md` (now Hebrew, rendered from the
  glossary), the LLM phase and settings of the engine plan, the offline Windows bundle of the delivery plan
  (wheelhouse, self-contained publish, `make-bundle.sh`, `run-all.ps1`, `run-all.sh`, the Windows rehearsal),
  `en.json`, the language switch and the `tablet` project of the web plan. Kept on purpose: the language
  mechanism; `heuristic: true` on examples 2 to 5; the Docker start scripts, `start.cmd` among them;
  `engine/requirements.txt`; the engine's driver and port settings; the 1024px layout breakpoints of
  `docs/design.md`; architecture §6's LLM step as a design that is not built. Not touched: `README.md` (Kfir's
  word), `sql/`, `dev/briefs/`, the notes of the other tasks. The lines kept for the consumer sessions went into
  the engine, api, web and delivery plans as a section each.
- 2026-11-10 one `reviewer` on Opus read the diff of the scope decision for leftovers and contradictions. Found
  and fixed: the cut numbers of the engine, delivery and web plans were stale after a cut was removed; the web
  plan still had a results state for "a run in the other language" and an English date fallback; architecture
  §3.1 still said "optional LLM"; this plan still named the `run-all` script and English glosses of glossary
  values, and decision 26 had a broken sentence; the delivery plan's decisions jumped from 2 to 4 (a stub for 3
  now) and one ask was worded wrongly; the engine's contract lines missed `<node>/right`. Over-deletion, reversed:
  the engine's win_amd64 wheel check and its suite runs under 3.13 and 3.14 were removed with the bundle, but the
  from-source path installs with pip on whatever Python the grader has, so both are back in the engine plan; the
  PowerShell parse check of the kept `start.ps1` is back in the delivery plan. Reported clean: `contracts/`,
  `.claude/`, `docs/design.md`, `docs/PRODUCT.md`; the `/run` example parses and its parts join to its texts.
- 2026-11-10 the local database passwords were rotated (`.env`, ignored by git) and the Gate ran again from a
  clean container on the final tree: `gates/final.txt`, init twice with 7 scripts, db-check 27 passed 0 failed,
  contracts-check 5 checks passed, hook tests 226 pass 0 fail.
- 2026-11-10 Kfir read the `--render` output and gave the final wording, applied in one commit to
  `contracts/glossary.json` (57 texts) and to the `/run` example of `contracts/api.md`, which is rendered from it.
  His rules: every operator text reads correctly for a field of either gender; numbers say "מתחת ל־" and "מעל",
  dates "לפני" and "אחרי"; missing and empty use the colon style in the sentence too ("שכר: חסר"), as in the
  reason; the brackets around related conditions stay; the department's value labels stay; the example
  descriptions stay as written; no rebase, `43745cc` stays as it is. Chosen by the session inside those rules: "at
  most" and "at least" are "לכל היותר" and "לפחות", for dates "לא אחרי" and "לא לפני"; `in` and `not_in` say
  "ברשימה" and "לא ברשימה"; the four text operators use the colon style ("שם: מכיל ”…”") and keep their picker
  labels; the three texts of the `date_order` suggestion say "לפני" as the operator now does. Not edited, on his
  "nothing else": the lines that quote the old words in `docs/architecture.md` §4.3, in plan decisions 12 and 34's
  neighbours, and in the web plan's contract lines ("קטן מ־18"). Checks after the change: contracts-check 5
  checks passed, db-check 27 passed, hook tests 226 pass.
