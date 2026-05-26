#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

log()  { echo -e "${CYAN}[prod]${RESET} $*"; }
ok()   { echo -e "${GREEN}[prod]${RESET} $*"; }
warn() { echo -e "${YELLOW}[prod]${RESET} $*"; }
err()  { echo -e "${RED}[prod]${RESET} $*" >&2; }

cleanup() {
  local exit_code=$?
  echo ""
  if [[ -t 0 ]]; then
    read -rp "$(echo -e "${YELLOW}[prod]${RESET} Stop all containers? [y/N] ")" stop_all
    if [[ "${stop_all,,}" == "y" ]]; then
      docker compose -f "$ROOT/docker-compose.yml" down
      ok "All containers stopped."
    else
      warn "Containers left running. Stop with:"
      warn "  docker compose down"
    fi
  fi
  exit "$exit_code"
}
trap cleanup INT TERM

log "Building and starting full stack via Docker Compose..."
docker compose -f "$ROOT/docker-compose.yml" up --build -d

log "Waiting for Next.js on localhost:3000..."
until curl -sf http://localhost:3000 >/dev/null 2>&1; do
  printf '.'
  sleep 2
done
echo ""

ok "All services running:"
echo -e "  ${GREEN}*${RESET} Next.js     -> http://localhost:3000"
echo -e "  ${GREEN}*${RESET} Temporal UI -> http://localhost:8080"
echo -e "  ${GREEN}*${RESET} gRPC        -> localhost:7233"
echo ""
log "Tailing container logs (Ctrl+C to stop)..."
echo ""

docker compose -f "$ROOT/docker-compose.yml" logs -f worker nextjs
