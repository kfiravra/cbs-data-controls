# README Engine section, every command once, 2026-11-11T01:10:56+02:00
# scratch copy: engine/ (no .venv), contracts/ and .env; Python Python 3.12.3, uv 0.11.26 (x86_64-unknown-linux-gnu)

$ python3 -m venv .venv
exit=0

$ .venv/bin/python -m pip install -r requirements.txt
exit=0
fastapi                   0.162.4
jsonschema                4.26.0
pydantic-settings         2.16.2
pyodbc                    5.5.0
SQLAlchemy                2.0.57
tzdata                    2026.6
uvicorn                   0.54.0

$ .venv/bin/python -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000   (background)

$ curl -s localhost:8000/health
{"status":"ok","database":"ok","glossaryVersion":"1.0.0","engineVersion":"0.1.0"}   [HTTP 200]

$ curl -s -X POST localhost:8000/run ... minor-high-salary ... | jq '.totalCount, [.violations[].key]'
3
["1051","1052","1053"]
    INFO:     Started server process [741130]
    INFO:     Waiting for application startup.
    INFO:     Application startup complete.
    INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
    INFO:     127.0.0.1:52168 - "GET /health HTTP/1.1" 200 OK
    INFO:     127.0.0.1:52178 - "GET /health HTTP/1.1" 200 OK
    2026-11-11 01:11:17,033 INFO app.routes [e8911249f3c446aaa9b38c3c37c791c0] run root='employee' total=3 returned=3 duration_ms=30
    INFO:     127.0.0.1:52190 - "POST /run HTTP/1.1" 200 OK

$ uv sync
 + tzdata==2026.6
 + uvicorn==0.54.0
exit=0

$ uv run python -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000   (background)

$ curl -s localhost:8000/health
{"status":"ok","database":"ok","glossaryVersion":"1.0.0","engineVersion":"0.1.0"}   [HTTP 200]

$ curl -s -X POST localhost:8000/run ... minor-high-salary ... | jq '.totalCount, [.violations[].key]'
3
["1051","1052","1053"]

$ uv run python -m pytest
........................................................................ [ 93%]
............................                                             [100%]
460 passed in 19.30s
exit=0

$ uv run ruff check .
All checks passed!
exit=0

$ uv run pyright
0 errors, 0 warnings, 0 informations
exit=0
