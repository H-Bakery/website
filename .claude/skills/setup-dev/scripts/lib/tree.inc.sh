# Sourced by up.sh and real.sh. Needs W, STATE, T, REPO.
# prepare_tree <ref> [rebuild]: checks <ref> out (detached) in $T, links node_modules and builds
# what start.sh needs unless $STATE/build.sha already names this commit.
# Sets SHA and HAS_NEXT (1 when the Fahrer-App and shop run on the real API, i.e. no simple-server.js).
prepare_tree() {
  local REF="$1" REBUILD="${2:-}"
  git -C "$REPO" rev-parse -q --verify "$REF^{commit}" >/dev/null || { echo "unknown ref: $REF" >&2; return 1; }
  mkdir -p "$STATE"
  if [ ! -e "$T/.git" ]; then
    git -C "$REPO" worktree prune
    git -C "$REPO" worktree add -q --detach "$T" "$REF"
  else
    git -C "$T" reset -q --hard
    git -C "$T" checkout -q --detach "$REF"
  fi
  [ -e "$T/node_modules" ] || ln -s "$REPO/node_modules" "$T/node_modules"
  SHA="$(git -C "$T" rev-parse HEAD)"
  echo "[up] $REF = $(git -C "$T" log --oneline -1 | cut -c1-80)"
  if ! git -C "$REPO" diff --quiet "$SHA" -- package-lock.json 2>/dev/null; then
    echo "[up] warning: package-lock.json of $REF differs from your checkout - the build uses your node_modules" >&2
  fi

  HAS_NEXT=""
  [ -f "$T/apps/bakery-api/simple-server.js" ] || HAS_NEXT=1
  local TARGETS=(api mgmt-full mgmt-pilot)
  [ -n "$HAS_NEXT" ] && TARGETS+=(delivery shop)

  if [ -n "$REBUILD" ] || [ "$(cat "$STATE/build.sha" 2>/dev/null)" != "$SHA" ]; then
    rm -f "$STATE/build.sha"
    echo "[up] building ${TARGETS[*]} (10-15 min; logs in $STATE/build-logs) ..."
    "$W/build.sh" "${TARGETS[@]}"
    echo "$SHA" > "$STATE/build.sha"
  else
    echo "[up] build of $(echo "$SHA" | cut -c1-8) is current"
  fi
}
