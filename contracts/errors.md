# Error catalogue

The closed list of everything the two HTTP APIs and a stored run say by key: error codes, definition error codes,
reason keys, evidence keys, request error codes and text part roles, each with its parameters. The shapes that carry
them (`Problem`, `DefinitionError`, `RequestError`, `Reason`, `Evidence`, `TextPart`) are defined in
[api.md](api.md). Where `docs/architecture.md` says otherwise, this file wins.

**Row format.** Every row of the six catalogue tables below starts with its code or key in backticks, one code or key
per row, so tests in any language read them with one regular expression per line:

```
^\| `([A-Za-z_]+)` \|
```

Each table sits under its own `##` heading; a consumer that needs one table takes the matching lines between that
heading and the next `##` heading. No code or key leads a row in two tables, and no other line of this file matches.

**Where the text lives.** A code (the Codes, Definition error codes and Request error codes tables) crosses a service
boundary as its key and params only; its text is the client's, in its translation files. The text of rule sentences,
reasons, suggestions and evidence lives only in `contracts/glossary.json` and is rendered only by the engine (Rules,
Rendering); the client draws the parts it receives and renders nothing.

## Codes

`code` of a `Problem`, or `error.code` of a failed run. "Run error" marks the codes a `Run.error` may carry. "From"
is the service that answers with the code: `engine`, `api`, `both`, or `client` (derived by the client, never sent).

| Code | Status | From | Run error | Params | Meaning |
|---|---|---|---|---|---|
| `REQUEST_INVALID` | 400 (413 for a body over the size limit, 415 for a body that is not JSON) | both | no | none; the problem's `errors` lists the faults (Request error codes) | The request is malformed: a member missing or of the wrong form, a value out of range, a bad query parameter |
| `DEFINITION_INVALID` | 422 | both | no | none, or `index` on `POST /api/v1/suggestions/accept`; the problem's `errors` lists the definition errors | The definition fails the schema or the glossary |
| `CONTROL_NOT_FOUND` | 404 | api | no | `id` | No control has this id |
| `VERSION_NOT_FOUND` | 404 | api | no | `id`, `version` | The control exists and has no such version |
| `RUN_NOT_FOUND` | 404 | api | no | `id` | No run has this id |
| `NOT_FOUND` | 404 | both | no | none | No such path, a method the path does not serve, or an id segment that is not a positive integer |
| `DEBUG_DISABLED` | 404 | engine | no | none | `POST /debug/compile` is turned off by configuration |
| `CONTROL_ARCHIVED` | 409 | api | no | `id` | The control is archived: it can be read but not changed or run |
| `CONCURRENCY_CONFLICT` | 409 | api | no | `id` | The control was saved by someone else since the client read it (the `concurrencyToken` is stale) |
| `ENGINE_UNAVAILABLE` | 503 | api | yes | none | The engine did not answer: not reachable, the attempt timed out, or the circuit is open |
| `DATABASE_UNAVAILABLE` | 503 | both | yes | none | SQL Server did not answer (the engine's `hr` connection or the api's `dq` connection) |
| `GLOSSARY_MISMATCH` | 503 | engine | no | `table` (`schema.name`), `column` (null when the whole table is missing) | The glossary names a table or column the database lacks, or a column whose type does not fit the field; logged at startup, where the engine exits, and answered by `GET /health` |
| `QUERY_TIMEOUT` | 504 | both | yes | `timeoutSeconds` | A statement ran past the engine's statement timeout; the run's status is `timed_out` |
| `INTERNAL_ERROR` | 500 | both | yes | none | Anything else; the details are logged with the correlation id and never returned |
| `CONTROL_DEFINITION_OUTDATED` | none (run error only) | api | yes | `errors`: the engine's definition errors | The saved definition no longer validates (a glossary key it uses has gone or changed) |
| `NETWORK_ERROR` | none | client | no | none | The api did not answer, or answered with something that is not a `Problem` (no connection, a gateway error); the client derives it and no service sends it |
| `ROW_CAP_EXCEEDED` | none (informational) | client | no | `total`, `stored` | The run found more violations than it stored; the client shows it when `Run.capExceeded` is true, from `totalCount` and `storedCount` |

