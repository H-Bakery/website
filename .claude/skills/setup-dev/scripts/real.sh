#!/bin/bash
# The bakery system locally with REAL hq data and a database that persists (instance "real").
# Everything stays on this Mac: hq is a local copy (bare repo cloned from ../hq), the "GitHub" the
# app talks to is fake, nothing is pushed anywhere. Ports as up.sh (stops a running dev instance).
#
#   real.sh up [<ref>] [--rebuild] [--geo]   start (first run sets everything up, later runs keep the DB)
#   real.sh down                             stop
#   real.sh status                           what runs, credentials file, DB size, backups
#   real.sh edits                            what was changed in the app (products, Grundmengen) vs hq
#   real.sh approve                          "merge" pending edits locally, so the Backzettel uses them
#   real.sh export                           copy the edits into ../hq as branch app-test/edits-<date>
#   real.sh hq-pull [<hq-ref>]               merge newer ../hq commits (default: its checked-out branch)
#                                            into the local copy - new cash reports, bank data, ...;
#                                            DB and tester edits stay, works while running
#   real.sh backup                           DB copy into backups/ (also automatic on every up)
#   real.sh reset --yes                      delete DB, hq copies and credentials (backups stay)
#
#   <ref>   website ref to run (default release/2026-11 if it exists, else the checked-out branch)
#   --geo   real address search + routing (Nominatim/OSRM, sends tour addresses to OSM servers);
#           default off -> distances are estimates
# Env: HQ_SOURCE (default <website>/../hq), HQ_REF (default release/2026-11, else main) - used only
# by the first setup; ports DEV_MGMT_PORT 4201, DEV_PILOT_PORT 4202, DEV_DELIVERY_PORT 4300,
# DEV_SHOP_PORT 4200, DEV_API_PORT 5100.
set -euo pipefail
W="$(cd "$(dirname "$0")" && pwd)"
source "$W/lib/paths.inc.sh"
source "$W/lib/tree.inc.sh"
REPO="$(git -C "$W" rev-parse --show-toplevel)"
NAME=real
I="$STATE/$NAME"
HQ_SOURCE="${HQ_SOURCE:-$(cd "$REPO/.." && pwd)/hq}"
MGMT="${DEV_MGMT_PORT:-4201}" PILOT="${DEV_PILOT_PORT:-4202}" DELIVERY="${DEV_DELIVERY_PORT:-4300}"
SHOP="${DEV_SHOP_PORT:-4200}" API_PORT="${DEV_API_PORT:-5100}"
WEB_HOSTNAME=localhost
DB="$I/db/bakery.db"
CMD="${1:-}"; shift || true
die() { echo "real.sh: $*" >&2; exit 1; }
g() { git -c commit.gpgsign=false -c user.name="hq lokal" -c user.email="hq-lokal@example.invalid" "$@"; }

backup() {
  [ -f "$DB" ] || return 0
  mkdir -p "$I/backups"
  local f="$I/backups/bakery-$(date +%Y%m%d-%H%M%S).db"
  sqlite3 "$DB" ".backup '$f'"
  chmod 600 "$f"
  ls -1t "$I"/backups/bakery-*.db | tail -n +21 | while read -r old; do rm -f "$old"; done
  echo "[real] backup $f"
}

