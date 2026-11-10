#!/usr/bin/env bash
# Checks the DataControls database. Prints one PASS or FAIL line per assertion; exits 1 on any FAIL.
#
#   scripts/db-check.sh                         every section, in the order of SECTIONS
#   scripts/db-check.sh structure permissions   only the named sections
#
# Passwords come from .env (a variable already set in the environment wins). sqlcmd runs inside the db
# container through `docker compose exec`, so the host needs no SQL Server tools. Every query is static text:
# values reach the SQL as sqlcmd variables, never spliced into it. The script shares no code with the engine.
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

SECTIONS=(structure permissions)

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
  { printf 'SET NOCOUNT ON;\nGO\n'; cat; printf '\n'; } |
    SQLCMDPASSWORD=$password docker compose exec -T -e SQLCMDPASSWORD db \
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
  local var
  for var in MSSQL_SA_PASSWORD DQ_APP_PASSWORD DQ_ENGINE_RO_PASSWORD; do
    [[ -n "${!var:-}" ]] || die "$var is not set: copy .env.example to .env (a new worktree has none)"
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
