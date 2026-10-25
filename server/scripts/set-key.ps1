# Puts your Anthropic API key into server/.env WITHOUT it ever being typed into chat or printed.
# 1. Copy the key (sk-ant-...) to your clipboard.
# 2. From the server folder run:  powershell -ExecutionPolicy Bypass -File scripts/set-key.ps1
# It reads the clipboard, writes ANTHROPIC_API_KEY into .env (keeping other lines), then clears the clipboard.

$ErrorActionPreference = "Stop"
$envPath = Join-Path $PSScriptRoot "..\.env"
$examplePath = Join-Path $PSScriptRoot "..\.env.example"

$key = (Get-Clipboard -Raw)
if ($null -eq $key) { $key = "" }
$key = $key.Trim()
if ($key -notmatch '^sk-ant-[A-Za-z0-9_\-]{20,}$') {
    Write-Host "Clipboard doesn't contain an Anthropic key (should start with sk-ant-). Nothing changed."
    exit 1
}

if (Test-Path $envPath) { $lines = [System.IO.File]::ReadAllLines($envPath) }
else { $lines = [System.IO.File]::ReadAllLines($examplePath) }

function Set-Line([string[]]$ls, [string]$name, [string]$value) {
    $found = $false
    $out = foreach ($l in $ls) {
        if ($l -match "^$name=") { $found = $true; "$name=$value" } else { $l }
    }
    if (-not $found) { $out = @($out) + "$name=$value" }
    return ,@($out)
}

$lines = Set-Line $lines "ANTHROPIC_API_KEY" $key

# UTF-8 without BOM so dotenv reads the first line correctly
[System.IO.File]::WriteAllLines((Resolve-Path -LiteralPath (Split-Path $envPath)).Path + "\.env", $lines, (New-Object System.Text.UTF8Encoding($false)))
Set-Clipboard -Value " "

$masked = $key.Substring(0, 10) + "..." + $key.Substring($key.Length - 4)
Write-Host "Saved ANTHROPIC_API_KEY ($masked) to server/.env. Clipboard cleared."
