<#
.SYNOPSIS
  One-time setup: whisper.cpp server, Kokoro server, Python environment.
  Safe to re-run -- every step skips itself if already done.
#>

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host "==> whisper.cpp server (port 2022)" -ForegroundColor Cyan
powershell -ExecutionPolicy Bypass -File (Join-Path $root "setup\setup-whisper.ps1")

Write-Host ""
Write-Host "==> Kokoro TTS server (port 8880)" -ForegroundColor Cyan
powershell -ExecutionPolicy Bypass -File (Join-Path $root "setup\setup-kokoro.ps1")

Write-Host ""
Write-Host "==> Python environment (uv)" -ForegroundColor Cyan
if (-not (Get-Command "uv" -ErrorAction SilentlyContinue)) {
    Write-Host "[setup] uv isn't on PATH. Install it with:" -ForegroundColor Yellow
    Write-Host "  powershell -ExecutionPolicy Bypass -c `"irm https://astral.sh/uv/install.ps1 | iex`""
    Write-Host "Then re-run this script."
    exit 1
}
Push-Location $root
try {
    uv sync
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "==> Setup complete." -ForegroundColor Green
Write-Host "Launch with: .\run-voice-line.ps1"
