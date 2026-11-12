# Control definition

A control definition is the rule of one control: the entity whose records are checked, and a tree of conditions
that is true for every record that breaks the rule. This page describes its shape, what it means, how it is checked
and how it becomes a query. The shape is fixed by
[`contracts/control-definition.schema.json`](../contracts/control-definition.schema.json), the codes and the rules
by [`contracts/errors.md`](../contracts/errors.md); where this page and `contracts/` differ, `contracts/` wins. Every
key a definition names comes from the glossary ([glossary.md](glossary.md)). The six example controls are described
in [examples.md](examples.md), the system around them in [summarize-architecture.md](summarize-architecture.md), and
what v1 leaves out in [assumptions-limitations-extensions.md](assumptions-limitations-extensions.md).

## Where a definition lives

- The JSON is the truth. The api stores it, minified as received, in `dq.ControlVersion`: one row per control and
  version (`control_id`, `version`) with the `definition` and its `definition_hash`. A version row is never changed,
  and a run names the version it ran (`control_version` in `dq.Run`).
- The engine receives the whole definition with every validate, run and debug compile, and stores nothing. SQL is
  derived from it inside the engine at run time, never stored and never sent between services; the only endpoint
  that shows SQL text is the engine's `POST /debug/compile`, off by default (`ENGINE_DEBUG_COMPILE`) and not exposed
  by the api.
- The engine keeps compiled plans in memory (statements, never results), keyed by a SHA-256 of the canonical
  definition, the glossary version and the engine version (`engine/app/cache/__init__.py`).

## Node types

Every object of a definition has `additionalProperties: false`: a member the schema does not list is a
`SCHEMA_VIOLATION`. One `node` schema declares every member any node can have, and an `if` on `type` requires the
members of that node type and forbids the others.

### The definition

| Member | Required | Value |
|---|---|---|
| `schemaVersion` | yes | the number 1 |
| `rootEntity` | yes | the key of a visible entity with `rootable: true`: the records that are checked |
| `where` | yes | a group: the root of the tree |

### Group

| Member | Required | Value |
|---|---|---|
| `type` | yes | `group` |
| `op` | yes | `and` or `or`: how the children combine |
| `children` | yes | 1 to 30 nodes: groups, conditions or related nodes |

A group has no `id`. It is never matched and never named in an error's `nodeId`.

### Condition

| Member | Required | Value |
|---|---|---|
| `type` | yes | `condition` |
| `id` | yes | matches `^[a-z][a-z0-9_]{0,31}$`; unique across the whole tree, related sub-trees included |
| `left` | yes | a field reference: the field the operator tests |
| `operator` | yes | one of the eighteen operator keys |
| `value` | by arity | the literal operand of an arity-1 operator: a number, a string or a boolean |
| `right` | by arity | another field as the operand of an arity-1 operator, in place of `value` |
| `values` | by arity | the literal operands of an arity-2 or a list operator: numbers or strings |

### Related

| Member | Required | Value |
|---|---|---|
| `type` | yes | `related` |
| `id` | yes | as for a condition |
| `relationship` | yes | a `one_to_many` relationship that starts at the scope entity |
| `quantifier` | yes | `any`: at least one related record satisfies `where`; `none`: no related record does, also when there are none |
| `where` | yes | a group, evaluated on each related record; its scope entity is the relationship's `to` entity |

### Field reference

| Member | Required | Value |
|---|---|---|
| `path` | no | 0 to 2 relationship keys, each `many_to_one` or `one_to_one`. The first starts at the scope entity, each next one at the entity the previous one reached. Absent or empty: a field of the scope entity |
| `field` | yes | a visible field key of the entity the path reaches |

The scope entity is the root entity, and inside the `where` of a related node the entity that node reaches. A
`one_to_many` relationship in a path is `PATH_NOT_TRAVERSABLE`: it belongs in a related node.

### Operands by arity

