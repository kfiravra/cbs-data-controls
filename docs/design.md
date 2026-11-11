---
version: alpha
name: Data Controls
description: Visual design of the Data Controls client. Direction, tokens, type, components, responsive rules, motion and states.
colors:
  ground: "#eef0f3"
  surface: "#e2e5ea"
  ink: "#0b0c0e"
  muted: "#5d6470"
  action: "#1f2de6"
  action-hover: "#355aec"
  action-pressed: "#486fef"
  on-action: "#ffffff"
  on-action-stale: "#ffffffb8"
  action-tint: "#1f2de61a"
  action-track: "#1f2de629"
  on-action-tonal: "#ffffff2e"
  on-action-line: "#ffffff47"
  bar: "#0b0c0e"
  on-bar: "#eef0f3"
  line: "#0b0c0e1c"
  line-strong: "#0b0c0e33"
  control-line: "#767c87"
  tonal: "#0b0c0e14"
  tonal-hover: "#0b0c0e24"
  row-hover: "#0b0c0e0a"
  danger: "#b51522"
  danger-tint: "#b515221a"
  danger-line: "#b5152259"
  warning: "#825100"
  warning-tint: "#8251001a"
  warning-line: "#82510059"
  success: "#1d6835"
  success-tint: "#1d68351a"
  success-line: "#1d683559"
  scrim: "#0b0c0e66"
typography:
  figure:
    fontFamily: "IBM Plex Sans Hebrew, IBM Plex Sans, system-ui, sans-serif"
    fontSize: 3rem
    fontWeight: 500
    lineHeight: 1
  figure-compact:
    fontFamily: "IBM Plex Sans Hebrew, IBM Plex Sans, system-ui, sans-serif"
    fontSize: 2.5rem
    fontWeight: 500
    lineHeight: 1
  page-title:
    fontFamily: "IBM Plex Sans Hebrew, IBM Plex Sans, system-ui, sans-serif"
    fontSize: 1.75rem
    fontWeight: 500
    lineHeight: 1.25
  page-title-compact:
    fontFamily: "IBM Plex Sans Hebrew, IBM Plex Sans, system-ui, sans-serif"
    fontSize: 1.5rem
    fontWeight: 500
    lineHeight: 1.25
  sentence:
    fontFamily: "IBM Plex Sans Hebrew, IBM Plex Sans, system-ui, sans-serif"
    fontSize: 1.25rem
    fontWeight: 500
    lineHeight: 1.7
  title:
    fontFamily: "IBM Plex Sans Hebrew, IBM Plex Sans, system-ui, sans-serif"
    fontSize: 1.125rem
    fontWeight: 500
    lineHeight: 1.35
  body:
    fontFamily: "IBM Plex Sans Hebrew, IBM Plex Sans, system-ui, sans-serif"
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.55
  body-strong:
    fontFamily: "IBM Plex Sans Hebrew, IBM Plex Sans, system-ui, sans-serif"
    fontSize: 1rem
    fontWeight: 500
    lineHeight: 1.55
  small:
    fontFamily: "IBM Plex Sans Hebrew, IBM Plex Sans, system-ui, sans-serif"
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  small-strong:
    fontFamily: "IBM Plex Sans Hebrew, IBM Plex Sans, system-ui, sans-serif"
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "IBM Plex Sans Hebrew, IBM Plex Sans, system-ui, sans-serif"
    fontSize: 0.8125rem
    fontWeight: 500
    lineHeight: 1.4
  caption:
    fontFamily: "IBM Plex Sans Hebrew, IBM Plex Sans, system-ui, sans-serif"
    fontSize: 0.8125rem
    fontWeight: 400
    lineHeight: 1.5
rounded:
  xs: 2px
  sm: 4px
  md: 6px
  lg: 8px
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
components:
  app-bar:
    backgroundColor: "{colors.bar}"
    textColor: "{colors.on-bar}"
    height: 56px
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.on-action}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.sm}"
    height: 44px
    padding: 0 24px
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
  button-tonal:
    backgroundColor: "{colors.tonal}"
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.sm}"
    height: 44px
    padding: 0 24px
  button-tonal-hover:
    backgroundColor: "{colors.tonal-hover}"
  button-small:
    typography: "{typography.small-strong}"
    height: 36px
    padding: 0 12px
  button-on-action:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
  button-on-action-tonal:
    backgroundColor: "{colors.on-action-tonal}"
    textColor: "{colors.on-action}"
  icon-button:
    textColor: "{colors.muted}"
    rounded: "{rounded.sm}"
    size: 44px
  field:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    height: 44px
    padding: 0 12px
  segmented-option:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.small-strong}"
    height: 36px
    padding: 6px 12px
  segmented-option-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
  entity:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.sm}"
    height: 44px
    padding: 0 16px
  entity-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
  chip:
    backgroundColor: "{colors.tonal}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    height: 24px
    padding: 0 8px
  mark:
    backgroundColor: "{colors.action-tint}"
    textColor: "{colors.action}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    size: 22px
  mark-active:
    backgroundColor: "{colors.action}"
    textColor: "{colors.on-action}"
  mark-on-action:
    backgroundColor: "{colors.on-action-tonal}"
    textColor: "{colors.on-action}"
  value:
    backgroundColor: "{colors.action-tint}"
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.sm}"
    padding: 1px 6px
  sentence-field:
    backgroundColor: "{colors.action}"
    textColor: "{colors.on-action}"
    typography: "{typography.sentence}"
    rounded: "{rounded.lg}"
    padding: 24px
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: 24px
  toolbar:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: 12px
  meter-track:
    backgroundColor: "{colors.action-track}"
    rounded: "{rounded.xs}"
    height: 8px
  meter-fill:
    backgroundColor: "{colors.action}"
    rounded: "{rounded.xs}"
    height: 8px
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
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: 24px
    width: 640px
  dialog-small:
    width: 440px
  toast:
    backgroundColor: "{colors.bar}"
    textColor: "{colors.on-bar}"
    typography: "{typography.small}"
    rounded: "{rounded.md}"
    height: 44px
    padding: 8px 16px
