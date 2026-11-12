# Security audit of the whole repository (gate item G5, 2026-11-11)

One `security-auditor` agent on opus, read-only, on `feat/delivery` at `0d9767f` with the composed stack running.
It read the compose file, both Dockerfiles, the start scripts, `sql/`, the engine's compiler, executor and
validator, the api's controls and results code, the client, and the committed files under `dev/` and `docs/`;
it ran `docker inspect` (variable names only), `scripts/db-check.sh permissions`, and read-only `curl` probes.

**No critical and no high finding.**

| # | Severity | Where | Finding | What happened |
|---|---|---|---|---|
| 1 | medium | `api/src/DataControls.Api/appsettings.json:8`, `AllowedHosts: "*"` (open item 1 of the api's audit) | The limitations document understated it: a rebinding page can also create a control and run it, which returns the records of `hr` it flags, not only stored results. Verified with a foreign `Host` header: 200 | The document now says so. Not changed in code or compose: plan decision 13 (a late finding that is not critical goes to the limitations), and a host list in compose would answer a grader who reaches the app by any other name with a bare 400. The fix is one line in the `api` service (`AllowedHosts: localhost;127.0.0.1;api`): Kfir's call |
| 2 | low | machine state | A second engine container published on 127.0.0.1:8009 was up during the audit | It was this session's scale test, kept for one more measurement; removed before the audit's report arrived. `scripts/scale-test.sh` removes it on exit unless `--keep` is given |
| 3 | low | `docker-compose.yml`, one default network | The `examples` one-shot can reach `engine:8000` and `db:1433`; on Docker Engine before 28 unpublished ports could be reached from the LAN by direct routing (unverified) | Added to the limitations document; an internal network is in the plan of dc-ai-suggestions (Design L) |
| 4 | info | `scripts/db-check.sh:216-262` | Eight probes; no probe of a write by `dq_app` on `hr`, of a write by `dq_engine_ro` on `dq`, or of role membership (the `DENY` lines cover them on reading) | Added to the limitations document |
| 5 | info | the developer's local `.env` | Mode 0644 (made by hand); `start.sh` writes 0600 | For Kfir: `chmod 600 .env` |
| 6 | info | git history | `43745cc`, with three former development passwords, exists only on `feat/contracts` (local and origin). It is not in the history of `main` or of this branch; none of the three values is in use or in the tree | For Kfir: deleting the branch `feat/contracts` on origin removes it from there |

The other open items of the api's audit (2 to 6) are no worse composed. Item 3's body-less POST also stores a
snapshot of up to 5,000 rows per call, with cleanup by hand only: said in the limitations document.

## Confirmed sound

- Passwords per container: `db` has `sa` only; `db-init` all three; the engine only its own; the api only
  `dq_app`'s; `examples` none. No `.env` in either image. The api's `.env` reader is off outside Development.
- Ports: the api on 127.0.0.1:5000, the database on 127.0.0.1 only, the engine on no host port.
- Images: code owned by root, processes as uid 10001 (engine) and 1654 (api); the layers hold only what the
  Dockerfiles copy.
- The generated `.env`: 24 characters of a 57-symbol alphabet (about 140 bits), mode 0600, no draft left
  behind; the values pass `check_password`, the `N'...'` literal and the SQL Server policy. The PowerShell
  generator uses a cryptographic generator without bias.
- Logins: `db-check.sh permissions` 8 of 8; `sql/` has no view, procedure or synonym, so ownership chaining
  cannot pass the `DENY`; passwords travel in the environment, never on a command line.
- The SQL path: identifiers only from the glossary's tables, typed binds, operators from the closed map with
  escaped wildcards; each of a run's two statements passes `ensure_single_select`; the results' sort by field
  checks the field against the glossary and binds the JSON path. Injected field keys and operators were
  answered `SCHEMA_VIOLATION`, injected sort fields `MALFORMED`; `%`, `_` and a bracket range in a search matched
  nothing. `/debug/compile` is 404 under every api path and off in the engine.
- Errors and logs: problem bodies carry a code and params only; no password, connection string or SQL text in
  the logs of the api, the engine, `db-init` or `examples`.
- CORS and the client: no origin configured, `*` refused, a `text/plain` POST is 415; no `innerHTML` in the
  client, and `bypassSecurityTrustHtml` only for the bundled icons.
- Limits: a 1.1 MB body is 413, JSON nested past 64 levels is 400, a list of 9,900 values validates in 0.1 s,
  a suggestions call takes 86 ms.
- The seed: all 85 national ids fail the check digit and every email is at `example.org`. `git grep` for
  passwords, keys and tokens found placeholders only.