| Arity | Operators | Operand |
|---|---|---|
| 0 | `is_null`, `is_not_null`, `is_empty`, `is_not_empty` | none: `value`, `right` and `values` are forbidden |
| 1 | `eq`, `ne`, `lt`, `lte`, `gt`, `gte`, `contains`, `not_contains`, `starts_with`, `ends_with` | exactly one of `value` and `right`; `values` is forbidden |
| 2 | `between`, `not_between` | `values` with exactly two items, low then high, both included |
| `list` | `in`, `not_in` | `values` with 1 to 100 unique items |

The schema enforces the shape per operator. The engine checks it again against the glossary's `arity`
(`OPERAND_MISMATCH`, which only a schema and a glossary that disagree can produce). A literal must fit the left
field's type, else `VALUE_TYPE_MISMATCH`: for `number` a JSON number, never a boolean, whose absolute value is below
10^15; for `text` a string; for `enum` a string that is one of the field's `enumValues` (else `UNKNOWN_ENUM_VALUE`);
for `date` a string holding a real `YYYY-MM-DD` date; for `bool` a boolean. A range whose first value is above its
second is `RANGE_INVALID`; equal values are allowed.

## Operators

The glossary's `operators`, in its order. "Right side a field" is the operator's `fieldComparable`.

| Operator | Arity | Field types | Right side a field |
|---|---|---|---|
| `eq` | 1 | `number`, `text`, `date`, `bool`, `enum` | yes |
| `ne` | 1 | `number`, `text`, `date`, `bool`, `enum` | yes |
| `lt` | 1 | `number`, `date` | yes |
| `lte` | 1 | `number`, `date` | yes |
| `gt` | 1 | `number`, `date` | yes |
| `gte` | 1 | `number`, `date` | yes |
| `between` | 2 | `number`, `date` | no |
| `not_between` | 2 | `number`, `date` | no |
| `in` | `list` | `number`, `text`, `enum` | no |
| `not_in` | `list` | `number`, `text`, `enum` | no |
| `contains` | 1 | `text` | no |
| `not_contains` | 1 | `text` | no |
| `starts_with` | 1 | `text` | no |
| `ends_with` | 1 | `text` | no |
| `is_null` | 0 | `number`, `text`, `date`, `bool`, `enum` | no |
| `is_not_null` | 0 | `number`, `text`, `date`, `bool`, `enum` | no |
| `is_empty` | 0 | `text` | no |
| `is_not_empty` | 0 | `text` | no |

By type: `bool` takes `eq`, `ne`, `is_null` and `is_not_null`; `enum` adds `in` and `not_in`; `number` takes those
of `enum` plus `lt`, `lte`, `gt`, `gte`, `between` and `not_between`; `date` takes those of `number` except `in` and
`not_in`; `text` takes those of `enum` plus the four text operators, `is_empty` and `is_not_empty`.

A field's resolved operators are its own `operators` list when the glossary gives one, else the operators of its
type, minus `is_null` and `is_not_null` when the field is not nullable. Anything else is `OPERATOR_NOT_ALLOWED`. In
glossary 1.0.0 `department_assignment` and `manager_assignment` allow only `is_null` and `is_not_null`, and a
non-nullable field such as `status` or `age` offers neither. The eighteen keys are a closed list: the schema's
`operator` enum, `OPERATOR_KEYS` in `engine/app/glossary/model.py` and one SQLAlchemy expression per key in
`OPERATORS` (`engine/app/compiler/operators.py`).

## Semantics

### The tree describes the violation, and what is matched

A record of the root entity is a violation when the root group is true for it: a control states what a bad record
looks like ("active, and no email"), not what a good one looks like. An `and` group is true when every child is, an
`or` group when at least one is.

A node (a condition or a related node) is matched for a record when it is true for that record and every group above
it, up to the root group, is true. A true condition inside a group that is false is not matched. Only nodes outside
every related sub-tree can be matched: the nodes inside a related node's `where` are evaluated per related record,
and the related node itself is the one that is matched. A violation always has at least one matched node; its
`matched` lists them in document order, with one reason each in `reasons`. In `OR( AND( c1, c2 ), c3 )` a record
with c1 and c3 true and c2 false is a violation with `matched` `[c3]`. The `conditions` list of `/validate`, `/run`
and a stored run holds exactly the nodes that can be matched, and its `count` per node is taken over all violations,
also when only the capped rows are returned.

