# Starts the whole system with Docker on Windows: SQL Server, the engine, the api with the client, and the six
# example controls. Run it through start.cmd in the repository root, which passes -ExecutionPolicy Bypass.
# Windows PowerShell 5.1; ASCII only (5.1 reads a script without a byte order mark in the ANSI code page).
#
# What it does, in order:
#   1. checks that Docker answers;
#   2. creates .env from .env.example when there is none, with three random passwords (an existing .env is
#      never changed);
#   3. docker compose up -d --build (the first build downloads base images and packages: several minutes);
#   4. waits, five minutes at most, until the app says that its database and its engine answer;
#   5. prints the address, and how to stop and how to wipe.

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'lib\env.ps1')

$WaitSeconds = 300

# docker writes its progress to the error stream, which PowerShell 5.1 turns into errors once it is
# redirected. So a quiet call goes through cmd.exe, and a visible one is not redirected at all.
function Test-Quiet {
    param([string]$Command)
    cmd.exe /d /c "$Command >nul 2>&1"
    return ($LASTEXITCODE -eq 0)
}

# The state of one service's container: "running healthy", "exited 0", or nothing when it does not exist.
function Get-ServiceState {
    param([string]$Service)
    $id = (cmd.exe /d /c "docker compose ps -aq $Service 2>nul" | Select-Object -First 1)
    if (-not $id) { return '' }
    $format = '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.ExitCode}}{{end}}'
    $state = (cmd.exe /d /c "docker inspect -f ""$format"" $id 2>nul" | Select-Object -First 1)
    if ($state) { return $state.Trim() }
    return ''
}

function Show-Failure {
    Write-Host ''
    Write-Host 'start: the system did not come up. The containers:'
    cmd.exe /d /c "docker compose ps -a 2>&1"
    foreach ($service in @('db', 'db-init', 'engine', 'api', 'examples')) {
        $state = Get-ServiceState $service
        if ($state -ne 'running healthy' -and $state -ne 'exited 0') {
            if (-not $state) { $state = 'not created' }
            Write-Host ''
            Write-Host "start: the last lines of $service ($state):"
            cmd.exe /d /c "docker compose logs --no-color --tail 25 $service 2>&1"
        }
    }
    Write-Host ''
    Write-Host 'start: a port that is taken is changed in .env (APP_PORT, DB_PORT); README.md lists what else can go wrong.'
}

Set-Location -LiteralPath $Root

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host 'start: docker was not found. Install Docker Desktop and run this again.'
    exit 1
}
if (-not (Test-Quiet 'docker info')) {
    Write-Host 'start: Docker does not answer. Start Docker Desktop, wait until it is running, and run this again.'
    exit 1
}
if (-not (Test-Quiet 'docker compose version')) {
    Write-Host 'start: docker compose (v2) was not found; it comes with Docker Desktop.'
    exit 1
}

Initialize-DcEnv $Root

Write-Host 'start: building and starting the containers (the first build takes several minutes)'
cmd.exe /d /c "docker compose up -d --build 2>&1"
if ($LASTEXITCODE -ne 0) {
    Show-Failure
    exit 1
}

$appPort = Get-DcEnvValue $Root 'APP_PORT' '5000'
$dbPort = Get-DcEnvValue $Root 'DB_PORT' '14330'

Write-Host 'start: waiting for the app'
$deadline = (Get-Date).AddSeconds($WaitSeconds)
while ($true) {
    $engine = Get-ServiceState 'engine'
    $api = Get-ServiceState 'api'
    $examples = Get-ServiceState 'examples'
    if ($api -eq 'running healthy' -and $examples -eq 'exited 0') { break }
    $loaderFailed = ($examples -like 'exited *') -and ($examples -ne 'exited 0')
    if (($engine -like 'exited*') -or ($api -like 'exited*') -or $loaderFailed) {
        Show-Failure
        exit 1
    }
    if ((Get-Date) -ge $deadline) {
        Show-Failure
        Write-Host "start: no healthy app after $WaitSeconds seconds"
        exit 1
    }
    Start-Sleep -Seconds 3
}

Write-Host ''
Write-Host 'Data Controls is running.'
Write-Host ''
Write-Host "  The app            http://localhost:$appPort"
Write-Host "  The api's pages    http://localhost:$appPort/api/docs"
Write-Host "  The database       127.0.0.1,$dbPort (SQL Server; the logins and their passwords are in .env)"
Write-Host ''
Write-Host '  Stop it            docker compose stop        (docker compose start brings it back)'
Write-Host '  Remove it          docker compose down        (the data stays in its volume)'
Write-Host '  Wipe the data too  docker compose down -v'
exit 0
