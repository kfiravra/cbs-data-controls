# Review of the documents (phases A1 and B4, 2026-11-11)

Two `reviewer` agents on opus, read-only, on the commits `5639436` and `db92c3d`. One checked
`docs/control-definition.md`, `docs/glossary.md` and the frame of `docs/examples.md` against `contracts/` and the
code; the other checked `README.md`, `docs/summarize-architecture.md`,
`docs/assumptions-limitations-extensions.md`, `docs/submission.he.md` and the diff of `docs/architecture.md`
against the tree and the gate files. Fixes: the commit `docs: review fixes`.

## The contract documents

Nothing false was found in the tables. Confirmed against the sources: the eighteen operator rows; example 4
(depth 3, six conditions, why 1086 matched `c1`, `c2`, `c3`); the limits and who enforces each; the 21 definition
error codes with their order and paths; "nothing changes in the api or the client" for a field, an entity or a
relationship.

| # | Severity | Where | Finding | What happened |
|---|---|---|---|---|
| 1 | warning | `docs/glossary.md`, adding an entity | `scripts/db-check.sh` asserts the exact list of tables and indexes, so its structure section fails after a new table | Fixed: the guide names the two checks that pin the sample model (the table and index lists, the version assertion of the engine's live test) |
| 2 | warning | `docs/glossary.md`, adding a relationship | The recipe did not say where in the list a new relationship goes; only the walkthrough did (the editor's chain shows the first one that joins two entities) | Fixed: the recipe states the order |
| 3 | warning | `docs/glossary.md`, a computed kind | A kind with another run-dependent parameter needs more of the compiler than the text named | Fixed: the four places are named |
| 4 | warning | `docs/glossary.md`, "every addition ends the same way" | A version bump breaks one assertion of the engine's live test, which contradicted "no engine code" of the walkthrough | Fixed with finding 1, and the walkthrough's opening line says it |
| 5 | info | `docs/glossary.md`, a field on a new column | `db-init.sh --reset` drops the whole database | Fixed: said, with `ALTER TABLE` as the other way |
| 6 | info | both documents, `nullable: false` | It removes the NULL tests from the type's operators only; a field's own list is kept | Fixed in the glossary guide |
| 7 | info | `docs/control-definition.md`, the count | The count's inner select is its own, without the value columns | Fixed |
| P | info | `docs/glossary.md`, startup validation | Design H asks what a mismatch looks like; no sample body was shown | Fixed: a sample 503 body |

## The README, the short architecture, the limitations, the cover page, the architecture diff

Confirmed: the six counts, the seed's totals, the ports and the example names agree across the five documents;
the SQL, the parameters and the Hebrew text of the short architecture match the golden files; the AI section
claims nothing is built; the seven deliverables of the cover page match the assignment word for word, and its
Hebrew addresses nobody in a gendered form.

| # | Severity | Where | Finding | What happened |
|---|---|---|---|---|
| 1 | critical | `README.md`, run from source | "Each was run as written on Linux" was false for step 2: `db-init.sh` against a host server never ran (no `sqlcmd` on the machine) | Fixed: the sentence says which steps ran and that step 2's host command did not |
| 2 | warning | `README.md`, step 1 | "Set the three passwords" misleads on a reader's own server: `MSSQL_SA_PASSWORD` must be the existing `sa` password, and `db-init.sh` refuses some characters | Fixed: the step says which password is which, and when to use the SSMS route |
| 3 | warning | `README.md`, the from-source publish | It kept warnings as errors with no pinned SDK, where the image turns that off | Fixed: the command carries `-p:TreatWarningsAsErrors=false`, with the reason |
| 4 | warning | `README.md`, "about 8 minutes", "half a minute" | In no gate | Fixed after G1: the README carries the times G1 measured |
| 5 | warning | limitations and architecture §10 | They stated the result of the whole-repository audit before it had run, and "each service had an audit" though the client had none | Fixed: the sentence was rewritten from the audit's report once it was in; §10 names the engine and the api |
| 6 | warning | architecture §18, "edit creates a version" | The two gate specs named as evidence do not edit a saved control | Fixed: the evidence is the api's `ControlUpdateTests.cs` |
| 7 | info | `README.md`, "Node 22" | Angular needs 22.12 | Fixed |
| 8 | info | `README.md`, the screenshots' caption | Example 1 had run twice | Fixed |
| 9 | info | the short architecture, the advisor | The plan judges the sixth example as "reported, not required", and says compose alone cannot prove "egress only from the advisor" | Fixed: both sentences now point at what the plan says |
| 10 | info | `docs/submission.he.md` | "The last chapter" was not the last; a line ended on a prefix before a link; "the system opens" where the scripts print an address | Fixed |
| P1 | info | night brief, item a ("not trimmed") | The diff dropped the deadline and position lines and two sentences of §15 | Fixed: the lines are back under "Context"; §15 states the policy again and points to where the records are weighed against it |
| P2 | info | `docs/screenshots/list-mobile.png` | A sixth file, linked from nowhere | Fixed: removed |
| P3 | info | links to the plan of dc-ai-suggestions | Dead at the two reviewed commits, fine at HEAD | Nothing to do |