### NULL

Comparisons follow SQL: a comparison with NULL never matches, the negative operators included. `eq`, `ne`, `lt`,
`lte`, `gt`, `gte`, `between`, `not_between`, `in`, `not_in`, `contains`, `not_contains`, `starts_with` and
`ends_with` are false when the left value, or the right field's value, is NULL. Missing data is found only with the
four explicit operators:

| Operator | True when |
|---|---|
| `is_null` | the value is NULL |
| `is_not_null` | the value is not NULL |
| `is_empty` | the text is NULL, the empty string, or spaces only |
| `is_not_empty` | the text holds a character other than a space |

A field reached through a path is NULL when a relationship on the path finds no record: the department name of an
employee with no department is NULL. Text comparisons follow the database collation `Hebrew_CI_AS`, so they are
case-insensitive. `contains`, `not_contains`, `starts_with` and `ends_with` take the operand literally: `%`, `_` and
`[` are not wildcards (`escape_like` in `engine/app/compiler/operators.py`).

### Empty versus null

`is_empty` and `is_not_empty` exist for `text` alone. On a text field `is_null` misses an empty or blank value, while
`is_empty` covers NULL, the empty string and spaces only, so a text field that must hold something is tested with
`is_empty`, as `c2` of example 4 does for `email`. In SQL `is_empty` is `IS NULL` or equal
to a bound empty string; SQL Server ignores trailing spaces when it compares, so spaces only equal the empty string.

### Age

`age` of `employee` is a computed field: `computed { function, over }` in place of a column, with the function
`age_years` over `birth_date`. It is the whole years from that date to the run date, `run.year - date.year`, minus one
when the run date's (month, day) is before the date's. Over a birth date of 2008-11-01 it is 18 on 2026-11-01 and 17
on 2026-10-31. The run date is the request's `runDate`, by default today in `Asia/Jerusalem`. The engine never
computes an age in SQL: `age < 18` becomes `birth_date` later than the run date minus 18 years, a parameter
recomputed for each run, so the index on `birth_date` serves (`engine/app/compiler/computed.py`). A computed field
is never comparable with another field, and its `actual` in a reason is the computed value.

### Field comparisons

A condition with `right` compares two fields. It is allowed only for an operator with `fieldComparable: true` and
only when neither field has `comparable: false` (`FIELD_COMPARISON_NOT_ALLOWED`); the glossary marks every computed
field and every field that only says whether a link exists. The two fields must have the same type
(`FIELD_TYPE_MISMATCH`). Example `termination-before-hire` compares `termination_date` with `hire_date`.

## Limits

The limits live in the glossary's `limits`, because the schema cannot express depth or totals.

| Limit | 1.0.0 | Schema | Engine semantic layer |
|---|---|---|---|
| `maxDepth` | 4 | nothing | `TOO_DEEP` at `/where`: groups on the longest chain, the root and every related `where` counting one |
| `maxConditions` | 30 | `children` holds at most 30 nodes per group | `TOO_MANY_CONDITIONS` at `/where`: every condition and related node of the tree |
| `maxListValues` | 100 | `values` of `in` and `not_in` holds 1 to 100 unique items | `TOO_MANY_VALUES` with `limit: "list"` at `<node>/values` |
| `maxPathHops` | 2 | `path` holds at most 2 items | `PATH_TOO_LONG` at the field reference |
| `maxTotalValues` | 500 | nothing | `TOO_MANY_VALUES` with `limit: "total"` at `/where`: every `value` and every item of `values` |

- `scripts/contracts-check.py` asserts that the three numbers the schema repeats equal the glossary's; where it
  repeats one, the schema normally reports it first (`contracts/examples/invalid/path-of-three-hops.json` is a
  `SCHEMA_VIOLATION`).
- The engine refuses to start with a `maxTotalValues` above 500 (`unsupported` in `engine/app/compiler/support.py`):
  a statement could then pass `MAX_PARAMETERS` (2,000; SQL Server refuses more than 2,100). It answers a tree more
  than eight times past `maxDepth`, `maxConditions` or `maxTotalValues` (`OVERSIZE_FACTOR` in
  `engine/app/validator/__init__.py`) with that limit's error alone, before the schema runs.
