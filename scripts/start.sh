#!/usr/bin/env bash
# Starts the whole system with Docker: SQL Server, the engine, the api with the client, and the six example
# controls. Linux, macOS and WSL; on Windows, start.cmd in the repository root does the same.
#
#   scripts/start.sh
#
# What it does, in order:
#   1. checks that Docker answers;
#   2. creates .env from .env.example when there is none, with three random passwords (an existing .env is
#      never changed);
#   3. docker compose up -d --build (the first build downloads base images and packages: several minutes);
#   4. waits, five minutes at most, until the app says that its database and its engine answer;
#   5. prints the address, and how to stop and how to wipe.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/env.sh
. "$ROOT/scripts/lib/env.sh"

WAIT_SECONDS=300

die() {
  printf 'start: %s\n' "$*" >&2
  exit 1
}

# The state of one service's container: "running healthy", "exited 0", or nothing when it does not exist.
service_state() {
  local id
  id=$(docker compose ps -aq "$1" 2>/dev/null | head -n 1)
  [[ -n "$id" ]] || return 0
  docker inspect -f '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.ExitCode}}{{end}}' "$id" 2>/dev/null || true
}

show_failure() {
  printf '\nstart: the system did not come up. The containers:\n' >&2
  docker compose ps -a >&2 || true
  local service state
  for service in db db-init engine api examples; do
    state=$(service_state "$service")
    case "$state" in
      "running healthy" | "exited 0") ;;
      *)
        printf '\nstart: the last lines of %s (%s):\n' "$service" "${state:-not created}" >&2
        docker compose logs --no-color --tail 25 "$service" >&2 || true
        ;;
    esac
  done
  printf '\nstart: a port that is taken is changed in .env (APP_PORT, DB_PORT); README.md lists what else can go wrong.\n' >&2
}

cd "$ROOT"

command -v docker >/dev/null 2>&1 || die "docker was not found. Install Docker Desktop (or Docker Engine with Compose v2) and run this again."
docker info >/dev/null 2>&1 || die "Docker does not answer. Start Docker Desktop (or the Docker service) and run this again."
docker compose version >/dev/null 2>&1 || die "docker compose (v2) was not found; it comes with Docker Desktop."

dc_ensure_env "$ROOT"

printf 'start: building and starting the containers (the first build takes several minutes)\n'
if ! docker compose up -d --build; then
  show_failure
  exit 1
fi

app_port=$(dc_env_value "$ROOT" APP_PORT 5000)
db_port=$(dc_env_value "$ROOT" DB_PORT 14330)

printf 'start: waiting for the app\n'
deadline=$((SECONDS + WAIT_SECONDS))
until [[ "$(service_state api)" == "running healthy" && "$(service_state examples)" == "exited 0" ]]; do
  case "$(service_state engine)|$(service_state api)|$(service_state examples)" in
    exited*\|*\|* | *\|exited*\|* | *\|*\|"exited "[1-9]*)
      show_failure
      exit 1
      ;;
  esac
  if ((SECONDS >= deadline)); then
    show_failure
    die "no healthy app after $WAIT_SECONDS seconds"
  fi
  sleep 3
done

# The containers are healthy; this last look proves that the published port answers from the host too.
if command -v curl >/dev/null 2>&1; then
  curl -fsS -o /dev/null "http://localhost:$app_port/api/v1/health" \
    || die "the containers are healthy, but http://localhost:$app_port does not answer from this machine"
fi

cat <<EOF

Data Controls is running.

  The app            http://localhost:$app_port
  The api's pages    http://localhost:$app_port/api/docs
  The database       127.0.0.1,$db_port (SQL Server; the logins and their passwords are in .env)

  Stop it            docker compose stop        (docker compose start brings it back)
  Remove it          docker compose down        (the data stays in its volume)
  Wipe the data too  docker compose down -v
EOF
