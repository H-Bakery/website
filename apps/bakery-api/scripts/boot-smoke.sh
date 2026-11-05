#!/usr/bin/env bash
# Boot smoke test of the pilot API (roadmap B1):
#   bundle -> start in production mode on a fresh SQLite file -> GET /health
#   -> stop -> start again on the same file (migrations must not re-run)
#   -> GET /health -> stop.
#
# Usage (from anywhere):
#   apps/bakery-api/scripts/boot-smoke.sh
# Environment:
#   SMOKE_PORT=5099        port to listen on
#   SMOKE_SKIP_BUNDLE=1    reuse dist/apps/bakery-api/bundle/main.js
#   SMOKE_LOGIN_USER / SMOKE_LOGIN_PASSWORD
#                          additionally POST /api/auth/login and expect 200
#
# Runs in a temp directory (no .env, no repo database is touched) and kills
# only the server it started.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
BUNDLE="$ROOT/dist/apps/bakery-api/bundle/main.js"
PORT="${SMOKE_PORT:-5099}"
BASE="http://127.0.0.1:$PORT"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/bakery-boot-smoke.XXXXXX")"
LOG="$WORK/server.log"
PID=""

cleanup() {
  if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
    wait "$PID" 2>/dev/null || true
  fi
  rm -rf "$WORK"
}
trap cleanup EXIT

fail() {
  echo "[boot-smoke] FAIL: $*" >&2
  echo "[boot-smoke] --- server log ---" >&2
  cat "$LOG" >&2 || true
  exit 1
}

if [[ "${SMOKE_SKIP_BUNDLE:-}" != "1" ]]; then
  (cd "$ROOT" && node apps/bakery-api/build.mjs)
fi
[[ -f "$BUNDLE" ]] || fail "bundle not found: $BUNDLE"

JWT_SECRET="$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")"

start_server() {
  : >"$LOG"
  (
    cd "$WORK"
    NODE_ENV=production PORT="$PORT" DB_PATH="$WORK/smoke.db" \
      JWT_SECRET="$JWT_SECRET" \
      exec node --enable-source-maps "$BUNDLE"
  ) >"$LOG" 2>&1 &
  PID=$!
}

stop_server() {
  kill -TERM "$PID" 2>/dev/null || true
  for _ in $(seq 1 50); do
    kill -0 "$PID" 2>/dev/null || break
    sleep 0.2
  done
  kill -0 "$PID" 2>/dev/null && fail "server did not stop on SIGTERM"
  wait "$PID" 2>/dev/null || true
  PID=""
}

wait_for_health() {
  local body=""
  for _ in $(seq 1 60); do
    kill -0 "$PID" 2>/dev/null || fail "server exited during startup"
    if body="$(curl -fsS "$BASE/health" 2>/dev/null)"; then
      echo "$body" | grep -q '"status":"ok"' || fail "unexpected /health body: $body"
      echo "$body" | grep -q '"database":"ok"' || fail "database not ok: $body"
      echo "[boot-smoke] /health: $body"
      return 0
    fi
    sleep 0.5
  done
  fail "no answer from $BASE/health within 30 s"
}

check_login() {
  [[ -n "${SMOKE_LOGIN_USER:-}" ]] || return 0
  local status
  status="$(curl -s -o "$WORK/login.json" -w '%{http_code}' \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$SMOKE_LOGIN_USER\",\"password\":\"${SMOKE_LOGIN_PASSWORD:-}\"}" \
    "$BASE/api/auth/login")"
  [[ "$status" == "200" ]] || fail "login answered $status: $(cat "$WORK/login.json")"
  echo "[boot-smoke] login ok"
}

check_404() {
  local status
  status="$(curl -s -o "$WORK/404.json" -w '%{http_code}' "$BASE/api/gibt-es-nicht")"
  [[ "$status" == "404" ]] || fail "unknown route answered $status"
  grep -q '"message"' "$WORK/404.json" || fail "404 without message: $(cat "$WORK/404.json")"
}

echo "[boot-smoke] first start (fresh database)"
start_server
wait_for_health
check_404
check_login
stop_server

echo "[boot-smoke] second start (same database)"
start_server
wait_for_health
grep -q 'Migrations: 0 applied, 0 pending' "$LOG" ||
  fail "second start applied migrations again"
stop_server

echo "[boot-smoke] OK"