---

# Design System: Data Controls

The visual design of the client in [architecture.md §8](architecture.md): three screens (controls list, control
editor, run results) and the suggestions dialog, for business users at a statistics bureau, in Hebrew, right to
left, written mobile first. Product context is in [PRODUCT.md](PRODUCT.md).

How it was made (2026-11-10). The direction was dealt, not chosen by taste, with the `design-taste-frontend`
dealer. A static mock of the three screens and a sheet of their states was then built from the deal and checked at
390 and 1440, and this document records what the mock does (`/impeccable document`). The tokens in the frontmatter
are normative; the prose says how to apply them. The mock and its screenshots are working files of the developer
(`dev/active/design/`, not in the repository), so this document stands without them.

## Overview

**Creative North Star: "The Annotated Table"**

A statistical table is trusted because every figure can be traced: a small mark beside the number leads to the note
that explains it. This interface works the same way. Every condition of a control carries a mark, a letter given in
order (א, ב, ג), and the mark travels with the condition wherever it is spoken of: on its row in
the builder, on its clause in the sentence that reads the control back, on its line in the breakdown of a run, and
beside every reason a record is listed. A user who asks "why is this record here" follows a letter, not a query.

The mood is exact, plain and unhurried. Exact: aligned numerals, hairline rules, square corners, one measure of
everything. Plain: sentences in the user's own words, standard controls that need no learning, no decoration
standing in for content. Unhurried: nothing blinks or counts up, a finding is stated in ink and not in red, and the
one saturated colour is spent on what the user is about to commit. The primary scene is an office desk in daylight,
so there is one light theme and no dark one.

The page is flat and grey by design, and three things keep it from being a grey screen with a blue button: a near
black bar that frames every screen, two greys that mean different things (below), and a cobalt field that holds the
control in words.

The direction as dealt:

| Part | Dealt | Why it stands |
|---|---|---|
| Palette | `cool-grey-cobalt`, the first of three dealt for a software product | A cool paper grey for long reading of tables, near black type, one cobalt. Nothing else is tinted, so state colours keep their meaning. |
| Type | `plex` (IBM Plex Sans) | The first pairing dealt, Host Grotesk, has no Hebrew glyphs. Checked against the Google Fonts metadata, IBM Plex is the only family on the dealer's software list with a Hebrew cut drawn as part of the same family. The language decided, not taste. |
| Radius | `sharp`: 4, 6, 8 | The dealer's scale for data tools. Tables and nested conditions want corners that do not eat their content. |
| Buttons | `tonal` | One filled button for the main action; every other button is a quiet grey fill with no border. |
| Mark | `dots` | Three dots and one square: three records and the one that differs. It is the only brand mark; there is no bureau logo. |

Website parts of the deal (navigation, footer, hero, scroll moments) have no place in an application and were not
used.

**Key Characteristics:**

- One mark per condition, the same everywhere the condition appears.
- Two greys with two jobs: the lighter is read on, the darker is operated on.
- One cobalt, kept for the main action, links, focus, marks and the control in words.
- Flat surfaces, hairline rules, square corners; one shadow, only for what floats.
- Standard controls at one height of 44px; nothing invented where a known control exists.
- Sentences before symbols: the control, the result of a run and each reason are written out.

## Colors

A cool neutral page, a near black ink and one cobalt; three state colours of matched weight that appear only with an
icon and words. Each colour below is the CSS custom property `--color-<name>`.

### Primary

- **Action** (`#1f2de6`): the one filled button of a view, text links, the focus ring, the caret, the meter's fill,
  and the ground of the sentence field. **Action hover** (`#355aec`) is its hover; **Action pressed** (`#486fef`)
  shows a press when motion is reduced. **On action** (`#ffffff`) is text on it.
- **Action tint** (`#1f2de61a`, 10%): the ground of a mark, of a highlighted value and of a selected filter row.
  **Action track** (`#1f2de629`, 16%): the unfilled part of a meter.
- **On action tonal** (`#ffffff2e`) and **On action line** (`#ffffff47`): marks, the second button and the divider
  on the sentence field. **On action stale** (`#ffffffb8`, 72% white): the last valid sentence, kept on the field
  while the draft is unfinished or refused.

### Neutral

