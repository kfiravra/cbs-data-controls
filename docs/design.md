---
version: alpha
name: Data Controls
description: Visual design of the Data Controls client. Direction, tokens, type, components, responsive rules, motion and states.
colors:
  ground: "#f7f9fa"
  surface: "#ecf0f2"
  card: "#ffffff"
  ink: "#1f3038"
  muted: "#5d6b72"
  action: "#0d7480"
  action-hover: "#106a76"
  action-pressed: "#12616c"
  on-action: "#ffffff"
  action-ink: "#0b5f69"
  action-tint: "#0d74801a"
  inverse: "#1f3038"
  on-inverse: "#f7f9fa"
  on-inverse-muted: "#bbc1c4"
  on-inverse-tonal: "#f7f9fa24"
  on-inverse-line: "#f7f9fa3d"
  line: "#1f30381c"
  line-strong: "#1f303833"
  control-line: "#74838b"
  tonal: "#1f303812"
  card-hover: "#f4f7f8"
  scroll: "#1f303880"
  scroll-on-inverse: "#f7f9fa80"
  danger: "#b51522"
  danger-tint: "#b515221a"
  danger-line: "#b5152259"
  warning: "#825100"
  warning-tint: "#8251001a"
  warning-line: "#82510059"
  success: "#2d6a1e"
  success-tint: "#2d6a1e1a"
  success-line: "#2d6a1e59"
  scrim: "#1f303847"
typography:
  figure:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: 2.25rem
    fontWeight: 600
    lineHeight: 1.2
  page-title:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: 1.5rem
    fontWeight: 600
    lineHeight: 1.2
  title:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: 1.125rem
    fontWeight: 600
    lineHeight: 1.35
  name:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: 1rem
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
  body-strong:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: 1rem
    fontWeight: 500
    lineHeight: 1.5
  read:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: 1rem
    fontWeight: 500
    lineHeight: 1.7
  small:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  small-strong:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: 1.35
  label:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: 0.8125rem
    fontWeight: 500
    lineHeight: 1.35
  caption:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: 0.8125rem
    fontWeight: 400
    lineHeight: 1.5
  mark:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: 0.75rem
    fontWeight: 600
    lineHeight: 1
  mark-corner:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: 0.625rem
    fontWeight: 600
    lineHeight: 1
rounded:
  xs: 4px
  chip: 6px
  sm: 8px
  md: 12px
  lg: 20px
spacing:
  "1": 4px
  "2": 8px
  "3": 12px
  "4": 16px
  "5": 24px
  "6": 32px
  "7": 48px
  "8": 64px
  gutter-phone: 16px
  gutter-tablet: 32px
  gutter-desktop: 48px
  container: 1280px
  sheet: 1120px
  sheet-inset: 12px
components:
  app-bar:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    height: 60px
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.on-action}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.sm}"
    height: 44px
    padding: 0 24px
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.sm}"
    height: 44px
    padding: 0 24px
  button-secondary-hover:
    backgroundColor: "{colors.ground}"
  button-small:
    typography: "{typography.small-strong}"
    height: 36px
    padding: 0 12px
  button-on-inverse:
    backgroundColor: "{colors.on-inverse}"
    textColor: "{colors.inverse}"
  button-on-inverse-quiet:
    backgroundColor: "{colors.inverse}"
    textColor: "{colors.on-inverse}"
  icon-button:
    textColor: "{colors.muted}"
    rounded: "{rounded.sm}"
    size: 44px
  field:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    height: 44px
    padding: 0 12px
  segmented-option:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.small-strong}"
    height: 36px
    padding: 6px 12px
  segmented-option-selected:
    backgroundColor: "{colors.inverse}"
    textColor: "{colors.on-inverse}"
  tab:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    typography: "{typography.small-strong}"
    rounded: "{rounded.sm}"
    height: 36px
    padding: 0 16px
  tab-selected:
    backgroundColor: "{colors.inverse}"
    textColor: "{colors.on-inverse}"
  choice:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.name}"
    rounded: "{rounded.md}"
    padding: 12px 16px
  choice-selected:
    backgroundColor: "{colors.inverse}"
    textColor: "{colors.on-inverse}"
  chip:
    backgroundColor: "{colors.tonal}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.chip}"
    height: 24px
    padding: 0 8px
  status-chip:
    backgroundColor: "{colors.tonal}"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.chip}"
    height: 26px
    padding: 2px 8px
  status-chip-violations:
    backgroundColor: "{colors.danger-tint}"
    textColor: "{colors.danger}"
  status-chip-clean:
    backgroundColor: "{colors.success-tint}"
    textColor: "{colors.success}"
  status-chip-stopped:
    backgroundColor: "{colors.warning-tint}"
    textColor: "{colors.warning}"
  mark:
    backgroundColor: "{colors.action-tint}"
    textColor: "{colors.action-ink}"
    typography: "{typography.mark}"
    rounded: "{rounded.chip}"
    size: 18px
  mark-corner:
    typography: "{typography.mark-corner}"
    rounded: "{rounded.xs}"
    size: 13px
  mark-on-inverse:
    backgroundColor: "{colors.on-inverse-tonal}"
    textColor: "{colors.on-inverse}"
  value:
    backgroundColor: "{colors.action-tint}"
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.chip}"
    padding: 1px 6px
  rule-bar:
    backgroundColor: "{colors.inverse}"
    textColor: "{colors.on-inverse}"
    typography: "{typography.body-strong}"
    padding: 16px 32px
  table-row:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: 12px 16px
  table-row-hover:
    backgroundColor: "{colors.card-hover}"
  sheet:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    width: 1120px
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: 24px
  rule-block:
    backgroundColor: "{colors.action-tint}"
    textColor: "{colors.ink}"
    typography: "{typography.read}"
    rounded: "{rounded.md}"
    padding: 16px 24px
  overview:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: 24px
  meter:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.small}"
    rounded: "{rounded.sm}"
    height: 36px
    padding: 4px 12px
  meter-selected:
    backgroundColor: "{colors.ground}"
  ideas:
    backgroundColor: "{colors.action-tint}"
    textColor: "{colors.action-ink}"
    typography: "{typography.small-strong}"
    rounded: "{rounded.md}"
    height: 44px
    padding: 0 16px
  ideas-count:
    backgroundColor: "{colors.action}"
    textColor: "{colors.on-action}"
    typography: "{typography.label}"
    rounded: "{rounded.chip}"
    height: 20px
    padding: 0 6px
  banner-warning:
    backgroundColor: "{colors.warning-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: 12px 16px
  banner-danger:
    backgroundColor: "{colors.danger-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: 12px 16px
  dialog:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: 24px
    width: 640px
  dialog-small:
    width: 440px
  toast:
    backgroundColor: "{colors.inverse}"
    textColor: "{colors.on-inverse}"
    typography: "{typography.small}"
    rounded: "{rounded.md}"
    height: 44px
    padding: 8px 16px
---

# Design System: Data Controls

The visual design of the client in [architecture.md §8](architecture.md): one page (the controls list) with
the control editor, the run results and the suggestions opening in a panel over it, for business users at a
statistics bureau, in Hebrew, right to left, written mobile first. Product context is in
[PRODUCT.md](PRODUCT.md).

How it was made. The first direction (2026-11-10: a cool grey page, a near black bar, one cobalt, square
corners, IBM Plex) was built and shipped, and its owner read it in the browser and found it dated and dull.
On 2026-11-11 the structure became one page, and one new direction was dealt with the `design-taste-frontend`
dealer and applied as the only theme: there is no second theme and no switch. This document records what the
client does now. The tokens in the frontmatter are normative; the prose says how to apply them.

## Overview

**Creative North Star: "The Annotated Table"**

