# Dot-sourced by scripts/start.ps1. Creates .env from .env.example when there is none, with a random value for
# each empty *_PASSWORD line. An existing .env is never changed. Windows PowerShell 5.1; ASCII only.

# 24 characters from letters and digits without look-alikes (no 0 O 1 l I), drawn again until an upper-case
# letter, a lower-case letter and a digit are all present: the SQL Server password policy. Letters and digits
# only, so the value passes what scripts/db-init.sh refuses (spaces, quotes, $, ; and backslash).
function New-DcPassword {
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
    $random = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
    try {
        while ($true) {
            $bytes = New-Object 'System.Byte[]' 96
            $random.GetBytes($bytes)
            $chars = New-Object System.Text.StringBuilder
            foreach ($b in $bytes) {
                # 228 is the largest multiple of the alphabet's 57 below 256: a byte above it would favour
                # the first letters.
                if ($b -lt 228 -and $chars.Length -lt 24) {
                    [void]$chars.Append($alphabet[$b % 57])
                }
            }
            $value = $chars.ToString()
            if ($value.Length -eq 24 -and $value -cmatch '[A-Z]' -and $value -cmatch '[a-z]' -and $value -cmatch '[2-9]') {
                return $value
            }
        }
    }
    finally {
        $random.Dispose()
    }
}

# Initialize-DcEnv <repository root>: says in one line what it did.
function Initialize-DcEnv {
    param([string]$Root)

    $target = Join-Path $Root '.env'
    if (Test-Path -LiteralPath $target) {
        Write-Host 'start: using the existing .env'
        return
    }
    $example = Join-Path $Root '.env.example'
    if (-not (Test-Path -LiteralPath $example)) {
        throw "start: $example is missing"
    }
    $utf8 = New-Object System.Text.UTF8Encoding $false
    $lines = [System.IO.File]::ReadAllLines($example, $utf8)
    $out = New-Object System.Collections.Generic.List[string]
    foreach ($line in $lines) {
        if ($line -cmatch '^([A-Z_]+_PASSWORD)=$') {
            $out.Add($Matches[1] + '=' + (New-DcPassword))
        }
        else {
            $out.Add($line)
        }
    }
    # LF line ends and no byte order mark: docker compose and the Linux containers read this file.
    [System.IO.File]::WriteAllText($target, (($out -join "`n") + "`n"), $utf8)
    Write-Host 'start: created .env with three random passwords (they are in that file and are not printed)'
}

# Get-DcEnvValue <repository root> <KEY> <default>: the value in the environment, else in .env, else the default.
function Get-DcEnvValue {
    param([string]$Root, [string]$Key, [string]$Default)

    $fromEnvironment = [System.Environment]::GetEnvironmentVariable($Key)
    if ($fromEnvironment) {
        return $fromEnvironment
    }
    $value = ''
    $target = Join-Path $Root '.env'
    if (Test-Path -LiteralPath $target) {
        foreach ($line in [System.IO.File]::ReadAllLines($target)) {
            if ($line.StartsWith($Key + '=')) {
                $value = $line.Substring($Key.Length + 1).Trim()
            }
        }
    }
    if ($value) { return $value }
    return $Default
}
