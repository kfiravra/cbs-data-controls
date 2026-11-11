# Security audit: branch `feat/engine`, `origin/main...85bfa53`

Auditor: the `security-auditor` agent on opus, 2026-11-11, read-only. Report as returned.

One high, one medium and two low issues, all on the input-bounds side. Nothing on SQL injection, the read-only
login or error leakage. No suite was run, no service started and no database connection opened: the checks are
timing and memory snippets on the validator and compiler, and in-process TestClient calls without the lifespan.

## Findings

1. `engine/app/validator/schema.py:41`: **high** [A04 Insecure Design]
   - Risk: `uniqueItems` (`contracts/control-definition.schema.json:326`) runs through jsonschema 4.26's
     `_utils.uniq`, which goes brute-force O(n²) when the items can't be sorted. So one `in` condition whose
     `values` mixes a string with numbers (`["x",0,1,2,...]`) burns CPU while holding the GIL, and the 100-item
     `maxItems` doesn't stop it.
   - Confirmed by timing `validate_definition`: 1,000 / 2,000 / 4,000 items took 0.32 / 1.24 / 4.39 s (23 KB
     body). About 150k items fit under 1 MiB, which is roughly 1.7 h per request on `/validate` or `/run`. A
     wide `children` list is linear but heavy: 10k `{"type":"group"}` took 1.5 s and gave 700 KB of errors.
   - Precondition: reaching the engine port.
   - Fix: before `iter_errors`, cut every array in the copy at 101 items (one past the largest `maxItems`, so
     the error location is kept), or register a hashing `uniqueItems` with `validators.extend`.

2. `engine/app/services.py:117` (cache capacity at `cache/__init__.py:17`): **medium** [A04]
   - Risk: text literals have no length bound (schema `value`; `semantic.py:290`). A `contains` condition with a
     1,000,000-character value validates, and its cached plan holds 3.1 MB (measured with tracemalloc). 256
     distinct such requests pin about 0.8 GB.
   - Fix: cap text literals (`maxLength`, or a glossary limit checked in `_literal`; either is a contract
     change), or skip caching plans above a size.

3. `engine/app/cache/__init__.py:29`: **low** [A04]
   - Risk: a lone surrogate (`"value":"\ud800"`) raises `UnicodeEncodeError` before validation. The caller gets
     500 `INTERNAL_ERROR` and a full traceback is logged on every such request, so it can flood the log.
     Confirmed with TestClient.
   - Fix: reject strings that don't encode as UTF-8 at the edge, with a 400 or 422.

4. `engine/app/glossary/loader.py:199`: **low** [A01 Broken Access Control]
   - Risk: `identifyingFields` is checked for existence, not visibility. With `employee_number` marked hidden,
     the page still selects `e0.id AS d2`, returns it in every violation's `display`, and `public_view` lists
     the key. Only `scripts/contracts-check.py:727` refuses this; today's glossary has no hidden fields.
   - Fix: refuse hidden identifying and lifecycle fields in `_entity`.

## Checked, nothing found

- **Identifiers:** all SQL names come from `glossary.tables` and `source_column`. Aliases and labels (`e`, `k`,
  `d`, `a`, `t`, `m`, `p` plus a number) are generated. Root, relationship and field keys go through
  `visible_entity`, `usable_relationship` (both ends visible) and `visible_field`. Operators come from the closed
  map. `Accept-Language` can only yield a glossary language; a 5,000-character `X-Correlation-Id` is replaced by
  a fresh one.
- **Values:** every literal is a typed bind. `escape_like` is complete for T-SQL (`]` and `^` only matter inside
  a class); `a%_[/]'; DROP` compiles to p0 `a/%/_/[//]'; DROP`. `literal_execute` only ever carries the 1 and 0
  and `TOP int(min(rowCap, ENGINE_ROW_CAP))` (`routes.py:83`). The cache key is a sha256 of canonical JSON, and
  only valid plans are stored.
- **Read-only:** every statement goes through `ensure_single_select`. The login is a constant. SQLAlchemy
  brace-escapes host, database, driver and password (`;UID=sa` was tried in each). With the flag off,
  `/debug/compile` returns 404 without reading the body.
- **Leaks:** problem bodies carry a code and params only. `hide_parameters=True` is set; the driver message goes
  only to the ERROR log and SQL text only to DEBUG. The password's repr is masked. The image holds only
  requirements, `app` and `contracts`, runs as uid 10001 and has no `.env`. `.env.example` holds placeholders
  only.
- **Bounds and the rest:** the depth pre-check is iterative (a 900-deep `value` gets 422 in 0.01 s), and a
  chunked 1.3 MiB body gets 413. The regexes are anchored and linear. Suggestions stay local, the profile SELECT
  returns counts only, and every proposal goes through `plan_for`. The run log line holds counts only.
