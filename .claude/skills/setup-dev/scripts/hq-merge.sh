#!/bin/bash
# Simulates "the rolling PR app/edits was merged on GitHub" + hq-sync for instance <name>:
# merges origin/app/edits into origin/main, closes the fake PR, fast-forwards the read clone.
# The API notices on its next sync (POST /api/hq-sync/retry as inhaber, or within 60 s).
set -euo pipefail
W="$(cd "$(dirname "$0")" && pwd)"
source "$W/lib/paths.inc.sh"
I="$STATE/${1:?usage: hq-merge.sh <name>}"
g() { git -c commit.gpgsign=false -c user.name="hq reviewer" -c user.email="review@example.invalid" "$@"; }
g -C "$I/seed" fetch -q origin
g -C "$I/seed" checkout -q -B main origin/main
if g -C "$I/seed" rev-parse -q --verify origin/app/edits >/dev/null; then
  g -C "$I/seed" merge -q --no-ff -m "Merge app/edits (bakery-dev)" origin/app/edits
  g -C "$I/seed" push -q origin main
else
  echo "no origin/app/edits yet"
fi
GH="$(sed -n 's/^export GITHUB_API_URL="\(.*\)"$/\1/p' "$I/env.sh")"
curl -fsS -X POST "$GH/__merge" >/dev/null || true
g -C "$I/hq" pull -q --ff-only
echo "merged; read clone at $(git -C "$I/hq" rev-parse --short HEAD)"
