param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]] $CodexArgs
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$codex = Join-Path $projectRoot "node_modules\.bin\codex.cmd"
$server = Join-Path $projectRoot "codex-capture.js"
$codexHome = Join-Path $projectRoot ".codex-capture-home"
$configTemplate = Join-Path $projectRoot "config\codex-capture.toml"

if (-not (Test-Path $codex)) {
    throw "Codex CLI is not installed. Run npm install first."
}

New-Item -ItemType Directory -Force -Path $codexHome | Out-Null
Copy-Item -Force $configTemplate (Join-Path $codexHome "config.toml")
$env:CODEX_HOME = $codexHome
$captureProcess = Start-Process -FilePath (Get-Command node).Source `
    -ArgumentList $server `
    -WorkingDirectory $projectRoot `
    -NoNewWindow `
    -PassThru

try {
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try {
            Invoke-RestMethod -Uri "http://127.0.0.1:8998/health" -TimeoutSec 1 | Out-Null
            $ready = $true
            break
        } catch {
            [Threading.Thread]::Sleep(100)
        }
    }
    if (-not $ready) {
        throw "Codex capture server did not become ready."
    }

    & $codex @CodexArgs
    exit $LASTEXITCODE
} finally {
    if (-not $captureProcess.HasExited) {
        Stop-Process -Id $captureProcess.Id
    }
}