setup_once() {
  local hq_ref="${HQ_REF:-}"
  [ -d "$HQ_SOURCE/.git" ] || die "hq not found at $HQ_SOURCE (set HQ_SOURCE)"
  if [ -z "$hq_ref" ]; then
    if git -C "$HQ_SOURCE" rev-parse -q --verify "release/2026-11^{commit}" >/dev/null; then hq_ref=release/2026-11; else hq_ref=main; fi
  fi
  echo "[real] first setup: hq from $HQ_SOURCE ($hq_ref) ..."
  umask 077
  mkdir -p "$I"/{pids,logs,db,backups}
  g clone -q --bare "$HQ_SOURCE" "$I/origin.git"
  g -C "$I/origin.git" remote remove origin 2>/dev/null || true   # never push back into ../hq
  g -C "$I/origin.git" update-ref refs/heads/main "$(git -C "$HQ_SOURCE" rev-parse "$hq_ref^{commit}")"
  g -C "$I/origin.git" symbolic-ref HEAD refs/heads/main
  g clone -q "$I/origin.git" "$I/seed"          # used by hq-merge.sh (= real.sh approve)
  g clone -q "$I/origin.git" "$I/hq"
  g clone -q "$I/origin.git" "$I/hq-write"
  git -C "$I/hq-write" config commit.gpgsign false
  git -C "$I/hq-write" config bakery.role write-clone
  git -C "$I/hq-write" checkout -q -b app/edits origin/main
  git -C "$I/hq-write" worktree add -q "$I/hq-write-main" main
  echo "$hq_ref @ $(git -C "$HQ_SOURCE" rev-parse --short "$hq_ref")" > "$I/hq-source"
  openssl rand -hex 32 > "$I/jwt-secret"

  # owner account; the password is shown once and kept in credentials.txt (0600)
  local pw pin
  pw="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)"
  pin="$(( $(od -An -N2 -tu2 /dev/urandom | tr -d ' ') % 9000 + 1000 ))"
  write_env
  # shellcheck disable=SC1091
  source "$I/env.sh"
  (cd "$I" && CREATE_USER_PASSWORD="$pw" CREATE_USER_PIN="$pin" \
    node "$T/dist/apps/bakery-api/bundle/cli.js" create-user --username inhaber --display-name "Inhaber" --role inhaber) \
    > "$I/logs/create-user.log" 2>&1 || { cat "$I/logs/create-user.log"; die "create-user failed"; }
  printf 'Verwaltung (lokal, echte Daten)\nBenutzer: inhaber\nPasswort: %s\nPIN: %s\n' "$pw" "$pin" > "$I/credentials.txt"
  chmod 600 "$I/credentials.txt"
}

write_env() { # (re)written on every up: fake GitHub port changes
  local origins="http://localhost:$MGMT,http://127.0.0.1:$MGMT,http://localhost:$PILOT,http://127.0.0.1:$PILOT,http://localhost:$DELIVERY,http://127.0.0.1:$DELIVERY,http://localhost:$SHOP,http://127.0.0.1:$SHOP"
  umask 077
  cat > "$I/env.sh" <<EOF
# instance real: source this, then (cd \$W_INSTANCE && node $T/dist/apps/bakery-api/bundle/cli.js <command>)
export W_INSTANCE="$I"
export NODE_ENV=production TZ=Europe/Berlin
export PORT=$API_PORT HOST=127.0.0.1
export DB_PATH="$DB"
export JWT_SECRET=$(cat "$I/jwt-secret")
export CORS_ORIGIN="$origins"
export PUBLIC_CATALOGUE=1
export HQ_DIR="$I/hq"
export HQ_PRODUCTS_DIR="$I/hq/products"
export HQ_REPORTS_DIR="$I/hq/data/reports"
export HQ_FINANCE_DIR="$I/hq/data/finance"
export HQ_WRITE_DIR="$I/hq-write"
export HQ_SNAPSHOT_DIR="$I/hq-write-main"
export HQ_GITHUB_TOKEN=fake-token-local
export HQ_GITHUB_REPO=local/hq
export GITHUB_API_URL="http://127.0.0.1:${GH_PORT:-9}"
export HQ_SYNC_RETRY_MS=60000
export GEOCODER_USER_AGENT="Baeckerei Heusser Verwaltung (lokaler Test)"
EOF
  if [ -z "${GEO:-}" ]; then
    printf 'export NOMINATIM_URL="http://127.0.0.1:9/search"\nexport OSRM_URL="http://127.0.0.1:9"\n' >> "$I/env.sh"
  fi
}

