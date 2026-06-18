# NimAI RFQ Generator - Start all services
# Usage:  .\start.ps1
#
# Prerequisites:
#   - Docker Desktop running (for Redis + Postgres)
#   - Node.js installed (for Vite)
#   - Python venv already created in .venv (root level, Python 3.12)
#
# Services started:
#   1. Redis (Docker container)   localhost:6379
#   2. FastAPI server             http://localhost:8001
#   3. Celery worker              (connects to Redis)
#   4. RFQ client app (Vite)      http://localhost:5173
#   5. Website (Vite)              http://localhost:3000

$ROOT       = $PSScriptRoot
$BE         = Join-Path $ROOT "backend"
$FE         = Join-Path $ROOT "frontend\rfq"
$WEBSITE    = Join-Path $ROOT "frontend\website"
$VENV       = Join-Path $ROOT ".venv\Scripts"
$uvicornExe   = Join-Path $VENV "uvicorn.exe"
$celeryExe    = Join-Path $VENV "celery.exe"
$apiLog       = Join-Path $BE "uvicorn.log"
$apiErrLog    = Join-Path $BE "uvicorn.err.log"
$celeryLog    = Join-Path $BE "celery.log"
$celeryErrLog = Join-Path $BE "celery.err.log"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   NimAI RFQ Generator - Starting up" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $uvicornExe)) {
    Write-Host "ERROR: Missing backend/.venv/Scripts/uvicorn.exe" -ForegroundColor Red
    Write-Host "Create backend venv and install requirements first." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $celeryExe)) {
    Write-Host "ERROR: Missing backend/.venv/Scripts/celery.exe" -ForegroundColor Red
    Write-Host "Create backend venv and install requirements first." -ForegroundColor Red
    exit 1
}

# Reset logs so readiness checks reflect current run.
# Files may be locked by a still-running prior instance; redirect truncates on
# launch anyway, so ignore lock errors here.
foreach ($log in @($apiLog, $apiErrLog, $celeryLog, $celeryErrLog)) {
    try { Set-Content -Path $log -Value "" -ErrorAction Stop } catch { }
}

# 1. Redis
Write-Host "[1/5] Checking Redis..." -ForegroundColor Yellow
$redis = docker ps --filter "name=redis-rfq" --filter "status=running" -q 2>$null
if (-not $redis) {
    Write-Host "      Starting Redis container..." -ForegroundColor Gray
    docker run -d --name redis-rfq -p 6379:6379 redis:7 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        # Container exists but stopped - restart it
        docker start redis-rfq 2>$null | Out-Null
    }
    Start-Sleep -Seconds 2
    Write-Host "      Redis started." -ForegroundColor Green
} else {
    Write-Host "      Redis already running." -ForegroundColor Green
}

# 2. Postgres check
Write-Host "[2/5] Checking Postgres on localhost:5432..." -ForegroundColor Yellow
$tcpClient = New-Object System.Net.Sockets.TcpClient
try {
    $tcpClient.Connect("localhost", 5432)
    $tcpClient.Close()
    Write-Host "      Postgres is reachable." -ForegroundColor Green
} catch {
    Write-Host "      WARNING: Postgres not reachable on port 5432." -ForegroundColor Red
    Write-Host "      Make sure Docker Desktop is running and Postgres container is up." -ForegroundColor Red
}

