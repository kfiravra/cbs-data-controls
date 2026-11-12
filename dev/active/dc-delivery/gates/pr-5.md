# PR #5: feat(web): one page, a new look, and the last design round

State: MERGED · merged 2026-11-11T20:19:51Z · merge commit d66670d · branch `feat/web-ux` into `main` · 15 commits · 178 files, +27920 -3485

Commits (oldest first):
- 22c64f1 feat(web): one page, with the editor and the results in a panel
- 3762765 feat(web): the new look
- 3b4013b fix(web): design critique and polish
- 8690539 fix(web): review fixes
- 15658ca feat(api): sort the controls list
- b47d203 feat(web): the last design round
- cc23057 fix(api,web): review fixes
- 929ff6f feat(api): sort a run's results by a field and by the reasons
- 0428a67 fix(web): hot fixes from the third read
- 039690b fix(api,web): review fixes of the hot fixes
- 54947e8 feat(web): the rule in words in the colours of its conditions
- 00f8600 fix(web): review fixes of the rule in words
- 3a49090 fix(web): the rule in words as one flowing sentence
- 9471424 fix(web): the neutral line of a group lies over no colour; one icon f…
- 9b5f79a fix(web): only a condition's own words are underlined in the rule in …

---

## What

Five passes on the client (`web/`), each from a read of the running app by its owner, and two small changes of
the api: the list's sort for the second pass, the sort of a run's records for the third.

### The UX pass (first read)

**One page.** The controls list is the page. The control editor and the run results open in a wide panel over
it, and the list stays in view beside the panel. The panel's X, Esc and a click beside it close it, and the focus
goes back to the row. On a phone the panel is the whole window. The addresses are kept (`/`, `/controls/<id>`,
`/runs/<id>`), and one is added, `/controls/<id>/runs`, for a control that has no run yet. Two tabs with counts,
active and archive; a picker of a control's runs in the results panel; the suggestions as a wide panel of cards;
"what do you want to check" as a plain question with one card per glossary entity; the rule in words as a bar at
the foot of the editor beside Save. **A new look**, dealt with the `design-taste-frontend` skill and applied as
the only theme: "Frost and slate", white cards on an off-white ground, a slate ink and one teal, in Heebo.

### The last design round (second read)

Seventeen items; after this round only bugs.

- **All tables are one design.** A head of column names and one bubble per row, over a real table so the
  columns line up (a card per row on a phone). A row of the list has three parts: its details, its run button,
  its actions. A click anywhere on the details opens the results of the last run (the name's link is stretched
  over them).
- **Every column of the list sorts on a click of its name**, ascending then descending, and the order is the
  server's: `GET /api/v1/controls` takes `sort` (`name`, `rootEntity`, `lastRun`, `violations`) and `dir`
  (`contracts/api.md`, ten api tests). A control that never ran sorts last in both directions; `rootEntity`
  follows the glossary's labels in the request's language. The results keep the server sort they have: the api
  orders a run's records by their identifying text, so the first column's name is the one that sorts.
- **Colour means status, the same everywhere:** violations red, a clean run green, a run that stopped amber,
  never ran and archived grey. This retires the first design's rule that a count is never red.
- **The archive behaves as the active list does:** a row per control that opens its last result, where the
  picker moves to earlier runs. Only run and edit are missing, on the row and in the panel.
