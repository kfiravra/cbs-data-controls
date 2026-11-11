# Phase 3 review: engine and harness, `e74d531..a9b3ec8`

Reviewer: the `reviewer` agent on opus, 2026-11-11, read-only. Report as returned.

The worst finding is a crash. A valid definition with nested groups gets a 500 `INTERNAL_ERROR`, because the
parameter count grows with conditions times depth and both statement shapes go past 2,000. It was confirmed by
compiling probe definitions against the real glossary.

## Plan / contract

1. **critical** `engine/app/compiler/build.py:332`, `:339`: every reference to a truth flag binds `:one` again,
   and `_matched` writes out each enclosing group's whole sub-tree for every node. 30 single-value conditions at
   depth 3, or 26 at depth 4, end in `InternalError` (`build.py:250`); depth 3 with 28 conditions already sends
   1,764. The fallback shape cannot help, because the growth is in the outer statements. Design D says: "The
   compiler asserts the parameter count is under 2,000; `maxTotalValues` makes that hold." That is false, and no
   test covers depth.
2. **warning** Decision 10 (notes) is sound in what it does. Groups are AND/OR only and `CASE` turns UNKNOWN into
   0, so filtering on the flags keeps exactly the rows the three-valued WHERE keeps. But it was sized on values
   alone. `tests/unit/test_compiler.py:474` checks the second shape only as text, never against rows.
   `.claude/skills/dc-engine/SKILL.md:58-60` now promises the second shape keeps every valid definition under
   the limit, which finding 1 shows is untrue.
3. **info** `engine/app/compiler/computed.py:31-32`: clamping to `date.min` is off by one day. A record born
   0001-01-01 (age 2025) satisfies `age >= 5000` and fails `age < 5000`. The upper clamp is correct.
4. **info** `SKILL.md:46-48` says "the plan maps the labels back to node ids". The plan maps the `m` labels; the
   `t` labels exist only inside the builder.

Decision 11 is correct. When the target year has a 29 February, `years_before` keeps it; for a birth in that
year, age >= n holds exactly when the birth date <= S(n). The literal plan wording would have been wrong.
Decisions 12 to 14 are sound.

These check out: every condition that can be matched gets `actual` and `rightActual`; parents are joined with
LEFT OUTER JOIN; EXISTS is correlated correctly for nested related nodes and for paths inside one; negative
operators and `none` follow the NULL rule; every age-table row matches Design D, fractional `between` ends
included; `escape_like` is complete (every `[` is escaped, so `]`, `^` and `-` can never sit inside a character
class, and `/` is doubled first); the cache is thread-safe, keyed as specified, and holds only valid
definitions; recipes let one plan serve any run date and cap, and nothing is mutated after a plan is built; no
caller text reaches the SQL, `TOP` and the expanded lists included.

## Standards

1. **warning, judgment (temporal coupling)** `build.py:165`, `:332`, `:336`: `_holds` reads `self._flag_label`,
   which only `_matched` assigns. `_statements` works only because line 277 calls `_matched` before line 280
   calls `_holds`.
2. **info, judgment (duplicated code)** `build.py:179-185` works out the matchable nodes again, although
   `ValidatedDefinition.matchable()` already returns them in document order. The `t{index}` label is also
   formatted in two places (`:236`, `:336`).
3. **info, judgment (mysterious name)** `build.py:102`: `f"p{len(self.recipes) - 2}"` ties parameter naming to
   the two constants.
4. **info, hard** `tests/unit/test_debug_compile.py:51`: `today.replace(year=today.year - 18)` raises on 29
   February. It also computes the expected value the way the code does, which CODING-STANDARDS (Tests) rules out.

Genericity is clean: nothing branches on an entity, field or relationship key, and the tests run on a synthetic
glossary. Errors cross the boundary as codes only; the text from `unsupported()` reaches only the startup log.

**Totals.** Plan / contract: 1 critical, 1 warning, 2 info. Standards: 1 warning, 3 info.
