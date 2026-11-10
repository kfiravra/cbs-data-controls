# Product

<!-- impeccable:product-schema 1 -->

Product record for the design tooling (`/impeccable`). It lives in `docs/` beside [design.md](design.md) because
impeccable resolves the two files as a pair from one folder. Source of every fact: [architecture.md](architecture.md),
the assignment in its Appendix A, and three answers given on 2026-11-10 (marked "confirmed").

## Platform

web

## Stack

Angular 21 (standalone components, signals, zoneless), Angular Material and the CDK, `@ngx-translate/core` with
`he.json` and `en.json`, Vitest, Playwright. Decided in architecture §8 and `.claude/skills/dc-web` before this
record was written; not asked. The client is served as static files by the .NET API.

## Users

One role: a business user at a statistics bureau. They know what the organization's data means (who an employee
is, what an inactive department implies) and do not know SQL, the tables or the joins between them. The same person
defines a control, runs it and reads its violations; there are no separate author and reader roles in v1.

Primary scene (confirmed): an office desk, a desktop monitor, daylight office lighting, during ordinary working
hours. The phone is the secondary scene: opening a run and reading its violations. When a desk need and a phone need
conflict, the desk leads. The layout is still written mobile first and checked at 390, 1024 and 1440.

A second audience reads the product once: the bureau's evaluators, who run the submission from a clean clone and
judge, among other things, how reachable it is for a non-technical user.

## Product Purpose

Data-quality controls without code. A user states a rule in business terms ("employees under 18 earning more than
15,000"), saves it as a control, runs it over all records of one entity and gets back the violations: the records
that match, each with the reason it matched. The system detects and reports. It never fixes, updates or deletes
organization data.

Success is a user who builds a correct control on the first attempt, trusts what a run returned, and can say why
each listed record is there.

## Positioning

Controls are data, not code: adding a control needs no development, and adding a business entity needs only a
glossary entry. The definition is separate from the query that implements it, the translation is deterministic, and
the user never meets a table name, a column name or a line of SQL on the way.

## Operating Context

- Three screens and one dialog: the controls list (home), the control editor, the run results, and the suggestions
  dialog. There is no dashboard and no other destination.
- Hebrew is the default language and the document direction is right to left; English sits beside it and flips the
  direction. Dates and numbers use the Hebrew locale.
- Every entity, field, relationship and operator label comes from the business glossary at run time. Nothing on
  screen may assume the sample data model (ministry, department, employee): another glossary must render as well.
- An internal tool with no sign-in in v1. Runs are synchronous: the user waits for the result of a run.
- It may be run on a machine with no internet access, so nothing the interface needs (fonts, icons) can come from a
  network.

## Capabilities and Constraints

- A control has a name, a description, one root entity and a condition tree: groups joined by AND or OR, conditions
  (field, operator, value or another field), and quantified conditions on related records ("at least one", "none").
- Relationship paths reach at most two hops from the root; nesting depth, the number of conditions and the length
  of value lists are limited by validation.
- The condition describes the violation. A comparison against a missing value does not match; missing data is found
  with the explicit "is empty" operators, and the interface says so beside the operator.
- Each condition has a stable id. Validation errors arrive as a code, parameters and a path to the offending
  condition; reasons arrive per matched condition as a key and parameters. The client turns both into text.
- A run stores a snapshot: an exact total and at most a capped number of violation rows. Search, filter, sort and
  paging read the snapshot.
- States the product must explain in plain language: no violations, more violations than the cap, a run that timed
  out, the engine being unavailable, a control that refers to a field the glossary no longer has, an invalid
  definition, an edit conflict.
- Not in v1: sign-in and roles, scheduled or background runs, export, a glossary editor, marking a violation as
  handled, notifications.
- Vocabulary, fixed in Hebrew and English: control (בקרה), violation (חריגה), run (הרצה), root entity (ישות ראשית),
  business glossary (מילון המונחים), condition tree (עץ תנאים).

## Brand Commitments

- Name (confirmed): בקרות נתונים, "Data Controls" in English. A neutral identity of its own. No bureau logo, name or
  colours appear in the interface: none were supplied, and the submission is a candidate's work.
- Hebrew voice (confirmed): actions are named with action nouns (שמירה, הרצה, עריכה, שכפול) and messages avoid a
  gendered second person. Plain, non-technical wording; the product's own vocabulary above, never a database term.
- Tone: a bureau's register. Findings are stated as facts with their numbers, without alarm and without cheer.

## Evidence on Hand

- The assignment text and its four example controls, in Hebrew (architecture, Appendix A).
- Planned and not yet in the repository on 2026-11-10: `contracts/glossary.json`, six example controls with the
  records each must flag, and the seeded sample database.
- None: brand assets, screenshots of a running product, user research, usage figures. Mock screens use synthetic
  names and numbers and say so; nothing may be presented as a customer, a quote or a measured result.

## Product Principles

1. Business language end to end. If a word on screen would not be said in the user's own office, it is the wrong
   word.
2. A control can always be read back as one sentence. The sentence is how the user checks the rule before saving
   and how they recall it later.
3. Every listed record carries its reason, and every error says what happened and what to do next.
4. Findings, not alarms. The product reports what it found and how much of it; judgment stays with the user.
5. Drawn from the glossary. The interface is a rendering of whatever the glossary describes, never of three known
   tables.

## Accessibility & Inclusion

Architecture §8 commits to the basics: visible labels, full keyboard operation, visible focus and sufficient
contrast, in both directions of text. Wording is gender-neutral (above).

Open decision: v1 names no formal standard or conformance level. Until one is set, the design reads "sufficient
contrast" as the WCAG AA ratios.