A statistical table is trusted because every figure can be traced: a small mark beside the number leads to the note
that explains it. This interface works the same way. Every condition of a control carries a mark, a letter given in
order (א, ב, ג), and the mark travels with the condition wherever it is spoken of: on its row in
the builder, at the corner of its clause in the sentence that reads the control back, on its chip in the count of a
run by condition, and beside every reason a record is listed. A user who asks "why is this record here" follows a letter, not a query.

The mood is light, exact and unhurried. Light: white cards on a frost ground, soft corners, air between things.
Exact: aligned numerals, hairline edges, one measure of everything. Unhurried: nothing blinks or counts up, a
status is said in words with one of four colours beside them, and the teal is spent on what the user is about to
commit and on what is offered to be read. The primary scene is an office desk in daylight, so there is one light theme and no dark one.

The direction as dealt:

| Part | Dealt | How it stands |
|---|---|---|
| Palette | `cool-white-slate`, "Frost and slate": the first of the three dealt for a light software page | An off-white ground, white cards on it, a slate ink and one teal. The dealer's very first hand was a dark page; the desk in daylight asks for a light one, so the deal was repeated for light and its first palette taken. The teal is far from the three state colours, so red keeps its one meaning. |
| Type | `host` (Host Grotesk), the first pairing dealt | Host Grotesk has no Hebrew glyphs, and neither has any other face the dealer holds but IBM Plex, which the first direction used. The interface is in Hebrew, so the face is Heebo: the neo-grotesk nearest the dealt one whose Hebrew and Latin were drawn as one family. The language decided, not taste. |
| Radius | `soft`: 8, 12, 20 | The dealer's default. Controls 8, panels 12, the list and the panel 20. |
| Buttons | `arrow` | A filled main button and a quiet second one. The arrow itself says "this leads on" and is a device of a site's calls to action: the buttons of this page act in place (save, run, archive), so none carries it, and the second button takes the system's plain form, a white button with a line round it. |
| Mark | `wordmark` | The name of the product is its mark. No symbol stands beside it and there is no bureau logo. |

Website parts of the deal (navigation, footer, hero, scroll moments, photographs) have no place in an
application and were not used.

**Key Characteristics:**

- One mark per condition, the same everywhere the condition appears.
- Three lights with three jobs: the ground is the page, a card is what stands on it, the surface is where things
  are operated.
- One teal, kept for the main action, links, focus, marks, and the tint of the rule in words and of an offer.
- One status language: violations red, a clean run green, a stopped run amber, nothing to say grey.
- Ink selects: a chosen tab, a chosen card, a chosen option are filled with the ink.
- Every row is a bubble: a white card of its own, with room between it and the next.
- Soft corners, hairline edges, flat cards; a shadow only for what floats, and for a card about to be pressed.
- Standard controls at one height of 44px; nothing invented where a known control exists.
- Sentences before symbols: the control, the result of a run and each reason are written out.

## Colors

A frost page, white cards, a slate ink and one teal; three state colours of matched weight that appear only
with an icon or words. Each colour below is the CSS custom property `--color-<name>`.

### Primary

- **Action** (`#0d7480`): the one filled button of a view, text links, the focus ring, the caret, the count on
  the row of ideas and the first instant of the settle. **Action hover** (`#106a76`) is its hover; **Action pressed** (`#12616c`) shows a press when motion is
  reduced. **On action** (`#ffffff`) is text on it.
- **Action tint** (`#0d74801a`, 10%): the ground of a mark, of a highlighted value, of the rule in words on a
  results panel and of the row of ideas in the editor. **Action ink** (`#0b5f69`): the letter of a mark, and the
  text that stands on the tint (the label of the rule, the row of ideas), a step darker than Action so it reads on
  the tint also where the tint lies over Surface.

### Neutral

- **Ground** (`#f7f9fa`): the page, the body of a results panel (so its rows stand on the page again), the
  list's foot, the chosen chip of the count by condition, a second button under the pointer.
- **Card** (`#ffffff`): what stands on the page: a row of a table, the panel, the overview of a run, a dialog, a
  card, a second button, and the inside of every field. The bar's white is also painted on the canvas, so it
  reaches the window's edge over the room kept for the scrollbar. **Card hover** (`#f4f7f8`): the details of a row
  under the pointer, and a chip of the count by condition; one step from the card towards the ground.
- **Surface** (`#ecf0f2`): where the user operates: the builder, the track of the tabs.
- **Ink** (`#1f3038`): text. As **Inverse** it is a ground: the bar of the rule in words, a chosen tab, card or
  option, the toast and the tooltip, with **On inverse** (`#f7f9fa`) as their text. **On inverse muted**
  (`#bbc1c4`): the last valid sentence, kept on the bar while the draft is unfinished or refused. **On inverse
  tonal** (`#f7f9fa24`) and **On inverse line** (`#f7f9fa3d`): marks and the edge of the second button on the bar.
- **Muted** (`#5d6b72`): labels, hints, meta lines, resting icons. Never a sentence the user must read to act.
- **Line** (`#1f30381c`, 11% ink): the edge of a row's bubble and of a card, the line between the parts of a row,
  the line over a foot. **Line strong** (`#1f303833`, 20% ink): the edge of a row under the pointer, of a second
  button, of a choice card and of a chip of the count by condition, the builder's rail. **Control line** (`#74838b`): the border
  of every field.
- **Tonal** (`#1f303812`): chips, the grey status chip, skeleton bars, an icon button under the pointer. **Row
  hover** (`#1f30380a`) is declared and no component draws it now: a row under the pointer takes Card hover.
- **Scroll** (`#1f303880`, 50% ink): the thumb of every scrollbar. **Scroll on inverse** (`#f7f9fa80`): the same
  on the bar of the rule in words.
- **Scrim** (`#1f303847`, 28% ink): the page behind an open panel or dialog. Light on purpose: the list stays
  readable under it.

### State

- **Danger** (`#b51522`): violations (the status chip of a row, the count of a run, the counts by condition),
  system errors, an invalid field. **Warning** (`#825100`): a run that stopped (timed out or failed), a result
  that is true but partial (the row cap), a control that can no longer run, an edit conflict. **Success**
  (`#2d6a1e`): a run with no violations; a leaf green, kept away from the teal.
- Each has a **tint** (10%, the ground of its banner and of its status chip) and a **line** (35%, the banner's
  border). The state colour itself is used for the icon, the figure and short status text, never for a paragraph.

### Contrast, measured

| Pair | Ratio |
|---|---|
| Ink on Ground / on Surface / on Card | 12.9 / 11.9 / 13.7 |
| Muted on Ground / on Surface / on Card | 5.2 / 4.8 / 5.5 |
| Action on Ground / on Surface / on Card | 5.2 / 4.8 / 5.5 |
| On action on Action / on Action hover | 5.5 / 6.3 |
| Action ink on Action tint over Card / over Surface | 6.4 / 5.6 |
| On inverse on Inverse / On inverse muted on Inverse | 12.9 / 7.5 |
| Danger, Warning, Success on Ground | 6.4, 6.4, 6.2 |
| Danger, Warning, Success on their own tint over Surface (worst case) | 5.0, 5.1, 5.0 |
| Danger, Warning, Success on their own tint over Card (a status chip) | 5.7, 5.8, 5.7 |
| Danger, Success on Card (the figure of a run) | 6.8, 6.6 |
| Muted on Tonal over Card (the grey status chip) / on Card hover | 4.8 / 5.1 |
| Action ink, Ink on Action tint over Ground (the rule of a results panel) | 6.1, 11.3 |
| Control line against Card / Ground / Surface | 3.9 / 3.7 / 3.4 |

