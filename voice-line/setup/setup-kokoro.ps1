<#
.SYNOPSIS
  Best-effort setup for a local Kokoro TTS server on port 8880, exposing
  /v1/audio/speech, via the kokoro-fastapi Docker image.

.DESCRIPTION
  1. Skips everything if something is already answering on port 8880.
  2. Requires Docker Desktop (the simplest reliable way to run
     kokoro-fastapi on Windows, with or without a GPU).
  3. Runs the GPU image if an NVIDIA GPU + the NVIDIA Container Toolkit are
     available, otherwise the CPU image.
#>

$ErrorActionPreference = "Stop"
$port = 8880
$containerName = "voice-line-kokoro"

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
    Write-Host "[setup-kokoro] something is already listening on port $port -- assuming Kokoro is up. Nothing to do."
    exit 0
}

if (-not (Get-Command "docker" -ErrorAction SilentlyContinue)) {
    Write-Host "[setup-kokoro] Docker isn't on PATH." -ForegroundColor Yellow
    Write-Host "  Install Docker Desktop: winget install Docker.DockerDesktop"
    Write-Host "  After installing, start Docker Desktop once, then re-run this script."
    Write-Host ""
    Write-Host "  (No Docker? kokoro-fastapi can also be run directly with Python --"
    Write-Host "   see https://github.com/remsky/Kokoro-FastAPI for the non-Docker path.)"
    exit 1
}

$existing = docker ps -a --filter "name=$containerName" --format "{{.Names}}" 2>$null
if ($existing -eq $containerName) {
    Write-Host "[setup-kokoro] starting existing container '$containerName'..."
    docker start $containerName | Out-Null
} else {
    $image = "ghcr.io/remsky/kokoro-fastapi-cpu:latest"
    $gpuArgs = @()
    if (Get-Command "nvidia-smi" -ErrorAction SilentlyContinue) {
        Write-Host "[setup-kokoro] NVIDIA GPU detected -- using the GPU image."
        $image = "ghcr.io/remsky/kokoro-fastapi-gpu:latest"
        $gpuArgs = @("--gpus", "all")
    } else {
        Write-Host "[setup-kokoro] no NVIDIA GPU detected -- using the CPU image."
    }
    Write-Host "[setup-kokoro] pulling and starting $image..."
    docker run -d --name $containerName @gpuArgs -p "${port}:8880" $image | Out-Null
}

Write-Host "[setup-kokoro] waiting for the server to come up..."
$upped = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    if (Test-PortOpen $port) {
        $upped = $true
        break
    }
}

if ($upped) {
    Write-Host "[setup-kokoro] Kokoro is up on port $port." -ForegroundColor Green
} else {
    Write-Host "[setup-kokoro] container started but port $port isn't answering yet." -ForegroundColor Yellow
    Write-Host "  Check logs with: docker logs $containerName"
}
