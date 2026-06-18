#!/usr/bin/env bash
# NimAI — Start all services on Ubuntu/Linux (AWS)
# Usage: ./start.sh
#
# Prerequisites:
#   - Docker installed & running (for Redis)
#   - Postgres running (RDS or local Docker container)
#   - Python 3.12 with venv created at .venv/
#   - Node.js 18+ and npm installed
#   - backend/.env file configured (copy from backend/.env.example)
#
# Services started:
#   1. Redis       (Docker)          localhost:6379
#   2. FastAPI     (uvicorn)         0.0.0.0:8001
#   3. Celery      (worker)          connects to Redis
#   4. RFQ app     (Vite)            0.0.0.0:5173
#   5. Website     (Vite)            0.0.0.0:3000

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BE="$ROOT/backend"
FE="$ROOT/frontend/rfq"
WEBSITE="$ROOT/frontend/website"
VENV="$ROOT/.venv/bin"
UVICORN="$VENV/uvicorn"
CELERY_BIN="$VENV/celery"

API_LOG="$BE/uvicorn.log"
API_ERR="$BE/uvicorn.err.log"
CELERY_LOG="$BE/celery.log"
CELERY_ERR="$BE/celery.err.log"
RFQ_LOG="$FE/vite.log"
WEB_LOG="$WEBSITE/vite.log"

# ── Colours ──────────────────────────────────────────────────────────────────
CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
RED='\033[0;31m';  GRAY='\033[0;90m';  BOLD='\033[1m';  NC='\033[0m'

log()  { echo -e "$1"; }
ok()   { echo -e "      ${GREEN}$1${NC}"; }
warn() { echo -e "      ${YELLOW}$1${NC}"; }
err()  { echo -e "      ${RED}$1${NC}"; }
info() { echo -e "      ${GRAY}$1${NC}"; }

log ""
log "${CYAN}==========================================${NC}"
log "${CYAN}${BOLD}   NimAI — Starting all services          ${NC}"
log "${CYAN}==========================================${NC}"
log ""

# ── Pre-flight checks ─────────────────────────────────────────────────────────
PREFLIGHT_OK=true

if [ ! -f "$UVICORN" ]; then
    err "Missing .venv/bin/uvicorn"
    err "Setup: python3 -m venv .venv && source .venv/bin/activate && pip install -r backend/requirements.txt"
    PREFLIGHT_OK=false
fi

if [ ! -f "$CELERY_BIN" ]; then
    err "Missing .venv/bin/celery"
    PREFLIGHT_OK=false
fi

if [ ! -f "$BE/.env" ]; then
    err "Missing backend/.env — copy backend/.env.example and fill in your values"
    PREFLIGHT_OK=false
fi

if ! command -v docker &>/dev/null; then
    warn "docker not found — Redis will not be started automatically"
fi

if ! command -v node &>/dev/null || ! command -v npm &>/dev/null; then
    err "node / npm not found — install Node.js 18+ first"
    PREFLIGHT_OK=false
fi

if [ "$PREFLIGHT_OK" = false ]; then
    log ""
    err "Pre-flight checks failed. Fix the errors above and re-run."
    exit 1
fi

# ── Helper: kill anything listening on a given port ───────────────────────────
kill_port() {
    local port=$1
    local pids
    pids=$(ss -tlnp "sport = :${port}" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | sort -u)
    if [ -n "$pids" ]; then
        echo "$pids" | xargs -r kill -9 2>/dev/null || true
        sleep 1
    fi
}

# ── 1. Redis ──────────────────────────────────────────────────────────────────
log "${YELLOW}[1/5] Checking Redis...${NC}"
if command -v docker &>/dev/null; then
    if docker ps --filter "name=redis-rfq" --filter "status=running" -q 2>/dev/null | grep -q .; then
        ok "Redis already running."
    else
        info "Starting Redis container..."
        if ! docker run -d --name redis-rfq -p 6379:6379 redis:7 2>/dev/null; then
            docker start redis-rfq 2>/dev/null || true
        fi
        sleep 2
        ok "Redis started."
    fi
else
    warn "Docker unavailable — assuming Redis is already running on port 6379."
fi

# ── 2. Postgres check ─────────────────────────────────────────────────────────
log "${YELLOW}[2/5] Checking Postgres on port 5432...${NC}"
if (echo >/dev/tcp/localhost/5432) 2>/dev/null; then
    ok "Postgres is reachable."
else
    warn "Postgres not reachable on port 5432 — check your DATABASE_URL in backend/.env"
fi

# ── 3. Alembic migrations ─────────────────────────────────────────────────────
log "${YELLOW}[3/5] Applying Alembic migrations...${NC}"
cd "$BE"
if "$VENV/alembic" upgrade head >> "$BE/alembic.log" 2>&1; then
    ok "Migrations applied (or already up to date)."
