# Phase 2 review: engine, `a426451..c96bc1d`

Reviewer: the `reviewer` agent on opus, 2026-11-11, read-only. Report as returned.

Four findings on standards (the worst a crash) and two on the contract. No suite was run; all six findings are
against commit `c96bc1d`.

## Standards

- `engine/app/validator/schema.py:34`: **critical**, hard violation (CODING-STANDARDS Security: "bounded
  execution (... depth and size limits)"). A definition of 170 nested groups (about 8 KB, far under the 1 MiB
  body limit) raises `RecursionError` inside jsonschema's `iter_errors`. The caller gets 500 instead of
  `TOO_DEEP` at `/where`; at 150 levels it is still `TOO_DEEP`. `_group` and `document_positions` also recurse
  without a bound, and no test covers this.
- `engine/tests/unit/test_validator.py`: **warning**, hard violation (Size and structure: "Files stay under about
  500 lines"). The file is 752 lines.
- `engine/app/validator/semantic.py:163,216,239`: **info**, judgment call (data clump). `pointer, node_id` travel
  together through `_error`, `_field_ref`, `_field_comparison`, `_literals` and `_literal`.
- `engine/app/validator/semantic.py:51`: **info**, judgment call. `run` returns `None` while the errors sit on a
  public mutable list. That split is what needs the "unreachable" `raise InternalError()` at
  `engine/app/validator/__init__.py:72`.

## Plan / contract

- `engine/app/validator/semantic.py:153` with `:224`: **warning**. The per-list `TOO_MANY_VALUES` check runs only
  after the left field resolves. errors.md, Order of checks 3, says: "A check that needs a key the validator
  could not resolve ... is skipped; every other check runs." With `maxListValues=3`, an unknown field and 4
  values, only `UNKNOWN_FIELD` comes back. The same happens under an unknown root and inside a related node with
  an unknown relationship. It needs a glossary list limit below the schema's 100 to show, and it is untested.
- `engine/app/validator/semantic.py:177-179`: **warning**. `PATH_NOT_REACHABLE` in a field path stops the walk,
  although the relationship and its target are known. A related node with the same fault keeps checking its
  `where` (`:116-125`). The notes' own rule ("does not stop the walk when the entity it reaches is still known")
  and "every other check runs" both say the field should still be checked. Of the four notes choices: exact enum
  match: sound; typing literals despite `OPERATOR_NOT_ALLOWED`: sound; checking a related node's `where` in its
  target: sound; continuing after a path fault: sound, but not applied in this case.

## Checked and clean

- Every code carries the params, path and `nodeId` errors.md pins; `nodeId` is absent on `/rootEntity`, `/where`
  and `DUPLICATE_NODE_ID`.
- The sort is position, then code, then `index`.
- Depth, condition count and total values match the Rules, related sub-trees included.
- `_operand_fits` matches the schema's four arities.
- These produce errors, not crashes: NaN, ±Infinity, 10^400, a `schemaVersion` of 1.0, NaN, true or null, mixed
  lists, and dates written in Unicode digits.
- Nothing is keyed on a real entity or field key.
- Expected values in the tests come from the fixtures or are written by hand from the Rules.

**Totals.** Standards: 1 critical, 1 warning, 2 info. Plan/contract: 2 warning.
