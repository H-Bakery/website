#!/bin/bash
# Swaps the app on an instance's second port without touching API or management:
#   second.sh <name> delivery|shop|landing|none
# The shop needs the API's anonymous catalogue: if the instance was started without
# --public-catalogue (or --second shop), the shop shows its "API not reachable"/empty state.
set -euo pipefail
W="$(cd "$(dirname "$0")" && pwd)"
source "$W/lib/paths.inc.sh"
NAME="${1:?usage: second.sh <name> delivery|shop|landing|none}"
KIND="${2:?usage: second.sh <name> delivery|shop|landing|none}"
I="$STATE/$NAME"
[ -f "$I/world.json" ] || [ -f "$I/env.sh" ] || { echo "no instance '$NAME'" >&2; exit 1; }
API_PORT="$(sed -n 's/^export PORT=\([0-9]*\) .*/\1/p' "$I/env.sh")"
SECOND_PORT="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).second.port)' "$I/world.json")"
WEB_HOSTNAME="${WEB_HOSTNAME:-localhost}"
# shellcheck source=lib/second.inc.sh
source "$W/lib/second.inc.sh"
stop_second
if [ "$KIND" = shop ] && ! grep -q '^export PUBLIC_CATALOGUE=1' "$I/env.sh"; then
  echo "warning: API of '$NAME' runs without PUBLIC_CATALOGUE=1 - restart with start.sh ... --second shop for a working catalogue" >&2
fi
start_second "$KIND"
node -e 'const fs=require("fs");const f=process.argv[1];const w=JSON.parse(fs.readFileSync(f,"utf8"));w.second.kind=process.argv[2];w.second.url=process.argv[2]==="none"?null:process.argv[3];fs.writeFileSync(f,JSON.stringify(w,null,2)+"\n")' "$I/world.json" "$KIND" "$(second_url)"
