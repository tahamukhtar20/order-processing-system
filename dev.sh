#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

log()  { echo -e "${CYAN}[dev]${RESET} $*"; }
ok()   { echo -e "${GREEN}[dev]${RESET} $*"; }
warn() { echo -e "${YELLOW}[dev]${RESET} $*"; }
err()  { echo -e "${RED}[dev]${RESET} $*" >&2; }

WORKER_PID=""
NEXT_PID=""

cleanup() {
  echo ""
  warn "Shutting down..."
  [[ -n "$WORKER_PID" ]] && kill "$WORKER_PID" 2>/dev/null && log "Stopped worker (PID $WORKER_PID)"
  [[ -n "$NEXT_PID"   ]] && kill "$NEXT_PID"   2>/dev/null && log "Stopped Next.js (PID $NEXT_PID)"

  read -rp "$(echo -e "${YELLOW}[dev]${RESET} Stop Temporal Docker containers? [y/N] ")" stop_docker
  if [[ "${stop_docker,,}" == "y" ]]; then
    docker compose -f "$ROOT/docker-compose.temporal-only.yml" down
    ok "Temporal stopped."
  else
    warn "Temporal left running. Stop it later with:"
    warn "  docker compose -f docker-compose.temporal-only.yml down"
  fi
  exit 0
}
trap cleanup INT TERM

log "Starting Temporal via Docker Compose..."
docker compose -f "$ROOT/docker-compose.temporal-only.yml" up -d

log "Waiting for Temporal gRPC on localhost:7233..."
until nc -z localhost 7233 2>/dev/null; do
  printf '.'
  sleep 1
done
echo ""
ok "Temporal is up."

sleep 3

log "Starting Temporal worker..."
(
  cd "$ROOT/temporal-worker"
  exec npm run dev 2>&1 | sed "s/^/$(printf '\033[0;35m')[worker]$(printf '\033[0m') /"
) &
WORKER_PID=$!
ok "Worker started (PID $WORKER_PID)"

log "Starting Next.js dev server..."
(
  cd "$ROOT/nextjs-app"
  exec npm run dev 2>&1 | sed "s/^/$(printf '\033[0;34m')[nextjs]$(printf '\033[0m') /"
) &
NEXT_PID=$!
ok "Next.js started (PID $NEXT_PID)"

echo ""
ok "All services running:"
echo -e "  ${GREEN}•${RESET} Next.js   -> http://localhost:3000"
echo -e "  ${GREEN}•${RESET} Temporal  -> http://localhost:8080 (UI)"
echo -e "  ${GREEN}•${RESET} gRPC      -> localhost:7233"
echo ""
warn "Press Ctrl+C to stop."

wait
