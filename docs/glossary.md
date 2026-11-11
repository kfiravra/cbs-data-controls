# Business glossary

The glossary is [`contracts/glossary.json`](../contracts/glossary.json): the organization's data described in
business terms. Every entity, field, relationship and operator a control may name is a key of it, and every word of
a rule sentence, a reason and a suggestion is a text of it. Controls are written against its keys
([control-definition.md](control-definition.md)), and its physical names point into the schema `hr` built by
[`sql/`](../sql/README.md). Where this page and `contracts/` differ, `contracts/` wins. See also
[examples.md](examples.md), [summarize-architecture.md](summarize-architecture.md) and
[assumptions-limitations-extensions.md](assumptions-limitations-extensions.md).

## Who reads it

| Reader | Reads | For |
|---|---|---|
| engine | the whole file, once at startup (`load_glossary` in `engine/app/glossary/loader.py`) | validation, compilation, rendering and suggestions; it checks the file against the database before it serves |
| engine, `GET /glossary` | the public form (`public_view` in `engine/app/glossary/public.py`) | the only copy that leaves the engine |
| api | the public form, cached (`api/src/DataControls.Api/Glossary/GlossaryCache.cs`) and served unchanged at `GET /api/v1/glossary`; it reads `glossaryVersion`, `languages`, `defaultLanguage` and, per entity, `identifyingFields`, the plural `label` and the field types (`api/src/DataControls.Api/Engine/EngineGlossary.cs`) | the request language, the `display_text` of stored violations, sorting controls by root entity and results by an identifying field |
| client | the public form from the api, once per page load (`web/src/app/core/glossary/glossary.service.ts`) | every picker: root entities, field groups, operators and their labels, enum and bool values, related relationships; and the five limits |
| `scripts/contracts-check.py` | the file, without a database | integrity, agreement with the schema, the examples and the invalid fixtures |
| `scripts/db-check.sh`, section `glossary` | the physical names | every table and column exists for `dq_engine_ro`, with a type that fits |

The api keeps its copy fresh for `Glossary__CacheMinutes` (10 by default), serves it stale while the engine does not
answer, and drops it when a run answer reports another `glossaryVersion`.

## The file, key by key

### Top level

| Key | Holds |
|---|---|
| `glossaryVersion` | a version such as `1.0.0`; reported by `GET /health` and every run answer, and part of the compile-cache key |
| `languages` | the distinct two-letter codes the texts are written in; v1 lists `he` alone |
| `defaultLanguage` | one of `languages`: the language of an answer whose `Accept-Language` names no listed one |
| `limits` | the five limits of a definition |
| `formats` | per language, how dates and numbers are written |
| `phrases` | the words that join clauses |
| `operators` | the eighteen operators and their texts |
| `entities` | the records a control can check, with their fields |
| `relationships` | how the entities connect |
| `suggestions` | the texts of the suggestion kinds and of their evidence |

`scripts/contracts-check.py` requires exactly these members. A **text** is an object with one non-empty string per
language of `languages` and nothing else: `{ "he": … }`. The check refuses a missing language, an unknown one, a
placeholder the text may not use, different placeholders in two languages, a stray brace, a leading or trailing
space (except in `and`, `or`, `listSeparator` and `reasonSeparator`, which carry their own spaces), and a Hebrew text
that has Latin letters and no Hebrew letter.

### `limits`

| Key | 1.0.0 | Counts |
|---|---|---|
| `maxDepth` | 4 | groups on the longest chain, the root and every related `where` counting one |
| `maxConditions` | 30 | conditions and related nodes in the whole tree |
| `maxListValues` | 100 | items of one `values` list |
| `maxPathHops` | 2 | relationships in one field `path` |
| `maxTotalValues` | 500 | literal values in the whole definition |

Each is a positive integer. The schema repeats three of them (`maxListValues`, `maxPathHops`, and `maxConditions` as
the most `children` of one group), and the check asserts that they agree. The engine refuses to start with a
`maxTotalValues` above 500. Who enforces which limit is in [control-definition.md](control-definition.md).

### `formats`

Per language: `date`, a pattern holding `dd`, `MM` and `yyyy` once each with separators (`dd.MM.yyyy` for `he`), and
`groupSeparator` and `decimalSeparator`, one character each and different (`,` and `.` for `he`). A number of a
field marked `identifier` is written with no separator.

