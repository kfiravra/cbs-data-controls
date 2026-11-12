#!/usr/bin/env bash
# Times the six example controls on a scratch database of about 200,000 employees.
#
#   scripts/scale-test.sh          build the scratch database, time the examples, drop it
#   scripts/scale-test.sh --keep   the same, and leave DataControlsScale and its engine container in place
#
# It needs the compose stack up (scripts/start.sh) and python3. What it does:
#   1. runs sql/scale/load_scale.sql as sa inside the db container: the database DataControlsScale, with the
#      seed's organization multiplied (DataControls is only read; its seed and scripts/db-check.sh are untouched);
#   2. starts a second engine container against that database, published on 127.0.0.1:8009;
#   3. posts each definition of contracts/examples to that engine's /run five times and prints one row per
#      example: the violations found, the rows returned (the row cap) and the engine's own time for the run
#      (its durationMs: the count statement and the capped page), the median of the five;
#   4. stops the second engine and drops the scratch database.
# Nothing is stored: the api and the dq schema take no part.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
KEEP=0
[[ "${1:-}" == "--keep" ]] && KEEP=1
PORT=8009
NAME=data-controls-scale-engine

[[ -f .env ]] || { printf 'scale-test: no .env here; start the system first (scripts/start.sh)\n' >&2; exit 1; }
sa_password=$(grep -E '^MSSQL_SA_PASSWORD=' .env | head -n 1 | cut -d= -f2-)

sql_as_sa() {
  SQLCMDPASSWORD="$sa_password" docker compose exec -T -e SQLCMDPASSWORD db \
    /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -b -I -f 65001 "$@"
}

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  if [[ "$KEEP" == 0 ]]; then
    sql_as_sa -d master -Q "IF DB_ID(N'DataControlsScale') IS NOT NULL BEGIN ALTER DATABASE DataControlsScale SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE DataControlsScale; END;" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

printf 'scale-test: building DataControlsScale\n'
sql_as_sa -d master -i /dev/stdin <sql/scale/load_scale.sql

printf 'scale-test: starting a second engine on 127.0.0.1:%s\n' "$PORT"
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker compose run -d --no-deps --name "$NAME" -p "127.0.0.1:$PORT:8000" -e ENGINE_DB_NAME=DataControlsScale engine >/dev/null

python3 - "$PORT" <<'PY'
import json
import pathlib
import statistics
import sys
import time
import urllib.error
import urllib.request

base = f"http://127.0.0.1:{sys.argv[1]}"
deadline = time.monotonic() + 90
while True:
    try:
        with urllib.request.urlopen(base + "/health", timeout=5) as response:
            if json.load(response).get("status") == "ok":
                break
    except (OSError, ValueError):
        pass
    if time.monotonic() > deadline:
        sys.exit("scale-test: the second engine did not become healthy in 90 seconds")
    time.sleep(2)

print()
print("| Example | Root records | Violations found | Rows returned | Engine time, median of 5 (ms) |")
print("|---|---|---|---|---|")
for file in sorted(pathlib.Path("contracts/examples").glob("*.json")):
    example = json.loads(file.read_text(encoding="utf-8"))
    body = json.dumps({"definition": example["definition"], "runDate": example["runDate"]}).encode("utf-8")
    times, answer = [], {}
    for _ in range(5):
        request = urllib.request.Request(base + "/run", data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(request, timeout=120) as response:
            answer = json.load(response)
        times.append(answer["durationMs"])
    root = example["definition"]["rootEntity"]
    print(f"| `{example['id']}` | {root} | {answer['totalCount']:,} | {answer['returnedCount']:,} | {statistics.median(times):,.0f} |")
PY
printf '\nscale-test: done\n'