else
    warn "Alembic migration failed — check $BE/alembic.log"
fi
cd "$ROOT"

# ── 4. FastAPI ────────────────────────────────────────────────────────────────
log "${YELLOW}[4/5] Starting FastAPI server on :8001...${NC}"
kill_port 8001
: > "$API_LOG"; : > "$API_ERR"

cd "$BE"
nohup "$UVICORN" app.api.main:app \
    --host 0.0.0.0 --port 8001 --workers 2 \
    > "$API_LOG" 2> "$API_ERR" &
echo $! > "$BE/.uvicorn.pid"
cd "$ROOT"

info "Waiting for FastAPI to be ready (up to 40s)..."
API_READY=false
for _ in $(seq 1 20); do
    sleep 2
    if curl -sf http://localhost:8001/health >/dev/null 2>&1; then
        HEALTH=$(curl -s http://localhost:8001/health)
        ok "FastAPI ready: $HEALTH"
        API_READY=true
        break
    fi
done
if [ "$API_READY" = false ]; then
    err "FastAPI did not respond within 40s"
    err "Check: $API_LOG"
    err "Error: $API_ERR"
fi

# ── 5. Celery worker ──────────────────────────────────────────────────────────
log "${YELLOW}[5/5] Starting Celery worker...${NC}"
pkill -f "app.worker.tasks" 2>/dev/null || true
sleep 1
: > "$CELERY_LOG"; : > "$CELERY_ERR"

cd "$BE"
nohup "$CELERY_BIN" -A app.worker.tasks worker \
    --loglevel=info \
    > "$CELERY_LOG" 2> "$CELERY_ERR" &
echo $! > "$BE/.celery.pid"
cd "$ROOT"

sleep 5
if grep -q "ready\." "$CELERY_LOG" 2>/dev/null; then
    ok "Celery worker ready."
else
    warn "Celery still starting — check: $CELERY_LOG"
fi

# ── 6. RFQ client app (Vite) ──────────────────────────────────────────────────
log "${YELLOW}[6/6] Starting RFQ client app on :5173...${NC}"
kill_port 5173
: > "$RFQ_LOG"

cd "$FE"
nohup npm run dev -- --host 0.0.0.0 --port 5173 \
    > "$RFQ_LOG" 2>&1 &
echo $! > "$FE/.vite.pid"
cd "$ROOT"
sleep 3
ok "RFQ app started."

# ── 7. Website (Vite) ─────────────────────────────────────────────────────────
log "${YELLOW}[7/7] Starting website on :3000...${NC}"
kill_port 3000
: > "$WEB_LOG"

cd "$WEBSITE"
nohup npm run dev -- --host 0.0.0.0 --port 3000 \
    > "$WEB_LOG" 2>&1 &
echo $! > "$WEBSITE/.vite.pid"
cd "$ROOT"
sleep 3
ok "Website started."

# ── Summary ───────────────────────────────────────────────────────────────────
PUBLIC_IP=$(curl -sf http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "<your-server-ip>")

log ""
log "${CYAN}==========================================${NC}"
log "${GREEN}${BOLD}   All services started!${NC}"
log ""
log "   ${BOLD}Website${NC}         ->  http://${PUBLIC_IP}:3000"
log "   ${BOLD}RFQ client app${NC}  ->  http://${PUBLIC_IP}:5173"
log "   ${BOLD}API${NC}             ->  http://${PUBLIC_IP}:8001"
log "   ${BOLD}API docs${NC}        ->  http://${PUBLIC_IP}:8001/docs"
log ""
log "${GRAY}   Client login flow:${NC}"
log "${GRAY}     1. Visit http://${PUBLIC_IP}:3000${NC}"
log "${GRAY}     2. Click 'Client Login', enter org (acme, varroc, ltts)${NC}"
log "${GRAY}     3. Redirects to http://${PUBLIC_IP}:5173/login?org=<slug>${NC}"
log "${GRAY}     4. Sign in with credentials from TESTERS.md${NC}"
log ""
log "   ${BOLD}Default admin:${NC} admin@nimai.ai / password!123"
log ""
log "${GRAY}   Logs:${NC}"
log "${GRAY}     API      -> $API_LOG${NC}"
log "${GRAY}     API err  -> $API_ERR${NC}"
log "${GRAY}     Celery   -> $CELERY_LOG${NC}"
log "${GRAY}     RFQ app  -> $RFQ_LOG${NC}"
log "${GRAY}     Website  -> $WEB_LOG${NC}"
log ""
log "${YELLOW}   AWS Security Group — ensure these inbound ports are open:${NC}"
log "${GRAY}     TCP 3000  (Website)${NC}"
log "${GRAY}     TCP 5173  (RFQ app)${NC}"
log "${GRAY}     TCP 8001  (API)${NC}"
log "${CYAN}==========================================${NC}"
log ""
