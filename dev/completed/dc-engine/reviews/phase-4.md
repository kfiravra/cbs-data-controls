# Phase 4 review: engine and the README's Engine section, `642f140..a49c710`

Reviewer: the `reviewer` agent on opus, 2026-11-11, read-only. Report as returned.

No critical findings and one warning. The warning is that nothing tests the clamp that cuts an oversized `rowCap`
down to `ENGINE_ROW_CAP`, even though a test's name says it does.

## Standards

Nothing in `app/` names a language or a real entity or field, and no `.py` test holds a Hebrew literal.

- `engine/app/executor/database.py:104`, info, hard violation ("No dead code lands"; "New behaviour ships with
  tests"). `count_compiled` has no caller and no test in this commit. It is there for phase 5.
- `engine/app/executor/database.py:149`, info, hard violation ("Test behaviour through public interfaces"). Only
  `translate_driver_error` is tested (`engine/tests/unit/test_startup.py:80`). No test pushes a fabricated
  `HYT00` through `_select` or `/run`, so two things are unproven: the `connecting=False` argument at the call
  site, and the 504 `{timeoutSeconds}` error `/run` should return.
- `engine/tests/integration/test_semantics_live.py:211`, info, hard violation (Genericity: a test reads field
  keys from the glossary or the examples). The string `"email; DROP TABLE hr.Employee"` spells a field key, which
  also contradicts the module's own docstring ("never spelled here").
- `engine/tests/unit/test_explainer.py:16`, info, judgment call. The test imports `fill` and `rendered` from
  `app.explainer.parts`, which are not in the package's `__all__`, so it tests the implementation rather than
  the public surface.
- `engine/app/explainer/render.py:24,92`, info, judgment call (repeated switch; python.md "closed sets are
  immutable"). The code branches on the quantifier in two places, once through a plain mutable dict:
  `_RELATED_REASON_KEYS = {"any": ..., "none": ...}`.
- `engine/app/explainer/__init__.py:40` and `render.py:195`, info, judgment call (divergent change). The explainer
  builds the camelCase response dicts itself (`sentenceParts`, `reasonText`), so any change to the api.md shapes
  means editing the renderer.
- `engine/tests/integration/test_text_goldens_live.py:17`, info, judgment call. It imports helpers from another
  test module (`tests.golden.test_goldens`).

## Plan / contract

- `engine/tests/integration/test_examples_live.py:114`, warning. `test_row_cap_above_the_ceiling_is_the_ceiling`
  sends a cap of 5,000,000 against 10 violations, and any cap of 10 or more passes. So the clamp at
  `engine/app/routes.py:80` is untested. api.md requires it ("above the engine's configured maximum ... it is
  that maximum"), and so does Design G ("clamped to `ENGINE_ROW_CAP`").
- `engine/tests/integration/test_examples_live.py:136`, info. Every `/validate` test uses `live_client`, so
  nothing checks that `/validate` works with the database down. api.md says "A dry compile; it does not touch
  the database."
- `README.md:113`, info. The `ENGINE_PORT` row says "the port the start command gives to `--port`", but the
  section's own start commands (lines 75-85) hard-code `--port 8000`. Setting the variable changes nothing for
  someone following them.
- `README.md:134`, info. The README lists the Hebrew text goldens with the unit and golden tests. They are
  rendered from a live `/run` (`test_text_goldens_live.py`, marked integration) and fail without the database.
- `README.md:75`, info. The command is `python3 -m venv`, but decision 21 makes Windows a host the engine must
  start on, and there the command is `python` or `py`. Only the venv interpreter path is given for Windows.

The rest is clean. Explainer: it matches every bullet of errors.md "Rendering"; a nested related node, `between`
on dates, a field on a two-hop path and an identifier list were rendered against the real glossary, every part
carries the right node id (the list separator and the inner nodes of a related phrase included), no part is
empty, and the parts join to the string. Reason params match the "Reason keys" table. `/run` and `/validate`:
every member matches api.md. Executor: count and page run on one connection, the single-SELECT guard checks
both statements, the connection is released in `finally`, the INFO `run` line holds only the root key and
counts, `hide_parameters=True` is set and the driver's message is logged only at ERROR. Unattended decisions 15
and 16 are sound on their merits.

**Totals.** Standards: 0 critical, 0 warning, 7 info. Plan / contract: 0 critical, 1 warning, 4 info.