## Definition error codes

A definition error is `{ code, path, nodeId?, params }` (api.md, `DefinitionError`). `path` is a JSON Pointer into
the definition itself (not into the request body); `""` is the definition. In the Path column `<node>` stands for the
pointer of the node that holds the member (for example `/where/children/0`).

`nodeId` is the `id` of the nearest node at or above `path` that has a string `id` (a condition or a related node);
it is absent when there is none (`/rootEntity`, `/where`, a group outside every related node) and on
`DUPLICATE_NODE_ID`, whose id names two nodes.

A schema-layer error follows the instance location of the failing keyword (Rules, Schema violations). A semantic
error names the member that the editor edits as one input: `/rootEntity`, a field reference (`<node>/left` or
`<node>/right`, which covers its `path` and its `field`), `<node>/operator`, `<node>/value`, `<node>/values` (an item
of the list is named by `params.index`, from 0), `<node>/relationship`, `<node>/id`, the condition node itself, or
`/where` for a fault of the whole tree.

| Code | Layer | Params | Path | Meaning |
|---|---|---|---|---|
| `SCHEMA_VIOLATION` | schema | none | the instance location of the failing keyword: the object for a missing or an extra member, the member for a wrong value, type or length | The definition does not match `contracts/control-definition.schema.json` |
| `UNSUPPORTED_SCHEMA_VERSION` | before the schema | none | `/schemaVersion` | The definition is an object whose `schemaVersion` is present and is not the number 1; decided before the schema runs, and nothing else is reported |
| `UNKNOWN_ENTITY` | semantic | `entity` | `/rootEntity` | No visible entity has this key |
| `ENTITY_NOT_ROOTABLE` | semantic | `entity` | `/rootEntity` | The entity exists and may not be a root entity |
| `UNKNOWN_RELATIONSHIP` | semantic | `relationship` | the field reference whose `path` holds it, or `<node>/relationship` of a related node | No relationship has this key |
| `PATH_NOT_REACHABLE` | semantic | `relationship`, `entity` | the field reference, or `<node>/relationship` of a related node | The relationship does not start at `entity`: the entity reached so far on the path, or the scope entity of the related node |
| `PATH_NOT_TRAVERSABLE` | semantic | `relationship` | the field reference | A one-to-many relationship in a field path; only many-to-one and one-to-one relationships can be traversed (a one-to-many one belongs in a related node) |
| `PATH_TOO_LONG` | semantic | `max`, `actual` | the field reference | The path has more hops than `limits.maxPathHops` |
| `UNKNOWN_FIELD` | semantic | `entity`, `field` | the field reference | The entity the path reaches has no visible field with this key (a hidden field is unknown) |
| `RELATIONSHIP_NOT_QUANTIFIABLE` | semantic | `relationship`, `cardinality` | `<node>/relationship` | A related node names a relationship that is not one-to-many |
| `OPERATOR_NOT_ALLOWED` | semantic | `operator`, `field`, `type` | `<node>/operator` | The operator is not among the field's resolved operators (by its type, or by the field's override) |
| `OPERAND_MISMATCH` | semantic | `operator`, `arity` (`0`, `1`, `2` or `list`) | the condition node | The operand does not fit the operator's arity in the glossary. The schema already enforces the operand shape per operator, so this code guards a schema and a glossary that disagree |
| `VALUE_TYPE_MISMATCH` | semantic | `field`, `type`, `index` (in a list only) | `<node>/value`, or `<node>/values` with `index` | A literal is not of the field's type: a JSON number (never a boolean) whose absolute value is below 10^15 for `number`, a string for `text` and `enum`, a string holding a real `YYYY-MM-DD` date for `date`, a boolean for `bool` |
| `UNKNOWN_ENUM_VALUE` | semantic | `field`, `value`, `index` (in a list only) | `<node>/value`, or `<node>/values` with `index` | The string is not one of the field's `enumValues` |
| `FIELD_COMPARISON_NOT_ALLOWED` | semantic | `operator`, or `field` | `<node>/right` with `operator`; the field reference of that field with `field` | A field-to-field comparison the glossary does not allow (Rules, Field comparisons) |
| `FIELD_TYPE_MISMATCH` | semantic | `leftType`, `rightType` | `<node>/right` | The two fields of a comparison have different types |
| `RANGE_INVALID` | semantic | `low`, `high` | `<node>/values` | `between` or `not_between` whose first value is above the second (later, for dates); equal values are allowed |
| `TOO_DEEP` | semantic | `max`, `actual` | `/where` | The tree is deeper than `limits.maxDepth` (Rules, Depth and condition count) |
| `TOO_MANY_CONDITIONS` | semantic | `max`, `actual` | `/where` | The tree holds more nodes than `limits.maxConditions` (Rules, Depth and condition count) |
| `TOO_MANY_VALUES` | semantic | `limit` (`list` or `total`), `max`, `actual` | `<node>/values` for `list`; `/where` for `total` | Too many literal values (Rules, Values) |
| `DUPLICATE_NODE_ID` | semantic | `id` | `<node>/id` of every node after the first that carries the id, in document order | Two nodes share an id; ids are unique across the whole tree, related sub-trees included |

