#!/bin/bash
# Builds a ref and runs the whole bakery system locally with synthetic data.
#
#   up.sh [<ref>] [--rebuild]
#
#   <ref>      branch/commit to run (default: the branch checked out in the main repo).
#              Committed code only - uncommitted changes in your checkout are not included.
#   --rebuild  build even if this commit was built before
#
# Ports (env overrides): DEV_MGMT_PORT 4201 (full management), DEV_PILOT_PORT 4202 (pilot-mode
# management), DEV_DELIVERY_PORT 4300 (Fahrer-App), DEV_SHOP_PORT 4200 (shop), DEV_API_PORT 5100
# (real TS API; 5000 is taken by macOS AirPlay). Instance name: dev. State: $STATE (paths.inc.sh).
# Fahrer-App and shop only on branches where they run on the real API (no simple-server.js).
set -euo pipefail
W="$(cd "$(dirname "$0")" && pwd)"
source "$W/lib/paths.inc.sh"
source "$W/lib/tree.inc.sh"
REPO="$(git -C "$W" rev-parse --show-toplevel)"
REF="" REBUILD=""
for a in "$@"; do
  case "$a" in
    --rebuild) REBUILD=1 ;;
    -*) echo "usage: up.sh [<ref>] [--rebuild]" >&2; exit 2 ;;
    *) REF="$a" ;;
  esac
done
[ -n "$REF" ] || REF="$(git -C "$REPO" rev-parse --abbrev-ref HEAD)"
MGMT="${DEV_MGMT_PORT:-4201}" PILOT="${DEV_PILOT_PORT:-4202}" DELIVERY="${DEV_DELIVERY_PORT:-4300}"
SHOP="${DEV_SHOP_PORT:-4200}" API="${DEV_API_PORT:-5100}"
NAME=dev
mkdir -p "$STATE"

"$W/stop.sh" "$NAME" >/dev/null 2>&1 || true
"$W/stop.sh" real >/dev/null 2>&1 || true   # same ports

prepare_tree "$REF" "$REBUILD"

# ---------------------------------------------------------------- start + seed
if [ -n "$HAS_NEXT" ]; then
  EXTRA_ORIGINS="http://localhost:$SHOP,http://127.0.0.1:$SHOP" \
    "$W/start.sh" "$NAME" "$MGMT" "$DELIVERY" "$API" --mode full --second delivery --public-catalogue
  "$W/extra.sh" "$NAME" "$PILOT" "$SHOP"
else
  "$W/start.sh" "$NAME" "$MGMT" "$DELIVERY" "$API" --mode full --second none
  "$W/extra.sh" "$NAME" "$PILOT" -
fi

SAT="$(node -e 'console.log(require(process.argv[1]).saturday||"")' "$STATE/$NAME/world.json" 2>/dev/null || true)"
cat <<EOF

bakery-dev is running ($REF @ $(echo "$SHA" | cut -c1-8)), synthetic data only:
  Management (full)    http://localhost:$MGMT/admin/login
  Management (pilot)   http://localhost:$PILOT/admin/login
$( [ -n "$HAS_NEXT" ] && printf '  Fahrer-App           http://localhost:%s\n  Shop                 http://localhost:%s\n' "$DELIVERY" "$SHOP" || echo "  (no Fahrer-App/shop: on this ref they still need the mock server)")
  API                  http://127.0.0.1:$API/health
Logins (user / password / PIN):
  verify.inhaber   Verify-Inhaber-2026   1357
  verify.verkauf   Verify-Verkauf-2026   2468
  verify.backstube Verify-Backstube-2026 0420
  verify.fahrer    Verify-Fahrer-2026    9753
Saturday with Hefeteig + tours: ${SAT:-?}. Details: $STATE/$NAME/world.json
Stop: $W/down.sh
EOF
