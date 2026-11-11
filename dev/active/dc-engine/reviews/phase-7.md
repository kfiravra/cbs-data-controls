# Phase 7 review: the engine image, `dcc70b6..85bfa53`

Reviewer: the `reviewer` agent on opus, 2026-11-11, read-only. Report as returned.

## Standards (hard violations: none)

- `engine/Dockerfile:19` info, judgment call. `packages-microsoft-prod.deb` is downloaded and installed with
  `dpkg -i` as root, and HTTPS is its only integrity check. `msodbcsql18`, `unixodbc` and the base tag all
  float. The OS half of the image cannot be reproduced, while the Python half is hash-locked. No documented
  standard requires a pin here.
- `engine/Dockerfile:9` info, judgment call. Pinning bookworm is correct for the `debian/12` repository URL.
  Unattended decision 21, though, does not weigh that bookworm left Debian's regular security support in June
  2026 (LTS only) and that trixie is the current stable.
- `engine/Dockerfile.dockerignore:2` info, judgment call. Only BuildKit reads a per-Dockerfile ignore file. The
  repository has no root `.dockerignore`, so the legacy builder would send `.env` (which holds the sa password)
  and `.venv` as build context. No `COPY` puts either into a layer.

Everything else on this axis is clean: no secret is in a layer; the process runs as uid 10001 and the code it
runs is owned by root; nothing at runtime needs a home directory or a writable path (`PYTHONDONTWRITEBYTECODE` is
set, and the smoke ran as that user); `--require-hashes` behaves the same as the README's plain `pip install -r`,
because pip turns hash checking on whenever the file carries hashes; the ignore patterns work as intended (tests,
goldens, `.venv`, `.env` and `__pycache__` stay out of the context).

## Plan

- `dev/active/dc-engine/notes.md:190` warning. "`depends_on: db: condition: service_healthy` plus `restart:
  on-failure` is enough" leaves out `db-init`. `db` reports healthy as soon as sa answers `SELECT 1`, which says
  nothing about whether `DataControls`, the login and `hr` exist yet. If the engine reads the catalog while
  `db-init` is still running, it sees a partial schema, raises `GlossaryMismatch` and exits at once
  (`engine/app/services.py:164`). It only gets up by restarting in a loop, logging CRITICAL lines each time.
- `dev/active/dc-engine/notes.md:185` info. The compose note says the service listens on `0.0.0.0:8000` but not
  that the port must stay unpublished or bound to 127.0.0.1. The engine has no authentication (decision 18).
- `dev/active/dc-engine/gates/image-smoke.txt:3` info. The recorded `docker run` line has neither the `--name
  dc-engine-smoke` that line 11 uses nor the 25-second `timeout` that the last line mentions. The transcript is
  therefore not the command that actually ran.
- `engine/Dockerfile:43` info. `ENGINE_PORT` does nothing inside the image, although Design A calls it "the value
  the start commands give to `--port`". The plan asked for a fixed 8000, so this is in scope, but the compose
  note does not mention it.

Both Phase 7 steps are present: base image (deviation recorded), `msodbcsql18` and `unixodbc`, the install from
`requirements.txt`, a non-root user, the repository root as build context, `ENGINE_DB_DRIVER`, the start command
on `0.0.0.0:8000`, and the smoke (`/health` 200 and the example flags 1051 to 1053). The smoke passed only
`DQ_ENGINE_RO_PASSWORD`, by name, instead of the whole `.env`. That fits the standard better than the plan's
wording. Nothing was added that nobody asked for.

**Totals.** Standards: 0 critical, 0 warning, 3 info. Plan: 0 critical, 1 warning, 3 info.