Text is held to 4.5:1 and the boundary of a control to 3:1. Row rules and the edge of a card are decoration and
are not. Translucent tokens (tints, Tonal, the lines) are measured as painted over what they lie on; a tool that
compares them unmixed, as the DESIGN.md linter does, reports a failure that is not there.

### Named Rules

**The Three Lights Rule.** Ground is the page. A Card is a thing on the page: it is white, it has a hairline
edge or floats, and it is where things are read. Surface is where things are operated, always inside a card and
never bare on the ground. Inside a Surface panel every field is a Card, so a field always reads as a white well.

**The One Teal Rule.** A view has one filled Action button. Teal otherwise appears only as a link, a focus
ring, a mark, the settle and the count of ideas; its tint grounds a mark, a value, the rule of a results panel and
the row of ideas, and on that tint a label takes Action ink. It is never a heading colour on a neutral ground, an
icon colour for decoration, or a full-strength background behind ordinary content.

**The Ink Selects Rule.** A chosen option (a tab of the list, the card of what to check, all of / any of, a
checked box) is filled with the Inverse ground; the chosen chip of the count by condition and a ticked suggestion
take an Ink edge. Teal acts and marks; ink selects.

**The One Status Language Rule.** A run's status has one colour wherever it is shown: violations are Danger, a
clean run Success, a stopped run Warning, and a control that never ran, or is archived, Muted on Tonal. The same
colours hold on a list row, on the archive's rows, on the count of a results panel and on its state panels. (The
earlier rule that a count is never red was retired by the product owner on 2026-11-11.)

**The Never Colour Alone Rule.** A state is an icon, a sentence that names it and, where there is one, the next
step. The colour is the third signal, not the first.

## Typography

**Display, body and label font:** Heebo, with `system-ui` behind it. One family for everything. Its Hebrew and
its Latin letters and digits were drawn together, so Hebrew text with an English name or a number in it stays
one texture.

**Character:** a calm, open neo-grotesk with a full, even Hebrew: easy in a table, clear at 13px, firm at 24.

Three weights, each a token: 400 (`--weight-regular`) for what is read, 500 (`--weight-medium`) for labels,
buttons, chips and the rule in words, 600 (`--weight-strong`) for titles, names, figures and the letter of a mark.
Four line heights, each a token: 1.2 (`--leading-tight`) for page titles and figures, 1.35 (`--leading-title`) for
section titles, names and labels, 1.5 (`--leading-body`) for body and small text, 1.7 (`--leading-read`) for lines
that carry marks and values. A role is a size with its weight and its line height; component styles take all
three from these tokens, and a one-line box (a button, a mark, the name in the bar) sets 1. The font is one variable file per script (Hebrew, Latin) and ships with the application.
No mono face is loaded: nothing on the page is code.

### Hierarchy

Sizes are fixed rem steps, not fluid, and the same at every width: label 13, small 14, body 16, title 18, page 24,
figure 36.

- **Figure** (600, 2.25rem, 1.2): the number of violations in the overview of a run, its noun beside it in Title
  size; Danger, and Success for a run that found none. One per panel at most.
- **Page title** (600, 1.5rem, 1.2): the `h1` of the list and of a panel: the list's name, the control's name on
  its results.
- **Title** (600, 1.125rem, 1.35): section headings, the name in the bar, the title of a state or a dialog, the
  name of a suggestion card.
- **Name** (600, 1rem, 1.35): the name of a control on its row, the identifying field of a record, the name on a
  card of what to check and on an idea.
- **Body** (400, 1rem, 1.5) and **Body strong** (500): running text and field text; buttons, a banner's title, the
  highlighted value, the sentence on the bar from 720px of panel width.
- **Read** (500, 1rem, 1.7): the rule in words on a results panel and in the archived editor. A reason takes the
  same line height at 400.
- **Small** (400, 0.875rem, 1.5) and **Small strong** (500): descriptions, meta lines and notes; field labels,
  tabs, small buttons, the chips of the count by condition, an error under its field, the row of ideas, the
  sentence on the bar of a narrow panel.
- **Label** (500, 0.8125rem, 1.35) and **Caption** (400, 1.5): chips, status chips, column heads, the joining word
  on the rail, the terms of the overview, the chain of what connects; hints under a field, the description on a
  card of what to check.
- **Mark** (600, 0.75rem) and **Mark corner** (600, 0.625rem): the letter of a condition at the start of its row,
  and as a superscript over the start corner of its clause in a sentence.

### Named Rules

**The No Tracking Rule.** Hebrew is never letter-spaced, tighter or wider, at any size. The dealt pairing's negative
display tracking is not applied.

**The Thirteen Floor Rule.** No text is smaller than 0.8125rem, the letter of a mark aside: one letter that
names its condition, also said in words where nothing else says it. Text the user must read to act (a message, a
reason, an instruction) is 1rem; 0.875rem is for support beside it.

**The Standing Numbers Rule.** Digits are Western (0 to 9) and share one width, so columns of numbers align.
Numbers, dates, currency and durations are formatted by the locale (`he-IL`: `15,000 ₪`, `10.11.2026`, `09:12`),
and a range is written with a word (`1 עד 10 מתוך 23`), not a dash, so its two ends cannot swap sides in
right-to-left text.