## Reason keys

A reason's `reasonKey` (api.md, `Reason`), one per operator key plus the two keys of a related node. The params of a
condition reason are keys and raw values, never labels or formatted text:

- `left`: the left field reference as the definition has it (`{ "path"?: [...], "field": ... }`).
- `actual`: the record's value of the left field as a JSON scalar: a number, a string, a boolean, an enum value, a
  date as `YYYY-MM-DD`, or null; for a computed field, the computed value (Rules, Age).
- `value`: the operand as the definition has it; `values`: the operand list as the definition has it.
- `right`: the right field reference as the definition has it; `rightActual`: the record's value of the right field,
  as for `actual`.

Every condition reason carries `actual`, and every field comparison `rightActual`, also when the template shows
neither.

The text is the operator's `reason` template (Rules, Rendering), or `phrases.relatedAny.reason` and
`phrases.relatedNone.reason` for the two related keys.

| Key | Params | Matched when |
|---|---|---|
| `eq` | `left`, `actual`, and `value`, or `right` and `rightActual` | the left value equals the operand |
| `ne` | `left`, `actual`, and `value`, or `right` and `rightActual` | the left value differs from the operand |
| `lt` | `left`, `actual`, and `value`, or `right` and `rightActual` | the left value is less (earlier) than the operand |
| `lte` | `left`, `actual`, and `value`, or `right` and `rightActual` | less (earlier) or equal |
| `gt` | `left`, `actual`, and `value`, or `right` and `rightActual` | greater (later) |
| `gte` | `left`, `actual`, and `value`, or `right` and `rightActual` | greater (later) or equal |
| `between` | `left`, `actual`, `values` (low, high) | low ≤ left value ≤ high, both ends included |
| `not_between` | `left`, `actual`, `values` (low, high) | the left value is below low or above high |
| `in` | `left`, `actual`, `values` | the left value is one of the values |
| `not_in` | `left`, `actual`, `values` | the left value is none of the values |
| `contains` | `left`, `actual`, `value` | the text contains the operand (no wildcards: `%`, `_` and `[` are literal) |
| `not_contains` | `left`, `actual`, `value` | the text does not contain the operand |
| `starts_with` | `left`, `actual`, `value` | the text starts with the operand |
| `ends_with` | `left`, `actual`, `value` | the text ends with the operand |
| `is_null` | `left`, `actual` (null) | the value is NULL |
| `is_not_null` | `left`, `actual` | the value is not NULL |
| `is_empty` | `left`, `actual` (null, empty or spaces only) | the text is NULL, empty or spaces only |
| `is_not_empty` | `left`, `actual` | the text holds a character other than a space |
| `related_any` | `relationship` (its key) | at least one related record satisfies the related node's `where` |
| `related_none` | `relationship` (its key) | no related record satisfies the related node's `where`, also when there are none |

## Evidence keys

An `Evidence` item's `key` in a suggestion (api.md, `SuggestionItem`). The text is `suggestions.evidence.<key>` in
the glossary. `field` is a field key of the suggestion's root entity; its label is in the text.

