#!/usr/bin/env bash
# Checks the DataControls database. Prints one PASS or FAIL line per assertion; exits 1 on any FAIL.
#
#   scripts/db-check.sh                         every section, in the order of SECTIONS
#   scripts/db-check.sh structure permissions   only the named sections
#
# Passwords come from .env (a variable already set in the environment wins). sqlcmd runs inside the db
# container through `docker compose exec`, so the host needs no SQL Server tools; the sections that read
# contracts/ need jq. Every query is static text: values reach the SQL as sqlcmd variables, never spliced
# into it. The script shares no code with the engine.
#
# Adding a section: write a function section_<name> and add <name> to SECTIONS.
#
# Helpers for sections
#   pass "<text>"                                       prints "PASS <section>: <text>"
#   fail "<text>"                                       prints "FAIL <section>: <text>"; the exit code becomes 1
#   check_equal "<text>" "<expected>" "<actual>"        pass when the two strings are equal, else fail with both
#   check_same_lines "<text>" "<expected>" "<actual>"   pass when the two sets of lines are equal (order and blank
#                                                       lines ignored), else fail with the missing and unexpected
#   sql_query <login> "<query>" [VAR=value ...]         runs a static query
#   sql_file <login> <file.sql> [VAR=value ...]         runs a local .sql file (a path from the repository root)
#
# <login> is sa, dq_app or dq_engine_ro, always against DataControls. sql_query and sql_file print the rows of
# every result set, one row per line, columns separated by '|', with no header and no "rows affected" line, NULL
# as NULL and an empty string as nothing, in UTF-8. NVARCHAR(MAX) values are cut at 256 characters (sqlcmd -W
# excludes -y): CAST such a column to NVARCHAR(4000) to read more. A VAR=value is $(VAR) in the SQL; values must
# not contain spaces or quotes. On a SQL error both print sqlcmd's message to stderr and return 1.
# pass and fail may be called from subshells and pipelines too: the tally lives in a file.
#
#   rows=$(sql_file dq_engine_ro sql/checks/minor-high-salary.sql RUN_DATE=2026-11-01) || { fail "..."; return 0; }
#   count=$(sql_query dq_engine_ro "SELECT COUNT(*) FROM hr.Employee;")
#
# Sourcing this file defines the helpers and runs nothing; call db_check_setup before the first query.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATABASE=DataControls
SQLCMD=/opt/mssql-tools18/bin/sqlcmd

SECTIONS=(structure permissions glossary hebrew examples)

SECTION=""
TALLY=""

die() {
  printf 'db-check: %s\n' "$*" >&2
  exit 1
}

pass() {
  printf 'PASS %s: %s\n' "$SECTION" "$*"
  printf 'P\n' >>"$TALLY"
}

fail() {
  printf 'FAIL %s: %s\n' "$SECTION" "$*"
  printf 'F\n' >>"$TALLY"
}

check_equal() {
  if [[ "$2" == "$3" ]]; then
    pass "$1"
  else
    fail "$1: expected '$2', got '$3'"
  fi
}

sorted_lines() { printf '%s\n' "$1" | sed '/^[[:space:]]*$/d' | LC_ALL=C sort -u; }
joined() { printf '%s\n' "$1" | sed '/^$/d' | paste -sd ' ' -; }

check_same_lines() {
  local missing unexpected
  missing=$(LC_ALL=C comm -23 <(sorted_lines "$2") <(sorted_lines "$3"))
  unexpected=$(LC_ALL=C comm -13 <(sorted_lines "$2") <(sorted_lines "$3"))
  if [[ -z "$missing$unexpected" ]]; then
    pass "$1"
  else
    fail "$1: missing [$(joined "$missing")] unexpected [$(joined "$unexpected")]"
  fi
}