Further type rules: user data that may be in the other script (a person's name) is isolated with `<bdi>`. A prefix
joins its number with a maqaf (`מ־18`). Quotation marks are the Hebrew locale's pair (`”ריק”`). There is no italic
and no capitals style: emphasis is weight.

## Layout

One page. Its content is one column, at most 1280px wide, centred, with a side gutter of 16px on a phone, 32px
from 640px and 48px from 1024px. The bar (60px) spans the window; its content keeps the same edges. Under the
list its foot (the range and the pager) is a bar fixed at the bottom of the window, a Card with a Line over it as
the foot of the results panel is, there whether the list is longer than the window or one row.

**The panel.** A control or a run opens in a panel over the list: a card at the inline end, as tall as the window
less 12px of room on every side, `min(1120px, the window less between 48 and 320px)` wide, with the large radius
and the overlay shadow. The list stays in view beside it, at the start edge, under the scrim: the names of the
controls remain readable. Below 640px the panel is the whole window, square, with no room around it. A panel has
a head that stays (the title, one meta line or the picker of runs, the actions; the close button at its end), a
body that scrolls, and a foot that stays: for the editor the bar of the rule in words, for the results the count
and the pager under the records. The suggestions are the same panel.

What is inside a panel answers to the panel's width, not the window's (container queries on the panel): the
overview of a run and the bar of the rule in words change at 720px of panel, the grid of suggestion cards at
880px, the editor's details and section heads at 900px.

Spacing uses eight steps: 4, 8, 12, 16, 24, 32, 48, 64 (`--space-1` to `--space-8`). 8 between a label and its
control, between the controls of one condition and between two rows of a table; 12 between cards of a row; 16
between fields and between the blocks of a results panel; 24 between the sections of the editor and at the top of
a panel's body. A panel's body has 16px of side room on a phone and 32 from 640. There is always more space above
a heading than under it.

**Scrolling.** Every scrollbar is thin (10px), with a Scroll thumb inset 2px, no arrows and no drawn track; a
browser without the scrollbar pseudo-elements takes `scrollbar-width: thin` and `scrollbar-color` instead. From
640px the page and a panel's body keep the room of their scrollbar (`scrollbar-gutter: stable`), so nothing moves
sideways when content grows past the window. Below 640px the scrollbar lies over the page and keeps no room.
Nothing scrolls sideways at any width: a long value breaks inside its tint, a table becomes cards.

| | Below 640 | From 640 | From 900 (the window for the list, the panel for what is in it) |
|---|---|---|---|
| List head | Title, then the two actions as equal buttons in one row | Actions at the end of the title's row | Same |
| Tabs, search, filter | The tabs as one track, full width; under them the search and one square filter button | The same two rows, the filter as a select | One row: the tabs at the start, the search and the filter at the end |
| Controls list | One card per row, 12px apart: name and description; what is checked; the status and the last run on one line; under a line, run at the start and the actions at the end. A select in the toolbar sorts | A table of bubbles, 8px apart, under a head of sort buttons: four columns (40%, 16%, 18%, 16%), then the run and the actions, each behind a line | Same |
| Panel | The whole window | A floating card, 12px of room, the list beside it | Same, up to 1120px wide |
| Panel head | Title and meta, then the actions as one row | Actions at the end of the title's row | Same |
| Editor | One column: name, description, what to check (cards stacked), the row of ideas, conditions; the bar: sentence, status, then two equal buttons | Cards in a row | From 720 of panel the bar in one row: the sentence and its status, then the buttons. From 900 the name (22rem) and the description (36rem) side by side, and a section's title and hint on one line |
| Results | One column: the rule, the overview (the count and the facts, then the count by condition under a line), the records, the foot | Same | From 720 of panel the overview in two parts side by side (1fr and 2fr, a line between); the records as wide as the panel |
| Results rows | One card per record: the identifying fields on one line, the reasons under them; a sort select | A table of bubbles with a sortable first header | Same |
| Suggestions | One column of cards | Same | Two cards in a row |
| Controls | Every control 44px high | Small controls (36px) allowed | Same |
| Dialog | Full width inside the gutters | Up to 440px for a confirmation | Same |

Name and description in the editor keep a width that is easy to read (40rem at most, 22rem and 36rem when side
by side), not the width of the panel. The description is two rows and stays two rows; more text scrolls inside
it. The editor is laid out so that the conditions are in the first view: the details have no visible heading,
the cards of what to check are compact, and their chain and summary share one line.

Below 640px the sticky bars (the editor's bar of the rule in words, the results' foot, the list's foot) stay in
reach at the bottom of the window; the two feet of a table keep the room of the device's safe area.

A condition row answers to its own width, not to the window: it is one line (mark, field, comparison, value,
remove) when its group is at least 560px wide and stacks below that. Each level of nesting indents 24px on a
phone and 32px from 640px.

Right to left:

- Only logical properties (`margin-inline-start`, `inset-inline-end`, `border-start-start-radius`,
  `text-align: start`), so the layout holds for any language the interface gains later, whatever its direction.
  The one thing a logical property cannot say, which way the panel slides in, reads a sign from the direction.
- Chevrons follow the reading direction: next page points to the end edge. Icons that show a thing and not a
  direction (run, search, edit, copy, archive, refresh) are never mirrored.
- The builder's rail stands on the start edge. A mark in a sentence stands at the top corner of its clause, on the
  start side. The panel stands at the end edge.

## Elevation & Depth

The page is flat. Depth is said with the three lights and a hairline: a card or a row is white on the frost
ground with a Line edge; an operating panel is Surface inside a card. A row under the pointer is not lifted: its
details take Card hover and its edge Line strong.

### Shadow Vocabulary

- **Overlay** (`0 24px 48px -12px #1f303829, 0 2px 8px #1f303814`): for what floats above the page: the panel, a
  dialog, a menu or select panel, a toast.
- **Raised** (`0 6px 16px -6px #1f303824, 0 1px 2px #1f30380f`): a card that can be pressed (a choice of what to
  check, a suggestion for it), while the pointer is on it.

### Named Rules

**The Flat Page Rule.** Nothing that is part of the page casts a shadow at rest. If a thing has the Overlay
shadow, it can be dismissed; if it takes the Raised one, it is about to be pressed.

**The No Box In A Box Rule.** A card never holds another card, and a Surface panel never holds another. Inside
the builder, depth is a rail; inside a row, its parts are divided by a line. A panel whose body holds rows (the
results) paints that body the ground, so its rows and its overview stand on the page again.

## Shapes

Soft, five radii: 4px for the focus outline, the sort button and a mark at the corner of a clause; 6px for marks,
chips, status chips and highlighted values; 8px for every control and button, a chip of the count by condition
and an idea; 12px for a row's bubble, panels, banners, toasts, menus, cards, the rule block, the overview and the
row of ideas; 20px for the panel and a dialog. No pills and no circles, aside from the spinner, the 6px dot of a
status chip and the thumb of a scrollbar. The panel of a select keeps the component library's 4px:
the library has no token for its shape.

Lines are 1px. A field's border is Control line and turns Muted on hover, Action with a soft 3px ring on focus,
and Danger, doubled to 2px, when invalid. A rule between rows and the edge of a card are Line; the edge of a
second button, of a choice card and of a hovered row, and the builder's rail, are Line strong. No coloured stripe
marks the side of a row, a banner or a card.

Icons are Material Symbols, Sharp, weight 400, drawn in the colour of the text beside them: 20px by default, 16px
inside small text and marks of status, 24px at the head of a state panel. They ship as SVG with the application.
The suggestions panel is opened with the light bulb. The row of ideas in the editor carries a sparkle, drawn for
this project in the same box as the Sharp set; its words say what is offered, never that a machine
made it. A column that does not sort now shows `unfold_more` at 55%; a sorted one an up or down arrow.

## Components

### Bar

A card across the window, 60px, with a Line under it and the name of the product at the start, linking home. The
name is the mark (600, Title size): there is no symbol and no language switch. It scrolls with the page. Its
white and its line are also painted on the canvas, so the bar reaches the window's edge over the scrollbar's room.

### Buttons

Plain and exact; they step, they do not glow.

- **Shape:** 44px high, 24px side padding, 8px radius, Body strong. Small: 36px, 12px, Small strong, never below
  640px.
- **Primary:** Action ground, On action text. One per view. **Second:** Card ground, Ink text, a Line strong
  edge; Ground under the pointer. Every other button. **Text:** Ink text with an underline; a banner's action,
  "open in the editor".
- **On the bar of the rule in words:** the main action is On inverse with Inverse text; the second is clear with
  an On inverse line edge.
- **Icon button:** 44px square, Muted icon, Tonal ground on hover; always with a name for assistive technology and
  a tooltip.
- **States:** hover changes the ground and lifts 1px for a fine pointer; a press sinks 1px and scales to 0.985;
  focus is the ring; disabled is Tonal ground with Muted text and no edge; while its action runs, the button
  looks the same, is unavailable and keeps the focus (Dialogs and toast, below), and shows a 16px spinner before
  its label (`ההרצה מתבצעת`).
- An underline anywhere (text button, link, adder) rests at 40% of its text colour and fills on hover.

### Fields

- **Style:** Card fill, 1px Control line, 8px radius, 44px, Body text, 12px side padding. A visible label above
  (Small strong, 8px away), never a floating or placeholder label. A hint under it in Caption.
- **Kinds:** text, text area (two rows, not resizable), select (a caret at the end; a search, a filter or the
  picker of runs may carry its own label inside as a Muted prefix: `מה נבדק: הכול`, `הרצה:`), number with a unit
  at the end (`₪`, `שנים`), date, and a list of values as chips inside the field.
- **Focus:** Action border and a soft 3px ring, at once. **Hover:** Muted border.
- **Error:** a 2px Danger border, and under the field its reason in Small strong Danger with the error icon: what
  is missing and what to enter (`חסר ערך להשוואה. יש להזין סכום.`). Errors show on save, not while typing.

### Tabs of the list

Two tabs on one Surface track (12px radius, 4px of room): `פעילות` and `ארכיון`, each with the number of controls
it holds as a small chip (a Card chip on a resting tab, so its Muted digits keep 5.5:1). The chosen tab is
filled with Inverse. The numbers follow the search and the filter, so
a tab says how many of what was asked for it holds. One stop of the keyboard: an arrow, Home or End moves to the
other tab and shows it. Under the archive tab one line says what the archive is: only controls are archived,
their runs and results are kept, and each can be duplicated into a new control.

### Segmented control

Two or three joined buttons sharing one border; the selected one is filled with Inverse. Used for all of / any
of. 36px, 44px on a phone. Keyboard focus is a 2px ring drawn inside the segment, because the shared border clips
what is outside it: Action on a resting segment, On inverse on the selected one.

### Chips

- **Chip:** Tonal ground, Label text, 24px, 6px radius. Facts and evidence, the count on a tab, and values in a
  list field (30px there, with a remove button). A chip is never a button.
- **Status chip:** the result of a run, on a list row and in the head of an archived control's results. Label at
  500, 26px, 6px radius, a 6px dot of its colour before the words; a spinner takes the dot's place while a run is
  on its way. Violations (`3 חריגות`) are Danger on Danger tint, `ללא חריגות` Success on its tint, `ההרצה נעצרה`
  Warning on its tint, and `טרם הורצה`, `בארכיון` or any archived row Muted on Tonal. It always carries its words.
- **Chips of the count by condition** are the one chip that is a button: on the overview of a run, Card ground,
  a Line strong edge, 8px radius, 36px, Small. Card hover and a Control line edge under the pointer; the pressed
  one (the filter of the records) takes the Ground and an Ink edge doubled to 2px.

### The mark and the value

The signature of the system.

- **The groups of a rule** are drawn, not written: no bracket character of the engine's sentence stands on the
  screen. What a pair of brackets holds is one soft block (Tonal on a light ground, On inverse tonal on the bar,
  6px radius, 8px of room at its sides), and a block in a block is a shade deeper. Where the top level of a rule
  joins groups, each stands on a line of its own, led by the word that joins it to the line before (Small,
  Muted; Action ink on the rule's tint). Only the engine's own group marks are drawn this way: the glossary's
  `groupOpen` and `groupClose`, read in the engine's connecting text. A bracket in a value the user typed, in a
  field's label or in the name of a relationship is data and is written as it is. The engine's text is
  untouched: beside a drawing that has blocks the plain sentence, brackets and all, with each condition named
  by its letter, is given to assistive technology, and the drawing is hidden from it. A reason is not a rule:
  its brackets are its own punctuation and are written as they came.
- **Mark:** an 18px badge (wider for two letters), 6px radius, Action tint ground, Action ink letter (0.75rem,
  600). In a sentence it is a superscript (13px, 0.625rem, 4px radius): placed over the start corner of its
  clause, above the first word, and out of the line, so it takes no room in it and the words keep their own
  spacing. Letters follow the order of the conditions in the definition, top to bottom, and are recomputed on every
  edit: Hebrew numerals (א to י, then יא, יב and on). A condition on related records has a letter of its own, given
  before the letters of the conditions inside it: a run matches that node as a whole, so its letter is the one a
  reason and the count by condition show. The mark is display only: it is derived from the order of the
  definition and never stored. On a run, the marks are those of the version that ran.
- **A mark is a badge everywhere.** It does not answer the pointer or the keyboard, in the editor included:
  filtering by a condition is a press on its chip in the count by condition, and that chip says it is chosen.
- **In the editor** a mark has one more state, **open**: an outline in Danger while its condition is incomplete
  or invalid. On the bar it reads in On inverse. A clause whose text changed settles (Motion, below).
- **Value:** the actual value that matched, inside its reason: Action tint ground, Body strong, 6px radius. A
  reason reads as a statement with its value marked: `גיל [15] נמוך מ־16`. A value stays whole while it fits on
  a line; only one longer than the line itself (an address, a long name) breaks inside its tint, so no value
  widens the panel.
- A mark is hidden from assistive technology where a name already says it (`תנאי ב`), and is its name where
  nothing else does.

### Rule sentence

The control read back in the user's words, each clause opening with its mark, bound to its first word so a line
never ends on a mark. Two forms:

- **The bar:** in the editor only, at the foot of the panel, always in view. Inverse ground, On inverse text: a
  small heading (`הבקרה במילים`, heard and not seen on a narrow panel), the sentence, one line of status when
  something is unfinished (`תנאי ה לא הושלם: חסר ערך להשוואה.`), and beside them save and, last, save and run.
  Before a first sentence exists the status line is silent, unless a save was asked for: the hint already says
  what is awaited, and a warning over a row nobody touched would be a reproach for no mistake.
  **The bar never changes its height:** the sentence has the room of two lines and scrolls inside it when it is
  longer, and the status line keeps its room while it is empty (one line, two on a narrow panel; a status that
  does not fit is cut, and the same words stand in full under the condition they are about). The sentence is the
  engine's: the editor asks for it 400ms after the last edit of a complete draft and draws what comes back.
  While a condition is unfinished nothing is asked; a complete draft the engine refuses is asked about again on
  its next edit. In both cases the last valid sentence stays, in On inverse muted, the mark of the open condition
  is outlined, and the status line names it. Marks are those of the current draft, so a clause whose condition
  was removed stands without one. Before the first valid sentence the bar holds one line of hint, which says why
  there is no sentence: no condition is complete yet (`כאן תוצג הבקרה במילים, לאחר שהתנאי הראשון יושלם.`), the
  conditions were refused (`הבקרה תוצג כאן במילים לאחר תיקון התנאים.`), or the engine does not answer (`אי אפשר
  להציג כעת את הבקרה במילים.`). A sentence that is waiting for its answer is not dimmed, so typing does not make
  it flicker. Changes of the sentence and of the status line are announced politely.
- **Plain:** for reading, in Read type. At the top of a results panel it stands in a block of Action tint
  (12px radius, 16px by 24px of room) under a Label title in Action ink (`הבקרה במילים`), before what the run
  found. It is also on each suggestion card, on each idea (Small, Muted) and in an archived control's editor. A
  results panel always shows it: where the run carries none (a control that never ran, a run that stopped), the
  engine is asked once for the sentence of the control, or of the version that ran.

### What to check

The editor asks `מה רוצים לבדוק?` and answers with one card for each entity the glossary allows a control to
start from: the entity's name (its plural label, in Name type) and the glossary's own description of it (Caption).
The cards are compact (12px by 16px of room, at least 13rem wide) and one radio group, 12px radius, a Line strong
edge; the chosen card is filled with Inverse and shows a check. A new
control has nothing chosen, and the conditions appear once something is. The group is one tab stop: the chosen
card, or the first while nothing is chosen. Arrow keys move between the cards and choose nothing; Space, Enter
or a click chooses. Another choice starts a control's conditions over, so it is never made by passing over a
card. A save before the choice says so under the cards and puts the focus on the first.

Under the cards, a small chain shows how those things connect: each name as a chip, in glossary order, and
between two neighbours a line with a few words that say which holds many of the other (`בכל מחלקה יש עובדים`),
taken from the cardinality of the relationship that joins them. The chip of the chosen one is filled with
Inverse, as its card is. It is a picture to read: nothing in it can be pressed. One sentence beside it, on the
same line where there is room, states what the control will return and lists what else it may ask about
(`הבקרה תחזיר מחלקות. אפשר להתנות גם על: המשרד ועובד במחלקה.`). Everything here is drawn from the glossary and
assumes no number of entities. The word for an entity is not shown.

**The row of ideas.** A new control that starts from nothing has, under the chain, one collapsed row of Action
tint (12px radius, 44px, Small strong in Action ink) with a sparkle, its words and, once there are any, their
count in a small Action chip and a chevron. The row comes in with the choice of what to check (a short rise and
fade, none under reduced motion): the conditions come in with it, so it moves nothing that was read. Then it
only changes its words, so nothing moves when the ideas arrive: while they are computed it says so, and when
there are none it says that too; in those states it is not a button to press. Pressed, it opens (the chevron
turns) and shows one line of hint and up to three ideas the engine computed for that choice from the data as
they are now: each a white button card (8px radius, a Line edge, Raised under the pointer) with its name, its
rule in words and its first piece of evidence as a chip. One press fills the conditions, and the name and the
description where nothing was typed; a toast gives back what was there. Its words never say AI.

### Condition builder

One Surface panel (12px radius, 24px of room from 640px), in the editor's panel. Before it is chosen what to
check, the panel holds its place (two controls high) with one centred line that says what it waits for, so the
conditions are in the first view from the start.

**Simple by default.** A control starts as a flat list of conditions under one switch, all of them or at least
one. Groups and conditions on related records are behind one **advanced** action (the tune icon), a Muted text
button at the end of the adders' line that turns Ink while on. A draft that already holds a group or a condition
on related records is shown in full, with every adder, and the advanced action is gone. Inside it:

- **Group:** a head with a lead word (`מתקיימים`, `מתקיים`), the segmented control (`כל התנאים` / `אחד התנאים
  לפחות`) and, for a nested group, a remove button; under it a body indented behind a **rail**, a 1px Line
  strong line down its start edge.
- **Joiner:** between two neighbours of a group, the group's joining word (`וגם` or `או`) in Label, Muted, sitting
  on the rail. It is the same word the sentence uses: both come from the glossary.
- **Condition row:** the mark, a field picker, a comparison picker, a value input and a remove button. The field
  picker shows the path before the field, in Muted, when the field belongs to a related entity (`המשרד של המחלקה
  / פעיל`); its list is grouped by entity and relationship label. The comparison list holds only what the field's
  type allows. When a comparison takes no value (`ריק`), the value's place says so in Small, Muted.
- **Value input:** by the field's type, as under Fields. Beside it, a toggle to compare with another field
  instead of a value: an icon alone when the row is one line, the icon and its words when the row is stacked;
  filled with Inverse while on, and the value input then becomes a field picker.
- **Related records:** a group whose head reads as the start of a sentence: its mark, a quantity (`אין אף` /
  `יש`), the relationship (`עובד במחלקה`), the word `עם` and the segmented control of its own rows (`כל התנאים` /
  `אחד התנאים לפחות`), then a remove button. The wording carries no gender. Its rows are about the related
  entity, and their letters continue after the node's own.
- **Adders:** at the foot of each group, text buttons with a plus: condition, and with the advanced part, group
  and condition on related records.
- **Removing:** a removed condition or group is offered back by a toast for as long as it stands (`תנאי ב הוסר`
  or `הקבוצה הוסרה, עם התנאים שבה`, with `שחזור`), and so are the conditions that another choice of what to
  check cleared, and the ones a suggestion replaced. The offer is withdrawn as soon as the conditions are another
  draft (edited further, read again from the server, started over), because the way back leads to the draft as
  it was.
- **Note:** once, at the foot of the panel, the rule about missing values (a comparison does not match a missing
  value; missing values are found with the comparisons that ask whether a value is missing or empty). The note
  names no comparison: their labels are the glossary's.
- **Validation:** a server error is placed by its path on the row it names: the row's mark turns open, the
  offending input takes the error state, the reason stands under the row, and the status line of the bar at
  the foot names the condition.

### Search and filters

A search field with a leading icon, then the filters, with no ground of their own. On the list they share a row
with the tabs from 900px and stand at its end; on a phone the filters fold into one square boxed button, and
unfold by themselves while one of them is not at its default, so a narrowed or reordered list always shows why.
The list has one filter, `מה נבדק`, and below 640px a select of the order (`מיון: ..., מהתחלה לסוף` and its
reverse, for each column), since the table has no head to press there.

### Tables and card rows

One table design for the controls, the archive and the records of a run.

- **Every row is a bubble.** From 640px it is a real `<table>` whose rows stand 8px apart (separate borders):
  each cell carries its part of a Line edge on the Card ground, and the first and the last cell carry the 12px
  corners, so the columns of every bubble line up. The head is a row of column names in Label, Muted, with no
  band. Below 640px the same cells are a card per row (12px radius, a Line edge, 16px of room, 12px between
  cards), and the head is read by assistive technology and not seen.
- **Sorting.** A column head is a button (`app-sort-header`): a press sorts ascending, the next descending; the
  sorted column turns Ink and shows its arrow, the others a faint `unfold_more`. The order of the list is the
  server's (`sort` and `dir` in the address and in `GET /api/v1/controls`); below 640px the toolbar's select
  sorts. Every head of a run's records sorts as well, the reasons too (by how many there are, then by their
  text): ascending, descending, then back to the run's order; the api orders a field by its glossary type.
- **A row of the list** has three parts with a line between them: its details, its run button, its actions. The
  details are the name over its description; what it checks; the last run; the result as a status chip (Chips,
  above). The name is a link to the results of the control's last run, and for a control that never ran to the
  control's own results panel, where it can be run; it says which to assistive technology. The link is stretched
  over the whole of the details, so a click anywhere on them opens what the name opens, and the keyboard meets the
  row once; its focus ring is drawn round the details. Under the pointer the details take Card hover and the row's
  edge Line strong. The run (a small second button with its label) and the actions (icon buttons for edit, the
  pencil; duplicate; archive, a closed box) stand over the link. On a phone the status and the last run share a
  line, and under a line the run stands at the start and the actions at the end.
- **The archive** uses the same table without the run column and without edit; its status chips are grey,
  whatever its runs found. A row without a run button gives its actions the whole line on a phone.
- **A run from the list** stays on the list. The row's button keeps the focus and is marked unavailable while
  the run is on its way, the run column keeps room for the wider running label, so the other columns do not
  move, and the start and the outcome are said to assistive technology by name (`הרצת הבקרה ”…” הסתיימה: 3
  חריגות`); the row's run button is described by the control's name.
- **The records of a run** stand on the ground of the results panel, as wide as the panel: the record's
  identifying fields (the first in Name type), then the reasons: one line for each condition the record matched,
  its mark, then the sentence with the value marked, at the Read line height.
- **Foot:** the range in words, a page size select and previous and next icon buttons, which are drawn when
  there is more than one page. Under the list it is a bar fixed at the bottom of the window; under the records
  it is the panel's foot. The range is a status: after a search, a filter, a sort or another page it is said to assistive
  technology.

### Run overview

What the run found, in one white block (12px radius, a Line edge) on the ground of the panel, not a row of
tiles. Its first part is the Figure with its noun (`23 חריגות`), Danger, or Success for a run that found none,
then a short list of terms and values: what was checked, how long it took, and the count of the previous run with
its date, as a link. The time is in seconds with one decimal at most (`0.4 שניות`); a run that rounds to nothing
is said in words (`פחות משנייה`), never as `0 שניות`.

Its second part, under a line or from 720px of panel beside it (2fr to the first part's 1fr), is the count by
condition: a Label title (`חריגות לפי תנאי`), one line of hint, and a chip for all violations followed by one chip
for each condition with its mark, its clause and the number of violations that match it, in Danger at 600. Each
chip filters the records (Chips, above); the chip for all violations carries no number, because the figure
beside it says it. A record may match several conditions, and the hint says so. To assistive technology a chip's
number is read with its noun (`8 חריגות`). A clean run has no count by condition: its block is the figure and the
terms on one line. There are no bars.

### Picker of runs

In the head of a results panel, under the control's name: a small select that lists the control's runs, newest
first, each as its day, its time and what it found or how it ended (`10.11.2026, 09:12 · 3 חריגות`; a list
that is scanned counts in digits). Choosing
one shows that run, at its own address. It is there when the control has more than one run, and lists the 50
newest; beside it the head says which version of the control ran. With one run the head says when it ran, in a
line of text.

### Banner

A message that belongs to the whole list or panel and leaves the content in place: an icon in the state colour,
a title in Body strong, one or two sentences in Small, and at most one text button. Tint ground, 1px line in the
state colour at 35%, 12px radius.

### State panel

A message that stands where content would be: an icon (24px), a title, a short paragraph in Body, then buttons. It
is aligned to the start edge, 62 characters wide at most, and never centred with an illustration.

### States

Every empty, waiting and failed state, and what it says. The error codes are those of `contracts/errors.md`.

| State | Where | Component | Says | Next step |
|---|---|---|---|---|
| No controls yet | The list, in place of the tabs, the search and the table; the head leaves its two actions to the panel | State panel, neutral | What a control is, in one sentence. No example: an example would name the entities of one glossary | New control (primary); suggestions (second) |
| Every control archived | The list, under the tabs | State panel, neutral, no icon | That no control is active and where the archived ones are | Show the archive |
| Nothing in the archive | The list, under the archive tab | State panel, neutral, no icon | That an archived control is shown here, with its runs | None |
| Never run | A list row; the results panel opened by the control | A grey status chip on the row; in the panel the control's name, its rule in words and a state panel, neutral | `טרם הורצה` on the row; in the panel that the control has not run yet and what a run will do | Run (primary, in the panel). An archived control that never ran says so and offers nothing |
| Run in progress | List row, results | Button with spinner, unavailable (on a list row it keeps the focus); a spinner in the row's status chip; skeleton rows in the table | `ההרצה מתבצעת` | Wait |
| No violations | Results | The overview with a green figure, then a state panel, Success | That the control was checked against every record and none matched | Run again, in the head |
| More violations than the cap, `ROW_CAP_EXCEEDED` | Results, above the records | Banner, Warning | The exact total and how many are shown; the figure and the count by condition count all violations; the search, the filter and the sort reach the stored rows only, and a search that finds none there says so | Edit the conditions |
| Run timed out, `QUERY_TIMEOUT` | Results; the list row shows an amber `ההרצה נעצרה` | State panel, Warning, under the rule that was running | After how long it stopped, and that nothing was checked | Edit the conditions; run again, in the head |
| Run failed for another reason (a run error other than the two beside it) | Results; the list row shows an amber `ההרצה נעצרה` | State panel, Warning | That the run did not complete, and what stopped it then, in the past tense: the run may be days old, and the text of a live failure would say the system is down now | Run again, in the head |
| Run still in progress when its results are opened (`running`) | Results; the head offers no run | State panel, neutral, no icon | That the results appear when the run ends | Look again |
| Engine, database or network not answering, `ENGINE_UNAVAILABLE`, `DATABASE_UNAVAILABLE`, `NETWORK_ERROR` | The list or a panel, under its head | Banner, Danger | What still works (reading) and what waits (run, save) | Try again |
| A control that cannot be archived | The list, under its head | Banner, Danger | Why, by its code | Its row's own button |
| The saved definition no longer fits the glossary, `CONTROL_DEFINITION_OUTDATED` | Results: state panel, Warning, and the head offers no run. Editor: banner, Warning, and the error on the row | Which condition, by its mark: the label of a field that left the glossary no longer exists, and a key never reaches the screen | Edit the control |
| Archived control's results | Results panel | A grey `בארכיון` chip in the head, which offers neither run nor edit | That the control is in the archive | None |
| Control archived, `CONTROL_ARCHIVED` | Editor, under the head: the control is shown as text, with no bar. Results, after "run again" was refused | Banner, Warning | That it can be read but not changed or run | Editor: duplicate into a new control. Results: none |
| No such control, run or page | In the panel for a control or a run; in place of the page for any other address | State panel, neutral | That the address may be wrong or the thing gone | Back to the list |
| Nothing chosen to check | Editor, under the cards, on a save | Field error | That nothing was chosen | Choose a card |
| Definition not valid, `DEFINITION_INVALID` | Editor | Field error on the row; status line on the bar | What is missing on that condition | Fix the row |
| Saved elsewhere meanwhile (conflict) | Editor, under the head | Banner, Warning | That this screen's changes are not saved | Load the current version |
| Search or filter matches nothing | Under the search | State panel, neutral, no icon | The term searched and what the search looks in | Clear the search |
| No suggestions | The suggestions panel: one sentence. The editor: nothing at all | Text | That the data shows no pattern that asks for a new control | None |
| Saved, archived, created, filled from a suggestion | Any | Toast | The result in one line (`הבקרה נשמרה כגרסה 4`) | One optional text button (`שחזור`) |

The head of a results panel is always in view, so a state never repeats the head's own button: where the
next step is to run again, it is the head's.

Loading never blanks a screen: the head stays, and rows are skeleton bars (Tonal, breathing slowly) in the shape
of what is to come: rows of the list, records of a run, cards of suggestions. The row of ideas is there from the
start and says in words that they are being computed.

### The panel, dialogs and toast

- **The panel** (Layout, above) is modal: `role="dialog"`, named by its title. The list behind it is still seen
  and is out of reach of the pointer and the keyboard. It is closed by its X, by Esc and by a click beside it;
  an open select takes Esc for itself first. Closing returns to the list as it was (its search, tab and page) and
  puts the focus back on the element that opened the panel, else on the row of the panel's control, else on the
  list's title. The browser's Back closes it too: a panel is an address. The list is read again when a panel
  closes and when the panel moves on (a save, a run), so it never shows a stale row; opening a panel reads
  nothing again. A save or a run that lands after its panel was closed does not open the panel again: it says
  what it did in a toast, and the list reads the row it changed.
- **Suggestions panel:** the same card, opened from the list's head. A head with the title, one line that says
  where the suggestions come from (they are computed from the data as they are now, on every opening and every
  refresh, and nothing is saved or run without a choice) and a refresh button; a body of cards, one for each
  suggestion: a checkbox (none ticked at first) with its name, its rule in words with marks, one line of
  rationale in Small Muted, the evidence as chips, and a text button to open it in the editor; a foot with close
  and the main button, which counts what will be created (`יצירת 2 הבקרות שנבחרו`) and is disabled while nothing
  is ticked. A ticked card takes an Ink edge. A refresh keeps the cards on the screen until the new ones arrive,
  and drops the ticks.
- **Dialog:** a Card, 20px radius, 24px padding, the Overlay shadow, over the Scrim. A title and a close button;
  the buttons at the end edge with the main one last. Used for one thing: to confirm archiving a control.
- **Archive confirmation:** archiving is an action of the row. The dialog says what it does and what it does
  not: the control leaves the list, its runs and results are kept, and it can be duplicated into a new control
  (`הבקרה ”…” תוסר מהרשימה. ההרצות והתוצאות שלה יישמרו, ואפשר יהיה לשכפל אותה לבקרה חדשה.`). There is no
  restore in this version, so the text promises none. After it the focus goes to the row that took the place of
  the archived one.
- **Toast:** Inverse ground, On inverse text, 12px radius, the Overlay shadow; one line and at most one text
  button; at the start edge, over the bar that is fixed at the bottom of the window and not on it. Never for an
  error.
- **Closing a changed draft never asks.** The panel closes at once, by its X, by Esc or by a click beside it,
  and a toast says so (`הבקרה נסגרה בלי שמירה`) with `שחזור`, which opens the editor again at the same address
  with the draft as it was. That toast stands twelve seconds, twice a plain one: its button is the only way back
  and has to be reached. One closed draft is kept, for as long as the page lives; a draft that is asked back
  while another changed draft is on the screen takes its place, and that one is offered back in its turn. A
  draft closed while its save was on its way is offered back only if that save fails: otherwise it is stored.
  Leaving the page itself (closing the tab, reloading) over a changed draft is
  asked by the browser's own prompt; that is not a dialog of the application.
- **A button made unavailable by its own press** (save, run, refresh, the last page of a pager) keeps the focus
  it holds: it is marked unavailable for assistive technology and ignores a second press, and is not removed
  from the tab order. A button that cannot be used as the screen stands (nothing ticked, a limit reached) is
  disabled. The pager's two buttons are of the first kind at both ends, also on a first page nobody has pressed
  yet: one button, one behaviour.

### Motion

Motion says that a state changed. Nothing moves on load, nothing moves on scroll, and nothing loops except the
two signs of waiting.

| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Every transition |
| `--duration-in` | 150ms | A hover arriving: ground, border, underline, a card's lift; the chevron of the row of ideas turning |
| `--duration-out` | 120ms | The same leaving |
| `--duration-press` | 90ms | A button's step: 1px up on hover (fine pointer only), 1px down and 0.985 on press |
| `--duration-panel` | 220ms | The panel and a dialog opening: the panel fades in and slides 32px from its edge, a dialog rises 6px, the scrim fades in |
| `--duration-close` | 120ms | A dialog closing: the component library's own fade, inside this time |
| `--duration-settle` | 600ms | The settle, below |

- **Focus is instant:** the ring and a field's focus border appear with no transition.
- **No trace.** A mark never fills because its row or its clause is under the pointer or in focus.
- **The settle:** when a new sentence arrives from the engine, each clause whose text changed is rewritten in
  place and its mark there fills at once and eases back over 600ms, so the eye finds what the edit changed. The
  first sentence of a panel settles nothing. This is the one authored moment of the product.
- **Waiting:** a 16px spinner turning once a second inside the button that started the work, and skeleton bars
  breathing between full and 45% opacity over 1.4s.
- **Panels of a select:** they keep the component library's own opening and closing (about 120ms).
- **Reduced motion:** buttons do not step and a press shows as a tone (Action pressed); the spinner and the
  skeletons stand still; the panel, a dialog and a select's panel appear at once; the settle does not run.

## Do's and Don'ts

### Do:

- **Do** give every condition its mark and show that mark wherever the condition is named: builder, sentence,
  count by condition, reasons.
- **Do** keep the three lights to their jobs: the ground is the page, a card stands on it, the surface is
  operated on, and a field is always a white well.
- **Do** keep one filled Action button in a view and make every other button the second kind or text.
- **Do** give a status its one colour and its words together: red violations, green clean, amber stopped, grey
  never ran or archived.
- **Do** draw every row as its own bubble, from the same table design, in the list, the archive and the results.
- **Do** fill what is chosen with the ink: a tab, a card, an option.
- **Do** write a state as an icon, a sentence and a next step, in the words of [PRODUCT.md](PRODUCT.md): action
  nouns (`שמירה`, `הרצה`), no gendered address, no database terms.
- **Do** take every colour, size, radius and duration from the tokens; a component holds no literal value.
- **Do** keep every control 44px high on a phone and every label visible above its field.
- **Do** size what stands in a panel by the panel's width, and check it at 390 and 1440.

### Don't:

- **Don't** colour a status with anything but its own colour, or let the colour stand without its words.
- **Don't** put a card inside a card, a shadow on anything at rest that is part of the page, or a coloured stripe
  down the side of a row or a banner.
- **Don't** make a condition's letter answer the pointer or the focus, anywhere. It is a badge.
- **Don't** let the bar of the rule in words change its height, or leave the view.
- **Don't** use a physical `left` or `right` in CSS, mirror an icon that shows a thing, or letter-space Hebrew.
- **Don't** set the overview of a run as a row of metric cards, add a chart or a bar for its own sake, or animate
  a number counting up.
- **Don't** ask before closing a changed draft; close it and offer it back.
- **Don't** open a dialog for anything but confirming an archive; a control, a run and the suggestions open in
  the panel.
- **Don't** let a table name, a column name, a condition id, an error code or the word for an entity reach the
  screen.
- **Don't** load a font or an icon from a network: the product may run with no internet access.
- **Don't** restyle Angular Material by its internal classes. Where no token exists (the focus ring of a segment)
  the rule names the component's element and its state in ARIA.

## Implementation

Notes for the client task; the visual system above does not depend on them.

- **Tokens.** One stylesheet (`web/src/styles/tokens.scss`) declares them on `:root` under the names used here:
  `--color-*`, `--font-sans`, `--text-*` (`label`, `small`, `body`, `title`, `page`, `figure`, `mark`,
  `mark-corner`), `--weight-regular`, `--weight-medium`, `--weight-strong`, `--leading-tight`, `--leading-title`,
  `--leading-body`, `--leading-read`, `--space-1` to `--space-8`, `--radius-xs`, `--radius-chip`, `--radius-sm`,
  `--radius-md`, `--radius-lg`, `--size-control` (44px), `--size-control-sm` (36px, 44px below 640px),
  `--size-icon`, `--size-mark` (18px), `--size-mark-corner` (13px), `--size-bar`, `--gutter`, `--container`,
  `--sheet-inset`, `--sheet-width`, `--sheet-peek`, `--shadow-overlay`, `--shadow-raised`, `--ease-out` and the
  `--duration-*` set. Component styles read only these; the type roles of `base.scss` (`t-page`, `t-title`,
  `t-small`, `t-label`) set a size with its weight and line height. There is one theme: no second set of values
  and no switch.
- **Angular Material.** One light theme through `mat.theme`, then Material's system tokens are pointed at these
  values with the mixin's `$overrides` map: primary to Action, the surfaces to Card and Surface, on-surface to
  Ink, the inverse pair to Inverse, outline to Control line, error to Danger, and the corner tokens to the radius
  scale. Where a component still differs (button height, dialog corners, elevation) it is corrected with that
  component's own `overrides` mixin. Fields reach 44px through the form field's own height tokens.
- **The panel.** The list is the parent route and renders the routed screen inside its panel; the suggestions
  use the component library's dialog, shown as the same card (a clear container, the screen inside it floating
  with the panel's room). Both name the panel's width for container queries (`sheet`).
- **Fields in Material.** A plain `<label>` above the form field and no `mat-label` inside it; outline
  appearance; dynamic subscript sizing so a field with no hint or error reserves no space under it.
- **Tables.** One data source and one template, a real `<table>`: from 640px it is laid out as a table with
  separate borders, below it the same cells are laid out as a card by the stylesheet (`_tables.scss`). The status
  colour of a result comes from one function (`toneOf` in `run-result.ts`).
- **Closed drafts.** The editor's store gives a snapshot of a draft and restores one (`EditorStore.snapshot` and
  `restore`); `closed-drafts.ts` keeps the last one closed, by its address.
- **Fonts and icons.** Heebo (SIL Open Font License 1.1), as one variable file each for Hebrew and Latin, and the
  Material Symbols Sharp icons in use (Apache 2.0) are bundled with the build; icons are registered as SVG.
- **What the contracts provide.** Every sentence arrives with `sentenceParts` and every reason with `textParts`
  (`contracts/api.md`): pieces of text, each tied to the condition it speaks for and to its role (the field, a
  value, the record's actual value). The client draws the parts and renders no text of its own; a mark stands
  before the first clause of each condition, and an actual value is drawn as the value. A run carries a count per
  condition that can be matched, exact also above the row cap, and its results filter by condition. The
  definition of the version that ran is one request away, so the marks of a run are those of what was checked.
  A control's runs are one request away (`GET /controls/{id}/runs`), and the suggestions can be asked for one
  entity (`POST /suggestions` with `rootEntity`).