### `phrases`

| Key | Placeholders | Use |
|---|---|---|
| `and`, `or` | none | join the children of a group |
| `groupOpen`, `groupClose` | none | bracket a child group |
| `listSeparator` | none | between the items of `{values}` |
| `reasonSeparator` | none | between the reasons of a violation's `reasonText` |
| `fieldOnPath` | `{field}`, `{relationship}` | a field reached through a path, with the label of the path's last relationship |
| `relatedAny`, `relatedNone` | `sentence`: `{relationship}` and `{conditions}`; `reason`: `{relationship}`, and `{conditions}` if wanted | a related node with `any` or `none` |

### `operators`

Each operator has `key`, `arity` (0, 1, 2 or `"list"`), `types` (the field types it applies to), `fieldComparable`
(whether the right side may be a field; only for arity 1), and three texts:

- `label`: the operator in the picker, with no placeholder;
- `sentence`: its clause in the rule sentence;
- `reason`: why a record is a violation, with the record's value.

Each of the three is an object of **variants**, every variant a text. `default` is required; a variant named after
one of the operator's `types` is allowed; when `fieldComparable` is true, so are `field` and `<type>.field`. The
renderer uses the first variant present in the order `<type>.field`, `field`, `<type>`, `default`, where `<type>` is
the left field's type and the two `field` variants apply only when the condition has a `right`. That is how `lt` says
"before" for a date and "below" for a number. The client uses the same order for picker labels only.

| Text | Arity 0 | Arity 1 | Arity 1, `field` variants | Arity 2 | List |
|---|---|---|---|---|---|
| `sentence` | `{field}` | `{field}`, `{value}` | `{field}`, `{other}` | `{field}`, `{value}`, `{value2}` | `{field}`, `{values}` |
| `reason` | `{field}`, `{actual}` | `{field}`, `{value}`, `{actual}` | `{field}`, `{other}`, `{actual}`, `{otherActual}` | `{field}`, `{value}`, `{value2}`, `{actual}` | `{field}`, `{values}`, `{actual}` |

A `sentence` must use all of its placeholders; a `reason` must use `{field}` and may use the rest. The eighteen keys
are fixed in code: the loader refuses a key outside `OPERATOR_KEYS`, the compiler holds one expression per key in
`OPERATORS`, and the check requires the schema's `operator` enum to equal the glossary's keys.

### `entities`

| Member | Value |
|---|---|
| `key` | matches the schema's key pattern `^[a-z][a-z0-9_.]{0,63}$` |
| `label` | `singular` and `plural` texts; the plural names the entity in suggestion texts and in the api's sort |
| `description` | a text |
| `table` | `schema` and `name` of the physical table |
| `keyColumn` | the column that identifies a record; a violation's `key` is its value as a string, and violations are ordered by it |
| `rootable` | whether a control may check this entity (`ENTITY_NOT_ROOTABLE`) |
| `visible` | false hides the entity, and every relationship that touches it, from the public glossary and from validation (`UNKNOWN_ENTITY`) |
| `identifyingFields` | distinct visible field keys, name first: the `display` of every violation, in this order |
| `lifecycle` | optional: `field`, a visible stored `bool` or `enum` field, and `active`, its value that means active; read by the suggestions and needed by `required` |
| `fields` | at least one field, keys unique within the entity |

### Fields

| Member | Required | Value |
|---|---|---|
| `key` | yes | the key pattern |
| `label` | yes | a text |
| `description` | no | a text |
| `type` | yes | `number`, `text`, `date`, `bool` or `enum` |
| `column` | one of the two | the physical column |
| `computed` | one of the two | `{ function, over }`: a function of the closed list (`age_years`) over the column of a stored field of this entity, of the type the function reads |
| `nullable` | yes | false removes `is_null` and `is_not_null` from the field's operators; not compared with the database |
| `visible` | yes | false hides the field: left out of the public glossary, `UNKNOWN_FIELD` for a caller; still checked against the database |
| `unit` | no | a text, on `number` only, written after every value with one space |
| `enumValues` | on `enum`, and only there | `{ value, label }` items with distinct values |
| `valueLabels` | on `bool`, and only there | the texts `true` and `false` |
| `operators` | no | the field's own operator list in place of its type's; each must apply to the type |
| `required` | no | `always`, `active` or `inactive` (the last two need a `lifecycle`): when the field must hold a value; read by the `missing_required` suggestion, never by validation |
| `comparable` | no | absent means true; false keeps the field out of field comparisons, and a computed field must say false |
| `identifier` | no | true on a `number` without a `unit` that names a record: written digit for digit |