# 3. FastAPI
Write-Host "[3/5] Starting FastAPI server..." -ForegroundColor Yellow
# Kill ALL previous instances on port 8001. The OneDrive-synced folder breaks
# uvicorn --reload file watching, so stale workers pile up across restarts and
# keep serving old code (e.g. the approval-name enrichment bug). Loop over every
# owning PID, then sweep any stray uvicorn/python still bound to app.api.main:app.
# Loop-kill: retry until port is clear or 10 attempts exhausted
for ($attempt = 0; $attempt -lt 10; $attempt++) {
    $portConns = Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue
    if (-not $portConns) { break }
    foreach ($conn in $portConns) {
        taskkill /PID $conn.OwningProcess /F /T 2>&1 | Out-Null
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Get-CimInstance Win32_Process -Filter "Name = 'uvicorn.exe' OR Name = 'python.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like '*app.api.main:app*' } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 1
}
$still = Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue
if ($still) {
    Write-Host "      WARNING: port 8001 still in use after cleanup (PIDs: $($still.OwningProcess -join ', '))." -ForegroundColor Red
    Write-Host "      Run: netstat -ano | findstr :8001  to identify the blocker." -ForegroundColor Red
} else {
    Write-Host "      port 8001 clear." -ForegroundColor Gray
}
Start-Process -FilePath $uvicornExe `
    -ArgumentList @("app.api.main:app", "--port", "8001") `
    -WorkingDirectory $BE `
    -WindowStyle Hidden `
    -RedirectStandardOutput $apiLog `
    -RedirectStandardError $apiErrLog
$apiReady = $false
$deadline = (Get-Date).AddSeconds(40)
Write-Host "      Waiting for FastAPI to be ready..." -ForegroundColor Gray
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 2
    try {
        $health = (Invoke-WebRequest -Uri "http://localhost:8001/health" -UseBasicParsing -TimeoutSec 3).Content
        Write-Host "      FastAPI OK: $health" -ForegroundColor Green
        $apiReady = $true
        break
    } catch { }
}
if (-not $apiReady) {
    Write-Host "      FastAPI did not respond within 40s - check: $apiLog" -ForegroundColor Red
    Write-Host "      Error log: $apiErrLog" -ForegroundColor Red
}

# 4. Celery worker
Write-Host "[4/5] Starting Celery worker (pool=solo)..." -ForegroundColor Yellow
# Stop any previous Celery workers so they don't pile up
Get-CimInstance Win32_Process -Filter "Name = 'celery.exe'" -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Process -FilePath $celeryExe `
    -ArgumentList @("-A", "app.worker.tasks", "worker", "--loglevel=info", "--pool=solo") `
    -WorkingDirectory $BE `
    -WindowStyle Hidden `
    -RedirectStandardOutput $celeryLog `
    -RedirectStandardError $celeryErrLog
Start-Sleep -Seconds 5
$celeryReady = Select-String -Path $celeryLog -Pattern "ready\." -Quiet 2>$null
if ($celeryReady) {
    Write-Host "      Celery worker ready." -ForegroundColor Green
} else {
    Write-Host "      Celery starting - check: $celeryLog" -ForegroundColor Yellow
}

# 5. RFQ client app (Vite)
Write-Host "[5/6] Starting RFQ client app (Vite)..." -ForegroundColor Yellow
$viteOld = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($viteOld) {
    Stop-Process -Id $viteOld.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}
Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c npm run dev" `
    -WorkingDirectory $FE `
    -WindowStyle Normal
Start-Sleep -Seconds 3
Write-Host "      RFQ app started at http://localhost:5173" -ForegroundColor Green

# 6. Website (Vite)
Write-Host "[6/6] Starting website (Vite)..." -ForegroundColor Yellow
$craOld = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($craOld) {
    Stop-Process -Id $craOld.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}
Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c npm run dev" `
    -WorkingDirectory $WEBSITE `
    -WindowStyle Normal
Start-Sleep -Seconds 3
Write-Host "      Website started at http://localhost:3000" -ForegroundColor Green

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   All services started!" -ForegroundColor Green
Write-Host ""
Write-Host "   Website         ->  http://localhost:3000" -ForegroundColor White
Write-Host "   RFQ client app  ->  http://localhost:5173" -ForegroundColor White
Write-Host "   API             ->  http://localhost:8001" -ForegroundColor White
Write-Host "   API docs        ->  http://localhost:8001/docs" -ForegroundColor White
Write-Host ""
Write-Host "   Client login flow:" -ForegroundColor Gray
Write-Host "     1. Visit http://localhost:3000" -ForegroundColor Gray
Write-Host "     2. Click 'Client Login', enter org name (e.g. acme, varroc, ltts)" -ForegroundColor Gray
Write-Host "     3. Redirects to http://localhost:5173/login?org=<slug>" -ForegroundColor Gray
Write-Host "     4. Sign in with credentials (see TESTERS.md)" -ForegroundColor Gray
Write-Host ""
Write-Host "   Default admin: admin@nimai.ai / password!123" -ForegroundColor White
Write-Host ""
Write-Host "   Logs:" -ForegroundColor Gray
Write-Host "     API    -> $apiLog" -ForegroundColor Gray
Write-Host "     Celery -> $celeryLog" -ForegroundColor Gray
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