hq_pull() { # merge <ref> of ../hq into the local origin main, then update the read clone
  [ -d "$I/seed" ] || die "no local hq copy yet - run: real.sh up"
  local ref="${1:-$(git -C "$HQ_SOURCE" rev-parse --abbrev-ref HEAD)}" sha
  sha="$(git -C "$HQ_SOURCE" rev-parse -q --verify "$ref^{commit}")" || die "$ref not found in $HQ_SOURCE"
  g -C "$I/seed" fetch -q origin
  g -C "$I/seed" checkout -q -B main origin/main
  g -C "$I/seed" fetch -q "$HQ_SOURCE" "$sha"
  if g -C "$I/seed" merge-base --is-ancestor FETCH_HEAD HEAD; then
    echo "already contains $ref @ ${sha:0:7}"
  elif ! g -C "$I/seed" merge -q --no-ff -m "Merge $ref @ ${sha:0:7} from ../hq (real.sh hq-pull)" FETCH_HEAD; then
    g -C "$I/seed" merge --abort || true
    die "$ref conflicts with the local copy (tester edits?) - nothing changed"
  else
    g -C "$I/seed" push -q origin main
  fi
  g -C "$I/hq" pull -q --ff-only
  echo "$ref @ ${sha:0:7} (pulled $(date '+%Y-%m-%d %H:%M'))" >> "$I/hq-pulls"
  echo "local hq at $(git -C "$I/hq" rev-parse --short HEAD); reports/finance are read per request, products and Backzettel config at the API's next hq sync (<= 60 s)"
}