Glossary 1.0.0 uses every member. On `employee`: `employee_number` is an `identifier` on the column `id`; `age` is
`computed`; `salary` has a `unit` and is `required` while active; `status` has `enumValues`; `department_assignment`
has its own `operators`, `comparable: false` and `identifier`. `is_active` of `department` and `ministry` has
`valueLabels`.

### `relationships`

| Member | Value |
|---|---|
| `key` | the key pattern; by convention the `from` key, a dot and a name, as in `employee.department` |
| `from`, `to` | entity keys |
| `cardinality` | `many_to_one`, `one_to_one` or `one_to_many`, read from `from` |
| `join` | `fromColumn`, a column of the `from` table, and `toColumn`, a column of the `to` table; the two must be equal |
| `label` | a text: the relationship as the user reads it; a field on a path is labelled with its last relationship |

A `many_to_one` or `one_to_one` relationship can be a hop of a field `path`; a `one_to_many` one serves only a related
node. Each direction is its own relationship: glossary 1.0.0 has `employee.department` and `department.employees`
over the same column. Nothing compares a cardinality with the data: a `many_to_one` whose `toColumn` is not unique
would repeat root rows through its join. A relationship with a hidden end cannot be used and is not public.

### `suggestions`

`kinds` holds exactly the five kinds the engine's generators produce (`engine/app/suggestions/generators.py`), each
with `name`, `description` and `rationale`:

| Kind | Placeholders |
|---|---|
| `missing_required` | `{entity}` |
| `date_order` | `{entity}`, `{earlier}`, `{later}` |
| `active_under_inactive` | `{entity}`, `{relationship}` |
| `active_without_active_children` | `{entity}`, `{relationship}` |
| `missing_optional` | `{entity}`, `{field}` |

`evidence` holds `violations_found` (`{count}`, `{total}`), `field_missing` (`{field}`, `{count}`) and
`date_order_split` (`{count}`, `{total}`). The engine refuses to start when one is missing (`missing_texts`). The
texts carry meaning only, never a threshold. The generators read properties of the glossary (`lifecycle`,
`required`, cardinality, types) and name no entity, field or relationship.

## The public glossary

`GET /glossary` of the engine, served unchanged by `GET /api/v1/glossary` ([`contracts/api.md`](../contracts/api.md)
§3), is the file with the physical names and the hidden parts taken out:

| Left out | From |
|---|---|
| `table`, `keyColumn` | every entity |
| `column`, `computed` | every field |
| `join` | every relationship |
| entities whose `visible` is false | `entities` |
| fields whose `visible` is false | each entity's `fields` |
| relationships that start or end at a hidden entity | `relationships` |

Every field instead carries `operators`, always: its resolved list, in glossary order. `glossaryVersion`,
`languages`, `defaultLanguage`, `limits`, `formats`, `phrases`, `operators` and `suggestions` are as in the file. No
table, column or join name leaves the engine, and a client tells a computed field only by its `operators` and
`comparable`.

## Startup validation

1. **Read.** `load_glossary` refuses a file the engine cannot use (`GlossaryInvalid`): a missing member, an unknown
   operator key or arity, an unknown field type, a computed function outside `COMPUTED_FUNCTIONS`, a field with both
   or neither of `column` and `computed`, a `required` outside its three words, an unknown or hidden identifying or
   lifecycle field, a relationship to an unknown entity, or one column read as two SQL types.
2. **Serve.** `unsupported` (`engine/app/compiler/support.py`) and `missing_texts` refuse what the code cannot serve:
   an operator without an expression, a `maxTotalValues` above 500, a computed field with an operator its function has
   no predicate for or without `comparable: false`, a missing suggestion text. Both run before any connection.
