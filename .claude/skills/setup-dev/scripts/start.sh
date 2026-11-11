#!/bin/bash
# bakery-dev: one isolated instance of the ref checked out in $STATE/tree (up.sh):
# real API bundle on a fresh SQLite DB + synthetic hq (git: bare origin, read clone, write clone
# on app/edits + snapshot worktree on main, fake GitHub for the rolling PR), `next start` of the
# production management build (pilot or full), and a second app on <secondPort>.
#
#   start.sh <name> <mgmtPort> <secondPort> <apiPort> [--mode pilot|full] [--second delivery|shop|landing|none] [--public-catalogue]
#
#   --mode      pilot (default) = dist/apps/bakery-management-pilot (NEXT_PUBLIC_PILOT_MODE=1),
#               full = dist/apps/bakery-management-full
#   --second    app on secondPort (default delivery = Fahrer-App). Swap later with
#               second.sh <name> <kind> (API stays). shop implies --public-catalogue.
#   --public-catalogue  API with PUBLIC_CATALOGUE=1 (anonymous GET /api/products, the shop needs it)
#
# WEB_HOSTNAME (default localhost) = `next start --hostname` for both web apps (see w4-verify:
# 127.0.0.1 reproduces the box, where Next proxies its internal rewrites to localhost -> ::1).
# Nominatim and OSRM point at a closed port (127.0.0.1:9): every delivery route is an estimate.
# Builds are NOT done here (build.sh). Wipes and recreates $STATE/<name>/.
set -euo pipefail

W="$(cd "$(dirname "$0")" && pwd)"
source "$W/lib/paths.inc.sh"
USAGE="usage: start.sh <name> <mgmtPort> <secondPort> <apiPort> [--mode pilot|full] [--second delivery|shop|landing|none] [--public-catalogue]"
NAME="${1:?$USAGE}"
WEB_PORT="${2:?$USAGE}"
SECOND_PORT="${3:?$USAGE}"
API_PORT="${4:?$USAGE}"
shift 4
MODE=pilot SECOND=delivery PUBLIC_CATALOGUE=
while [ $# -gt 0 ]; do
  case "$1" in
    --mode) MODE="${2:?}"; shift 2 ;;
    --mode=*) MODE="${1#*=}"; shift ;;
    --second) SECOND="${2:?}"; shift 2 ;;
    --second=*) SECOND="${1#*=}"; shift ;;
    --public-catalogue) PUBLIC_CATALOGUE=1; shift ;;
    *) echo "$USAGE" >&2; exit 2 ;;
  esac
