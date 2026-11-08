#!/bin/bash
# Adds two apps to a running bakery-dev instance (same API, same data):
#   pilot management build on <pilotPort>, shop on <shopPort> (- = no shop).
#   extra.sh <name> <pilotPort> <shopPort|->
# pid files go into <instance>/pids, so stop.sh <name> stops them too.
set -euo pipefail
W="$(cd "$(dirname "$0")" && pwd)"
source "$W/lib/paths.inc.sh"
NAME="${1:?name}"; PILOT_PORT="${2:?pilotPort}"; SHOP_PORT="${3:?shopPort}"
I="$STATE/$NAME"
# shellcheck disable=SC1091
source "$I/env.sh"
API="http://127.0.0.1:$PORT"
PLACEHOLDER_API='http://bakery-dev-api.invalid'

for p in "$PILOT_PORT" $([ "$SHOP_PORT" = - ] || echo "$SHOP_PORT"); do
  if lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then echo "port $p is in use" >&2; exit 1; fi
done

echo "[$NAME] management (pilot) :$PILOT_PORT ..."
(cd "$T"; env -i PATH="$PATH" HOME="$HOME" TZ=Europe/Berlin NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
  API_URL="$API" HQ_DIR="$HQ_DIR" HQ_PRODUCTS_DIR="$HQ_PRODUCTS_DIR" HQ_REPORTS_DIR="$HQ_REPORTS_DIR" HQ_FINANCE_DIR="$HQ_FINANCE_DIR" \
  nohup node node_modules/next/dist/bin/next start dist/apps/bakery-management-pilot --hostname localhost --port "$PILOT_PORT" \
  > "$I/logs/web-pilot.log" 2>&1 & echo $! > "$I/pids/web-pilot.pid")

if [ "$SHOP_PORT" != - ]; then
echo "[$NAME] shop :$SHOP_PORT ..."
copy="$T/dist/nv-instances/$NAME/bakery-shop-extra"
mkdir -p "$copy"
rsync -a --delete --exclude '.next/cache' "$T/dist/apps/bakery-shop/" "$copy/"
{ grep -rl "$PLACEHOLDER_API" "$copy/.next" || true; } | while read -r f; do LC_ALL=C sed -i '' "s|$PLACEHOLDER_API|$API|g" "$f"; done
grep -rq "$API" "$copy/.next" || { echo "shop build has no API placeholder ($PLACEHOLDER_API) - rebuild: build.sh shop" >&2; exit 1; }
(cd "$T"; env -i PATH="$PATH" HOME="$HOME" TZ=Europe/Berlin NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
  nohup node node_modules/next/dist/bin/next start "$copy" --hostname localhost --port "$SHOP_PORT" \
  > "$I/logs/shop.log" 2>&1 & echo $! > "$I/pids/shop.pid")
fi

for url in "http://localhost:$PILOT_PORT/admin/login" $([ "$SHOP_PORT" = - ] || echo "http://localhost:$SHOP_PORT/"); do
  for _ in $(seq 1 90); do curl -fsS -o /dev/null "$url" 2>/dev/null && break; sleep 1; done
  curl -fsS -o /dev/null "$url" && echo "up: $url" || { echo "not up: $url" >&2; exit 1; }
done