# Runs the SQL on stdin as <login>; the remaining arguments are VAR=value sqlcmd variables.
# -b fails on a SQL error, -r1 sends messages to stderr, -I sets QUOTED_IDENTIFIER ON, -f 65001 reads and writes
# UTF-8, -h -1 drops the header, -W trims padding, -s '|' separates columns.
run_sql() {
  local login=$1 password
  shift
  case "$login" in
    sa) password=${MSSQL_SA_PASSWORD:-} ;;
    dq_app) password=${DQ_APP_PASSWORD:-} ;;
    dq_engine_ro) password=${DQ_ENGINE_RO_PASSWORD:-} ;;
    *)
      printf 'db-check: unknown login "%s" (sa, dq_app or dq_engine_ro)\n' "$login" >&2
      return 2
      ;;
  esac
  local vars=() var
  for var in "$@"; do vars+=(-v "$var"); done
  # NOCOUNT is set in a batch of its own and holds for the session; the password travels in the environment.
  # The two MSYS variables stop Git Bash from rewriting the container paths into Windows paths.
  { printf 'SET NOCOUNT ON;\nGO\n'; cat; printf '\n'; } |
    SQLCMDPASSWORD=$password MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' docker compose exec -T -e SQLCMDPASSWORD db \
      "$SQLCMD" -C -S localhost -U "$login" -d "$DATABASE" -b -r1 -I -f 65001 -h -1 -W -s '|' \
      ${vars[@]+"${vars[@]}"} -i /dev/stdin
}

sql_query() {
  local login=$1 query=$2
  shift 2
  printf '%s\n' "$query" | run_sql "$login" "$@"
}

sql_file() {
  local login=$1 file=$2
  shift 2
  if [[ ! -f "$file" ]]; then
    printf 'db-check: no such file: %s\n' "$file" >&2
    return 2
  fi
  run_sql "$login" "$@" <"$file"
}