| Key | Params | Says |
|---|---|---|
| `violations_found` | `count`, `total` | the control flags `count` records now, out of `total` records of the root entity; every suggestion carries it |
| `field_missing` | `field`, `count` | the required field is missing in `count` records in the state that requires it; one per field of a `missing_required` suggestion |
| `date_order_split` | `count`, `total` | of the `total` records that hold both dates, `count` have them in the wrong order; on a `date_order` suggestion |

## Request error codes

An item of the `errors` of `REQUEST_INVALID`: `{ path, code, params }` (api.md, `RequestError`). `path` is a JSON
Pointer into the request body (`/name`, `/items/2/name`), or the name of a query parameter (`pageSize`).

| Code | Params | When |
|---|---|---|
| `REQUIRED` | none | A required member or parameter is absent or null, or a required string is empty after trimming |
| `TOO_LONG` | `max` | A string has more than `max` characters after trimming |
| `OUT_OF_RANGE` | `min`, `max` (each only where it applies) | A number, or the number of items of a list, is outside its range |
| `MALFORMED` | none | A value of the wrong JSON type or form: not an integer, not a real `YYYY-MM-DD` date, not one of the accepted words, not a valid `concurrencyToken`, not a JSON object where a definition belongs; on the engine also a member it does not know |

## Text part roles

A `TextPart`'s `role` (api.md, `TextPart`): the placeholder the part came from. Template text has no role.

| Role | Part |
|---|---|
| `field` | `{field}`: the left field's label, through `phrases.fieldOnPath` when it is on a path |
| `value` | `{value}`, `{value2}`, and each item of `{values}` |
| `actual` | `{actual}`: the record's value of the left field |
| `other` | `{other}`: the right field's label, through `phrases.fieldOnPath` when it is on a path |
| `otherActual` | `{otherActual}`: the record's value of the right field |
| `relationship` | `{relationship}` in `phrases.relatedAny` and `phrases.relatedNone`: the relationship's label |

## Rules

Each rule is stated here once; `api.md` and the glossary refer to it.

### Matched

A node (a condition or a related node) is matched for a record when it is true for that record and every group above
it, up to the root group, is true. A true condition inside a group that is false is not matched. Only nodes outside
every related sub-tree can be matched: the conditions and related nodes inside a related node's `where` are evaluated
per related record and are never matched; the related node itself is. A violation is a record for which the root
group is true, so it always has at least one matched node.

A violation's `matched` lists its matched nodes in document order and `reasons` holds one reason per matched node in
the same order. `conditions[]` of `/validate`, `/run` and a `Run` lists exactly the nodes that can be matched, in
document order, and `conditions[].count` is the number of violations in which the node is matched, over all
violations, also when only the capped rows are returned or stored.

Example: in `OR( AND( c1, c2 ), c3 )` a record with c1 and c3 true and c2 false is a violation with `matched` `[c3]`.

### NULL

Comparisons follow SQL: a comparison with NULL never matches, the negative operators included. `eq`, `ne`, `lt`,
`lte`, `gt`, `gte`, `between`, `not_between`, `in`, `not_in`, `contains`, `not_contains`, `starts_with` and
`ends_with` are false when the left value, or the right field's value, is NULL. Missing data is found only with
`is_null`, `is_not_null`, `is_empty` (NULL, the empty string, or spaces only) and `is_not_empty`. A field reached
through a path is NULL when a relationship on the path finds no record (the department name of an employee with no
department is NULL). Text comparisons follow the database collation (`Hebrew_CI_AS`: case-insensitive).

### Age

A computed field has `computed { function, over }` in the glossary in place of a column, and the engine implements
its function. The one function is `age_years`, a number: the whole years from the date in the column `over` to the
run date, `run.year - date.year`, minus one when the run date's (month, day) is before that date's. Over a birth
date of 2008-11-01 it is 18 on 2026-11-01 and 17 on 2026-10-31. The rule belongs to the function, not to a field
key: the glossary's `age` of `employee` is one use of it. A computed field is never comparable (Field
comparisons), and its `actual` in a reason is the computed value.

### Depth and condition count

- Depth is the number of `group` nodes on the longest chain from the root group down. The root group counts 1, and so
  does the `where` group of a related node. It may not exceed `limits.maxDepth` (4): `TOO_DEEP`.
