#!/bin/bash
# bakery-dev: builds everything start.sh runs, from the detached worktree $STATE/tree (up.sh checks out the ref).
# Stop all instances first (they run from these build dirs).
#
#   build.sh [api] [mgmt-pilot] [mgmt-full] [delivery] [shop] [landing]   (no args = all)
#
# Outputs (inside the worktree):
#   dist/apps/bakery-api/bundle/{main,cli}.js
#   dist/apps/bakery-management-pilot   NEXT_PUBLIC_PILOT_MODE=1
#   dist/apps/bakery-management-full    no pilot mode
#   dist/apps/bakery-delivery           NEXT_PUBLIC_API_URL = placeholder, patched per instance by start.sh
#   dist/apps/bakery-shop               NEXT_PUBLIC_API_URL = placeholder, patched per instance by second.sh
#   apps/bakery-landing/out             static export (synthetic E2E catalogue)
# Builds read only the synthetic catalogue tools/e2e/hq-products (HQ_PRODUCTS_DIR); the worktree has no ../hq.
set -euo pipefail
W="$(cd "$(dirname "$0")" && pwd)"
source "$W/lib/paths.inc.sh"
PLACEHOLDER_API='http://bakery-dev-api.invalid'
mkdir -p "$STATE/build-logs"
cd "$T"
[ -L node_modules ] || [ -d node_modules ] || { echo "no node_modules in $T" >&2; exit 1; }

FIX="$T/tools/e2e/hq-products"
nextenv() { # Next prod build env: NX_ISOLATE_PLUGINS=false + NODE_ENV=production; IS_WEBPACK_TEST=1 = webpack (Turbopack refuses the symlinked node_modules; nx next:build has no --webpack)
  env NX_DAEMON=false NX_ISOLATE_PLUGINS=false NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 IS_WEBPACK_TEST=1 \
    HQ_PRODUCTS_DIR="$FIX" HQ_REPORTS_DIR="$T/.no-hq/reports" HQ_FINANCE_DIR="$T/.no-hq/finance" "$@"
}
revert_next_env() { git -C "$T" checkout -- apps/bakery-management/next-env.d.ts apps/bakery-delivery/next-env.d.ts apps/bakery-shop/next-env.d.ts apps/bakery-landing/next-env.d.ts apps/bakery-landing/public/sitemap.xml 2>/dev/null || true; }
fail() { revert_next_env; tail -40 "$1"; echo "BUILD FAILED: $1" >&2; exit 1; }

b_api() {
  echo "[build] api bundle ..."
  NX_DAEMON=false npx nx run bakery-api:bundle --skip-nx-cache > "$STATE/build-logs/api.log" 2>&1 || fail "$STATE/build-logs/api.log"
  ls -la dist/apps/bakery-api/bundle/main.js dist/apps/bakery-api/bundle/cli.js
}
b_mgmt() { # pilot|full
  local mode="$1" pilot=""
  [ "$mode" = pilot ] && pilot=1
  echo "[build] management ($mode) ..."
  rm -rf "dist/apps/bakery-management-$mode"
  nextenv NEXT_PUBLIC_PILOT_MODE="$pilot" NEXT_PUBLIC_API_URL= SW_VERSION="nv-$mode-$(date +%s)" \
    npx nx build bakery-management --configuration=production --skip-nx-cache \
    --outputPath="dist/apps/bakery-management-$mode" > "$STATE/build-logs/mgmt-$mode.log" 2>&1 || fail "$STATE/build-logs/mgmt-$mode.log"
  revert_next_env
  echo "  BUILD_ID $(cat "dist/apps/bakery-management-$mode/.next/BUILD_ID")"
}
b_delivery() {
  echo "[build] delivery ..."
  rm -rf dist/apps/bakery-delivery
  nextenv NEXT_PUBLIC_API_URL="$PLACEHOLDER_API" \
    npx nx build bakery-delivery --configuration=production --skip-nx-cache > "$STATE/build-logs/delivery.log" 2>&1 || fail "$STATE/build-logs/delivery.log"
  revert_next_env
  echo "  BUILD_ID $(cat dist/apps/bakery-delivery/.next/BUILD_ID); placeholder hits: $(grep -rl "$PLACEHOLDER_API" dist/apps/bakery-delivery/.next | wc -l | tr -d ' ')"
}
b_shop() {
  echo "[build] shop ..."
  rm -rf dist/apps/bakery-shop
  nextenv NEXT_PUBLIC_API_URL="$PLACEHOLDER_API" \
    npx nx build bakery-shop --configuration=production --skip-nx-cache > "$STATE/build-logs/shop.log" 2>&1 || fail "$STATE/build-logs/shop.log"
  revert_next_env
  echo "  BUILD_ID $(cat dist/apps/bakery-shop/.next/BUILD_ID); placeholder hits: $(grep -rl "$PLACEHOLDER_API" dist/apps/bakery-shop/.next | wc -l | tr -d ' ')"
}
b_landing() {
  echo "[build] landing static export ..."
  rm -rf apps/bakery-landing/.next apps/bakery-landing/out
  nextenv npx nx build-static-standalone bakery-landing --skip-nx-cache > "$STATE/build-logs/landing.log" 2>&1 || fail "$STATE/build-logs/landing.log"
  revert_next_env
  git -C "$T" status --porcelain | grep -v '^??' | sed 's/^/  modified after landing build: /' || true
  echo "  $(find apps/bakery-landing/out -name '*.html' | wc -l | tr -d ' ') html files in apps/bakery-landing/out"
}

TARGETS=("$@")
[ ${#TARGETS[@]} -eq 0 ] && TARGETS=(api mgmt-pilot mgmt-full delivery shop landing)
for t in "${TARGETS[@]}"; do
  case "$t" in
    api) b_api ;;
    mgmt-pilot) b_mgmt pilot ;;
    mgmt-full) b_mgmt full ;;
    delivery) b_delivery ;;
    shop) b_shop ;;
    landing) b_landing ;;
    *) echo "unknown target $t" >&2; exit 2 ;;
  esac
done
revert_next_env
echo "[build] tracked changes in worktree: $(git -C "$T" status --porcelain | grep -vc '^??' || true)"
