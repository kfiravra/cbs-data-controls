# Platform facts read on 2026-11-10 (planning)

Each line: the fact, how sure, the source. "Memory" means no source was read; confirm before relying on it.

## Confirmed by a source

- .NET 10 container images: the default tags (`10.0`) are Ubuntu 24.04; Debian images are no longer published.
  https://learn.microsoft.com/dotnet/core/compatibility/containers/10.0/default-images-use-ubuntu
- The aspnet runtime image carries no curl (third-party reports; the chiseled variant has no shell either).
  https://forums.docker.com/t/best-approach-for-docker-health-checks-in-net-containers-without-curl-wget/151820
- Microsoft publishes `msodbcsql18` for Debian 13; the 17 driver is not offered there, and a `python:3.13` image
  that moved to Debian 13 broke an `msodbcsql17` install. Pinning `-bookworm` keeps the Debian 12 instructions.
  https://learn.microsoft.com/sql/connect/odbc/download-odbc-driver-for-sql-server
  https://learn.microsoft.com/en-us/answers/questions/5523563/unable-to-locate-package-msodbcsql17-when-installi
  https://learn.microsoft.com/sql/connect/odbc/linux-mac/installing-the-microsoft-odbc-driver-for-sql-server
- `uv pip compile` resolves for another platform and Python version with `--python-platform` and
  `--python-version`. https://docs.astral.sh/uv/concepts/resolution/
- `docker compose up --wait` has been reported to exit 1 when an init container exits 0.
  https://forums.docker.com/t/behavior-of-up-wait-changed/147699
- Compose ports: the host part is optional and the long syntax has `published` and `host_ip`.
  https://docs.docker.com/get-started/docker-concepts/running-containers/publishing-ports/
- Windows client default PowerShell execution policy is Restricted; `Unblock-File` removes the Zone.Identifier
  stream and does not change the policy.
  https://learn.microsoft.com/en-us/previous-versions/powershell/module/microsoft.powershell.core/about/about_execution_policies?view=powershell-4.0
  https://learn.microsoft.com/en-us/PowerShell/module/microsoft.powershell.utility/unblock-file?view=powershell-7.4
- SQL Server Native Client is not part of SQL Server 2022. https://www.github.com/tediousjs/node-mssql/issues/1474

## From memory, not confirmed

- pip evaluates environment markers for the interpreter it runs on, also under `--platform`. (Why the bundle
  compiles one requirement list per platform and version and downloads with `--no-deps`.)
- Python 3.12 has been security-only since April 2025; 3.12.10 was the last release with a Windows installer.
- A SQL Server 2019 or 2022 install on Windows adds "ODBC Driver 17 for SQL Server" and `sqlcmd`.
- SQL Server Express Basic install: Windows authentication only, instance `SQLEXPRESS`, TCP/IP disabled, shared
  memory enabled.
- SQL Server 2022 Express supports Windows 10 Home.
  https://learn.microsoft.com/sql/sql-server/install/hardware-and-software-requirements-for-installing-sql-server-2022
  (the page was found, the Home row was not read)
- Windows PowerShell 5.1 reads a script without a BOM in the ANSI code page.
- Explorer's "Extract all" copies the Mark of the Web to every extracted file; a `.cmd` launched from cmd.exe does
  not go through SmartScreen the way a double click does.
- Docker Desktop needs a paid subscription in government bodies, one more reason to expect graders without it.
