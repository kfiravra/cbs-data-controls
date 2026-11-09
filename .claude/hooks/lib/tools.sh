#!/usr/bin/env bash
# Shared helpers for the hooks. Source this file; do not execute it.
# Every path derives from this file's location, so the hooks work from any checkout
# (the main tree or a linked worktree).

DC_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DC_INFRA_DIR="$(cd "$DC_LIB_DIR/../.." && pwd)"
DC_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$DC_INFRA_DIR/.." && pwd)}"
# Tests point this at a temp dir so they never touch live session state.
DC_STATE_ROOT="${DC_STATE_ROOT:-$DC_INFRA_DIR/state}"
# Written by /guard off, removed by /guard on. While present, git-guard.sh
# stands down and session-start.sh says so.
DC_GUARD_OFF="$DC_STATE_ROOT/guard-off"

# Every hook parses its stdin with jq. Without it a hook cannot tell a safe
# command from a destructive one, so the caller decides how to fail:
#   dc_require_jq block   -> exit 2 (PreToolUse: refuse the tool call)
#   dc_require_jq report  -> print one line, exit 0 (Stop/PostToolUse/SessionStart)
dc_require_jq() {
  command -v jq >/dev/null 2>&1 && return 0
  local msg="jq is not installed; the Claude Code hooks cannot parse their input. Install it (sudo apt install jq) and retry."
  if [[ "${1:-report}" == "block" ]]; then
    printf 'BLOCKED by %s: %s\n' "$(basename "$0")" "$msg" >&2
    exit 2
  fi
  printf '%s: %s\n' "$(basename "$0")" "$msg"
  exit 0
}

# Per-session state directory (created on demand).
dc_state_dir() {
  local d="$DC_STATE_ROOT/${1:-nosession}"
  mkdir -p "$d" 2>/dev/null
  printf '%s' "$d"
}

# Absolute or relative path -> path relative to DC_ROOT. Empty when outside the project.
dc_rel() {
  local p="$1"
  case "$p" in
    "$DC_ROOT"/*) printf '%s' "${p#"$DC_ROOT"/}" ;;
    /*) printf '' ;;
    *) printf '%s' "$p" ;;
  esac
}

# Prints an engine tool: the engine venv's copy first (the version the project pins),
# then PATH. Returns 1 when neither exists.
dc_engine_tool() {
  local t="$DC_ROOT/engine/.venv/bin/$1"
  if [[ -x "$t" ]]; then
    printf '%s' "$t"
    return 0
  fi
  command -v "$1" 2>/dev/null
}
dc_ruff() { dc_engine_tool ruff; }
dc_pyright() { dc_engine_tool pyright; }

# True inside a linked worktree (its git dir differs from the common dir). The SQL
# Server container is started and initialised from the main tree only.
dc_linked_worktree() {
  local gd gc
  gd=$(git -C "$DC_ROOT" rev-parse --absolute-git-dir 2>/dev/null) || return 1
  gc=$(git -C "$DC_ROOT" rev-parse --git-common-dir 2>/dev/null) || return 1
  [[ "$gc" != /* ]] && gc="$DC_ROOT/$gc"
  gd=$(cd "$gd" 2>/dev/null && pwd -P) || return 1
  gc=$(cd "$gc" 2>/dev/null && pwd -P) || return 1
  [[ "$gd" != "$gc" ]]
}

# Prints the eslint binary of a package dir (relative to DC_ROOT) or returns 1.
dc_eslint_bin() {
  local b="$DC_ROOT/$1/node_modules/.bin/eslint"
  if [[ -x "$b" ]]; then
    printf '%s' "$b"
    return 0
  fi
  return 1
}

# One-key JSON object, e.g. dc_json systemMessage "text".
dc_json() {
  jq -cn --arg k "$1" --arg v "$2" '{($k): $v}'
}