- The condition count is every `condition` node plus every `related` node, anywhere in the tree, related sub-trees
  included. It may not exceed `limits.maxConditions` (30): `TOO_MANY_CONDITIONS`.

### Values

`TOO_MANY_VALUES` covers two limits. `limit: "list"`: the `values` of one condition hold more than
`limits.maxListValues` (100) items; the path is that `values` array. `limit: "total"`: the definition holds more than
`limits.maxTotalValues` (500) literal values, where a `value` counts one, each item of a `values` list counts one, a
`right` field reference counts nothing, and related sub-trees are included; the path is `/where`. The schema
repeats the list limit, so an over-long list is normally reported by the schema first.

### Field comparisons

A condition with `right` compares two fields. It is allowed only when the operator's `fieldComparable` is true and
neither field is marked `comparable: false` (an absent flag means true; the glossary marks every computed field
and every field that only says whether a link exists). When the operator is not `fieldComparable`, the error is
one `FIELD_COMPARISON_NOT_ALLOWED` with `{ operator }` at `<node>/right`, and the fields are not checked further.
Otherwise there is one `FIELD_COMPARISON_NOT_ALLOWED` with `{ field }` (a field key) per field that is not
comparable, at that field's reference. The two fields must have the same type: `FIELD_TYPE_MISMATCH`.

### Order of checks

1. `UNSUPPORTED_SCHEMA_VERSION`, before the schema runs, in both services. When it applies it is the only error. A
   definition without a `schemaVersion` goes to the schema. A `definition` that is not a JSON object never gets
   here: the request is malformed (400 `REQUEST_INVALID` with `MALFORMED`; api.md, Definitions).
2. The schema layer: every `SCHEMA_VIOLATION`. Any schema error ends validation; the semantic layer runs only on a
   schema-valid definition. The api answers this layer itself and does not call the engine for a definition that
   fails it.
3. The semantic layer (the engine only): everything it finds. A check that needs a key the validator could not
   resolve (an unknown root entity, relationship or field) is skipped; every other check runs.

Errors are listed in document order: the order in which their paths appear in the definition's JSON text, an object
before the members inside it. Errors that share a path are listed in the order of the Definition error codes table,
and several of one code by `params.index`.

### Schema violations

- `path` is the instance location of the failing keyword: the object for a missing member (`required`) and for an
  extra one (`additionalProperties: false`, or a member forbidden with `false` under `properties`); the member itself
  for a wrong value (`enum`, `const`, `pattern`), a wrong `type`, and an array of the wrong length (`minItems`,
  `maxItems`). `params` is empty.
- There is one error per distinct path, in document order (Order of checks).
- `nodeId` is the `id` of the nearest enclosing node that has one, the node at the path included.
- Two validators read the same schema: Python `jsonschema` in the engine and JsonSchema.Net 8.0.5 in the api. They
  report the same paths because the schema tells node types and operand shapes apart with `if`/`then` (never
  `oneOf`), forbids a member only with `additionalProperties: false` or `properties: { member: false }`, and uses no
  `not`, `anyOf` or `oneOf`. The api drops the failed `if` tests that JsonSchema.Net lists as errors and lifts a
  `false` subschema from the member to its object, which is where Python reports it.
- `contracts/examples/invalid/` holds schema-layer fixtures for both kinds of location, among them an extra member
  (`value-with-is-null.json`), so the lift is tested from both sides.

### Rendering

- **One source.** Every word of a rule sentence, a condition sentence, a reason, a suggestion's name, description and
  rationale, and an evidence text comes from the glossary in `he` and `en`: operator templates (`operators.*.label`,
  `sentence`, `reason`), `phrases`, entity, field, relationship, enum and bool labels, units, `formats` and
  `suggestions`. The engine renders it in the request's language and is the only renderer.
- **Variants.** `label`, `sentence` and `reason` of an operator are each an object of variants, every variant
  `{ he, en }`. The first variant present in this order is used: `<type>.field`, `field`, `<type>`, `default`, where
  `<type>` is the left field's type and the two `field` variants apply only when the condition has a `right`.
