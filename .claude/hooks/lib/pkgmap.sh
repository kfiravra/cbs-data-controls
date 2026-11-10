#!/usr/bin/env bash
# Map touched paths to the checks that cover them. Single source of truth for
# stop-check.sh, /check and /ship.
#
#   pkgmap.sh [--all] [--tests] <path>...
#
# Output: one check per line, tab-separated:  <label> <cwd relative to root> <command>
# A "skip" label carries a reason instead of a command.
#
# The verify matrix (.claude/CLAUDE.md):
#   sql       sql/, scripts/db-*.sh, docker-compose.yml   --tests: sql-init, sql-check
#   contracts contracts/, scripts/contracts-check.py      contracts-check (uv run scripts/contracts-check.py)
#   engine    engine/                                     engine-ruff, engine-pyright; --tests: engine-test
#   api       api/                                        api-build, api-format; --tests: api-test
#   web       web/                                        web-ngc, web-eslint; --tests: web-test, web-build
#   contracts/**/*.json also counts as engine + api + web: it is the one channel between them.
#   Service source (.py in engine/, .cs in api/, .ts in web/) also gets print-guard.
#   .claude/hooks/ gets the hook self-test.
# A part whose directory does not exist yet emits nothing. A part whose directory exists
# without its manifest or tool emits a skip line that says what is missing.
# Order: sql, contracts, engine, api, web, print-guard, hooks (sql-init first: everything after
# it reads the db; contracts-check next: the three services read what it checks).
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/tools.sh"

all=0
tests=0
paths=()
for a in "$@"; do
  case "$a" in
    --all) all=1 ;;
    --tests) tests=1 ;;
    *) paths+=("$a") ;;
  esac
done

want_sql=0 want_contracts=0 want_engine=0 want_api=0 want_web=0 want_hooks=0
web_lint=() guard_files=()