done
[[ "$MODE" =~ ^(pilot|full)$ ]] || { echo "--mode pilot|full" >&2; exit 2; }
[[ "$SECOND" =~ ^(delivery|shop|landing|none)$ ]] || { echo "--second delivery|shop|landing|none" >&2; exit 2; }
[ "$SECOND" = shop ] && PUBLIC_CATALOGUE=1
WEB_HOSTNAME="${WEB_HOSTNAME:-localhost}"
WEB_URL="http://$([ "$WEB_HOSTNAME" = 0.0.0.0 ] && echo localhost || echo "$WEB_HOSTNAME"):$WEB_PORT"
[[ "$NAME" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "bad name" >&2; exit 2; }
I="$STATE/$NAME"
BUNDLE="$T/dist/apps/bakery-api/bundle"
NEXT_DIST="$T/dist/apps/bakery-management-$MODE"
# shellcheck source=lib/second.inc.sh
source "$W/lib/second.inc.sh"

die() { echo "start.sh: $*" >&2; exit 1; }
[ -f "$BUNDLE/main.js" ] || die "API bundle missing - run $W/build.sh api"
[ -f "$NEXT_DIST/.next/BUILD_ID" ] || die "management build ($MODE) missing - run $W/build.sh mgmt-$MODE"

if [ -d "$I/pids" ]; then
  for f in "$I"/pids/*.pid; do
    [ -f "$f" ] || continue
    if kill -0 "$(cat "$f")" 2>/dev/null; then die "instance '$NAME' is running - stop.sh $NAME first"; fi
  done
fi
for p in "$WEB_PORT" "$SECOND_PORT" "$API_PORT"; do
  if lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then die "port $p is in use"; fi
done
[ "$WEB_PORT" != "$SECOND_PORT" ] && [ "$WEB_PORT" != "$API_PORT" ] && [ "$SECOND_PORT" != "$API_PORT" ] || die "ports must differ"

rm -rf "$I"
mkdir -p "$I"/{pids,logs,db,shots}
echo "$MODE" > "$I/mode"

git_() { git -c init.defaultBranch=main -c commit.gpgsign=false -c user.name="hq seed" -c user.email="seed@example.invalid" "$@"; }

# ---------------------------------------------------------------- synthetic hq
echo "[$NAME] hq ..."
git_ init -q --bare -b main "$I/origin.git"
git_ clone -q "$I/origin.git" "$I/seed" 2>/dev/null
git_ -C "$I/seed" checkout -q -B main
# MAKE_HQ_FLAGS: e.g. --busy-saturday or --samstag-ersatz (print checks, see lib/make-hq.js)
# shellcheck disable=SC2086
HQ_INFO="$(cd "$T" && node "$W/lib/make-hq.js" "$I/seed" ${MAKE_HQ_FLAGS:-})"
echo "$HQ_INFO" > "$I/hq-info.json"
git_ -C "$I/seed" add -A
git_ -C "$I/seed" commit -q -m "synthetic hq (bakery-dev)"
git_ -C "$I/seed" push -q origin main
git_ clone -q "$I/origin.git" "$I/hq"
git_ clone -q "$I/origin.git" "$I/hq-write"
git -C "$I/hq-write" config commit.gpgsign false
git -C "$I/hq-write" config bakery.role write-clone
git -C "$I/hq-write" checkout -q -b app/edits origin/main
git -C "$I/hq-write" worktree add -q "$I/hq-write-main" main

# ---------------------------------------------------------------- fake GitHub
GH_PORT="$(node -e 'const s=require("net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')"
nohup node "$W/lib/fake-github.js" "$GH_PORT" "Test-Org/hq" "$I/fake-github-pulls.json" > "$I/logs/fake-github.log" 2>&1 &
echo $! > "$I/pids/fake-github.pid"

# ---------------------------------------------------------------- env
JWT="$(openssl rand -hex 32)"
ORIGINS="http://127.0.0.1:$WEB_PORT,http://localhost:$WEB_PORT,http://127.0.0.1:$SECOND_PORT,http://localhost:$SECOND_PORT${EXTRA_ORIGINS:+,$EXTRA_ORIGINS}"
cat > "$I/env.sh" <<EOF
# Source this to run the API CLI against instance '$NAME':
#   source $I/env.sh && (cd \$W_INSTANCE && node $BUNDLE/cli.js <command> ...)
export W_INSTANCE="$I"
export NODE_ENV=production TZ=Europe/Berlin
export PORT=$API_PORT HOST=127.0.0.1
export DB_PATH="$I/db/bakery.db"
export JWT_SECRET=$JWT
export CORS_ORIGIN="$ORIGINS"
export PUBLIC_CATALOGUE=${PUBLIC_CATALOGUE:-0}
export HQ_DIR="$I/hq"
export HQ_PRODUCTS_DIR="$I/hq/products"
export HQ_REPORTS_DIR="$I/hq/data/reports"
export HQ_FINANCE_DIR="$I/hq/data/finance"
export HQ_WRITE_DIR="$I/hq-write"
export HQ_SNAPSHOT_DIR="$I/hq-write-main"
export HQ_GITHUB_TOKEN=fake-token-bakery-dev
export HQ_GITHUB_REPO=Test-Org/hq
export GITHUB_API_URL="http://127.0.0.1:$GH_PORT"
export HQ_SYNC_RETRY_MS=60000
# dead geo services (closed port): delivery routes fall back to estimates (isEstimate: true)
export NOMINATIM_URL="http://127.0.0.1:9/search"
export OSRM_URL="http://127.0.0.1:9"
export GEOCODER_USER_AGENT="bakery-dev (synthetic test instance)"
EOF
# shellcheck disable=SC1091
source "$I/env.sh"

# ---------------------------------------------------------------- inhaber via CLI (as on the box)
(cd "$I" && CREATE_USER_PASSWORD='Verify-Inhaber-2026' CREATE_USER_PIN=1357 \
  node "$BUNDLE/cli.js" create-user --username verify.inhaber --display-name "Ines Inhaber" --role inhaber) \
  > "$I/logs/create-user.log" 2>&1 || { cat "$I/logs/create-user.log"; die "create-user failed"; }

# ---------------------------------------------------------------- extra pickup points via the import CLI (no POST route exists)
(cd "$I" && node "$BUNDLE/cli.js" import-preorders --file "$W/lib/pickup-points.json") \
  > "$I/logs/import-pickup-points.log" 2>&1 || { cat "$I/logs/import-pickup-points.log"; die "import-preorders (pickup points) failed"; }

# ---------------------------------------------------------------- API
echo "[$NAME] api :$API_PORT (public catalogue: ${PUBLIC_CATALOGUE:-no}) ..."
(cd "$I"; nohup node --enable-source-maps "$BUNDLE/main.js" > "$I/logs/api.log" 2>&1 & echo $! > "$I/pids/api.pid")

# ---------------------------------------------------------------- management (next start, production build)
echo "[$NAME] management ($MODE) :$WEB_PORT ..."
(cd "$T"; env -i PATH="$PATH" HOME="$HOME" TZ=Europe/Berlin NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
  API_URL="http://127.0.0.1:$API_PORT" \
  HQ_DIR="$I/hq" HQ_PRODUCTS_DIR="$I/hq/products" HQ_REPORTS_DIR="$I/hq/data/reports" HQ_FINANCE_DIR="$I/hq/data/finance" \
  nohup node node_modules/next/dist/bin/next start "$NEXT_DIST" --hostname "$WEB_HOSTNAME" --port "$WEB_PORT" \
  > "$I/logs/web.log" 2>&1 & echo $! > "$I/pids/web.pid")

wait_for() { # url seconds
  local i
  for ((i = 0; i < $2; i++)); do
    if curl -fsS -o /dev/null "$1" 2>/dev/null; then return 0; fi
    sleep 1
  done
  return 1
}
wait_for "http://127.0.0.1:$API_PORT/health" 60 || { tail -30 "$I/logs/api.log"; die "API did not become healthy"; }
wait_for "$WEB_URL/admin/login" 90 || { tail -30 "$I/logs/web.log"; die "management did not come up"; }

# ---------------------------------------------------------------- second app
start_second "$SECOND" || die "second app ($SECOND) failed (others keep running; stop.sh $NAME)"

# ---------------------------------------------------------------- seed via the API
echo "[$NAME] seed ..."
node "$W/lib/seed.mjs" "$I" "$WEB_URL" "$API_PORT" "$GH_PORT" "$(second_url)" "$SECOND" "$MODE" > "$I/logs/seed.log" 2>&1 \
  || { cat "$I/logs/seed.log"; die "seed failed (servers keep running; stop.sh $NAME)"; }
tail -3 "$I/logs/seed.log"
echo "[$NAME] ready ($MODE): management $WEB_URL  $SECOND $( [ "$SECOND" = none ] && echo - || second_url)  api http://127.0.0.1:$API_PORT  world $I/world.json"