- The api's schema layer (`DefinitionSchemaValidator`) bounds only what the schema bounds. It evaluates a
  definition of at most 240 nodes (objects and arrays that are items of an array, `MaxEvaluatedNodes`) and 10,000
  JSON values (`MaxEvaluatedValues`) whose numbers all fit a .NET decimal. A larger one is not refused there: it goes
  to the engine, which checks the schema itself, and nothing is saved before the engine has answered.
- Both services refuse a request body over 1 MB (413 `REQUEST_INVALID`). The client checks the five limits as a
  convenience.

## Versions

### `schemaVersion`

Every definition carries `"schemaVersion": 1`; the schema holds it as `const: 1`. Both services decide it before the
schema runs: a definition whose `schemaVersion` is present and is not the number 1 gets `UNSUPPORTED_SCHEMA_VERSION`
at `/schemaVersion`, and nothing else is reported. A definition without the member goes on to the schema, which
requires it.

### Control versions

`POST /api/v1/controls` stores the definition as version 1. `PUT /api/v1/controls/{id}` compares the definition's
hash with the current version's `definition_hash`: a SHA-256 of a canonical form, with object members sorted by
name, no whitespace, strings by their decoded value and numbers as written (`DefinitionHasher`). Member order and
layout do not make a new version; a different value, a number written another way (`1` and `1.0`) or a list in
another order does. A new version is written only when the hash differs, and only then is the engine's `/validate`
asked. A change of the name or the description alone keeps the version and works while the engine is down; when
nothing changed, nothing is written. `GET /api/v1/controls/{id}/versions` lists the versions with their
`definitionHash`, and an archived control keeps them.

## Validation

### Three layers

| Layer | Where | Checks | Trusted |
|---|---|---|---|
| client | the editor in `web/` | offers only what the public glossary allows (root entities, fields, resolved operators, enum and bool values, comparable fields), inputs by field type, the five limits | no: convenience only |
| api schema layer | `api/src/DataControls.Api/Controls/DefinitionSchemaValidator.cs` | `UNSUPPORTED_SCHEMA_VERSION`, then the schema with JsonSchema.Net 8.0.5; a failure is answered 422 without calling the engine | the system boundary, structure only |
| engine semantic layer | `engine/app/validator/` | the version and the schema again (Python `jsonschema`), then the glossary (`SemanticWalk`) | authoritative: runs on every validate, run, suggestion and debug compile |

The two schema validators report the same paths because the schema avoids `not`, `anyOf` and `oneOf`; the api drops
the failed `if` tests JsonSchema.Net lists and lifts a `false` subschema from the member to its object
(`SchemaErrorPaths`). Creating a control, accepting a suggestion and `POST /api/v1/controls/validate` pass both
layers before anything is stored. A run validates again in the engine: a saved definition that no longer validates
(a glossary key it uses has gone) ends the run `failed` with `CONTROL_DEFINITION_OUTDATED` and the engine's errors.

### Order of checks

1. `UNSUPPORTED_SCHEMA_VERSION`, before the schema, in both services; when it applies it is the only error. A
   `definition` that is not a JSON object never gets here: 400 `REQUEST_INVALID` with `MALFORMED`.
2. The schema layer: every `SCHEMA_VIOLATION`, one per distinct path. Any schema error ends validation, and the api
   then does not call the engine.
3. The semantic layer, in the engine only: everything it finds. A check that needs a key the validator could not
   resolve (an unknown root entity, relationship or field) is skipped; every other check runs.

Errors are listed in document order: the order in which their paths appear in the definition's JSON text, an object
before the members inside it. Errors that share a path follow the order of the code table below, and several of one
code follow `params.index`. One shortcut sits in front of step 2 in the engine: a tree more than eight times past a
limit is answered with that limit's error alone (Limits, above).

### Definition error codes

Shortened from [`contracts/errors.md`](../contracts/errors.md), which also gives each code's `params`. `<node>` is the
pointer of the node that holds the member, for example `/where/children/0`.

