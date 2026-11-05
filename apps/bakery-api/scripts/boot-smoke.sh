#!/usr/bin/env bash
# Boot smoke test of the pilot API (roadmap B1, B3):
#   bundle -> create-user CLI on a fresh SQLite file (twice: create, then the
#   idempotent reset with a new password) -> start in production mode
#   -> GET /health -> guard (401 without session) -> login -> /api/auth/me,
#   /api/partners, JSON 404 with a session -> stop -> start again on the same
#   file (migrations must not re-run) -> GET /health + login -> stop.
#
# Usage (from anywhere):
#   apps/bakery-api/scripts/boot-smoke.sh
# Environment:
#   SMOKE_PORT=5099        port to listen on
#   SMOKE_SKIP_BUNDLE=1    reuse dist/apps/bakery-api/bundle/{main,cli}.js
#
# The account is created per run with a random password; there is no default
# account in the API (B3).
#
# Runs in a temp directory (no .env, no repo database is touched) and kills
# only the server it started.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
BUNDLE="$ROOT/dist/apps/bakery-api/bundle/main.js"
CLI="$ROOT/dist/apps/bakery-api/bundle/cli.js"
SMOKE_USER="smoke.inhaber"
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
[[ -f "$CLI" ]] || fail "CLI bundle not found: $CLI"

random_hex() {
  node -e "process.stdout.write(require('crypto').randomBytes(${1:-32}).toString('hex'))"
}
JWT_SECRET="$(random_hex 32)"
SMOKE_PASSWORD=""

create_user() {
  # $1 = role. Production mode, same DB_PATH as the server; the password comes
  # through stdin (the CLI reads the first line when stdin is not a terminal).
  local role="$1" out
  if ! out="$(
    cd "$WORK" &&
      printf '%s\n' "$SMOKE_PASSWORD" |
      NODE_ENV=production DB_PATH="$WORK/smoke.db" \
        node --enable-source-maps "$CLI" create-user \
        --username "$SMOKE_USER" --display-name "Smoke Test" --role "$role" 2>&1
  )"; then
    echo "$out" >&2
    fail "create-user failed"
  fi
  echo "[boot-smoke] create-user: $(echo "$out" | tail -n 1)"
}

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

TOKEN=""

# $1 = expected status, $2 = path, $3 = what; with a session when TOKEN is set.
expect_status() {
  local expected="$1" path="$2" what="$3" status
  local auth=()
  [[ -n "$TOKEN" ]] && auth=(-H "Authorization: Bearer $TOKEN")
  status="$(curl -s -o "$WORK/resp.json" -w '%{http_code}' ${auth[@]+"${auth[@]}"} "$BASE$path")"
  [[ "$status" == "$expected" ]] ||
    fail "$what: $path answered $status, expected $expected: $(cat "$WORK/resp.json")"
  if [[ "$expected" -ge 400 ]]; then
    grep -q '"message"' "$WORK/resp.json" || fail "$what without message: $(cat "$WORK/resp.json")"
    grep -q '"error"' "$WORK/resp.json" || fail "$what without error: $(cat "$WORK/resp.json")"
  fi
}

login() {
  local status
  status="$(curl -s -o "$WORK/login.json" -w '%{http_code}' \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$SMOKE_USER\",\"password\":\"$SMOKE_PASSWORD\"}" \
    "$BASE/api/auth/login")"
  [[ "$status" == "200" ]] || fail "login answered $status: $(cat "$WORK/login.json")"
  TOKEN="$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')).data.token)" "$WORK/login.json")"
  [[ -n "$TOKEN" ]] || fail "login without token: $(cat "$WORK/login.json")"
  echo "[boot-smoke] login ok"
}

echo "[boot-smoke] create-user on a fresh database (create, then idempotent reset)"
SMOKE_PASSWORD="$(random_hex 12)"
create_user verkauf
SMOKE_PASSWORD="$(random_hex 12)"
create_user inhaber

echo "[boot-smoke] first start"
start_server
wait_for_health
TOKEN=""
expect_status 401 /api/partners "guard without session"
expect_status 401 /api/gibt-es-nicht "guard without session"
login
expect_status 200 /api/auth/me "me"
grep -q '"role":"inhaber"' "$WORK/resp.json" || fail "reset did not apply the role: $(cat "$WORK/resp.json")"
expect_status 200 /api/partners "partners with session"
expect_status 404 /api/gibt-es-nicht "unknown route with session"
stop_server

echo "[boot-smoke] second start (same database)"
start_server
wait_for_health
grep -q 'Migrations: 0 applied, 0 pending' "$LOG" ||
  fail "second start applied migrations again"
TOKEN=""
login
stop_server

echo "[boot-smoke] OK"
