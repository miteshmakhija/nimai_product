# NimAI RFQ Generator - Stop all services
# Usage:  .\stop.ps1            (stops API, Celery, Vite)
#         .\stop.ps1 -All       (also stops Redis container)
#         .\stop.ps1 -Restart   (stop then start all services)
#         .\stop.ps1 -All -Restart  (stop including Redis, then start)
#
# Services stopped:
#   1. Vite dev server            localhost:5173
#   2. Celery worker              (celery.exe)
#   3. FastAPI server             localhost:8000
#   4. Redis (Docker container)   only with -All

param(
    [switch]$All,
    [switch]$Restart
)

$ROOT = $PSScriptRoot
$BE   = Join-Path $ROOT "backend"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   NimAI RFQ Generator - Shutting down" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

function Stop-Port {
    param([int]$Port, [string]$Label)
    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if (-not $conns) {
        Write-Host "      $Label not running (port $Port clear)." -ForegroundColor Gray
        return
    }
    for ($attempt = 0; $attempt -lt 10; $attempt++) {
        $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if (-not $conns) { break }
        foreach ($conn in $conns) {
            Write-Host "      Stopping $Label PID $($conn.OwningProcess)" -ForegroundColor Gray
            taskkill /PID $conn.OwningProcess /F /T 2>&1 | Out-Null
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Seconds 1
    }
    $still = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($still) {
        Write-Host "      WARNING: port $Port still in use (PIDs: $($still.OwningProcess -join ', '))." -ForegroundColor Red
    } else {
        Write-Host "      $Label stopped." -ForegroundColor Green
    }
}

# 1. Vite frontend (5173)
Write-Host "[1/4] Stopping Vite dev server..." -ForegroundColor Yellow
Stop-Port -Port 5173 -Label "Vite"
# Vite spawns under cmd/node; also clean stray node serving this project
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*vite*" -and $_.CommandLine -like "*RFQGenerator*" } |
    ForEach-Object {
        Write-Host "      Stopping stray Vite node PID $($_.ProcessId)" -ForegroundColor Gray
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }

# 2. Celery worker
Write-Host "[2/4] Stopping Celery worker..." -ForegroundColor Yellow
$celery = Get-CimInstance Win32_Process -Filter "Name = 'celery.exe'" -ErrorAction SilentlyContinue
if ($celery) {
    $celery | ForEach-Object {
        Write-Host "      Stopping Celery PID $($_.ProcessId)" -ForegroundColor Gray
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
    Write-Host "      Celery stopped." -ForegroundColor Green
} else {
    Write-Host "      Celery not running." -ForegroundColor Gray
}

# 3. FastAPI (8000) - kill listener + any --reload child workers from this venv
Write-Host "[3/4] Stopping FastAPI server..." -ForegroundColor Yellow
Stop-Port -port 8001 -Label "FastAPI"
Get-CimInstance Win32_Process -Filter "Name = 'uvicorn.exe' OR Name = 'python.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*app.api.main:app*" } |
    ForEach-Object {
        Write-Host "      Stopping stray uvicorn PID $($_.ProcessId)" -ForegroundColor Gray
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }

# 4. Redis (only with -All)
Write-Host "[4/4] Redis container..." -ForegroundColor Yellow
if ($All) {
    $redis = docker ps --filter "name=redis-rfq" --filter "status=running" -q 2>$null
    if ($redis) {
        docker stop redis-rfq 2>$null | Out-Null
        Write-Host "      Redis container stopped." -ForegroundColor Green
    } else {
        Write-Host "      Redis container not running." -ForegroundColor Gray
    }
} else {
    Write-Host "      Left running (use -All to stop Redis)." -ForegroundColor Gray
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   All services stopped." -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

if ($Restart) {
    Write-Host "Restarting services..." -ForegroundColor Cyan
    & (Join-Path $ROOT "start.ps1")
}