| Code | Layer | Path | Meaning |
|---|---|---|---|
| `SCHEMA_VIOLATION` | schema | the failing keyword's location: the object for a missing or an extra member, the member for a wrong value, type or length | does not match the schema |
| `UNSUPPORTED_SCHEMA_VERSION` | before the schema | `/schemaVersion` | present and not the number 1 |
| `UNKNOWN_ENTITY` | semantic | `/rootEntity` | no visible entity has the key |
| `ENTITY_NOT_ROOTABLE` | semantic | `/rootEntity` | the entity may not be a root entity |
| `UNKNOWN_RELATIONSHIP` | semantic | the field reference, or `<node>/relationship` | no relationship has the key |
| `PATH_NOT_REACHABLE` | semantic | the field reference, or `<node>/relationship` | the relationship does not start at the entity reached so far, or at the related node's scope |
| `PATH_NOT_TRAVERSABLE` | semantic | the field reference | a one-to-many relationship in a field path |
| `PATH_TOO_LONG` | semantic | the field reference | more hops than `limits.maxPathHops` |
| `UNKNOWN_FIELD` | semantic | the field reference | the entity reached has no visible field with the key |
| `RELATIONSHIP_NOT_QUANTIFIABLE` | semantic | `<node>/relationship` | a related node on a relationship that is not one-to-many |
| `OPERATOR_NOT_ALLOWED` | semantic | `<node>/operator` | not among the field's resolved operators |
| `OPERAND_MISMATCH` | semantic | the condition node | the operand does not fit the operator's arity in the glossary |
| `VALUE_TYPE_MISMATCH` | semantic | `<node>/value`, or `<node>/values` with `index` | a literal is not of the field's type |
| `UNKNOWN_ENUM_VALUE` | semantic | `<node>/value`, or `<node>/values` with `index` | not one of the field's `enumValues` |
| `FIELD_COMPARISON_NOT_ALLOWED` | semantic | `<node>/right` for the operator, or the reference of a field that is not comparable | a field comparison the glossary does not allow |
| `FIELD_TYPE_MISMATCH` | semantic | `<node>/right` | the two fields have different types |
| `RANGE_INVALID` | semantic | `<node>/values` | the first value of a range is above the second |
| `TOO_DEEP` | semantic | `/where` | deeper than `limits.maxDepth` |
| `TOO_MANY_CONDITIONS` | semantic | `/where` | more nodes than `limits.maxConditions` |
| `TOO_MANY_VALUES` | semantic | `<node>/values` for `list`, `/where` for `total` | too many literal values |
| `DUPLICATE_NODE_ID` | semantic | `<node>/id` of every node after the first that carries the id | two nodes share an id |

`nodeId` is the `id` of the nearest condition or related node at or above the path. It is absent when there is none
and on `DUPLICATE_NODE_ID`, whose id names two nodes.

### A problem with a definition error

`POST /api/v1/controls` with the fixture `contracts/examples/invalid/unknown-field.json`, whose second condition names
a field `employee` does not have. The answer is 422 with `Content-Type: application/problem+json`:

```json
{
  "type": "about:blank",
  "title": "DEFINITION_INVALID",
  "status": 422,
  "code": "DEFINITION_INVALID",
  "params": {},
  "errors": [
    {
      "code": "UNKNOWN_FIELD",
      "path": "/where/children/1/left",
      "nodeId": "c2",
      "params": { "entity": "employee", "field": "nickname" }
    }
  ],
  "correlationId": "5f2c0d8e9a7b4c1d8e3f6a2b7c9d0e1f"
}
```

## Example 4, annotated

[`contracts/examples/missing-mandatory-data.json`](../contracts/examples/missing-mandatory-data.json) finds employees
that lack data a business rule demands: an active employee needs an email, a salary and a department; an inactive one
needs a termination date. Rooted at `employee`, its tree is:

```
/where                              or    either branch                      depth 1
  /where/children/0                 and   the active branch                  depth 2
    c1  status eq active
    /where/children/0/children/1    or    what an active employee lacks      depth 3
      c2  email is_empty
      c3  salary is_null
      c4  department_assignment is_null
  /where/children/1                 and   the inactive branch                depth 2
    c5  status eq inactive
    c6  termination_date is_null
```

The tree is 3 deep of 4, holds 6 conditions of 30 and 2 literal values of 500. It has no related node, so all six
conditions can be matched, and `conditions` lists `c1` to `c6`. `c1` is matched for an active record that lacks at
least one of email, salary and department; `c2`, `c3` and `c4` each for an active record that lacks that one (for
`c2`, an email that is NULL, empty or spaces only); `c5` and `c6` together, for an inactive record with no
termination date.

Record 1086 in `sql/60_seed_hr.sql` is active, works in department 302, and has no email, no salary and no
termination date. For it `c1` is true, `c2` is true (`is_empty` covers NULL), `c3` is true and `c4` is false; the
inner `or` group is true, so the active branch is true, so the root group is true and 1086 is a violation. `c1`,
`c2` and `c3` are true with every group above them true: they are matched. `c5` is false. `c6` is true, since there
is no termination date, but it sits in the inactive branch, which is false, so it is not matched. Hence
`matched` `["c1", "c2", "c3"]` and three reasons. Record 1088 is the opposite case: inactive with an empty email,
so `c2` is true under a branch that is false, and its `matched` is `["c5", "c6"]`.

## How a definition becomes a query

The engine compiles a validated definition into two statements and runs them; nothing a caller typed reaches the SQL
text.

- **Validated first.** `validate_definition` (`engine/app/validator/__init__.py`) returns a definition whose keys are
  all resolved against the glossary and whose literals are all typed. `compile_definition`
  (`engine/app/compiler/build.py`) trusts it and checks nothing again.
- **Identifiers only from the glossary.** Each entity is one SQLAlchemy `Table` built from the glossary alone,
  holding only the columns the glossary names (`engine/app/glossary/tables.py`). Every alias and label is generated
  by the compiler (`e0`, `e1`, `k`, `d0`, `a0`, `t0`, `m0`); a node id never becomes SQL text.
- **Values only as bound parameters.** Every literal of the definition is a bound parameter, text bound as `Unicode`
  (NVARCHAR), a list as one expanding parameter. The only numbers written into the text are the engine's own: the 1
  and 0 of the flags and the row cap of `TOP (cap)`, rendered by SQLAlchemy.
- **Many-to-one paths become joins.** A field path becomes a `LEFT OUTER JOIN` per hop, with one alias per distinct
  path prefix, so two conditions on one path share the join. A record with no parent stays, and the parent's fields
  read NULL. Computed fields become ranges on their source column (`engine/app/compiler/computed.py`).
- **Related nodes become `EXISTS` or `NOT EXISTS`**, a sub-query over the related table correlated on the join
  columns, so root rows never multiply. Its `where` has a scope and joins of its own.
- **One flag column per node that can be matched.** The inner select carries the real `WHERE` (the root group) and,
  per node, `CASE WHEN` its predicate `THEN 1 ELSE 0 END` as a `t` column (`t0` for the first). The outer statements
  derive an `m` column per node from those flags: the node's flag and every group above it (Semantics, above).
- **A count and a capped, ordered page**, each a single SELECT over an inner select with the same `FROM`, joins,
  `WHERE` and flags (`CompiledPlan` in `engine/app/compiler/plan.py`); the count's inner select leaves out the
  columns of the record's values, which only the page shows. The count returns `COUNT(*)` and, per node, the `SUM` of its `m` column. The page
  returns `TOP (cap)` rows ordered by the root key: the key, the identifying fields, the values the reasons need and
  the `m` columns.
- **Run read-only and bounded.** `run_compiled` (`engine/app/executor/database.py`) runs the count, then the page, on
  one connection as `dq_engine_ro`, each under the statement timeout (30 s by default). `ensure_single_select` refuses
  anything that is not a SELECT or whose text holds a `;`. The explainer (`engine/app/explainer/`) then renders the
  rule sentence and one reason per matched node from the glossary.