if [[ ${#paths[@]} -gt 0 ]]; then
  for p in "${paths[@]}"; do
    rel="$(dc_rel "$p")"
    [[ -z "$rel" ]] && continue
    case "$rel" in
      */node_modules/*|*/dist/*|*/.angular/*|*/.venv/*|*/bin/*|*/obj/*) continue ;;
    esac
    case "$rel" in
      sql/*|scripts/db-*.sh|docker-compose.yml) want_sql=1 ;;
      engine/*) want_engine=1 ;;
      api/*) want_api=1 ;;
      web/*)
        want_web=1
        case "$rel" in web/*.ts|web/*.html) web_lint+=("${rel#web/}") ;; esac ;;
      contracts/*.json) want_contracts=1 want_engine=1 want_api=1 want_web=1 ;;
      contracts/*|scripts/contracts-check.py) want_contracts=1 ;;
      .claude/hooks/*) want_hooks=1 ;;
    esac
    case "$rel" in
      engine/*.py|api/*.cs|web/*.ts) [[ -f "$DC_ROOT/$rel" ]] && guard_files+=("$rel") ;;
    esac
  done
fi

if [[ $all -eq 1 ]]; then
  want_sql=1 want_contracts=1 want_engine=1 want_api=1 want_web=1 want_hooks=1
fi
[[ -d "$DC_ROOT/sql" || -e "$DC_ROOT/scripts/db-init.sh" ]] || want_sql=0
[[ -d "$DC_ROOT/contracts" || -e "$DC_ROOT/scripts/contracts-check.py" ]] || want_contracts=0
[[ -d "$DC_ROOT/engine" ]] || want_engine=0
[[ -d "$DC_ROOT/api" ]] || want_api=0
[[ -d "$DC_ROOT/web" ]] || want_web=0

emit() { printf '%s\t%s\t%s\n' "$1" "$2" "$3"; }
skip() { emit skip . "$1"; }

if [[ $want_sql -eq 1 && $tests -eq 1 ]]; then
  if [[ ! -x "$DC_ROOT/scripts/db-init.sh" ]]; then
    skip "scripts/db-init.sh missing or not executable: sql-init cannot run"
  elif dc_linked_worktree; then
    skip "sql-init runs from the main tree only (one SQL Server container per machine); this worktree uses the running one"
  else
    emit sql-init . "docker compose up -d db && scripts/db-init.sh"
  fi
  if [[ -x "$DC_ROOT/scripts/db-check.sh" ]]; then
    emit sql-check . "scripts/db-check.sh"
  else
    skip "scripts/db-check.sh missing or not executable: sql-check cannot run"
  fi
fi

if [[ $want_contracts -eq 1 ]]; then
  if [[ ! -f "$DC_ROOT/scripts/contracts-check.py" ]]; then
    skip "scripts/contracts-check.py missing: contracts-check cannot run"
  elif ! command -v uv >/dev/null 2>&1; then
    skip "uv not found on PATH: contracts-check runs as uv run scripts/contracts-check.py"
  else
    emit contracts-check . "uv run scripts/contracts-check.py"
  fi
fi

if [[ $want_engine -eq 1 ]]; then
  if [[ ! -f "$DC_ROOT/engine/pyproject.toml" ]]; then
    skip "engine/pyproject.toml missing: ruff, pyright and pytest have no configuration yet"
  else
    if ruff="$(dc_ruff)"; then
      emit engine-ruff engine "$ruff check ."
    else
      skip "ruff not found (engine/.venv/bin/ruff or PATH)"
    fi
    if pyright="$(dc_pyright)"; then
      emit engine-pyright engine "$pyright"
    else
      skip "pyright not found (engine/.venv/bin/pyright or PATH)"
    fi
    if [[ $tests -eq 1 ]]; then
      if [[ -x "$DC_ROOT/engine/.venv/bin/python" ]]; then
        emit engine-test engine ".venv/bin/python -m pytest"
      else
        skip "engine/.venv missing: create the venv before pytest can run"
      fi
    fi
  fi
fi

if [[ $want_api -eq 1 ]]; then
  shopt -s nullglob
  slns=("$DC_ROOT"/api/*.sln "$DC_ROOT"/api/*.slnx)
  shopt -u nullglob
  if [[ ${#slns[@]} -eq 0 ]]; then
    skip "api/ has no .sln or .slnx: dotnet build, format and test need one solution file at api/"
  elif [[ ${#slns[@]} -gt 1 ]]; then
    skip "api/ has ${#slns[@]} solution files: dotnet needs exactly one at api/"
  elif ! command -v dotnet >/dev/null 2>&1; then
    skip "dotnet not found on PATH"
  else
    emit api-build api "dotnet build -warnaserror"
    emit api-format api "dotnet format --verify-no-changes"
    [[ $tests -eq 1 ]] && emit api-test api "dotnet test"
  fi
fi

if [[ $want_web -eq 1 ]]; then
  if [[ ! -f "$DC_ROOT/web/angular.json" ]]; then
    skip "web/angular.json missing: not an Angular workspace yet"
  elif [[ ! -d "$DC_ROOT/web/node_modules" ]]; then
    skip "web/ has no node_modules (npm ci in web/)"
  else
    # 2026-05-31: a bare `tsc --noEmit` against a solution-style tsconfig.json (`files: []`,
    # references only) checked nothing and let two TS6133 errors into a production build.
    # Type-check the app config by name; ngc adds the template checks plain tsc cannot do.
    if [[ -f "$DC_ROOT/web/tsconfig.app.json" ]]; then
      emit web-ngc web "npx ngc -p tsconfig.app.json --noEmit"
    else
      skip "web/tsconfig.app.json missing: a typecheck against the solution tsconfig.json would check nothing, fix the layout first"
    fi
    if [[ $all -eq 1 ]]; then
      emit web-eslint web "npx ng lint"
    elif [[ ${#web_lint[@]} -gt 0 ]]; then
      if dc_eslint_bin web >/dev/null; then
        emit web-eslint web "npx eslint ${web_lint[*]}"
      else
        skip "web/node_modules/.bin/eslint missing: run ng add angular-eslint in web/"
      fi
    fi
    if [[ $tests -eq 1 ]]; then
      emit web-test web "npx ng test --watch=false"
      emit web-build web "npx ng build"
    fi
  fi
fi

guard="bash $DC_INFRA_DIR/hooks/print-guard.sh"
if [[ $all -eq 1 ]]; then
  if [[ -d "$DC_ROOT/engine" || -d "$DC_ROOT/api" || -d "$DC_ROOT/web" ]]; then
    emit print-guard . "$guard --all"
  fi
elif [[ ${#guard_files[@]} -gt 0 ]]; then
  emit print-guard . "$guard ${guard_files[*]}"
fi

[[ $want_hooks -eq 1 ]] && emit hooks . "node --test $DC_INFRA_DIR/hooks/tests/*.test.mjs"

exit 0