- **No layout shift when a scrollbar appears** (the page and a panel's body keep its room from 640px);
  scrollbars are thin, half transparent and have no arrows.
- **Results panel:** the rule in words first, on a tint (how a rule is drawn was replaced by the last pass,
  below); then one block for what the run found (the count, the run's facts and the count by condition, which is the
  filter); then the records as wide as the panel; the count and the pager always in view at the foot.
- **Editor panel:** it closes at once, also over a changed draft, and a toast gives the draft back; the
  suggestions for a new control are one collapsed row with a sparkle, there from the start so nothing moves
  when they load; the conditions are in the first view; the builder is a flat list with one switch, and groups
  and conditions on related records are behind one "advanced" action (a saved control that has them shows them
  in full); no hover link between a row and its clause.
- **Type** set on tokens: one family, six sizes, three weights, four line heights.
- **Phone (390):** rows are cards, panels are the whole window, the sticky bars stay in reach, nothing scrolls
  sideways.

Not doing, on the owner's word: a findings summary above the list, keyboard shortcuts, bulk actions.

### Hot fixes (third read)

Seven items, fast: one reviewer at the end.

- **Every head of the results table sorts**, through the api: `GET /api/v1/runs/{id}/results` takes `sort=field`
  with `field` (an identifying field of the run's root entity, checked against the glossary; a number by value,
  anything else as text, a missing value last) and `sort=reasons` (how many, then their text). The field's
  value is read by a bound JSON path; nothing of the request is written into a statement (`contracts/api.md`,
  api tests).
- **A rule in words shows no bracket.** How a group is drawn instead was replaced by the last pass, below.
  Only the engine's own marks are read (the glossary's `groupOpen` and `groupClose`, in its connecting text): a bracket in a value
  the user typed or in a label stays as it is, and so do the brackets of a reason. The engine's text and the
  contract are unchanged, and a screen reader gets the plain sentence with each condition named.
- The condition letters became superscripts in this pass and left the sentence in the next one.
- **New control:** the suggestions row comes in with the choice of what to check (a short entrance, none under
  reduced motion), and every suggestion replaces the name, the description and the conditions.
- **Results:** the search shows its whole placeholder. **List:** the count line is a bar fixed at the bottom
  of the window, also for a single page.

### The rule in words (fourth read, and a fix from a look at it)

Six items and four notes sent while it was built, one reviewer at the end; then three items from a look at the
result, which took the lines and the step in of the groups back. What stands is described here. The client
only: no api, engine or contract change.

- **A colour per condition** from a fixed set of eight light colours (tokens, at half strength on the owner's
  word), in the order of the rule, started again when the set ends.
- **The rule in words is plain text** with the engine's own spacing: no letter in it and no ground under any
  word or group. Each condition's words are underlined in that condition's colour, by a drawn line that fades
  at both ends and lies inside its own line of text. It is set as body text.
- **One flowing sentence** that wraps as text does: no forced line and nothing set in. A condition and the
  joining word before it are one piece, whole while it fits on a line, so a line never ends on a joining word
  and a condition's words stay together; a condition longer than the line breaks inside its own piece.
- **Only the conditions are underlined.** A joining word carries no line, in a group or out of one, and a
  group is not drawn: no bracket, no tint, no line, no step in. (Two cuts drew a thin neutral line under the
  joining words of a group, as first asked; the owner's next looks took it back.)
- **One icon for suggestions:** the sparkle of the editor's row is also on the button that opens the
  suggestions panel beside "new control"; the light bulb is gone.
- **Everywhere a rule is shown:** the editor's bar, the top of the results, the suggestion cards in the panel
  and in the row of a new control.
- **The same colour marks the condition elsewhere:** the ground of its letter in the builder's rows, on the
  chips of the count by condition and beside each reason. The letters stay there; they left only the sentence.
- **A screen reader gets the plain sentence**, brackets and all, with each condition named by its letter where
  the letters stand on the screen (the editor, the results); a suggestion shows no letters and is read as the
  plain sentence. The drawing is hidden from it.
- **Suggestions in a new control:** an opened list stays open while what to check changes and closes when a
  suggestion is taken into the form.

## Why

It is the only thing a business user sees. The first read found three separate screens heavy to move between
and the look dated; the second asked for one table design, one colour language, a results panel that reads top
to bottom, and an editor that is simple until asked otherwise.

## How to test

```sh
cd web && npm ci
npx ng lint && npm run typecheck:e2e && npx ng test --watch=false && npx ng build
npx playwright install chromium     # once per machine
npm run e2e                         # the mocked specs, no service needed
cd ../api && dotnet test            # the list's sort is in Controls/ControlListTests.cs
```

With the database, the engine and the api up (README, "Engine" and "The api"):

```sh
cd web && npm run e2e:gate                                    # behind the dev server on 4200
E2E_BASE_URL=http://localhost:5000 npm run e2e:gate           # on the build the api hosts
```

What ran on 2026-11-11 on the branch's last state, with the engine and the api started from this branch's tree
against the shared database (`dev/active/dc-web/gates/phase-13.txt`; the earlier rounds' records are
`phase-10.txt`, `phase-11.txt` and `phase-12.txt`):

- `/check all --tests`: green. `sql-check` 27 assertions, `contracts-check` 5 checks, the engine's ruff, pyright
  and 521 tests, the api's build with warnings as errors, format and 389 tests (3 live ones skipped by their own
  switch), the client's type checks, lint, 390 unit tests in 37 files and build, the print guard and the hook
  tests. `sql-init` is skipped in a worktree by the runner.
