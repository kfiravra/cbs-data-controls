#!/usr/bin/env bash
# Creates or updates the DataControls database by running sql/NN_*.sql in lexical order.
#
#   scripts/db-init.sh           create what is missing; a second run changes nothing
#   scripts/db-init.sh --reset   drop DataControls first; every dq row of every session goes with it
#
# Where it runs decides how:
#   - DB_HOST set in the environment and sqlcmd available: runs the scripts itself against DB_HOST[,DB_PORT].
#     This is the db-init container of docker-compose.yml, and the manual path on a host with its own
#     SQL Server (sql/README.md). The passwords come from the environment, or else from .env.
#   - otherwise: hands over to that container, `docker compose run --rm db-init`.
# It refuses to run in a linked git worktree: one SQL Server per machine, initialised from the main tree.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

die() {
  printf 'db-init: %s\n' "$*" >&2
  exit 1
}

usage() {
  sed -n '2,5s/^# \{0,1\}//p' "${BASH_SOURCE[0]}"
}

# The test of dc_linked_worktree in .claude/hooks/lib/tools.sh: a linked worktree's git dir differs from the
# repository's common dir. Without git (the init container) or outside a repository it is false.
linked_worktree() {
  command -v git >/dev/null 2>&1 || return 1
  local gd gc
  gd=$(git -C "$ROOT" rev-parse --absolute-git-dir 2>/dev/null) || return 1
  gc=$(git -C "$ROOT" rev-parse --git-common-dir 2>/dev/null) || return 1
  if [[ "$gc" != /* ]]; then gc="$ROOT/$gc"; fi
  gd=$(cd "$gd" 2>/dev/null && pwd -P) || return 1
  gc=$(cd "$gc" 2>/dev/null && pwd -P) || return 1
  [[ "$gd" != "$gc" ]]
}

find_sqlcmd() {
  if command -v sqlcmd >/dev/null 2>&1; then
    command -v sqlcmd
  elif [[ -x /opt/mssql-tools18/bin/sqlcmd ]]; then
    printf '%s\n' /opt/mssql-tools18/bin/sqlcmd
  else
    return 1
  fi
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
  done < "$file"
}

# A password ends up inside N'...' in sql/40_logins.sql, and compose and this script read quotes in .env
# differently: refuse what would break either, before anything runs.
check_password() {
  local name=$1 value=${!1:-} unsafe='[[:space:]"'\''$;\\]'
  [[ -n "$value" ]] || die "$name is not set: copy .env.example to .env and set it, or export it"
  if [[ "$value" =~ $unsafe ]]; then
    die "$name may not contain spaces, quotes, \$, ; or a backslash (.env.example says why)"
  fi
}

# Runs the scripts with sqlcmd; DB_HOST is set.
run_direct() {
  local sqlcmd=$1 reset=$2
  load_env
  local var
  for var in MSSQL_SA_PASSWORD DQ_APP_PASSWORD DQ_ENGINE_RO_PASSWORD; do
    check_password "$var"
  done

  local server=$DB_HOST
  if [[ -n "${DB_PORT:-}" ]]; then server="$DB_HOST,$DB_PORT"; fi
  # No password goes on a command line, where `ps` would show it: sqlcmd reads the sa password from
  # SQLCMDPASSWORD and resolves $(DQ_APP_PASSWORD) and $(DQ_ENGINE_RO_PASSWORD) from the environment.
  export SQLCMDPASSWORD=$MSSQL_SA_PASSWORD
  export DQ_APP_PASSWORD DQ_ENGINE_RO_PASSWORD
  # -b stops at the first error, -m 1 hides informational messages ("Changed database context"), -I sets
  # QUOTED_IDENTIFIER ON as the services' drivers do, -f 65001 reads and writes UTF-8, -C trusts the server's
  # self-signed certificate.
  local base=("$sqlcmd" -S "$server" -U sa -C -b -m 1 -I -f 65001)

  # A server that is still starting refuses connections and logins for a while, so every failure is retried;
  # the last error is shown when the wait runs out (a wrong sa password reads "Login failed"). A server that
  # was stopped and started again answers on master while DataControls is still being recovered (error 904,
  # "cannot be autostarted during server shutdown or startup"), so an existing database is read as well.
  local deadline=$((SECONDS + 120)) answer
  local probe="SET NOCOUNT ON; IF DB_ID(N'DataControls') IS NOT NULL EXEC(N'SELECT TOP (1) 1 FROM DataControls.sys.objects;') ELSE SELECT 1;"
  until answer=$("${base[@]}" -d master -l 5 -Q "$probe" 2>&1); do
    if ((SECONDS >= deadline)); then
      die "no answer from SQL Server at $server after 120 seconds. Last error: ${answer:-none}"
    fi
    sleep 2
  done

  if [[ "$reset" == 1 ]]; then
    printf 'db-init: --reset: dropping DataControls (the dq rows of every session go with it)\n'
    "${base[@]}" -d master -Q "IF DB_ID(N'DataControls') IS NOT NULL BEGIN ALTER DATABASE DataControls SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE DataControls; END;" \
      || die "could not drop DataControls"
  fi

  # Only the top level of sql/: subfolders (such as sql/checks) are not part of the init.
  local files=("$ROOT"/sql/[0-9][0-9]_*.sql) file
  [[ -e "${files[0]}" ]] || die "no sql/NN_*.sql scripts under $ROOT/sql"
  for file in "${files[@]}"; do
    printf 'db-init: %s\n' "${file#"$ROOT"/}"
    "${base[@]}" -d master -i "$file" \
      || die "${file#"$ROOT"/} failed (the scripts before it have run; fix it and run db-init again)"
  done
  printf 'db-init: DataControls is ready on %s (%d scripts)\n' "$server" "${#files[@]}"
}

# Runs this script again inside the db-init container, which starts db first if it is not running.
run_in_compose() {
  command -v docker >/dev/null 2>&1 \
    || die "neither DB_HOST with sqlcmd nor docker is available; see sql/README.md for running the scripts by hand"
  if [[ ! -f "$ROOT/.env" && -z "${MSSQL_SA_PASSWORD:-}" ]]; then
    die "no .env in $ROOT: copy .env.example to .env (a new worktree or clone has none)"
  fi
  cd "$ROOT"
  exec docker compose run --rm -T db-init "$@"
}

main() {
  local reset=0 arg
  for arg in "$@"; do
    case "$arg" in
      --reset) reset=1 ;;
      -h | --help) usage; exit 0 ;;
      *)
        printf 'db-init: unknown argument "%s"\n' "$arg" >&2
        usage >&2
        exit 2
        ;;
    esac
  done

  if linked_worktree; then
    die "refusing to run in a linked worktree ($ROOT). The SQL Server container is shared by every session and initialised from the main tree only; run scripts/db-init.sh there."
  fi

  local sqlcmd
  if [[ -n "${DB_HOST:-}" ]] && sqlcmd=$(find_sqlcmd); then
    run_direct "$sqlcmd" "$reset"
  else
    run_in_compose "$@"
  fi
}

main "$@"