- **Placeholders** of operator templates: `{field}` the left field, `{value}` the operand of arity 1 or the first of
  arity 2, `{value2}` the second of arity 2, `{values}` the list, `{actual}` the record's left value (reasons only),
  `{other}` the right field, `{otherActual}` the record's right value (reasons only). `phrases.relatedAny` and
  `phrases.relatedNone` (each `{ sentence, reason }`) take `{relationship}` and `{conditions}`. Suggestion texts have
  their own placeholders (Suggestions, below).
- **Fields.** A field is its label. A field reached through a `path` is `phrases.fieldOnPath` with `{field}` the
  field's label and `{relationship}` the label of the last relationship on the path; the result is one part, with
  the role `field` or `other`. A relationship is its `label`.
- **Values.** A date follows the pattern `formats.<language>.date`, its tokens `dd`, `MM` and `yyyy` filled from the
  date's day, month and year; the current patterns are `dd.MM.yyyy` for `he` and `yyyy-MM-dd` for `en`. A number
  has `formats.<language>.groupSeparator` between groups of three integer digits and
  `formats.<language>.decimalSeparator` before the fraction (currently `,` and `.` in both languages), with the
  trailing zeros of the fraction removed and the separator with them (`15000` is `15,000`, `15000.50` is
  `15,000.5`). A number of a field marked `identifier: true` in the glossary names a record and is not a quantity:
  it is written digit for digit, with no separator (`1051`), which is also how `display_text` holds it. An enum value is the `label` of its `enumValues` entry, found without
  regard to case, as the database compares it; a stored value with no entry is shown as stored. A bool is
  `valueLabels.true` or `valueLabels.false`; text is shown as stored. A value of a field with a `unit` is followed by
  one space and the unit in the language, inside the same part (`15,000 ILS`). A NULL value renders as nothing.
- **Lists.** `{values}` renders each item as a part with the role `value`, with `phrases.listSeparator` between them
  as parts without a role.
- **Sentences.** A condition renders its operator's `sentence` variant. A related node renders
  `phrases.relatedAny.sentence` or `phrases.relatedNone.sentence`, with `{relationship}` its relationship's label and
  `{conditions}` its `where` group rendered as below. The renderer puts no bracket around it: the glossary's two
  related `sentence` phrases bracket `{conditions}` themselves, so a sibling that follows a related node cannot be
  read into it. A group renders its children joined by
  `phrases.and` or `phrases.or` (by its `op`); a child group is wrapped in `phrases.groupOpen` and
  `phrases.groupClose`. The rule sentence is the root group. A condition sentence in `conditions[]` is that node
  rendered alone.
- **Reasons.** A matched condition renders its operator's `reason` variant, a matched related node
  `phrases.relatedAny.reason` or `phrases.relatedNone.reason`. `reasonText` is the reasons' texts joined by
  `phrases.reasonSeparator`.
- **Suggestions.** A suggestion's `name`, `description` and `rationale` are the three texts of its kind in
  `suggestions.kinds`, and the text of an evidence item is `suggestions.evidence.<key>`; all four are plain strings
  without parts. `{entity}` is the plural label of the suggestion's root entity. `{relationship}` is the label of
  the relationship the rule goes through: the last of the path, or the related node's. `{earlier}`, `{later}` and
  `{field}` are field labels; in an evidence text `{field}` is the label of `params.field`, and `{count}` and
  `{total}` are numbers in the number format of Values. The kinds take: `missing_required` `{entity}`; `date_order`
  `{entity}`, `{earlier}`, `{later}`; `active_under_inactive` and `active_without_active_children` `{entity}`,
  `{relationship}`; `missing_optional` `{entity}`, `{field}`.
- **As written.** Templates and phrases are used exactly as the glossary writes them; the renderer adds no space or
  punctuation of its own.
- **Parts.** A template is split at its placeholders: template text gives parts with no role, a placeholder gives a
  part with the role of the Text part roles table, `{conditions}` gives the parts of the sub-tree as rendered (each
  with its own `nodeId` and roles), and an empty text gives no part. Every part of a node's clause carries that
  node's id as `nodeId`; joining words (`and`, `or`) and brackets carry none. In a reason every part carries the
  reason's `conditionId`, except the parts of `{conditions}`, which carry the ids of the nodes they come from.
  Joining the `text` of a list of parts gives the plain string exactly.
