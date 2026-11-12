# Probe: where two validators report a schema failure (2026-11-10)

Why: dc-contracts H4a says the `path` of a `SCHEMA_VIOLATION` is the instance location of the failing keyword and
that Python `jsonschema` and JsonSchema.Net report it "once, at one instance location". The engine validates with
the first, the api with the second, and both are tested on the same fixtures, so the claim was checked.

How: a miniature of the definition schema (draft 2020-12; node types and operand shapes by `if`/`then` inside
`allOf`; `additionalProperties: false` on every object; `is_null` forbidding `value` with
`properties: { "value": false }`; `between` forbidding `value` with `not: { anyOf: [required value, required
right] }`), ten documents, Python `jsonschema` 4.25.1 (`iter_errors`, `absolute_path`) and JsonSchema.Net 8.0.5 on
net10.0 (`JsonSchema.FromText`, `Evaluate(JsonElement, new EvaluationOptions { OutputFormat = OutputFormat.List })`,
then every unit of `Details` that has `Errors`). The scratch scripts were not kept; Phase 2 repeats this on the
real schema and the real fixtures.

## Python jsonschema

| Document | Path [keyword] |
|---|---|
| unknown node type | `/where/children/0/type` [enum] |
| missing operator | `/where/children/0` [required] |
| `value` with `is_null` (`properties: { value: false }`) | `/where/children/0` [false schema] |
| path of three hops | `/where/children/0/left/path` [maxItems] |
| `between` with one value | `/where/children/0/values` [minItems] |
| `between` with `values` and a `value` (the `not`) | `/where/children/0` [not] |
| extra member on a condition | `/where/children/0` [additionalProperties] |
| extra member at the root | `""` [additionalProperties] |
| bad id and bad group op | `/where/children/0/id` [pattern], `/where/op` [enum] |

A `false` subschema is reported at the object, not at the member: `descend` returns before it appends the path.

## JsonSchema.Net 8.0.5, raw list output

| Document | Units with errors |
|---|---|
| every invalid document | the `if` tests that did not match, as errors: `/where/children/0/type` [const] via `…/allOf/0/if/properties/type`, and for a condition `/where/children/0/operator` [const] via `…/allOf/n/if/properties/operator` |
| unknown node type | `/where/children/0/type` [enum] |
| missing operator | `/where/children/0` [required] via `…/then/$ref`, and the same twice more via `…/if` |
| `value` with `is_null` | `/where/children/0/value` [false schema] via `…/then/properties/value` |
| path of three hops | `/where/children/0/left/path` [maxItems] |
| `between` with one value | `/where/children/0/values` [minItems], and `/where/children/0` [required] twice via `…/then/not/anyOf/0` and `/1`: the inside of a `not` that passed |
| `between` with `values` and a `value` | only `/where/children/0` [required] via `…/then/not/anyOf/1`; nothing for the `not` that failed |
| extra member on a condition | `/where/children/0/foo` [false schema] via `…/then/$ref/additionalProperties` |
| extra member at the root | `/extra` [false schema] via `/additionalProperties` |
| bad id and bad group op | `/where/op` [enum], `/where/children/0/id` [pattern] |

## What follows

1. Drop every unit whose evaluation path has an `if` segment.
2. Lift a `false`-schema unit (empty error key) from the member to its object. After that both validators agree
   on every row above except the `not` rows.
3. A failed `not` cannot be located in JsonSchema.Net and a passing one produces noise. The schema must forbid a
   member with `additionalProperties: false` or `properties: { member: false }` and use no `not`, `anyOf` or
   `oneOf` (dc-contracts Design I1).
4. Each list comes in the validator's own traversal order, which the probe did not compare with the document's.
   H4a asks for document order, so both sides sort.
5. The package restores and runs on the local SDK (10.0.114) with JsonPointer.Net 6.0.1 and Json.More.Net 2.2.0.

## Repeated on the real schema (2026-11-11, Phase 2)

How: JsonSchema.Net 8.0.5 on net10.0 against `contracts/control-definition.schema.json` as merged, the six
examples, the thirteen fixtures of `contracts/examples/invalid/` and fifteen extra documents (scratch project
outside the repository, not kept). Python's side was not re-run here: the fixtures' `expected.path` is what the
engine's validator must report, and `scripts/contracts-check.py` checks them on the contracts side.

- The schema uses no `not`, `anyOf` or `oneOf`; `allOf` holds only `if`/`then` pairs. Design I1 holds.
- Every document, valid ones included, lists the `if` tests that did not match as errors (`const` and `enum` on
  `type` and `operator`, `required` on the node). With the units whose evaluation path has an `if` segment
  dropped, the six examples leave no error unit.
- A `false` subschema is reported at the member with an empty error key: `/where/children/0/value` for
  `value-with-is-null.json` (expected `/where/children/0`), `/extra` for an extra root member, `/where/id` for
  an `id` on a group, `/where/children/0/left/oops` for an extra member of a field reference. Lifted to the
  parent, each is where the contract puts it.
- After the two corrections the five schema-layer fixtures land on their `expected.path`, one unit each:
  `between-with-one-value` `/where/children/0/values` [minItems], `condition-without-operator`
  `/where/children/0` [required], `path-of-three-hops` `/where/children/0/left/path` [maxItems],
  `unknown-node-type` `/where/children/0/type` [enum], `value-with-is-null` `/where/children/0` [false].
- The eight semantic-layer fixtures are schema-valid, as they must be for the engine to see them.
- Other shapes: a missing `where` is at `""`; a wrong root node type at `/where/type` [const]; an arity-1
  condition with neither `value` nor `right` at the node [required]; `value` beside `right` at the node (lifted);
  empty `children` at `/where/children`; duplicate `in` values at `…/values` [uniqueItems]; `"value": null` at
  `…/value` [type]; a fault inside a related node's `where` at its own node; two faults give two units.
- `schemaVersion: 1.0` passes `const: 1`, so the api's own check treats any number equal to 1 as version 1.
