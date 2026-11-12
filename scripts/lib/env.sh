# Sourced by scripts/start.sh. Creates .env from .env.example when there is none, with a random value for each
# empty *_PASSWORD line. An existing .env is never read past its presence and never changed.

# 24 characters from letters and digits without look-alikes (no 0 O 1 l I), drawn again until an upper-case
# letter, a lower-case letter and a digit are all present: the SQL Server password policy. Letters and digits
# only, so the value passes what scripts/db-init.sh refuses (spaces, quotes, $, ; and backslash).
dc_random_password() {
  local value="" tries=0
  [[ -r /dev/urandom ]] || {
    printf 'start: /dev/urandom is not readable; create .env by hand (cp .env.example .env, then the passwords)\n' >&2
    return 1
  }
  while ((tries < 50)); do
    tries=$((tries + 1))
    # tr reads until head has its 24 bytes and is then ended by the closed pipe, which is not a failure here.
    value=$(LC_ALL=C tr -dc 'A-HJ-NP-Za-km-z2-9' </dev/urandom 2>/dev/null | head -c 24 || true)
    if [[ ${#value} -eq 24 && $value == *[A-Z]* && $value == *[a-z]* && $value == *[2-9]* ]]; then
      printf '%s' "$value"
      return 0
    fi
  done
  printf 'start: could not draw a password; create .env by hand (cp .env.example .env, then the passwords)\n' >&2
  return 1
}

# dc_ensure_env <repository root>: prints one line that says what it did.
dc_ensure_env() {
  local root=$1 line
  if [[ -f "$root/.env" ]]; then
    printf 'start: using the existing .env\n'
    return 0
  fi
  [[ -f "$root/.env.example" ]] || {
    printf 'start: %s/.env.example is missing\n' "$root" >&2
    return 1
  }
  # Written under a private name first, so a start that is interrupted leaves no half-filled .env behind, and
  # no draft either: the draft holds the passwords.
  local draft="$root/.env.new.$$" password
  trap 'rm -f "$draft"; exit 130' INT TERM
  (
    umask 077
    while IFS= read -r line || [[ -n "$line" ]]; do
      line=${line%$'\r'}
      if [[ "$line" =~ ^([A-Z_]+_PASSWORD)=$ ]]; then
        password=$(dc_random_password) || exit 1
        printf '%s=%s\n' "${BASH_REMATCH[1]}" "$password"
      else
        printf '%s\n' "$line"
      fi
    done <"$root/.env.example" >"$draft"
  ) || {
    rm -f "$draft"
    trap - INT TERM
    return 1
  }
  mv "$draft" "$root/.env"
  trap - INT TERM
  printf 'start: created .env with three random passwords (they are in that file and are not printed)\n'
}

# dc_env_value <repository root> <KEY> <default>: the value of KEY in the environment, else in .env, else the default.
dc_env_value() {
  local root=$1 key=$2 fallback=$3 line value=""
  if [[ -n "${!key:-}" ]]; then
    printf '%s' "${!key}"
    return 0
  fi
  if [[ -f "$root/.env" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      line=${line%$'\r'}
      if [[ "$line" == "$key="* ]]; then value=${line#*=}; fi
    done <"$root/.env"
  fi
  printf '%s' "${value:-$fallback}"
}
