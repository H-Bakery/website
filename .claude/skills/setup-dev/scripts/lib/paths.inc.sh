# Sourced by every script. State lives outside the repo:
#   $STATE/tree          detached git worktree of the ref being run (node_modules symlinked to the main checkout)
#   $STATE/<instance>/   one running instance (synthetic hq, SQLite, logs, pids, world.json)
#   $STATE/build-logs/   build output
# Override with BAKERY_DEV_HOME.
STATE="${BAKERY_DEV_HOME:-$HOME/.cache/bakery-dev}"
T="$STATE/tree"
