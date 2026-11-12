# B2: the from-source path, carried out once as the README writes it

2026-11-11, WSL (Ubuntu), in a scratch clone of `feat/delivery` at `b35d72a` with the development `.env` copied
in. The database was the compose container on 127.0.0.1:1433, already initialised; the `engine` and `api`
containers were stopped first (`docker compose stop api engine`). The host has no `sqlcmd`, so step 2 was not
run as a host command here: `scripts/db-init.sh` hands over to the `db-init` container on such a machine.

| # | Command, as the README has it | Result |
|---|---|---|
| 0 | `cd engine && uv export --no-dev --format requirements-txt \| diff - requirements.txt` | no output: the committed file is the lock's export |
| 1 | `cp .env.example .env`, the three passwords, the two port lines | here: the development `.env` (`DB_PORT=1433`, `ENGINE_DB_HOST=127.0.0.1`, `ENGINE_DB_PORT=1433`) |
| 2 | `DB_HOST=localhost DB_PORT=1433 scripts/db-init.sh` | not run on this host (no sqlcmd); the database was initialised by the container |
| 3 | `cd engine`; `python3 -m venv .venv`; `.venv/bin/python -m pip install -r requirements.txt` | 12.6 s, 26 packages, Python 3.12.3 |
| 3 | `.venv/bin/python -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000` | `curl -s localhost:8000/health` → `{"status":"ok","database":"ok","glossaryVersion":"1.0.0","engineVersion":"0.1.0"}` |
| 4 | `(cd web && npm ci && npx ng build)` | 21 s; output in `web/dist/web/browser` |
| 4 | `dotnet publish api/src/DataControls.Api -c Release -o publish` | 10 s |
| 4 | `cp -r web/dist/web/browser publish/wwwroot` | done |
| 4 | `DQ_APP_PASSWORD=... DB_HOST=localhost DB_PORT=1433 Engine__BaseUrl=http://localhost:8000 ASPNETCORE_URLS=http://localhost:5000 dotnet publish/DataControls.Api.dll` | `curl -s localhost:5000/api/v1/health` → `{"status":"ok","database":"ok","engine":"ok","version":"1.0.0"}`; `/` is 200 `text/html`; the deep link `/controls/new` is 200 |
| 5 | `python3 scripts/examples.py load` | six `SKIP` lines (the six were already in this database) |
| | `python3 scripts/examples.py verify` | 7 PASS lines, exit 0 |
| | `python3 scripts/examples.py docs` and `docs --check` | `docs/examples.md` written; the check matches a fresh run |

The api's live tests (`DC_LIVE=1`) were not handed over: its notes record two passes on 2026-11-11.
Stopped after the run: both host processes; `ss -ltn` shows no listener on 5000 or 8000 (below).
listeners on 5000 and 8000 after the stop: none