- **Ground** (`#eef0f3`): the page, tables, sentences, dialogs, and the inside of every field.
- **Surface** (`#e2e5ea`): panels where the user operates: the builder, the breakdown, toolbars.
- **Ink** (`#0b0c0e`): text, selected options, and, as **Bar**, the app bar and the toast, with **On bar**
  (`#eef0f3`) as their text.
- **Muted** (`#5d6470`): labels, hints, meta lines, resting icons. Never a sentence the user must read to act.
- **Line** (`#0b0c0e1c`, 11% ink): rules between rows. **Line strong** (`#0b0c0e33`, 20% ink): the rule under a
  table header, the builder's rail, the edge of a dialog. **Control line** (`#767c87`): the border of every field.
- **Tonal** (`#0b0c0e14`) and **Tonal hover** (`#0b0c0e24`): the second button, chips, icon buttons on hover.
  **Row hover** (`#0b0c0e0a`): a table row or a filter row under the pointer.
- **Scrim** (`#0b0c0e66`): the page behind an open dialog.

### State

- **Danger** (`#b51522`): system errors, a failed run, an invalid field. **Warning** (`#825100`): a result that is
  true but partial (the row cap), a control that can no longer run, an edit conflict. **Success** (`#1d6835`): a
  run with no violations.
- Each has a **tint** (10%, the ground of its banner) and a **line** (35%, the banner's border). The state colour
  itself is used for the icon and for short status text, never for a paragraph.

### Contrast, measured

| Pair | Ratio |
|---|---|
| Ink on Ground / on Surface | 17.1 / 15.5 |
| Muted on Ground / on Surface | 5.2 / 4.7 |
| Action on Ground / on Surface / on Action tint | 7.1 / 6.5 / 6.2 |
| On action on Action / on Action hover | 8.2 / 5.5 |
| On action stale on Action | 4.9 |
| On bar on Bar | 17.1 |
| Danger, Warning, Success on Ground | 5.9, 5.9, 6.0 |
| Danger, Warning, Success on their own tint over Surface (worst case) | 4.7, 4.6, 4.7 |
| Control line against Ground / Surface | 3.7 / 3.3 |

Text is held to 4.5:1 and the boundary of a control to 3:1. Row rules are decoration and are not. Translucent
tokens (tints, Tonal, the lines) are measured as painted over Ground and over Surface; a tool that compares them
unmixed, as the DESIGN.md linter does, reports a failure that is not there.

### Named Rules

**The Two Greys Rule.** Ground is where things are read; Surface is where things are operated. A table, a sentence
or a summary never sits on Surface, and a builder or a filter bar never sits bare on Ground. Inside a Surface panel
every field is filled with Ground, so a field always reads as a lighter well.

**The One Cobalt Rule.** A view has one filled Action button. Cobalt otherwise appears only as a link, a focus
ring, a mark, a meter and the sentence field. It is never a heading colour, an icon colour for decoration, or a
background behind ordinary content.

**The Ink Selects Rule.** A chosen option (all of / any of, the root entity, a checked box) is filled with Ink.
Cobalt acts and marks; ink selects.

**The Findings Rule.** A number of violations is a finding and is set in Ink, or as an Action link to its results.
Red is for something that went wrong with the system or the input, never for the count.

**The Never Colour Alone Rule.** A state is an icon, a sentence that names it and, where there is one, the next
step. The colour is the third signal, not the first.

## Typography

**Display, body and label font:** IBM Plex Sans Hebrew, with IBM Plex Sans and `system-ui` behind it. One family
for everything. Its Hebrew and its Latin letters were drawn together, so Hebrew text with an English name or a
number in it stays one texture.

**Character:** an engineer's grotesque with a measured Hebrew: even, a little square, at ease in a table.

Weights 400 and 500 carry the interface; 600 is used once, for the letter inside a mark. The files (weights 400,
500, 600; Hebrew and Latin subsets) ship with the application. The mono face of the dealt pairing, IBM Plex Mono,
is not loaded: nothing on the three screens is code.

### Hierarchy

Sizes are fixed rem steps, not fluid. Two roles step down below 1024px.

- **Figure** (500, 3rem, 2.5rem below 1024, line height 1): the number of violations in the run summary. One per
  screen at most.
- **Page title** (500, 1.75rem, 1.5rem below 1024, 1.25): the `h1` of a screen: the list's name, the control's
  name on its results.
- **Sentence** (500, 1.25rem, 1.7): the control in words on the sentence field. The same component reads at Title
  size (regular weight, 1.75) on the results screen and at Body size in the suggestions dialog.
- **Title** (500, 1.125rem, 1.35): section headings, the brand name in the bar, the title of a state or a dialog.
- **Body** (400, 1rem, 1.55) and **Body strong** (500): running text and field text; buttons, a row's name, a
  banner's title, the highlighted value.
- **Small** (400, 0.875rem, 1.5) and **Small strong** (500): descriptions, meta lines and notes; field labels,
  table headers, small buttons, status text, an error under its field.
- **Label** (500, 0.8125rem, 1.4) and **Caption** (400): chips, marks, the joining word on the rail, the terms of
  the summary; hints under a field.

### Named Rules

**The No Tracking Rule.** Hebrew is never letter-spaced, tighter or wider, at any size. The dealt pairing's negative
display tracking is not applied.

**The Thirteen Floor Rule.** No text is smaller than 0.8125rem. Text the user must read to act (a message, a
reason, an instruction) is 1rem; 0.875rem is for support beside it.

**The Standing Numbers Rule.** Digits are Western (0 to 9). Plex's digits share one width, so
columns of numbers align without a feature switch. Numbers, dates, currency and durations are formatted by the
locale (`he-IL`: `15,000 ₪`, `10.11.2026`, `09:12`), and a range is written with a word (`1 עד 10 מתוך 23`), not a
dash, so its two ends cannot swap sides in right-to-left text.

Further type rules: user data that may be in the other script (a person's name) is isolated with `<bdi>`. A prefix
joins its number with a maqaf (`מ־18`). Quotation marks are the Hebrew locale's pair (`”ריק”`). There is no italic
and no capitals style: emphasis is weight 500.

## Layout

One column of content, at most 1280px wide, centred, with a side gutter of 16px on a phone, 32px from 640px and
48px from 1024px. The app bar (56px) spans the window; its content keeps the same edges. Nothing is sticky except
the side column of a split screen.

Spacing uses eight steps: 4, 8, 12, 16, 24, 32, 48, 64 (`--space-1` to `--space-8`). 8 between a label and its
control and between the controls of one condition; 16 between fields and inside a toolbar; 24 inside a panel; 32
between the blocks of a screen, 48 from 1024px. There is always more space above a heading than under it.

Two breakpoints change structure, and type does not scale between them:

| | Below 640 | 640 to 1023 | From 1024 |
|---|---|---|---|
| Page head | Title, then the actions as equal buttons in one row | Actions at the end of the title row | Same |
| Controls list | Card rows between rules: name and description; entity and last run on one line; result and actions on one line | A table of five columns (40%, 16%, 18%, 16%, actions) | Same |
| List toolbar | Search and one square filter button | Search and the filters as selects | Same |
| Editor | One column: details, root entity, conditions, then the sentence field with its buttons stacked | Same, the buttons side by side | Two columns (2fr and 1fr, at least 320px, 48px apart); the sentence field stays in view at the inline end, 24px from the top |
| Relationship map | Entities stacked, each link's label between them | One row: entity, link, entity | Same |
| Results | One column: head, sentence, summary, breakdown panel, table | Same | Summary in one row; then the table (1fr) with the breakdown panel (360px) in view at the inline end |
| Results rows | Card rows: name and number on one line, the reasons under them; a sort select in the toolbar | A table (20%, 12%, the rest) with sortable headers | Same |
| Controls | Every control 44px high | Small controls (36px) allowed | Same |
| Dialog | Full width inside the gutters | Up to 640px, or 440px for a confirmation | Same |

A condition row answers to its own width, not to the window: it is one line (mark, field, comparison, value,
remove) when its group is at least 560px wide and stacks below that. A deeply nested row on a wide screen and any
row on a phone therefore take the same stacked form. Each level of nesting indents 24px on a phone and 32px from
640px.

Right to left:

- Only logical properties (`margin-inline-start`, `inset-inline-end`, `border-start-start-radius`,
  `text-align: start`), so the layout holds for any language the interface gains later, whatever its direction.
- Arrows and chevrons follow the reading direction: back points to the start edge, next page to the end edge. Icons
  that show a thing and not a direction (run, search, edit, copy, delete) are never mirrored.
- A meter fills from the start edge. The builder's rail stands on the start edge. The side column of a split
  screen stands at the end edge.

## Elevation & Depth

Flat. Depth is said with tone and line: Ground and Surface, a hairline between rows, a stronger line under a
header. Panels have no border and no shadow; their grey is enough against the page.

### Shadow Vocabulary

- **Overlay** (`box-shadow: 0 8px 24px #0b0c0e1a, 0 1px 2px #0b0c0e14`): the only shadow, for what floats above
  the page: a dialog, a menu or select panel, a date picker, a toast. A dialog also takes a Line strong edge and
  the Scrim behind it.

### Named Rules

**The Flat Page Rule.** Nothing that is part of the page casts a shadow, at rest or on hover. If a thing has a
shadow, it can be dismissed.

**The No Box In A Box Rule.** A panel never holds another panel. Inside the builder, depth is a rail; inside a
table, grouping is a rule.

## Shapes

Square with eased corners, four radii: 2px for the meter and the focus outline, 4px for every control, button,
chip, mark and highlighted value, 6px for toolbars, banners, toasts and menus, 8px for panels, dialogs and the
sentence field. No pills and no circles, the spinner aside. The panel of a select keeps the component library's
4px: the library has no token for its shape.

Lines are 1px. A field's border is Control line and turns Muted on hover, Action with a soft ring on focus, and
Danger, doubled to 2px, when invalid. A rule between rows is Line; the rule under a table header and the
builder's rail are Line strong. No coloured stripe marks the side of a row, a banner or a card.

Icons are Material Symbols, Sharp, weight 400, drawn in the colour of the text beside them: 20px by default, 16px
inside small text and marks of status, 24px at the head of a state panel. They ship as SVG with the application.
The suggestions action uses the light bulb; no sparkle stands for intelligence.

## Components

### App bar

The frame of every screen. Bar ground, 56px, the brand mark and name at the start linking home. There is no
language switch: the interface is in Hebrew alone. It scrolls with the page.

### Buttons

Plain and exact; they step, they do not glow.

- **Shape:** 44px high, 24px side padding, 4px radius, Body strong. Small: 36px, 12px, Small strong, never below
  640px.
- **Primary:** Action ground, On action text. One per view. **Tonal:** Tonal ground, Ink text; every other
  button. **Text:** Ink text with an underline; cancel, a banner's action.
- **On the sentence field:** the main action is Ground with Ink text; the second is On action tonal with On action
  text.
- **Icon button:** 44px square, Muted icon, Tonal ground on hover; always with a name for assistive technology and
  a tooltip.
- **States:** hover changes the ground and lifts 1px for a fine pointer; a press sinks 1px and scales to 0.985;
  focus is the ring; disabled is Tonal ground with Muted text; while its action runs, the button looks the
  same, is unavailable and keeps the focus (Dialogs and toast, below), and shows a 16px spinner before its label
  (`ההרצה מתבצעת`).
- An underline anywhere (text button, link, adder) rests at 40% of its text colour and fills on hover.

### Fields

- **Style:** Ground fill, 1px Control line, 4px radius, 44px, Body text, 12px side padding. A visible label above
  (Small strong, 8px away), never a floating or placeholder label. A hint under it in Caption.
- **Kinds:** text, text area (72px at least), select (a caret at the end; a search or a filter may carry its own
  label inside as a Muted prefix: `ישות ראשית: הכול`), number with a unit at the end (`₪`, `שנים`), date, and a
  list of values as chips inside the field.
- **Focus:** Action border and a soft 4px ring, at once. **Hover:** Muted border.
- **Error:** a 2px Danger border, and under the field its reason in Small strong Danger with the error icon: what
  is missing and what to enter (`חסר ערך להשוואה. יש להזין סכום.`). Errors show on save, not while typing.

### Segmented control

Two or three joined buttons sharing one border; the selected one is filled with Ink. Used for all of / any of.
36px, 44px on a phone. Keyboard focus is a 2px ring drawn inside the segment, because the shared border clips
what is outside it: Action on a resting segment, Ground on the selected one.

### Chips

Tonal ground, Label text, 24px, 4px radius. Facts and evidence, and values in a list field (30px there, with a
remove button). A chip is never a button.

### The mark and the value

The signature of the system.

- **Mark:** 22px square (wider for two letters), 4px radius, Action tint ground, Action letter at weight 600.
  Letters follow the order of the conditions in the definition, top to bottom, and are recomputed on every edit:
  Hebrew numerals (א to י, then יא, יב and on). A condition on related records has a letter of its own, given
  before the letters of the conditions inside it: a run matches that node as a whole, so its letter is the one a
  reason and the breakdown show. The mark is display only: it is derived from the order of the definition and
  never stored. On a run, the marks are those of the version that ran.
- **States:** resting; **traced**, filled with Action while its condition is under the pointer or in focus
  anywhere on the screen; **active**, filled while it is the current filter; **open**, an outline in Danger while
  its condition is incomplete or invalid. On the sentence field the same four read in On action.
- **Value:** the actual value that matched, inside its reason: Action tint ground, Body strong, 4px radius. A
  reason reads as a statement with its value marked: `גיל [15] נמוך מ־16`. A value stays whole while it fits on
  a line; only one longer than the line itself (an address, a long name) breaks inside its tint, so no value
  widens the page.
- A mark is hidden from assistive technology where a name already says it (`תנאי ב`), and is its name where
  nothing else does.

### Rule sentence

The control read back in the user's words, each clause opening with its mark, bound to its first word so a line
never ends on a mark. Two forms:

- **Field:** in the editor only. Action ground, On action text, 8px radius, 24px padding: a small heading
  (`הבקרה במילים`), the sentence, under a divider one line of status when something is unfinished (`תנאי ה לא
  הושלם: חסר ערך להשוואה.`), then save and run, save, and cancel. The sentence is the engine's: the editor asks
  for it 400ms after the last edit of a complete draft and draws what comes back. While a condition is
  unfinished nothing is asked; a complete draft the engine refuses is asked about again on its next edit. In
  both cases the last valid sentence stays, in On action stale, the mark of the open condition is outlined,
  and the status line names it. Marks are those of the current draft, so a clause
  whose condition was removed stands without one. Before the first valid sentence the field holds one line of
  hint, which says why there is no sentence: no condition is complete yet (`כאן תוצג הבקרה במילים, לאחר שהתנאי
  הראשון יושלם.`), the conditions were refused (`הבקרה תוצג כאן במילים לאחר תיקון התנאים.`), or the engine does
  not answer (`אי אפשר להציג כעת את הבקרה במילים.`). A sentence that is waiting for its answer is not dimmed, so
  typing does not make it flicker. Changes of the sentence and of the status line are announced politely.
- **Plain:** on Ground, for reading: under the title of a run, and for each draft in the suggestions dialog.

### Relationship map

The root entity picker. The entities the glossary allows as a root are options of one radio group, 44px, joined by
their relationships. A link carries the glossary's label of the relationship that leads away from the chosen
root, so it reads as the user would say it from there (`המשרד`, `עובד במחלקה`); two neighbours that no
relationship joins have no link. The chosen entity is filled with Ink and says `ישות ראשית`. One sentence under
the map states what the control will return and lists what else it may ask about (`הבקרה תחזיר מחלקות. אפשר
להתנות גם על: המשרד ועובד במחלקה.`). It is drawn from the glossary and assumes no number of entities. Arrow
keys move the choice, and the chosen entity is the group's one tab stop.

### Condition builder

One Surface panel. Inside it:

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
  filled with Ink while on, and the value input then becomes a field picker.
- **Related records:** a group whose head reads as the start of a sentence: its mark, a quantity (`אין אף` /
  `יש`), the relationship (`עובד במחלקה`), the word `עם` and the segmented control of its own rows (`כל התנאים` /
  `אחד התנאים לפחות`), then a remove button. The wording carries no gender. Its rows are about the related
  entity, and their letters continue after the node's own.
- **Adders:** at the foot of each group, text buttons with a plus: condition, group, condition on related records.
- **Removing:** a removed condition or group is offered back by a toast for as long as it stands (`תנאי ב הוסר`
  or `הקבוצה הוסרה, עם התנאים שבה`, with `שחזור`), and so are the conditions a changed root entity cleared. The
  offer is withdrawn as soon as the conditions are another draft (edited further, read again from the server,
  started over), because the way back leads to the draft as it was.
- **Note:** once, at the foot of the panel, the rule about missing values (a comparison does not match a missing
  value; missing values are found with the comparisons that ask whether a value is missing or empty). The note
  names no comparison: their labels are the glossary's.
- **Validation:** a server error is placed by its path on the row it names: the row's mark turns open, the
  offending input takes the error state, the reason stands under the row, and the sentence field's status line
  names the condition.

### Toolbar

A strip of Surface, 6px radius, 12px padding, over the table it controls: a search field with a leading icon, then
filters. It wraps; on a phone the filters fold into one square Tonal button, and unfold by themselves while one of
them narrows the list, so a narrowed list always shows what narrows it.

### Tables and card rows

- **Table (from 640px):** on Ground with no frame. Headers in Small strong, Muted, over a Line strong rule; rows
  12px padded, top aligned, divided by Line; Row hover under the pointer. The table bleeds 12px past the content
  edge on both sides so its text stays on the page's edge.
- **Sorting:** a header is a button; the sorted column shows an arrow and turns Ink.
- **Card rows (below 640px):** the same cells, stacked between rules, 16px padded; no boxes. The header row is
  read by assistive technology and not seen, and its sort button is not there: the toolbar's select sorts.
- **A link in a row** (a control's name, a result) answers a touch 8px above and below its line, the height of a
  control in all; the row keeps its height and the focus ring stays on the text.
- **Controls list:** the name (a link to the editor) over its description; the root entity; the last run; the
  result; the actions: run (small tonal button with its label) and icon buttons for edit and duplicate. The result
  is one of: a count as an Action link to that run (`3 חריגות`), `ללא חריגות` with a check in Success, `ההרצה
  נעצרה` with the error icon in Danger, both linking to their run as the count does, or a dash when the control
  has never run. Under the page title stands the number of controls of the state shown (`6 בקרות פעילות`); under
  a search or an entity filter the line says how many were found (`נמצאו 3 בקרות`).
- **A run from the list** stays on the list. The row's button keeps the focus and is marked unavailable while
  the run is on its way, the actions column holds its width, and the start and the outcome are said to assistive
  technology by name (`הרצת הבקרה ”…” הסתיימה: 3 חריגות`); the row's result and its run button are described by
  the control's name.
- **Results:** the record's identifying fields, then the reasons: one line for each condition the record matched,
  its mark, then the sentence with the value marked.
- **Foot:** the range in words, a page size select and previous and next icon buttons. The range is a status:
  after a search, a filter, a sort or another page it is said to assistive technology.

### Run summary

A statement, not a row of tiles: between two Line strong rules, the Figure with its noun (`23 חריגות`), then a
short list of terms and values: what was checked, how long it took, and the count of the previous run with its
date.

### Breakdown by condition

A meter list in a Surface panel: one row for each condition with its mark, its clause, the number of violations
that match it, and that share of the total as an 8px bar (Action on Action track), plus a first row for all
violations. Each row is a button that filters the table; the chosen row takes Action tint and its mark turns
active. A record may match several conditions, and the panel says so. To assistive technology a row's number is
read with its noun (`8 חריגות`).

### Banner

A message that belongs to the whole screen and leaves the content in place: an icon in the state colour, a title
in Body strong, one or two sentences in Small, and at most one text button. Tint ground, 1px line in the state
colour at 35%, 6px radius.

### State panel

A message that stands where content would be: an icon (24px), a title, a short paragraph in Body, then buttons. It
is aligned to the start edge, 62 characters wide at most, and never centred with an illustration.

### States

Every empty, waiting and failed state, and what it says. The error codes are those of `contracts/errors.md`.

| State | Where | Component | Says | Next step |
|---|---|---|---|---|
| No controls yet | Controls list, in place of the toolbar and the table; the page head leaves its two actions to the panel | State panel, neutral | What a control is, in one sentence. No example: an example would name the entities of one glossary | New control (primary); suggestions (tonal) |
| Every control archived | Controls list, under the toolbar | State panel, neutral, no icon | That no control is active and where the archived ones are | Show the archived controls |
| Never run | A list row | Text | `טרם הורצה` as the last run; a dash as the result | Run |
| Run in progress | List row, results | Button with spinner, unavailable (on a list row it keeps the focus); skeleton rows in the table | `ההרצה מתבצעת` | Wait |
| No violations | Results | State panel, Success | That the control was checked against every record and none matched | Run again; back to the list |
| More violations than the cap, `ROW_CAP_EXCEEDED` | Results, above the table | Banner, Warning | The exact total and how many are shown; the figure and the breakdown count all violations; the search, the filter and the sort reach the stored rows only, and a search that finds none there says so | Edit the conditions |
| Run timed out, `QUERY_TIMEOUT` | Results; the list row shows `ההרצה נעצרה` | State panel, Danger | After how long it stopped, and that nothing was checked | Edit the conditions; run again |
| Run failed for another reason (a run error other than the two beside it) | Results; the list row shows `ההרצה נעצרה` | State panel, Danger | That the run did not complete, and what stopped it then, in the past tense: the run may be days old, and the text of a live failure would say the system is down now | Run again |
| Run still in progress when its results are opened (`running`) | Results; the page head offers no run | State panel, neutral, no icon | That the results appear when the run ends | Look again |
| Engine, database or network not answering, `ENGINE_UNAVAILABLE`, `DATABASE_UNAVAILABLE`, `NETWORK_ERROR` | Any screen, under the page head | Banner, Danger | What still works (reading) and what waits (run, save) | Try again |
| The saved definition no longer fits the glossary, `CONTROL_DEFINITION_OUTDATED` | Results: state panel, Warning, and the page head offers no run. Editor: banner, Warning, and the error on the row | Which condition, by its mark: the label of a field that left the glossary no longer exists, and a key never reaches the screen | Edit the control |
| Control archived, `CONTROL_ARCHIVED` | Editor, under the page head: the control is shown as text. Results, after "run again" was refused | Banner, Warning | That it can be read but not changed or run | Editor: duplicate into a new control. Results: none |
| No such control, run or page | In place of the screen | State panel, neutral | That the address may be wrong or the thing gone | Back to the list |
| Definition not valid, `DEFINITION_INVALID` | Editor | Field error on the row; status line on the sentence field | What is missing on that condition | Fix the row |
| Saved elsewhere meanwhile (conflict) | Editor, under the page head | Banner, Warning | That this screen's changes are not saved | Load the current version |
| Search or filter matches nothing | Under a toolbar | State panel, neutral, no icon | The term searched and what the search looks in | Clear the search |
| Saved, archived, created | Any | Toast | The result in one line (`הבקרה נשמרה כגרסה 4`) | One optional text button |

Loading never blanks a screen: the head and the toolbar stay, and rows are skeleton bars (Tonal, breathing slowly)
in the shape of the rows to come.

### Dialogs and toast

- **Dialog:** Ground, Line strong edge, 8px radius, 24px padding, the Overlay shadow, over the Scrim. A title and
  a close button; the buttons at the end edge with the main one last. Used for two things only: to confirm
  archiving a control, and for suggestions. Everything else happens in the page.
- **Archive confirmation:** says what archiving does and what it does not: the control leaves the list, its
  runs and results are kept, and it can be duplicated into a new control (`הבקרה ”…” תוסר מהרשימה. ההרצות
  והתוצאות שלה יישמרו, ואפשר יהיה לשכפל אותה לבקרה חדשה.`). There is no restore in this version, so the text
  promises none. Archiving is an action of the editor's page head; the list shows archived controls under its
  state filter, marked with a chip, with duplicate as their one action.
- **Suggestions dialog:** a list of drafts, each a checkbox (none ticked at first), a name, its sentence in the
  plain form with marks, one line of rationale in Small Muted, the evidence as chips, and a text button to open
  it in the editor. The main button counts what will be created (`יצירת 2 הבקרות שנבחרו`) and is disabled while
  nothing is ticked. Nothing is saved or run by opening it. The head and the buttons stay in view and the list
  scrolls between them.
- **Toast:** Bar ground, On bar text, 6px radius, the Overlay shadow; one line and at most one text button; at the
  bottom, at the start edge. Never for an error.
- **Leaving a changed draft** is asked by the browser's own prompt, on closing the tab and on a link of the
  application alike (`השינויים בבקרה לא נשמרו. לצאת מהעריכה בלי לשמור?`). It is not a dialog of the
  application, and an unchanged control is left without a question.
- **A button made unavailable by its own press** (save, run, the last page of a pager) keeps the focus it holds:
  it is marked unavailable for assistive technology and ignores a second press, and is not removed from the tab
  order. A button that cannot be used as the screen stands (nothing ticked, a limit reached) is disabled. The
  pager's two buttons are of the first kind at both ends, also on a first page nobody has pressed yet: one
  button, one behaviour.

### Motion

Motion says that a state changed. Nothing moves on load, nothing moves on scroll, and nothing loops except the
two signs of waiting.

| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Every transition |
| `--duration-in` | 150ms | A hover arriving: ground, border, underline, a mark being traced |
| `--duration-out` | 120ms | The same leaving |
| `--duration-press` | 90ms | A button's step: 1px up on hover (fine pointer only), 1px down and 0.985 on press |
| `--duration-panel` | 200ms | A dialog opening: fades in and rises 6px |
| `--duration-close` | 120ms | A dialog closing: the component library's own fade, inside this time |
| `--duration-settle` | 600ms | The settle, below |

- **Focus is instant:** the ring and a field's focus border appear with no transition.
- **The trace:** while a condition is under the pointer or in focus (its row, its clause, its meter row), its mark
  fills everywhere it stands on the screen.
- **The settle:** when a new sentence arrives from the engine, each clause whose text changed is rewritten in
  place and its mark there fills at once and eases back over 600ms, so the eye finds what the edit changed. The
  first sentence of a screen settles nothing. This is the one authored moment of the product.
- **Waiting:** a 16px spinner turning once a second inside the button that started the work, and skeleton rows
  breathing between full and 45% opacity over 1.4s.
- **Panels of a select:** they keep the component library's own opening and closing (about 120ms); only the
  dialog's opening is authored, on the application's own panel class.
- **Reduced motion:** buttons do not step and a press shows as a tone (Action pressed); the spinner and the
  skeletons stand still; a dialog and a select's panel appear at once; the settle does not run.

## Do's and Don'ts

### Do:

- **Do** give every condition its mark and show that mark wherever the condition is named: builder, sentence,
  breakdown, reasons.
- **Do** keep reading on Ground and operating on Surface, with fields filled with Ground.
- **Do** keep one filled Action button in a view and make every other button tonal or text.
- **Do** write a state as an icon, a sentence and a next step, in the words of [PRODUCT.md](PRODUCT.md): action
  nouns (`שמירה`, `הרצה`), no gendered address, no database terms.
- **Do** take every colour, size, radius and duration from the tokens; a component holds no literal value.
- **Do** keep every control 44px high on a phone and every label visible above its field.
- **Do** build each screen at 390 first and check it at 390 and 1440.

### Don't:

- **Don't** colour a count of violations red or put an alarm icon on it. Red means the system or the input failed.
- **Don't** put a panel inside a panel, a shadow on anything that is part of the page, or a coloured stripe down
  the side of a row or a banner.
- **Don't** use a physical `left` or `right` in CSS, mirror an icon that shows a thing, or letter-space Hebrew.
- **Don't** set a number in the summary as a row of metric cards, add a chart for its own sake, or animate a
  number counting up.
- **Don't** open a dialog for anything but confirming an archive and reviewing suggestions.
- **Don't** let a table name, a column name, a condition id or an error code reach the screen.
- **Don't** load a font or an icon from a network: the product may run with no internet access.
- **Don't** restyle Angular Material by its internal classes. Where no token exists (the focus ring of a segment)
  the rule names the component's element and its state in ARIA.

## Implementation

Notes for the client task; the visual system above does not depend on them.

- **Tokens.** One stylesheet declares them on `:root` under the names used here: `--color-*`, `--text-*`
  (`label`, `small`, `body`, `title`, `sentence`, `page`, `figure`), `--space-1` to `--space-8`, `--radius-xs` to
  `--radius-lg`, `--size-control` (44px), `--size-control-sm` (36px, 44px below 640px), `--size-icon`,
  `--size-mark`, `--size-bar`, `--gutter`, `--container`, `--shadow-overlay`, `--ease-out` and the `--duration-*`
  set. Component styles read only these.
- **Angular Material.** One light theme through `mat.theme`, then Material's system tokens are pointed at these
  values with `mat.theme-overrides` (or the mixin's `$overrides` map): primary to Action, the surfaces to Ground
  and Surface, on-surface to Ink, outline to Control line, error to Danger, and the corner tokens to the radius
  scale. Where a component still differs (pill buttons, button height, dialog corners, elevation) it is corrected
  with that component's own `overrides` mixin, whose token names are on the component's Styling tab. Fields reach
  44px by density: Material's field is 56px and each density step removes 4px, so the form field takes −3; buttons
  start at 40px and take their height from the button overrides.
- **Fields in Material.** A plain `<label>` above the form field and no `mat-label` inside it; outline
  appearance; dynamic subscript sizing so a field with no hint or error reserves no space under it.
- **Tables.** One data source and two templates: the table from 640px, the card rows below.
- **Paginator and other built-in text.** Material's own strings come from the translation files; the range uses
  the worded form.
- **Fonts and icons.** IBM Plex Sans Hebrew (SIL Open Font License 1.1) in weights 400, 500 and 600 and the
  Material Symbols Sharp icons in use (Apache 2.0) are bundled with the build; icons are registered as SVG.
- **What the contracts provide.** Every sentence arrives with `sentenceParts` and every reason with `textParts`
  (`contracts/api.md`): pieces of text, each tied to the condition it speaks for and to its role (the field, a
  value, the record's actual value). The client draws the parts and renders no text of its own; a mark stands
  before the first clause of each condition, and an actual value is drawn as the value. A run carries a count per
  condition that can be matched, exact also above the row cap, and its results filter by condition. The
  definition of the version that ran is one request away, so the marks of a run are those of what was checked.