- `e2e/mocked` on `mobile` and `desktop`: 219 passed, 5 skipped by project on purpose.
- `e2e/gate`: 18 of 18 behind the dev server and 18 of 18 on the build the api hosts.
- The last two commits (the sparkle on the list's button; no line under a joining word) came after that run
  and after the database reset. For them the client's checks and the mocked specs ran again (390 unit tests; 221 mocked specs passed, 5 skipped by project);
  the gate on the real stack did not, since it would leave its controls in the reset database.
- The list of every control the gate did not create was the same before and after each gate run.
- The review of the rule in words (one reviewer) found one critical point, the faint line, which is left to
  the owner (Risks, below), and six warnings and two notes, all fixed with tests; each is in the notes' Log.
  In the run after those fixes one mocked spec failed: it pressed the phone's sort select again while the list
  of its first choice was closing. The spec was wrong, not the client; it now waits, and the gate file says so.
- The earlier rounds: the hot fixes' review found one critical defect (the first cut of the bracket drawing
  took apart a bracket inside a value the user typed), fixed with tests.

A gate run leaves 18 archived controls with `e2e-` in their names and nothing active, as before. The dev
database is reset after the last run of each round and holds the six examples.

## Risks and rollback

- The api change is additive: a request without `sort` and `dir` is ordered by name, then id, as before.
  Reverting `feat(api): sort the controls list` and the client's commits after it brings back the list without
  sorting. `contracts/api.md` changes with the api in this branch, by the owner's word for this round.
- `sort=lastRun` and `sort=violations` order by a correlated read of each control's newest run. `lastRun` is one
  seek of the index on `dq.Run (control_id, started_at DESC)`; `violations` reads a control's runs to find the
  newest one's count, so its cost grows with a control's run history. The index that would serve it is a `sql/`
  change and is not in this branch.
- `sort=rootEntity` uses the glossary the api already holds and never calls the engine for a list; until the
  api has read a glossary once, it orders by the keys.
- Colour now carries status, always beside its words: a chip is never colour alone.
- `sort=field` needs the glossary to check the field and learn its type: the api's held copy serves, and the
  engine is asked only when the api holds none (then, and only then, the results can answer 503
  `ENGINE_UNAVAILABLE`). A stored value that is not a number in a number field sorts last and fails nothing.
- A rule longer than the two lines the editor's bar keeps for it scrolls inside the bar, as before.
- A condition longer than a line fills its own lines, and what follows it starts a new line: the price of
  keeping every shorter condition whole.
- A group is not shown in the sentence: "A and (B or C)" and "(A and B) or C" read alike on the screen. The
  builder shows the groups, and the copy that is read aloud keeps the engine's brackets.
