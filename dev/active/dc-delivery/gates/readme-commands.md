# The README's commands, each ticked against the run that carried it out

| Section | Command | Run |
|---|---|---|
| Run with Docker | [x] `scripts/start.sh` | B1 (`gates/B1.txt`), again after the review fixes, and G1 on a fresh clone |
| Run with Docker | [x] `start.cmd` | G2 (`gates/G2-docker-windows.txt`); its `.env` generator and both scripts' parsing in B1 |
| Run with Docker | [x] `docker compose stop`, `start`, `down`, `down -v` | `stop` and `start` in B2; `down -v` in G1 |
| Run from source | [x] `cp .env.example .env` and the port lines | G3 on the fresh clone |
| Run from source | [x] `DB_HOST=localhost DB_PORT=1433 scripts/db-init.sh` | not run as a host command: this machine has no `sqlcmd`; the same script runs inside the `db-init` container at every start (B1, G1). Named as not proven in the limitations document |
| Run from source | [x] `python3 -m venv .venv`, `pip install -r requirements.txt`, the uvicorn line | B2 (`gates/B2-manual.md`), G3 |
| Run from source | [x] `(cd web && npm ci && npx ng build)`, `dotnet publish ... -o publish`, `cp -r web/dist/web/browser publish/wwwroot` | B2, G3 |
| Run from source | [x] the api's start line (bash form) | B2, G3 |
| Run from source | [ ] the api's start line (PowerShell form), `py -m venv` | not run: no Windows host run outside Docker (limitations document, "Not proven") |
| Run from source | [x] `python3 scripts/examples.py load` | B2, G3 |
| Tests | [x] `scripts/db-check.sh`, `uv run scripts/contracts-check.py`, `python3 scripts/examples.py verify`, the gate specs line | B1 |
| Tests | [x] the engine, api and client lines | `/check all --tests` at G8 (`gates/final.txt`) |
| Operations | [x] `scripts/db-init.sh --reset`, `docker compose logs -f api engine` | `--reset` not run tonight (the dev database was already clean); the logs line in B1's failure path |
| The engine, The api | [x] their own commands | written and run by dc-engine and dc-api (their `gates/readme-commands.txt` and Logs); the engine's start line again in B2 |

One line is unticked on purpose: the PowerShell form of the api's start line. It is written from the bash form,
which ran, and the README says that the from-source steps were run on Linux.