3. **Fit.** `GlossaryGuard` (`engine/app/services.py`) reads `INFORMATION_SCHEMA.COLUMNS` for every schema the
   entities name, as `dq_engine_ro`, so it sees only what that login may read. `find_mismatches`
   (`engine/app/glossary/check.py`) then needs, for every entity, hidden ones included: its table; its key column;
   the column of every field (for a computed field, its `over` column); both join columns of every relationship. A
   column a field reads must have a type of the field type's family:

   | Field type | Database types |
   |---|---|
   | `number` | `tinyint`, `smallint`, `int`, `bigint`, `decimal`, `numeric` |
   | `text`, `enum` | `char`, `varchar`, `nchar`, `nvarchar` |
   | `date` | `date`, `datetime2` |
   | `bool` | `bit` |

   The `over` column of `age_years` must be a `date`. A key or join column that no field reads is checked for
   presence only. Nullability, keys and enum values are not compared, and a database column the glossary does not
   name is ignored.
4. **On a mismatch** the engine logs one error line per mismatch with `table` (`schema.name`) and `column` (null when
   the whole table is missing), then one critical line, and exits with a non-zero status. It waits for an absent
   database (`ENGINE_STARTUP_DB_WAIT_SECONDS`, 30 by default), but never for a mismatch. Under compose the engine has
   `restart: "no"` and stays stopped.
5. **While running**, `GET /health` repeats the check at most once a minute (`HEALTH_RECHECK_SECONDS`) and answers
   503 `GLOSSARY_MISMATCH` with `{ table, column }` of the first mismatch when the database no longer fits.

Without a database, `uv run scripts/contracts-check.py` checks the schema's keyword subset, the glossary's integrity
(every member, text, placeholder, reference and flag above), the agreement of the two (operator keys and arities,
three limits, the key pattern), the examples and the invalid fixtures; `--root DIR` checks another tree. It cannot
see the database: a physical name it accepts may still be missing, which the startup check and the `glossary`
section of `scripts/db-check.sh` find.

## How to add

Every addition ends the same way: bump `glossaryVersion`, run `uv run scripts/contracts-check.py`, restart the
engine. Keys are added, never renamed: a saved control whose key has gone fails its next run with
`CONTROL_DEFINITION_OUTDATED`.

**A field.** Add the object to the entity's `fields`, with `key`, `label`, `type`, `column`, `nullable` and
`visible`, and the optional members it needs. On a column that does not exist yet, add the column in
`sql/20_hr_tables.sql` first; its `CREATE TABLE` runs only when the table is missing, so an existing database gets
the column through `scripts/db-init.sh --reset`. The startup check then confirms the column and its type. The editor
offers the field with its resolved operators, and the suggestions may use it: a `required` one in
`missing_required`, a nullable stored one without `required` in `missing_optional`, a stored date in `date_order`.

**An entity.** Create its table in schema `hr` (`sql/20_hr_tables.sql`, with seed rows in `sql/60_seed_hr.sql`).
Permissions are granted per schema (`sql/40_logins.sql`), so `dq_engine_ro` reads a new `hr` table with no change; a
table in another schema needs its grant there, or the engine's catalog read does not see it. Add the entity to
`entities` with every member of the table above, then a relationship to connect it. The engine refuses to start
while the glossary names a table or column the database lacks or types it wrongly (`GLOSSARY_MISMATCH`, `column`
null for a missing table), and once running, `GET /health` answers the same code when a database change takes away
what the glossary names.

**A relationship.** Add the object to `relationships`; both join columns must exist, and the startup check confirms
it. A `many_to_one` or `one_to_one` relationship adds field groups to the editor; a `one_to_many` one adds an entry to
the related-records picker. The walkthrough below is a complete case.

**A computed-field kind.** The one case that needs engine code: the kinds are a closed list. `age_years` is
implemented in `engine/app/compiler/computed.py`: the function `age_years` gives the value shown as `actual`;
`_AGE_PREDICATES` maps each operator to a predicate on the source column, bound to "the run date minus N years"
(`years_before`, the recipe `RunDateMinusYears` in `engine/app/compiler/plan.py`); and both are registered under
the key `age_years` of `COMPUTED`, as a `ComputedFunction` of `predicates` and `value`. A new kind adds:

1. its name to `COMPUTED_FUNCTIONS` in `engine/app/glossary/model.py`, or the loader refuses it;
2. the field type of the column it reads to `COMPUTED_SOURCE_TYPES` in `engine/app/glossary/tables.py`;
3. a `ComputedFunction` in `COMPUTED`: a predicate for every operator a field of the kind resolves to (`unsupported`
   refuses a gap at startup) and its value function. A predicate receives one binder, for "the run date minus N
   years"; a kind that needs another run-dependent parameter also needs its own recipe in
   `engine/app/compiler/plan.py` and its binder in `_condition` of `_Builder` (`engine/app/compiler/build.py`);
4. the function and its source type to `COMPUTED_FUNCTIONS` in `scripts/contracts-check.py`;
5. its rule beside Age in `contracts/errors.md`, which today names `age_years` as the one function.

The field itself then uses `computed`, with `function` and `over`, and `comparable: false`.

**A language.** v1 ships Hebrew alone. A second language needs:

1. in the glossary: its code in `languages`, its `formats` entry, and a value under every text (entity, field,
   relationship, enum and bool labels, descriptions, units, every operator variant, the phrases, the suggestion
   texts); the check fails on any text without it;
2. in the client: `web/src/assets/i18n/<lang>.json` with every key of `he.json`, a row in `LANGUAGES` in
   `web/src/app/core/i18n/language.ts` (direction and locale), and its locale data registered in
   `web/src/app/app.config.ts`. v1 has no language switch: the interface language is `DEFAULT_LANGUAGE`;
3. in the database, for a language other than `he` and `en`: the constraint `CK_Run_language` of `dq.Run`
   (`sql/30_dq_tables.sql`).

The engine and the api follow `languages` with no code change.

## Worked example: the relationship `department.manager`

`hr.Department` already holds its manager: `manager_employee_id INT NULL`, with the foreign key
`FK_Department_Employee` to `hr.Employee (id)` (`sql/20_hr_tables.sql`), and glossary 1.0.0 already reads the column
as the field `manager_assignment`. The seed names a manager for every department except 204. Adding the relationship
is a change to the glossary alone: no SQL, no engine, api or client code. On a scratch copy of the repository:

1. Append this object as the last item of `relationships` in `contracts/glossary.json`, after
   `ministry.departments`:

   ```json
   {
     "key": "department.manager",
     "from": "department",
     "to": "employee",
     "cardinality": "many_to_one",
     "join": { "fromColumn": "manager_employee_id", "toColumn": "id" },
     "label": { "he": "המנהל" }
   }
   ```

   Keep it last. The editor's entity chain (`chainFor` in `web/src/app/core/glossary/glossary.lookups.ts`) reads the
   first relationship that joins two neighbouring entities, and for employee and department that must stay
   `employee.department`; placed before it, the chain would show one employee holding many departments.
2. Set `glossaryVersion` to `1.1.0`. The new version reaches `GET /health` and every run answer, changes every
   compile-cache key, and makes the api drop its cached copy at the next run. Two places quote `1.0.0` and follow the
   bump: the assertion in `engine/tests/integration/test_examples_live.py` and the example answers in
   `contracts/api.md` §5.
