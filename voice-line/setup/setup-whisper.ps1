<#
.SYNOPSIS
  Best-effort setup for a local whisper.cpp server on port 2022, exposing
  the OpenAI-style /v1/audio/transcriptions route that ears.py calls.
  NOT /inference -- that route 404s on this OpenAI-shaped multipart request.

.DESCRIPTION
  1. Skips everything if something is already answering on port 2022.
  2. Clones and builds whisper.cpp (CMake), using CUDA if an NVIDIA GPU is
     detected, else CPU.
  3. Downloads a small English model (ggml-base.en.bin) if not present.
  4. Launches whisper-server in its own window.

  Building whisper.cpp needs Git, CMake, and a C++ toolchain (Visual Studio
  Build Tools). If any of those are missing, this script prints exact
  install commands and stops rather than guessing.
#>

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$vendorDir = Join-Path $root "vendor\whisper.cpp"
$modelsDir = Join-Path $vendorDir "models"
$modelPath = Join-Path $modelsDir "ggml-base.en.bin"
$port = 2022

function Test-PortOpen($portNumber) {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $result = $client.BeginConnect("127.0.0.1", $portNumber, $null, $null)
        $ok = $result.AsyncWaitHandle.WaitOne(1000)
        $client.Close()
        return $ok
    } catch {
        return $false
    }
}

if (Test-PortOpen $port) {
    Write-Host "[setup-whisper] something is already listening on port $port -- assuming whisper server is up. Nothing to do."
    exit 0
}

function Require-Command($name, $installHint) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        Write-Host "[setup-whisper] missing required tool: $name" -ForegroundColor Yellow
        Write-Host "  Install it with: $installHint"
        return $false
    }
    return $true
}

$ok = $true
$ok = (Require-Command "git" "winget install Git.Git") -and $ok
$ok = (Require-Command "cmake" "winget install Kitware.CMake") -and $ok
if (-not (Get-Command "cl" -ErrorAction SilentlyContinue) -and -not (Get-Command "cl.exe" -ErrorAction SilentlyContinue)) {
    Write-Host "[setup-whisper] no C++ compiler (cl.exe) found on PATH." -ForegroundColor Yellow
    Write-Host "  Install Visual Studio Build Tools (`"Desktop development with C++`" workload), then re-run this"
    Write-Host "  script from a `"Developer PowerShell for VS`" prompt so cl.exe is on PATH."
    Write-Host "  winget install Microsoft.VisualStudio.2022.BuildTools"
    $ok = $false
}

if (-not $ok) {
    Write-Host ""
    Write-Host "[setup-whisper] install the above, then re-run: powershell -File setup\setup-whisper.ps1"
    exit 1
}

if (-not (Test-Path $vendorDir)) {
    Write-Host "[setup-whisper] cloning ggml-org/whisper.cpp..."
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $vendorDir) | Out-Null
    git clone --depth 1 https://github.com/ggml-org/whisper.cpp $vendorDir
}

$hasCuda = $false
if (Get-Command "nvidia-smi" -ErrorAction SilentlyContinue) {
    Write-Host "[setup-whisper] NVIDIA GPU detected -- building with CUDA acceleration."
    $hasCuda = $true
} else {
    Write-Host "[setup-whisper] no NVIDIA GPU detected -- building for CPU."
}

Push-Location $vendorDir
try {
    $cudaFlag = if ($hasCuda) { "-DGGML_CUDA=ON" } else { "-DGGML_CUDA=OFF" }
    Write-Host "[setup-whisper] configuring (cmake -B build $cudaFlag)..."
    cmake -B build $cudaFlag -DCMAKE_BUILD_TYPE=Release
    Write-Host "[setup-whisper] building (this can take a while the first time)..."
    cmake --build build --config Release -j
} finally {
    Pop-Location
}

$serverExe = Get-ChildItem -Path (Join-Path $vendorDir "build") -Recurse -Filter "whisper-server.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $serverExe) {
    Write-Host "[setup-whisper] build finished but whisper-server.exe wasn't found under build\. Check the build log above for errors." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $modelPath)) {
    Write-Host "[setup-whisper] downloading ggml-base.en.bin (small English model)..."
    New-Item -ItemType Directory -Force -Path $modelsDir | Out-Null
    Invoke-WebRequest -Uri "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin" -OutFile $modelPath
}

Write-Host "[setup-whisper] starting whisper-server on port $port in a new window..."
$launchCmd = "`"$($serverExe.FullName)`" -m `"$modelPath`" --host 127.0.0.1 --port $port"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$($serverExe.DirectoryName)'; $launchCmd" -WindowStyle Normal

Start-Sleep -Seconds 2
if (Test-PortOpen $port) {
    Write-Host "[setup-whisper] whisper server is up on port $port." -ForegroundColor Green
} else {
    Write-Host "[setup-whisper] launched, but port $port isn't answering yet -- check the new window for errors." -ForegroundColor Yellow
}
