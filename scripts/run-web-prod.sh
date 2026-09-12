#!/usr/bin/env bash
# Strata402 — run the Web UI in production (Next.js standalone).
# Requires the gateway (:8080) and ai-engine (:8000) to be up, plus a loaded
# .env with STRATA402_* payer variables to enable the live paid flow.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WEB_DIR="$ROOT_DIR/apps/web"
PORT="${PORT:-3000}"

cd "$WEB_DIR"
bun run build
mkdir -p .next/standalone/apps/web/.next
cp -R .next/static .next/standalone/apps/web/.next/static

echo "[Strata402] serving Web UI in production at http://localhost:${PORT}"
if [ -f "$ROOT_DIR/.env" ]; then
  # Load only well-formed KEY=VALUE lines; tolerate multi-line notes.
  while IFS='=' read -r key value; do
    case "$key" in
      '' | \#*) continue ;;
    esac
    key="$(printf '%s' "$key" | tr -d '[:space:]')"
    printf '%s' "$key" | grep -Eq '^[A-Za-z_][A-Za-z0-9_]*$' || continue
    export "$key=$value" || true
  done < "$ROOT_DIR/.env"
fi

# Safety gates must be explicit: no auto-payment without confirmation.
export STRATA402_RUN_C1="${STRATA402_RUN_C1:-false}"
export STRATA402_C1_CONFIRM="${STRATA402_C1_CONFIRM:-false}"

PORT="$PORT" HOSTNAME=0.0.0.0 exec node .next/standalone/apps/web/server.js