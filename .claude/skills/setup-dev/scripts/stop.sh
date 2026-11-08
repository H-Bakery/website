#!/bin/bash
# Stops only the processes of bakery-dev instance <name> (pid files), children included.
#   stop.sh <name> [--purge]   (--purge also deletes the instance directory and its app copies)
W="$(cd "$(dirname "$0")" && pwd)"
source "$W/lib/paths.inc.sh"
NAME="${1:?usage: stop.sh <name> [--purge]}"
I="$STATE/$NAME"
[ -d "$I/pids" ] || { echo "no instance '$NAME'"; exit 0; }
kill_tree() { # pid signal
  local c
  for c in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$c" "$2"; done
  kill "-$2" "$1" 2>/dev/null
}
for f in "$I"/pids/*.pid; do
  [ -f "$f" ] || continue
  pid="$(cat "$f")"
  if kill -0 "$pid" 2>/dev/null; then
    kill_tree "$pid" TERM
    for _ in $(seq 1 30); do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done
    kill -0 "$pid" 2>/dev/null && kill_tree "$pid" KILL
    echo "stopped $(basename "$f" .pid) ($pid)"
  fi
  rm -f "$f"
done
if [ "${2:-}" = "--purge" ]; then rm -rf "$I" "$T/dist/nv-instances/$NAME"; echo "purged $I"; fi
