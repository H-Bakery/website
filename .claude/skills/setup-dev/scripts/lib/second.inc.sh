# Sourced by start.sh and second.sh. Needs: W T I NAME SECOND_PORT API_PORT WEB_HOSTNAME
# Starts the app on SECOND_PORT: delivery | shop | landing | none.
# delivery/shop were built with NEXT_PUBLIC_API_URL=http://bakery-dev-api.invalid (baked into the
# bundles); each instance gets its own copy under <worktree>/dist/nv-instances/<name>/ (inside the
# worktree so `next` resolves from its node_modules) with the placeholder replaced by this API.
PLACEHOLDER_API='http://bakery-dev-api.invalid'

second_url() { echo "http://$([ "$WEB_HOSTNAME" = 0.0.0.0 ] && echo localhost || echo "$WEB_HOSTNAME"):$SECOND_PORT"; }

stop_second() {
  local f="$I/pids/second.pid" pid c
  [ -f "$f" ] || return 0
  pid="$(cat "$f")"
  kill_tree_() { for c in $(pgrep -P "$1" 2>/dev/null); do kill_tree_ "$c" "$2"; done; kill "-$2" "$1" 2>/dev/null; }
  if kill -0 "$pid" 2>/dev/null; then
    kill_tree_ "$pid" TERM
    for _ in $(seq 1 30); do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done
    kill -0 "$pid" 2>/dev/null && kill_tree_ "$pid" KILL
    echo "[$NAME] stopped second app $(cat "$I/second.kind" 2>/dev/null) ($pid)"
  fi
  rm -f "$f"
}

start_second() { # kind
  local kind="$1" src copy api="http://127.0.0.1:$API_PORT"
  echo "$kind" > "$I/second.kind"
  [ "$kind" = none ] && return 0
  if lsof -nP -iTCP:"$SECOND_PORT" -sTCP:LISTEN >/dev/null 2>&1; then echo "port $SECOND_PORT is in use" >&2; return 1; fi
  case "$kind" in
    delivery|shop)
      src="$T/dist/apps/bakery-$kind"
      [ -f "$src/.next/BUILD_ID" ] || { echo "$kind build missing - run $W/build.sh $kind" >&2; return 1; }
      copy="$T/dist/nv-instances/$NAME/bakery-$kind"
      mkdir -p "$copy"
      rsync -a --delete --exclude '.next/cache' "$src/" "$copy/"
      grep -rl "$PLACEHOLDER_API" "$copy/.next" | while read -r f; do
        LC_ALL=C sed -i '' "s|$PLACEHOLDER_API|$api|g" "$f"
      done
      if grep -rq "$PLACEHOLDER_API" "$copy/.next"; then echo "placeholder left in $copy" >&2; return 1; fi
      grep -rq "$api" "$copy/.next" || { echo "$kind build has no API placeholder ($PLACEHOLDER_API) - rebuild: build.sh $kind" >&2; return 1; }
      echo "[$NAME] $kind :$SECOND_PORT (API $api baked into $copy) ..."
      (cd "$T"; env -i PATH="$PATH" HOME="$HOME" TZ=Europe/Berlin NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
        nohup node node_modules/next/dist/bin/next start "$copy" --hostname "$WEB_HOSTNAME" --port "$SECOND_PORT" \
        > "$I/logs/second-$kind.log" 2>&1 & echo $! > "$I/pids/second.pid")
      ;;
    landing)
      [ -f "$T/apps/bakery-landing/out/index.html" ] || { echo "landing export missing - run $W/build.sh landing" >&2; return 1; }
      echo "[$NAME] landing (static export) :$SECOND_PORT ..."
      (cd "$T"; nohup node tools/e2e/serve-static.js apps/bakery-landing/out --port "$SECOND_PORT" \
        > "$I/logs/second-landing.log" 2>&1 & echo $! > "$I/pids/second.pid")
      ;;
    *) echo "unknown second app '$kind' (delivery|shop|landing|none)" >&2; return 2 ;;
  esac
  local i
  for ((i = 0; i < 90; i++)); do
    if curl -fsS -o /dev/null "http://127.0.0.1:$SECOND_PORT/" 2>/dev/null || curl -fsS -o /dev/null "$(second_url)/" 2>/dev/null; then
      echo "[$NAME] $kind up: $(second_url)"; return 0
    fi
    sleep 1
  done
  tail -20 "$I/logs/second-$kind.log"; echo "$kind did not come up" >&2; return 1
}