3. Run `uv run scripts/contracts-check.py` (on a copy, `--root` with the copy's directory). It ends with
   `contracts-check: ok, 5 checks passed (schema, glossary, agreement, examples, invalid fixtures)`. For the new item
   it checks the members, both entities, the cardinality, the two join names as plain identifiers, the label and the
   key; no example uses the relationship.
4. Restart the engine:

   ```sh
   # from source, in engine/ (ENGINE_CONTRACTS_DIR points the engine at a copy's contracts/)
   .venv/bin/python -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000
   curl -s localhost:8000/health          # in another shell: the glossaryVersion is now 1.1.0

   # under compose, whose engine image copies contracts/ at build time (engine/Dockerfile)
   docker compose up -d --build engine
   ```

   The startup check now also needs `manager_employee_id` of `hr.Department` and `id` of `hr.Employee`, and both
   exist.
5. Validate a definition rooted at `department` that uses the path, through the api:

   ```sh
   curl -s -X POST localhost:5000/api/v1/controls/validate \
     -H 'content-type: application/json' -H 'accept-language: he' \
     -d '{"definition": {"schemaVersion": 1, "rootEntity": "department", "where": {"type": "group", "op": "and",
          "children": [{"type": "condition", "id": "c1", "left": {"path": ["department.manager"], "field": "status"},
          "operator": "eq", "value": "inactive"}]}}}'
   ```

   The api checks the schema and asks the engine's `/validate`, whatever glossary copy it holds. The answer is 200,
   with `valid` true, one entry for `c1` in `conditions`, and the field named through `fieldOnPath`:

   ```json
   {
     "sentence": "סטטוס של המנהל: לא פעיל",
     "sentenceParts": [
       { "text": "סטטוס של המנהל", "nodeId": "c1", "role": "field" },
       { "text": ": ", "nodeId": "c1" },
       { "text": "לא פעיל", "nodeId": "c1", "role": "value" }
     ]
   }
   ```

   Before step 4 the same call answers 422 `DEFINITION_INVALID` with `UNKNOWN_RELATIONSHIP` at
   `/where/children/0/left`, `nodeId` `c1` and the relationship's key in `params`. Saved and run on the seed, the
   control flags departments 104, 203 and 403, whose managers (1101, 1074, 1105) are inactive; department 204 has no
   manager, so the manager's status is NULL and `eq` does not match it. Departments without a manager are found with
   `manager_assignment` and `is_null`.
6. Restart the api, or wait out `Glossary__CacheMinutes`, and reload the page: the client reads the glossary once per
   page load. The editor then offers:
   - in a control rooted at `department`: a field group for the manager, labelled with the relationship's label and
     holding the employee's visible fields, and a two-hop group for the manager's department (`department.manager`,
     then `employee.department`), labelled through the translation key `editor.field.pathOf`;
   - in a control rooted at `employee`: a two-hop group for the manager of the employee's department
     (`employee.department`, then `department.manager`), whose fields the comparison toggle also offers for a field
     of the same type, such as the employee's `hire_date` against that manager's;
   - no change in the related-records picker, which lists `one_to_many` relationships only.
7. `POST /api/v1/suggestions` can hold one more item. The `active_under_inactive` generator walks every
   `many_to_one` path of up to two hops from each root (`_parent_paths`), so it now also tries active departments
   with an inactive manager, active employees whose department's manager is inactive, and active departments whose
   manager's department is inactive. A candidate that flags no record today is dropped; on the seed only the first
   flags records (departments 104 and 403).

Nothing else must change, as the code shows:

- The validator resolves every hop by key (`usable_relationship`), so a second relationship between `department` and
  `employee` is simply another key; neither the validator nor the check compares the pairs of entities.
- The compiler gives every distinct path prefix its own alias (`_alias_for` of `_Scope` in
  `engine/app/compiler/build.py`), so the cycle `employee`, `department`, `employee` joins `hr.Employee` twice under
  two aliases. A path is a list of at most `maxPathHops` keys and the client's `fieldGroups` stops at that many hops,
  so a cycle cannot loop.
- The public glossary serves the relationship without its `join`; the api reads no relationship at all.

## What does not change

| Change | Glossary | `sql/` | Engine code | Api code | Client code |
|---|---|---|---|---|---|
| a field on an existing column | the field | no | no | no | no |
| a field on a new column | the field | the column | no | no | no |
| an entity | the entity and its relationships | the table | no | no | no |
| a relationship | the relationship | only a missing join column | no | no | no |
| a computed-field kind | the field | no | the closed lists and `engine/app/compiler/computed.py` | no | no |
| a language | every text, `languages`, `formats` | `CK_Run_language`, unless `he` or `en` | no | no | `LANGUAGES`, locale data, the translation file |

- **The compiler** does not change for a field, an entity, a relationship or a language: it takes tables, columns
  and joins from the glossary's tables and names no entity, field or relationship. It changes only for a
  computed-field kind, which also brings its entry in `scripts/contracts-check.py` and its rule in
  `contracts/errors.md`.
- **The api** does not change in any case: it passes the glossary through, reads only the version, the languages,
  the plural labels, the identifying fields and the field types, and never reads a relationship.
- **The client code** changes only for a language: every picker is drawn from the public glossary, and no key of
  the sample model is named in it.
