#!/usr/bin/env bash
# Flags debug output in service source, outside tests:
#   api/**/*.cs     Console.Write / Console.WriteLine (also .Out. and .Error.)  -> ILogger<T>
#   web/**/*.ts     console.log(                                                -> the logger service
#   engine/**/*.py  print( at the start of a statement                          -> logging
# Exempt: tests/ and test/ folders, *.Tests projects, *.spec.ts, *.test.ts, test_*.py,
# *_test.py, conftest.py, e2e/, scripts/, and build or dependency output. Lines that start
# as a comment are skipped (a commented-out call is dead code: a review finding, not this).
#
#   print-guard.sh [file...]   the given files, as they are in the working tree
#   print-guard.sh --staged    the staged blobs (hooks/git/pre-commit), so a partially
#                              staged file is judged by what will be committed
#   print-guard.sh --all       every tracked and untracked file under engine/ api/ web/
#
# Prints `path:line: code` per hit, then one hint per language; exit 1 on any hit.
# Runs from the Stop hook and /check (lib/pkgmap.sh) and from the git pre-commit.
source "$(dirname "${BASH_SOURCE[0]}")/lib/tools.sh"

mode=files
files=()
for a in "$@"; do
  case "$a" in
    --staged) mode=staged ;;
    --all) mode=all ;;
    *) files+=("$a") ;;
  esac
done

cd "$DC_ROOT" 2>/dev/null || exit 0
case "$mode" in
  staged) mapfile -t files < <(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null) ;;
  all) mapfile -t files < <(git ls-files --cached --others --exclude-standard -- engine api web 2>/dev/null) ;;
esac

exempt() {
  case "$1" in
    */node_modules/*|*/dist/*|*/.angular/*|*/.venv/*|*/bin/*|*/obj/*) return 0 ;;
    */tests/*|*/test/*|*.Tests/*|*/e2e/*|*/scripts/*) return 0 ;;
    *.spec.ts|*.test.ts|*/test_*.py|*_test.py|*/conftest.py) return 0 ;;
  esac
  return 1
}

hits=0
langs=""
for f in "${files[@]}"; do
  rel="$(dc_rel "$f")"
  [[ -z "$rel" ]] && continue
  case "$rel" in
    api/*.cs) lang=cs pat='(^|[^A-Za-z0-9_.])Console\.(Out\.|Error\.)?Write(Line)?[[:space:]]*\(' ;;
    web/*.ts) lang=ts pat='(^|[^A-Za-z0-9_$.])console\.log[[:space:]]*\(' ;;
    engine/*.py) lang=py pat='^[[:space:]]*print\(' ;;
    *) continue ;;
  esac
  exempt "$rel" && continue
  if [[ "$mode" == staged ]]; then
    content=$(git show ":$rel" 2>/dev/null) || continue
  else
    [[ -f "$rel" ]] || continue
    content=$(<"$rel")
  fi
  found=$(printf '%s\n' "$content" | grep -nE "$pat" | grep -vE '^[0-9]+:[[:space:]]*(//|/\*|\*|#)')
  [[ -z "$found" ]] && continue
  while IFS= read -r line; do
    code="${line#*:}"
    code="${code#"${code%%[![:space:]]*}"}"
    printf '%s:%s: %s\n' "$rel" "${line%%:*}" "$code"
    hits=$((hits + 1))
  done <<<"$found"
  [[ "$langs" == *"$lang"* ]] || langs+=" $lang"
done

(( hits == 0 )) && exit 0
for l in $langs; do
  case "$l" in
    cs) echo "  api: Console output skips the log pipeline and the correlation id; use ILogger<T>." ;;
    ts) echo "  web: console.log ships to every user's browser; use the logger service or delete it (console.warn and console.error stay allowed)." ;;
    py) echo "  engine: use logger = logging.getLogger(__name__); print( bypasses levels and handlers." ;;
  esac
done
echo "print-guard: $hits debug call(s) in service source (tests, specs, e2e/ and scripts/ are exempt)."
exit 1
