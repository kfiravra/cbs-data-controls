# Data Controls: the architecture and the controls mechanism

The short document. The long reference is [architecture.md](architecture.md); the run instructions are in the
[README](../README.md).

## What the system does

A business user who knows the meaning of the data, and neither SQL nor the tables, builds a **control**: a named
rule that finds problem records, such as "employees under 18 who earn more than 15,000". The rule is built in a
Hebrew interface from business terms. The system turns it into one safe query, runs it over all the records of
the entity it checks, and shows the **violations**: the records that match, each with the reason it was flagged.
A new control is a new row of data. No code is written for it, and no query is stored for it.

## The components

```
 Browser: Angular client (Hebrew, right to left)
    |   builds the control as JSON from the business glossary; draws results and reasons
    |   JSON over HTTP, /api/v1
    v
 .NET 10 Web API: the application layer            login dq_app: reads and writes schema dq only
    |   controls and their versions, runs and their stored results, paging, search, errors
    |   JSON over HTTP, internal: a definition goes down, records and reasons come back
    v
 Python FastAPI: the control engine                login dq_engine_ro: SELECT on schema hr only
    |   glossary -> validate -> compile one parameterized SELECT -> run -> explain
    v
 SQL Server 2022, database DataControls
    |- schema hr   the organization's data (Ministry -> Department -> Employee), never written
    '- schema dq   the controls store (Control, ControlVersion, Run, RunResult), written by the api only

 contracts/  the definition's JSON Schema, the business glossary, six examples, both HTTP APIs, the error codes:
             the only thing the three services share. No service imports another's code.
```

| Component | Owns | Never does |
|---|---|---|
| Client | the list, the rule builder, the results; every picker is drawn from the glossary | holds a table or column name, sends SQL, renders a sentence or a reason itself |
| Api (.NET) | the life of a control (create, edit, versions, archive), runs and their snapshots, the checks of structure | builds or runs dynamic SQL, reads `hr`, executes SQL text it was given |
| Engine (Python) | the glossary, the checks of meaning, the compiler, the execution, the reasons, the suggestions | writes to any database, keeps state, accepts a table or column name from a caller |
| Database | `hr` and `dq`, and two logins that can each do one job | |

The assignment asks for a separation between the definition of a control and the implementation of the query.
Here that sentence is a service boundary. The api owns definitions and can write, and it cannot reach the
organization's data. The engine produces and runs the dynamic SQL, and its login can only read. A bug in the
compiler cannot change data, and a bug in the api cannot run a query on `hr`. No SQL text travels between
services in either direction.

## The controls mechanism

**1. The definition is data.** A control is a JSON document: the entity whose records are checked, and a tree of
groups (`and`, `or`), conditions and "related records" nodes. It names things only by glossary keys. This is the
first example of the assignment:

```json
{ "schemaVersion": 1, "rootEntity": "employee",
  "where": { "type": "group", "op": "and", "children": [
    { "type": "condition", "id": "c1", "left": { "field": "age" },    "operator": "lt", "value": 18 },
    { "type": "condition", "id": "c2", "left": { "field": "salary" }, "operator": "gt", "value": 15000 } ] } }
```

The api stores it as an immutable version in `dq.ControlVersion`. The JSON is the source of truth; SQL is
derived from it at run time and is never stored.

**2. The glossary gives the keys their meaning.** [`contracts/glossary.json`](../contracts/glossary.json) maps
each business term to the database: `employee` is the table `hr.Employee`, `salary` is a numeric column, `age`
is computed from `birth_date` on the run date, `employee.department` is a join. It also holds the Hebrew labels,
the operators allowed per type, and the templates of sentences and reasons. Table and column names appear in
this one file and nowhere in the code of any service. A new field, entity or relationship is an edit of this
file (and of the database when the column is new); the engine checks the file against the database when it
starts and refuses to start when they disagree.

**3. Validation, in three layers.** The client guides the user and is not trusted. The api checks the
definition against the shared JSON Schema. The engine checks the meaning against the glossary: the field exists
and is visible, the operator fits the field's type, the value fits, the path of relationships connects, the
limits hold (depth 4, 30 conditions, paths of 2 hops). An error is a code, a JSON pointer and parameters, so the
interface marks the very row that is wrong.

**4. One parameterized SELECT.** The engine builds the statement with SQLAlchemy Core, never by joining
strings. Identifiers come only from the glossary and values are only bound parameters. A many-to-one path
becomes a join; a one-to-many relationship ("a department with no active employee") becomes `EXISTS` or
`NOT EXISTS`, so rows never multiply. The age condition becomes a range on the stored birth date, so an index
can serve it. The example above compiles to this, with `p0 = 2008-11-01` (the run date minus 18 years) and
`p1 = 15000`:

```sql
SELECT TOP 5000 q.k, q.d0, q.d1, q.d2, q.a0, q.a1,
       CASE WHEN (q.t0 = 1) THEN 1 ELSE 0 END AS m0, CASE WHEN (q.t1 = 1) THEN 1 ELSE 0 END AS m1
FROM (SELECT e0.id AS k, e0.first_name AS d0, e0.last_name AS d1, e0.id AS d2, e0.birth_date AS a0, e0.salary AS a1,
             CASE WHEN (e0.birth_date > :p0) THEN 1 ELSE 0 END AS t0, CASE WHEN (e0.salary > :p1) THEN 1 ELSE 0 END AS t1
      FROM hr.[Employee] AS e0
      WHERE e0.birth_date > :p0 AND e0.salary > :p1) AS q ORDER BY q.k
```

A run sends two statements under the read-only login, each with a timeout: an exact count, and this page, capped
and ordered by the record's key. The same definition on the same data always gives the same result: no language
model takes part in this path.

**5. The reason comes back with each record.** The statement carries one flag per condition (`t0`, `t1`) and
the record's own values (`a0`, `a1`). A condition is a reason for a record only when it is true and every group
above it is true. The engine renders the reason from the glossary's templates, in Hebrew:
`גיל: 16 (מתחת ל־18); שכר: 16,500 ₪ (מעל 15,000 ₪)`. The same templates give the rule in words that the editor
shows while the user builds: `גיל מתחת ל־18 וגם שכר מעל 15,000 ₪`. The engine is the only renderer; the client
draws what it receives.

**6. A run is a snapshot.** The api stores the count, the rule in words and every flagged record with its
reasons in `dq.RunResult`. Paging, search, filtering by condition and sorting are answered from that snapshot.
The organization's data is read exactly once per run, and the pages of one run always agree with each other.

## What keeps dynamic SQL safe

Four independent layers: identifiers only from the glossary; values only as bound parameters; a login that can
only `SELECT` on `hr`, with exactly one statement per compile; and bounds on everything (row cap, statement
timeout, depth and size limits). Errors cross a service boundary as codes and never carry SQL, a driver message
or a stack trace.

## The optional task: AI that proposes controls

**Built today: suggestions without a model.** The engine profiles each entity with one aggregate query (row
count, missing values per field, the order of date pairs) and derives controls from the glossary and that
profile: required fields that are missing, dates in the wrong order, active records under an inactive parent,
active parents with no active child. Each proposal is validated, compiled and counted like any control, and
shown with its evidence; a person creates it or ignores it. On the sample data this finds examples 2 to 5 of
[examples.md](examples.md). It cannot find example 1: no heuristic invents "18" and "15,000".

**Designed, not built: an advisor service.** The plan is in
[dev/active/dc-ai-suggestions/plan.md](../dev/active/dc-ai-suggestions/plan.md). Its shape:

- A fourth, small Python service, `advisor/`, is the only part that talks to a language model. The model works
  in a bounded loop with a few tools, and every tool is an HTTP call to the engine or the api: read one
  entity's slice of the glossary, read that entity's statistics, list the controls that exist, validate a
  definition (the errors come back, so it can repair, a bounded number of times), and measure it (how many
  records it flags now). The service has no database login.
- The model never writes SQL. It returns control definitions in the contract's JSON, and each one passes the
  same validator and the same compiler as a control a person builds. Its output is treated as untrusted.
- It is proactive: it runs on a schedule and when the glossary changes. Results land in a suggestions inbox
  (new, accepted, dismissed) that the interface shows. A person accepts; nothing becomes active by itself.
- Scale and privacy: a prompt holds metadata and statistics for one entity, never record values. Retrieval is
  over the catalogue, not over records; statistics are precomputed, and sampled on large tables.
- Safety: only this service has network egress; steps, tokens, time and cost have budgets; every run is logged
  with its prompt version, tool calls and outcome. The model is hosted inside the organization's own cloud, and
  its address and key come from the environment. The service is an optional compose profile.
- Today's heuristics stay as the deterministic baseline and the fallback. The evaluation: on the sample data
  the advisor must rediscover the planted rules, example 1 included; its tests replay recorded model answers
  and need no key.

## Where to read more

| Question | Document |
|---|---|
| How do I run it? | [README](../README.md) |
| Every node, operator, limit and error of a definition | [control-definition.md](control-definition.md) |
| The glossary, and how to add a field, an entity or a relationship | [glossary.md](glossary.md) |
| The six example controls with the records they flag | [examples.md](examples.md) |
| Assumptions, limitations and extensions | [assumptions-limitations-extensions.md](assumptions-limitations-extensions.md) |
| The AI tools used in development | [ai-usage.md](ai-usage.md) |
| Components, data model, flows, decisions, the assignment checklist | [architecture.md](architecture.md) |
| Both HTTP APIs and the error codes | [contracts/api.md](../contracts/api.md), [contracts/errors.md](../contracts/errors.md) |
