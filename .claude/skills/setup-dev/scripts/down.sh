#!/bin/bash
# Stops the local bakery system started by up.sh.
#   down.sh           stop (data stays until the next up.sh, which re-seeds)
#   down.sh --purge   stop and delete everything: instance data, builds, the worktree
set -euo pipefail
W="$(cd "$(dirname "$0")" && pwd)"
source "$W/lib/paths.inc.sh"
"$W/stop.sh" dev
if [ "${1:-}" = "--purge" ]; then
  REPO="$(git -C "$W" rev-parse --show-toplevel)"
  [ -e "$T/.git" ] && git -C "$REPO" worktree remove --force "$T"
  git -C "$REPO" worktree prune
  rm -rf "$STATE"
  echo "purged $STATE"
fi
