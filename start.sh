#!/usr/bin/env bash
#
# Strata402 — one-command local run.
#
# Confirmed working on macOS (darwin). Starts, in order:
#   1. api-gateway  :8080  (bun services/api-gateway/src/index.ts)
#   2. ai-engine    :8000  (uvicorn app.main:app in services/ai-engine/.venv)
#   3. web (prod)   :3000  (Next.js standalone build, server-side payer enabled)
#
# Every process that is already healthy is left untouched, so re-running the
# script is safe. The web standalone build is regenerated automatically when
# `.next/standalone` is missing (e.g. after a `next dev` wiped it).
#
# Usage:
#   ./start.sh          # run everything, paid flow ON (0.01 HBAR/call real testnet)
#   STRATA402_RUN_C1=false ./start.sh   # override: keep paid flow closed
#
# NOTE: `next dev` overwrites .next/standalone. If you used dev mode, re-run
# ./start.sh to rebuild and bring the production server back on :3000.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$ROOT/apps/web"
LOG_DIR="${STRATA402_LOG_DIR:-/tmp}"

echo "==> Strata402 start · root=$ROOT"

# ---- Load only real KEY=VALUE lines from .env (ignore portal doc blocks) ----
load_env_keyval() {
  while IFS= read -r line; do
    case "$line" in
      '' | '#'*) continue ;;
    esac
    if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      export "$line"
    fi
  done <"$1"
}
if [[ -f "$ROOT/.env" ]]; then
  load_env_keyval "$ROOT/.env"
fi

# ---- 1. api-gateway :8080 ----
if curl -s -o /dev/null --max-time 2 http://127.0.0.1:8080/health; then
  echo "==> gateway :8080        already healthy — skip"
else
  echo "==> starting api-gateway :8080 ..."
  (cd "$ROOT" && nohup bun services/api-gateway/src/index.ts >"$LOG_DIR/strata402-gateway.log" 2>&1 &)
fi

# ---- 2. ai-engine :8000 ----
if curl -s -o /dev/null --max-time 2 http://127.0.0.1:8000/health; then
  echo "==> ai-engine :8000      already healthy — skip"
else
  VENV="$ROOT/services/ai-engine/.venv/bin/uvicorn"
  if [[ -x "$VENV" ]]; then
    echo "==> starting ai-engine :8000 ..."
    (cd "$ROOT/services/ai-engine" && nohup "$VENV" app.main:app >"$LOG_DIR/strata402-ai-engine.log" 2>&1 &)
  else
    echo "==> ai-engine: venv missing at $VENV — create it (see services/ai-engine/README.md)"
  fi
fi

# ---- 3. web :3000 (production standalone, server-side payer) ----
do_web_build=false
if [[ ! -x "$WEB_DIR/.next/standalone/apps/web/server.js" ]]; then
  do_web_build=true
elif [[ -d "$WEB_DIR/src" && "$(find "$WEB_DIR/src" "$WEB_DIR/next.config.mjs" "$WEB_DIR/package.json" -newer "$WEB_DIR/.next/standalone/apps/web/server.js" 2>/dev/null | head -1)" != "" ]]; then
  do_web_build=true
fi

if curl -s -o /dev/null --max-time 2 http://127.0.0.1:3000/; then
  echo "==> web :3000           already responding — skip (re-run after code changes)"
else
  if [[ "$do_web_build" == true ]]; then
    echo "==> building web (standalone) ..."
    (cd "$WEB_DIR" && bun run build) || { echo "!! web build failed" >&2; exit 1; }
    cp -R "$WEB_DIR/.next/static" "$WEB_DIR/.next/standalone/apps/web/.next/static"
  fi
  echo "==> starting web :3000 ..."
  (cd "$WEB_DIR" \
    && export STRATA402_RUN_C1="${STRATA402_RUN_C1:-true}" \
    && export STRATA402_C1_CONFIRM="${STRATA402_C1_CONFIRM:-true}" \
    && HOSTNAME=0.0.0.0 PORT=3000 NODE_ENV=production \
       nohup bun .next/standalone/apps/web/server.js >"$LOG_DIR/strata402-web.log" 2>&1 &)
fi

echo
echo "==> waiting for health ..."
for _ in $(seq 1 15); do
  gateway=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:8080/health || true)
  ai=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:8000/health || true)
  web=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:3000/ || true)
  [[ "$gateway" == "200" && "$ai" == "200" && "$web" == "200" ]] && break
  sleep 1
done

echo " gateway :8080 HTTP $gateway"
echo " aiengine:8000 HTTP $ai"
echo " web    :3000 HTTP $web"
echo
echo " Open http://localhost:3000  · paid flow runs REAL 0.01 HBAR testnet settlements."
echo " Stop:  kill \$(lsof -ti:3000) etc. — or 'pkill -f strata402' mindful of other sessions."