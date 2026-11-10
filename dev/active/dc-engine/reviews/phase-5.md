# Phase 5 review: engine, the suggestions, `a49c710..57e3e28`

Reviewer: the `reviewer` agent on opus, 2026-11-11, read-only. Report as returned.

The phase-5 suggestions code is sound overall: no hard security issue, and nothing branches on a real entity,
field or relationship. One genericity gap and one wrong heuristic, both warnings, plus five info items.

The conventions were checked and found correct: the c/r ids follow document order with a related node's `where`
numbered right after it, a single-child OR collapses, the root is always a group, "missing" is chosen by type,
and "inactive" is `eq` on a two-valued field and `ne` on a wider one. Each candidate goes through
`Services.plan_for` and the real count statement, and a rejected one is logged with codes only. The `limit`
loop stops without skipping a candidate that would have been returned. The profile is one SELECT and handles
NULLs correctly. No suggestion puts a number into a definition.

## Standards

- **`engine/app/suggestions/generators.py:65-71` with `shape.py:64-70`: warning, hard violation**
  (CODING-STANDARDS "A new entity is a glossary change and a `sql/` change, nothing else"). `_missing_required`
  uses `is_null` for every required non-text field, which assumes the field is nullable. Checked on the
  synthetic glossary: making `priority` non-nullable gets the whole `missing_required` candidate rejected
  (`OPERATOR_NOT_ALLOWED`) and dropped. So every required field of that entity loses its suggestion, under a
  warning that calls it a "generator bug". `contracts-check.py` allows such a glossary. The same thing happens
  when a field's own `operators` list leaves out the missing operator.
- **`engine/app/suggestions/profile.py:42-46`: info, judgment call.** `date_fields` ignores `comparable: false`.
  A glossary that marks a date field that way gets a pair profiled and a field comparison rejected on every
  `/suggest`, each one logged as a generator bug.
- **`generators.py:25-33`: info, judgment call (shotgun surgery).** Each kind name is written three times: in
  `KINDS`, in `GENERATORS` and in the generator's own string. `PARENT_CARDINALITY = "many_to_one"` is also a
  cardinality string written outside the glossary module, which already has `QUANTIFIABLE_CARDINALITY`.

## Plan / contract

- **`generators.py:98-103`: warning, wrong behaviour (decision 19).** The plan says "one order holds in at least
  80% of them and the other in at least one row". The code counts equal dates as the usual order in both
  directions, so when most dates are equal both opposite rules are proposed. Reproduced with
  `DatePair(opened_on, closed_on, 40, 2, 2)`: both `opened_on lt closed_on` and `closed_on lt opened_on` came
  back, and one of them flags normal records. The seed is fine (21 rows after, 1 equal, 3 before). The unit
  tests never try this case.
- **`pipeline.py:112`: info.** api.md says of `SuggestionItem.name`: "at most 200 characters". The engine does
  not enforce this, so a glossary with long labels could break it. Only the integration test asserts it, and
  only on the seed.
- **`compiler/profile.py:41-83`: info, deviation accepted.** Design H's profile asks for "the null count ... the
  distinct count ... the minimum and maximum". Decision 17 dropped those because no generator reads them. That
  is sound, but the plan text was never amended. Decisions 18 and 20 are fine as they stand.
- **`tests/unit/test_suggestions.py:135-166`: info, test gaps.** Untested: the exactly-5-rows boundary (only 4
  is tested; 5 qualifies); `rows == 0` for `missing_optional`, and `both == 0`; the startup refusal in
  `build_services` (only `missing_texts` itself is tested); `/suggest` answering 504 `QUERY_TIMEOUT`. The
  expected values are otherwise taken from independent sources (the examples, `sql/README.md` for 25 and 3,
  hand-written conventions).

**Totals.** Standards: 1 warning (hard violation), 2 info (judgment calls). Plan / contract: 1 warning, 3 info.
Critical: none.
