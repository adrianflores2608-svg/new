<#
.SYNOPSIS
  Launch voice-line. Run this from a real foreground terminal window --
  never as a background/scheduled service. Nobody wants a 24/7 open mic.

.EXAMPLE
  .\run-voice-line.ps1
  .\run-voice-line.ps1 --open-mic
  .\run-voice-line.ps1 --project C:\dev\my-project
#>

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Push-Location $root
try {
    if (-not (Get-Command "uv" -ErrorAction SilentlyContinue)) {
        Write-Host "[voice-line] uv isn't on PATH. Run .\setup.ps1 first." -ForegroundColor Red
        exit 1
    }
    uv run python main.py @args
} finally {
    Pop-Location
}