- **The line under a condition's words is faint.** At half strength a colour stands 1.2 to 1.4:1 against the
  light grounds (2.7 to 3.3:1 on the editor's bar), and in the sentence it is the only thing that ties words
  to their condition; some pairs of the set are close for a colour-blind reader, and a rule of more than eight
  conditions repeats colours. The strength, the sentence without letters and the repeating set are the owner's
  words; the review named this its one critical point, and it is left to his eye. What is told by colour is
  also told without it: the letter stands with the colour in the builder, the filter and the reasons, and the
  copy that is read aloud names each condition. A full-strength token per colour for the line alone would keep
  the letters' grounds as they are.
- A draft that was closed is kept in memory only, one at a time, and is offered back for the twelve seconds of
  its toast; after that there is no way back to it. Closing the tab or reloading still asks through the
  browser's own prompt.
- The results panel reads a run's control to learn whether it is archived (one more request per panel); until
  that answer the run and edit buttons stay, and the api refuses them for an archived control as before.
- The simple and the advanced form of the builder is a state of the screen, not of the control.
- The list's search, tab, order and page are kept in memory while a panel is open and return to the address
  when it closes. A direct link to a run or a control opens it over the first page of the list.
- Tested in Chromium only, at 390×844 and 1440×900 (and measured at 1366×768 for the editor's first view).
- States the real stack was not made to produce (a timeout, the row cap, a database or engine that is down, a
  save conflict) are covered by the mocked specs alone.
- The new Hebrew texts have not had their read-through: `list.columns.run`, `list.sort.*`, `results.rule`,
  `results.archived`, `editor.conditions.waiting`, `editor.ideas.waiting`, `.loading` and `.none`,
  `editor.add.advanced` and `.advancedHint`, `editor.toast.closed`, and those of the first pass (`list.tabs`,
  `list.archiveNote`, `list.noArchived`, `editor.what`, `results.picker`, `results.never`, `suggestions.note`).
- Still open, as limitations: nested groups have no name for a screen reader; a save conflict loads the current
  version and discards the draft; a list row's count may belong to an older version of the rule.

## Docs for dc-delivery

Sentences in documents this task does not own that these passes make untrue, or limits a reader should be told
(the full list is in `dev/active/dc-web/notes.md`):

- `docs/architecture.md` §7: `GET /api/v1/controls` takes `sort` and `dir`; a control that never ran sorts last,
  and `rootEntity` follows the glossary's labels. `GET /api/v1/runs/{id}/results` takes `sort=field` with `field`
  and `sort=reasons`. In §8: every head of the results sorts; a rule in words is one flowing sentence of plain
  text with no letter and no bracket, each condition's words underlined in the colour its letter has in the
  builder, the filter and the reasons; a joining word carries no line and a group is not drawn (the engine's
  text is unchanged).
- `docs/architecture.md` §8 and §9: the client is one page; the list is the parent route and the editor, the
  results and the suggestions open in a panel over it; `/controls/<id>/runs` is added. Every table is one
  design, a bubble per row; a list row has three parts and the whole of its details opens the last run; a
  column's name sorts by it through the api; a status has one colour everywhere, which replaces "a count is
  never red". Screen 2: nothing chosen in a new control, one collapsed row of up to three suggestions, a builder
  that is a flat list with one switch and an "advanced" action, a panel that closes without asking and a toast
  that gives a changed draft back. Screen 3: the rule on a tint, one block (count, facts, count by condition as
  the filter), the records as wide as the panel, the pager always in view, a picker of the control's 50 newest
  runs; an archived control's runs are read the same way with no run and no edit. The reusable components
  list: "relationship map" is "entity cards" and "entity chain"; "run summary" and "breakdown" are one "run
  overview"; "sort header" is new.
- `docs/assumptions-limitations-extensions.md`: the
  list's search, tab, order and page are not in the address while a panel is open; a closed draft is kept in
  memory, one at a time, until the page is reloaded; the simple and the advanced form of the builder is not
  stored with the control; the word for an entity is not shown anywhere in the interface.
- README, the screenshots: every image of the first delivery shows the old look and the old three screens, and
  is to be taken again from a gate run on this branch.
- Any document that names the look or the font: "Frost and slate" in Heebo; the font's third-party notice
  changes from IBM Plex Sans Hebrew to Heebo (both SIL Open Font License 1.1).
- `docs/ai-usage.md`: the first pass used `/impeccable shape`, the `design-taste-frontend` dealer for the one
  direction, one critique run of two opus sub-agents and one opus reviewer. The last round used the same
  skill's rules for a UI fragment for the row, `/impeccable typeset` and `polish`, one opus sub-agent that
  brought `docs/design.md` in line, and two opus reviewers (api, web). The hot fixes used one opus reviewer,
  and so did the rule in words; the fix that made it one flowing sentence had none.