# Reads KEY=value lines of .env into the environment. A variable that is already set wins, as in docker compose.
load_env() {
  local file="$ROOT/.env" line key value
  [[ -f "$file" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    line=${line%$'\r'}
    [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] || continue
    key=${line%%=*}
    value=${line#*=}
    if [[ -z "${!key+set}" ]]; then export "$key=$value"; fi
  done <"$file"
}

db_check_setup() {
  cd "$ROOT"
  load_env
  local var unsafe='[[:space:]"'\''$;\\]'
  for var in MSSQL_SA_PASSWORD DQ_APP_PASSWORD DQ_ENGINE_RO_PASSWORD; do
    [[ -n "${!var:-}" ]] || die "$var is not set: copy .env.example to .env and set it (a new worktree has none)"
    # compose strips quotes around a value in .env and this script does not: refuse what would differ.
    if [[ "${!var}" =~ $unsafe ]]; then
      die "$var may not contain spaces, quotes, \$, ; or a backslash (.env.example says why)"
    fi
  done
  command -v docker >/dev/null 2>&1 || die "docker is not on PATH"
  if [[ -z "$(docker compose ps --status running --quiet db 2>/dev/null)" ]]; then
    die "the db container is not running: docker compose up -d db && scripts/db-init.sh (in the main tree)"
  fi
  sql_query sa "SELECT 1;" >/dev/null || die "cannot open DataControls (see above): run scripts/db-init.sh"
  TALLY=$(mktemp "${TMPDIR:-/tmp}/db-check.XXXXXX")
  trap 'rm -f "$TALLY"' EXIT
}

# --- structure: collation, schemas, tables, indexes ---

EXPECTED_TABLES='dq.Control
dq.ControlVersion
dq.Run
dq.RunResult
hr.Department
hr.Employee
hr.Ministry'

EXPECTED_INDEXES='dq.Run.IX_Run_control_id_control_version
dq.Run.IX_Run_control_id_started_at
hr.Department.IX_Department_manager_employee_id
hr.Department.IX_Department_ministry_id
hr.Employee.IX_Employee_birth_date
hr.Employee.IX_Employee_department_id
hr.Employee.IX_Employee_department_id_status
hr.Employee.IX_Employee_salary
hr.Employee.IX_Employee_status'

section_structure() {
  local value

  value=$(sql_query sa "SELECT CONVERT(NVARCHAR(128), DATABASEPROPERTYEX(N'DataControls', 'Collation'));") \
    || value="(query failed)"
  check_equal "database collation" "Hebrew_CI_AS" "$value"

  value=$(sql_query sa "SELECT CONVERT(NVARCHAR(128), SERVERPROPERTY('Collation'));") || value="(query failed)"
  check_equal "server collation, which tempdb and #temp tables share" "Hebrew_CI_AS" "$value"

  value=$(sql_query sa "SELECT name FROM sys.schemas WHERE name IN (N'hr', N'dq');") || value=""
  check_same_lines "schemas hr and dq" $'dq\nhr' "$value"

  value=$(sql_query sa "
    SELECT s.name + N'.' + t.name
    FROM sys.tables AS t
    JOIN sys.schemas AS s ON s.schema_id = t.schema_id
    WHERE s.name IN (N'hr', N'dq');") || value=""
  check_same_lines "the seven tables of hr and dq, and no other" "$EXPECTED_TABLES" "$value"

  value=$(sql_query sa "
    SELECT s.name + N'.' + t.name + N'.' + i.name
    FROM sys.indexes AS i
    JOIN sys.tables AS t ON t.object_id = i.object_id
    JOIN sys.schemas AS s ON s.schema_id = t.schema_id
    WHERE s.name IN (N'hr', N'dq') AND i.name LIKE N'IX[_]%';") || value=""
  check_same_lines "the indexes of 50_indexes.sql" "$EXPECTED_INDEXES" "$value"
}

# --- permissions: each login can do its own job and nothing else ---
# A probe answers 0 when its statement ran and the error number when it was refused: 229 is a denied object
# permission, 262 a denied database permission such as CREATE TABLE. Writes run in a transaction that is always
# rolled back, and the UPDATE matches no row. The rolled-back INSERT still uses up one identity value of
# dq.Control; ids carry no meaning.

probe() {
  local text=$1 expected=$2 login=$3 query=$4 value
  value=$(sql_query "$login" "$query") || value="(query failed)"
  check_equal "$text" "$expected" "$value"
}

section_permissions() {
  probe "dq_engine_ro reads hr.Employee" 0 dq_engine_ro "
    DECLARE @n INT;
    BEGIN TRY SELECT @n = COUNT(*) FROM hr.Employee; SELECT 0; END TRY
    BEGIN CATCH SELECT ERROR_NUMBER(); END CATCH;"

  probe "dq_engine_ro is refused a read of dq.Control (error 229)" 229 dq_engine_ro "
    DECLARE @n INT;
    BEGIN TRY SELECT @n = COUNT(*) FROM dq.Control; SELECT 0; END TRY
    BEGIN CATCH SELECT ERROR_NUMBER(); END CATCH;"

  probe "dq_engine_ro is refused an UPDATE of hr.Employee (error 229)" 229 dq_engine_ro "
    BEGIN TRANSACTION;
    BEGIN TRY UPDATE hr.Employee SET salary = salary WHERE 1 = 0; SELECT 0; END TRY
    BEGIN CATCH SELECT ERROR_NUMBER(); END CATCH;
    ROLLBACK TRANSACTION;"

  probe "dq_engine_ro is refused CREATE TABLE (error 262)" 262 dq_engine_ro "
    BEGIN TRANSACTION;
    BEGIN TRY CREATE TABLE hr.db_check_probe (id INT NOT NULL); SELECT 0; END TRY
    BEGIN CATCH SELECT ERROR_NUMBER(); END CATCH;
    ROLLBACK TRANSACTION;"

  probe "dq_app inserts into dq.Control (rolled back)" 0 dq_app "
    BEGIN TRANSACTION;
    BEGIN TRY
      INSERT INTO dq.Control (name, root_entity_key, current_version) VALUES (N'db-check probe', N'employee', 1);
      SELECT 0;
    END TRY
    BEGIN CATCH SELECT ERROR_NUMBER(); END CATCH;
    ROLLBACK TRANSACTION;"

  probe "dq_app is refused a read of hr.Employee (error 229)" 229 dq_app "
    DECLARE @n INT;
    BEGIN TRY SELECT @n = COUNT(*) FROM hr.Employee; SELECT 0; END TRY
    BEGIN CATCH SELECT ERROR_NUMBER(); END CATCH;"

  probe "dq_app is refused CREATE TABLE (error 262)" 262 dq_app "
    BEGIN TRANSACTION;
    BEGIN TRY CREATE TABLE dq.db_check_probe (id INT NOT NULL); SELECT 0; END TRY
    BEGIN CATCH SELECT ERROR_NUMBER(); END CATCH;
    ROLLBACK TRANSACTION;"

  probe "public holds no permission on hr or dq" 0 sa "
    SELECT COUNT(*)
    FROM sys.database_permissions AS p
    WHERE p.grantee_principal_id = DATABASE_PRINCIPAL_ID(N'public')
      AND ((p.class = 3 AND p.major_id IN (SCHEMA_ID(N'hr'), SCHEMA_ID(N'dq')))
        OR (p.class = 1 AND OBJECT_SCHEMA_NAME(p.major_id) IN (N'hr', N'dq')));"
}

# --- glossary: every table and column the glossary names exists as the engine's login sees it ---
# The same check the engine runs at startup, made here without the engine. One static query lists the columns
# that dq_engine_ro can see, with the type family of each; jq lists what contracts/glossary.json names. No SQL is
# built from the glossary.

GLOSSARY_FILE=contracts/glossary.json

# One line per physical column the glossary names: the key column of every entity, the column of every stored
# field, the column a computed field is derived from, and both ends of every relationship.
GLOSSARY_COLUMNS_JQ='
  (.entities | map({ key: .key, value: "\(.table.schema).\(.table.name)" }) | from_entries) as $table
  | [ .entities[]
      | "\(.table.schema).\(.table.name)" as $t
      | "\($t).\(.keyColumn)", (.fields[] | "\($t).\(.column // .computed.over)") ]
    + [ .relationships[] | "\($table[.from]).\(.join.fromColumn)", "\($table[.to]).\(.join.toColumn)" ]
  | unique | .[]'

# One line per stored field: its column and the type family the field's type needs (an enum is stored as text).
GLOSSARY_TYPES_JQ='
  [ .entities[]
    | "\(.table.schema).\(.table.name)" as $t
    | .fields[] | select(.column != null)
    | "\($t).\(.column):\(if .type == "enum" then "text" else .type end)" ]
  | unique | .[]'

section_glossary() {
  local seen expected missing
  command -v jq >/dev/null 2>&1 || { fail "jq is not on PATH: it reads $GLOSSARY_FILE"; return 0; }
  [[ -f "$GLOSSARY_FILE" ]] || { fail "$GLOSSARY_FILE does not exist"; return 0; }

  seen=$(sql_query dq_engine_ro "
    SELECT c.TABLE_SCHEMA + N'.' + c.TABLE_NAME + N'.' + c.COLUMN_NAME + N':' +
           CASE WHEN c.DATA_TYPE IN (N'tinyint', N'smallint', N'int', N'bigint', N'decimal', N'numeric')
                    THEN N'number'
                WHEN c.DATA_TYPE IN (N'nvarchar', N'nchar') THEN N'text'
                WHEN c.DATA_TYPE = N'date' THEN N'date'
                WHEN c.DATA_TYPE = N'bit' THEN N'bool'
                ELSE c.DATA_TYPE END
    FROM INFORMATION_SCHEMA.COLUMNS AS c;") || { fail "dq_engine_ro reads INFORMATION_SCHEMA.COLUMNS"; return 0; }

  expected=$(jq -r "$GLOSSARY_COLUMNS_JQ" "$GLOSSARY_FILE") || { fail "$GLOSSARY_FILE: jq cannot read it"; return 0; }
  missing=$(LC_ALL=C comm -23 <(sorted_lines "$expected") <(sorted_lines "$(cut -d: -f1 <<<"$seen")"))
  if [[ -z "$missing" ]]; then
    pass "all $(sorted_lines "$expected" | wc -l | tr -d ' ') columns the glossary names exist for dq_engine_ro"
  else
    fail "columns the glossary names and dq_engine_ro does not see: $(joined "$missing")"
  fi

  expected=$(jq -r "$GLOSSARY_TYPES_JQ" "$GLOSSARY_FILE") || expected=""
  missing=$(LC_ALL=C comm -23 <(sorted_lines "$expected") <(sorted_lines "$seen"))
  if [[ -z "$missing" ]]; then
    pass "every stored field's type fits its column"
  else
    fail "fields whose type does not fit the column (column:type the glossary needs): $(joined "$missing")"
  fi

  if grep -q '^dq\.' <<<"$seen"; then
    fail "dq_engine_ro sees columns of dq in INFORMATION_SCHEMA"
  else
    pass "dq_engine_ro sees hr alone in INFORMATION_SCHEMA"
  fi
}

# --- hebrew: the seeded names survived the trip through sqlcmd ---
# A missing N prefix or a wrong code page turns Hebrew into question marks on the way in; a wrong code page on the
# way out turns it into mojibake. The names are compared with the bytes of the seed file, so this script holds no
# Hebrew text of its own.

SEED_FILE=sql/60_seed_hr.sql

section_hebrew() {
  local counts total marks foreign names name lost=""

  counts=$(sql_query dq_engine_ro "
    WITH n (name) AS (
      SELECT m.name FROM hr.Ministry AS m
      UNION ALL SELECT d.name FROM hr.Department AS d
      UNION ALL SELECT e.first_name FROM hr.Employee AS e
      UNION ALL SELECT e.last_name FROM hr.Employee AS e
    )
    SELECT COUNT(*),
           COALESCE(SUM(CASE WHEN n.name LIKE N'%?%' THEN 1 ELSE 0 END), 0),
           COALESCE(SUM(CASE WHEN UNICODE(LEFT(n.name, 1)) NOT BETWEEN 1488 AND 1514 THEN 1 ELSE 0 END), 0)
    FROM n;") || counts=""
  IFS='|' read -r total marks foreign <<<"$counts"
  if [[ ! "$total" =~ ^[1-9][0-9]*$ ]]; then
    fail "the seed is loaded: expected names in hr, got '${total:-nothing}' (scripts/db-init.sh runs $SEED_FILE)"
    return 0
  fi
  pass "the seed is loaded: $total names in hr"
  check_equal "no seeded name holds a question mark" 0 "$marks"
  check_equal "every seeded name starts with a letter of the Hebrew block" 0 "$foreign"

  names=$(sql_query dq_engine_ro "
    SELECT m.name FROM hr.Ministry AS m UNION ALL SELECT d.name FROM hr.Department AS d;") || names=""
  while IFS= read -r name; do
    [[ -n "$name" ]] || continue
    grep -qF -- "N'$name'" "$SEED_FILE" || lost+="[$name] "
  done <<<"$names"
  if [[ -n "$names" && -z "$lost" ]]; then
    pass "ministry and department names read back byte for byte as $SEED_FILE writes them"
  else
    fail "ministry and department names read back as written in $SEED_FILE: differ ${lost:-(no names returned)}"
  fi
}

# --- examples: each example control flags exactly the records its file expects ---
# The oracle of an example is sql/checks/<id>.sql, a hand-written query that shares nothing with the engine. It
# returns key|name|matched ids per violating record, ordered by key. The run date of the example reaches it as
# the sqlcmd variable RUN_DATE.

EXAMPLES_DIR=contracts/examples
CHECKS_DIR=sql/checks

# check_example_run <id> <run date> <expected lines "key|id,id"> <expected total>
check_example_run() {
  local id=$1 run_date=$2 expected=$3 total=$4 rows actual count
  if [[ ! "$run_date" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
    fail "$id: runDate '$run_date' is not YYYY-MM-DD"
    return 0
  fi
  rows=$(sql_file dq_engine_ro "$CHECKS_DIR/$id.sql" "RUN_DATE=$run_date") || {
    fail "$id on $run_date: the oracle query failed (see above)"
    return 0
  }
  if [[ -n "$rows" ]]; then
    printf '%s\n' "$rows" | awk -F'|' '{ printf "       %-6s %s  [%s]\n", $1, $2, $3 }'
  fi
  actual=$(printf '%s\n' "$rows" | awk -F'|' 'NF { print $1 "|" $3 }')
  count=$(printf '%s\n' "$actual" | grep -c . || true)
  if [[ "$actual" == "$expected" && "$count" == "$total" ]]; then
    pass "$id on $run_date: $count records, keys and matched ids as the example expects"
  elif [[ "$count" != "$total" && "$actual" == "$expected" ]]; then
    fail "$id on $run_date: expected.total is $total but the example lists $count violations"
  elif [[ "$(sorted_lines "$actual")" == "$(sorted_lines "$expected")" ]]; then
    fail "$id on $run_date: the same records in another order (the example lists them by key)"
  else
    check_same_lines "$id on $run_date: keys and matched ids (key|ids)" "$expected" "$actual"
  fi
}

section_examples() {
  local file id run_date expected total n i found=0
  command -v jq >/dev/null 2>&1 || { fail "jq is not on PATH: it reads the example files"; return 0; }

  for file in "$EXAMPLES_DIR"/*.json; do
    [[ -f "$file" ]] || continue
    found=$((found + 1))
    id=$(jq -r '.id' "$file")
    if [[ ! "$id" =~ ^[a-z][a-z0-9-]*$ || "$EXAMPLES_DIR/$id.json" != "$file" ]]; then
      fail "$file: its id '$id' is not its file name"
      continue
    fi
    if [[ ! -f "$CHECKS_DIR/$id.sql" ]]; then
      fail "$id: no oracle query at $CHECKS_DIR/$id.sql"
      continue
    fi
    run_date=$(jq -r '.runDate' "$file")
    expected=$(jq -r '.expected.violations[] | "\(.key)|\(.matched | join(","))"' "$file")
    total=$(jq -r '.expected.total' "$file")
    check_example_run "$id" "$run_date" "$expected" "$total"

    n=$(jq -r '(.alternateRuns // []) | length' "$file")
    for ((i = 0; i < n; i++)); do
      run_date=$(jq -r --argjson i "$i" '.alternateRuns[$i].runDate' "$file")
      expected=$(jq -r --argjson i "$i" \
        '.alternateRuns[$i].expected.violations[] | "\(.key)|\(.matched | join(","))"' "$file")
      total=$(jq -r --argjson i "$i" '.alternateRuns[$i].expected.total' "$file")
      check_example_run "$id" "$run_date" "$expected" "$total"
    done
  done

  for file in "$CHECKS_DIR"/*.sql; do
    [[ -f "$file" ]] || continue
    id=$(basename "$file" .sql)
    [[ -f "$EXAMPLES_DIR/$id.json" ]] || fail "$file: no example at $EXAMPLES_DIR/$id.json"
  done
  if ((found == 0)); then fail "no example files in $EXAMPLES_DIR"; fi
}

main() {
  local names=("$@") name
  if ((${#names[@]} == 0)); then names=("${SECTIONS[@]}"); fi
  for name in "${names[@]}"; do
    if ! declare -F "section_$name" >/dev/null; then
      printf 'db-check: unknown section "%s" (sections: %s)\n' "$name" "${SECTIONS[*]}" >&2
      exit 2
    fi
  done

  db_check_setup
  for name in "${names[@]}"; do
    SECTION=$name
    "section_$name"
  done

  local passed failed
  passed=$(grep -c '^P$' "$TALLY" || true)
  failed=$(grep -c '^F$' "$TALLY" || true)
  printf 'db-check: %s passed, %s failed (%s)\n' "$passed" "$failed" "${names[*]}"
  if ((failed > 0)); then exit 1; fi
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