running() { local f; for f in "$I"/pids/*.pid; do [ -f "$f" ] && kill -0 "$(cat "$f")" 2>/dev/null && return 0; done; return 1; }

wait_for() { local i; for ((i = 0; i < $2; i++)); do curl -fsS -o /dev/null "$1" 2>/dev/null && return 0; sleep 1; done; return 1; }

up() {
  local ref="" rebuild="" a
  GEO=""
  for a in "$@"; do
    case "$a" in --rebuild) rebuild=1 ;; --geo) GEO=1 ;; -*) die "unknown option $a" ;; *) ref="$a" ;; esac
  done
  if [ -z "$ref" ]; then
    if git -C "$REPO" rev-parse -q --verify "release/2026-11^{commit}" >/dev/null; then ref=release/2026-11; else ref="$(git -C "$REPO" rev-parse --abbrev-ref HEAD)"; fi
  fi
  "$W/stop.sh" dev >/dev/null 2>&1 || true
  [ -d "$I/pids" ] && "$W/stop.sh" "$NAME" >/dev/null 2>&1 || true
  prepare_tree "$ref" "$rebuild"
  [ -n "$HAS_NEXT" ] || echo "[real] note: $ref has no Fahrer-App/shop on the real API - only management starts"
  [ -f "$DB" ] || [ -f "$I/credentials.txt" ] || setup_once
  for p in "$MGMT" "$PILOT" "$API_PORT" $([ -n "$HAS_NEXT" ] && echo "$DELIVERY $SHOP"); do
    lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1 && die "port $p is in use"
  done
  backup

  GH_PORT="$(node -e 'const s=require("net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')"
  nohup node "$W/lib/fake-github.js" "$GH_PORT" "local/hq" "$I/fake-github-pulls.json" > "$I/logs/fake-github.log" 2>&1 &
  echo $! > "$I/pids/fake-github.pid"
  write_env
  # shellcheck disable=SC1091
  source "$I/env.sh"

  echo "[real] api :$API_PORT ..."
  (cd "$I"; nohup node --enable-source-maps "$T/dist/apps/bakery-api/bundle/main.js" >> "$I/logs/api.log" 2>&1 & echo $! > "$I/pids/api.pid")
  echo "[real] management (full) :$MGMT ..."
  (cd "$T"; env -i PATH="$PATH" HOME="$HOME" TZ=Europe/Berlin NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
    API_URL="http://127.0.0.1:$API_PORT" HQ_DIR="$HQ_DIR" HQ_PRODUCTS_DIR="$HQ_PRODUCTS_DIR" \
    HQ_REPORTS_DIR="$HQ_REPORTS_DIR" HQ_FINANCE_DIR="$HQ_FINANCE_DIR" \
    nohup node node_modules/next/dist/bin/next start dist/apps/bakery-management-full --hostname "$WEB_HOSTNAME" --port "$MGMT" \
    > "$I/logs/web.log" 2>&1 & echo $! > "$I/pids/web.pid")
  wait_for "http://127.0.0.1:$API_PORT/health" 60 || { tail -30 "$I/logs/api.log"; die "API did not become healthy"; }
  wait_for "http://localhost:$MGMT/admin/login" 90 || { tail -30 "$I/logs/web.log"; die "management did not come up"; }

  if [ -n "$HAS_NEXT" ]; then
    SECOND_PORT="$DELIVERY"
    # shellcheck source=lib/second.inc.sh
    source "$W/lib/second.inc.sh"
    start_second delivery || die "Fahrer-App failed"
    "$W/extra.sh" "$NAME" "$PILOT" "$SHOP"
  else
    "$W/extra.sh" "$NAME" "$PILOT" -
  fi
  echo "$ref @ $(echo "$SHA" | cut -c1-8)" > "$I/web-ref"
  status
}

status() {
  if running; then echo "real: running ($(cat "$I/web-ref" 2>/dev/null))"; else echo "real: stopped"; fi
  [ -d "$I" ] || { echo "not set up yet - real.sh up"; return 0; }
  cat <<EOF
  Verwaltung (voll)     http://localhost:$MGMT/admin/login
  Verwaltung (Pilot)    http://localhost:$PILOT/admin/login
  Fahrer-App            http://localhost:$DELIVERY
  Shop                  http://localhost:$SHOP
  Login                 $I/credentials.txt
  hq                    $(cat "$I/hq-source" 2>/dev/null) - local copy, nothing is pushed
  DB                    $DB ($(du -h "$DB" 2>/dev/null | cut -f1 || echo -)), backups: $(ls "$I"/backups/*.db 2>/dev/null | wc -l | tr -d ' ')
  Pending hq edits      $(git -C "$I/origin.git" rev-list --count main..app/edits 2>/dev/null || echo 0) commit(s) - real.sh edits
EOF
}

edits() {
  local n
  n="$(git -C "$I/origin.git" rev-list --count main..app/edits 2>/dev/null || echo 0)"
  echo "pending (not yet approved): $n commit(s)"
  [ "$n" = 0 ] || { git -C "$I/origin.git" log --format='  %h %ad %s%n%(trailers:key=Co-authored-by,valueonly,separator=%x2C )' --date=format:'%d.%m. %H:%M' main..app/edits; git -C "$I/origin.git" diff --stat main app/edits; }
  local hq_base
  hq_base="$(cut -d' ' -f3 "$I/hq-source")"
  echo "everything changed since the copy of hq was made (approved + pending):"
  git -C "$I/origin.git" diff --stat "$hq_base" app/edits 2>/dev/null || true
}

case "$CMD" in
  up) up "$@" ;;
  down) [ -d "$I/pids" ] && "$W/stop.sh" "$NAME" || echo "not running" ;;
  status) status ;;
  edits) edits ;;
  approve) "$W/hq-merge.sh" "$NAME" ;;
  export)
    b="app-test/edits-$(date +%Y%m%d-%H%M)"
    git -C "$HQ_SOURCE" fetch -q "$I/origin.git" "app/edits:$b"
    echo "branch $b in $HQ_SOURCE ($(git -C "$HQ_SOURCE" rev-list --count "$(cut -d' ' -f3 "$I/hq-source")..$b") commits since the copy) - review, then open a PR"
    ;;
  hq-pull) hq_pull "$@" ;;
  backup) backup ;;
  reset)
    [ "${1:-}" = --yes ] || die "deletes the local DB, hq copies and credentials (backups stay): real.sh reset --yes"
    running && die "stop first: real.sh down"
    mkdir -p "$STATE/real-backups"; cp -p "$I"/backups/*.db "$STATE/real-backups/" 2>/dev/null || true
    rm -rf "$I"; echo "reset; backups kept in $STATE/real-backups"
    ;;
  *) sed -n '2,22p' "$0"; exit 2 ;;
esac
