#!/usr/bin/env bash
# hq-sync.sh - hält den Lese-Klon von hq auf origin/main (roadmap §4a, O1).
#
# Läuft als Benutzer `bakery` über bakery-hq-sync.timer: alle 10 Minuten und
# zusätzlich 14:50 / 17:50, kurz nach der Kassen-Pipeline auf robot0.
#
# Der Lese-Klon wird NIE beschrieben: kein Commit, kein Push. Er wird nur auf
# den Stand von origin/main gebracht (fetch + reset --hard + clean). Geschrieben
# wird ausschließlich im separaten Schreib-Klon (HQ_WRITE_DIR, B5b/Z9).
#
# Umgebung (aus /etc/bakery/bakery.env bzw. ops.env):
#   HQ_DIR            Lese-Klon (Vorgabe /var/lib/bakery/hq)
#   HQ_BRANCH         Vorgabe main
#   HQ_GITHUB_TOKEN   fester Token für das private hq-Repo (Q3)
#   HQ_GITHUB_TOKEN_FILE  sonst: Datei mit dem GitHub-App-Token (hq-token.sh,
#                     alle 30 min neu) - bei jedem Lauf frisch gelesen.
#                     Beides leer = öffentliche URL oder SSH-Schlüssel
#   HQ_WRITE_DIR      Schreib-Klon - darf nie derselbe Pfad wie HQ_DIR sein
#   HQ_SYNC_FORCE=1   lokale Commits im Lese-Klon verwerfen (sonst Abbruch)
#
# Exit-Codes:
#   0  aktuell (aktualisiert oder unverändert) - oder ein anderer Lauf hält die Sperre
#   2  Konfiguration falsch (kein Git-Klon, Markierung fehlt, Pfad = Schreib-Klon)
#   3  fetch fehlgeschlagen (offline, Token ungültig) - alter Stand bleibt
#   4  lokale Commits im Lese-Klon - Abbruch statt sie stillschweigend zu verwerfen
#   5  reset/clean fehlgeschlagen
set -euo pipefail

SCRIPT_NAME="hq-sync"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/scripts/lib.sh
. "$SCRIPT_DIR/lib.sh"
load_env_files

HQ_DIR="${HQ_DIR:-$BAKERY_VAR/hq}"
HQ_BRANCH="${HQ_BRANCH:-main}"
HQ_SYNC_FORCE="${HQ_SYNC_FORCE:-0}"
export GIT_TERMINAL_PROMPT=0

[ -d "$HQ_DIR/.git" ] ||
  die 2 "$HQ_DIR ist kein Git-Klon (erwartet: eigenständiger Klon mit .git-Verzeichnis, kein Worktree). Einrichten: siehe docs/runbook.md, Abschnitt hq-Sync."

hq_git() {
  git -C "$HQ_DIR" "$@"
}

# Schutz gegen einen falsch gesetzten Pfad: der Klon muss ausdrücklich als
# Lese-Klon markiert sein, sonst würde reset --hard fremde Arbeit vernichten.
role="$(hq_git config --get bakery.role || true)"
[ "$role" = "read-clone" ] ||
  die 2 "$HQ_DIR ist nicht als Lese-Klon markiert. Wenn das wirklich der Lese-Klon ist: git -C $HQ_DIR config bakery.role read-clone"

if [ -n "${HQ_WRITE_DIR:-}" ] && [ -d "$HQ_WRITE_DIR" ]; then
  read_real="$(cd "$HQ_DIR" && pwd -P)"
  write_real="$(cd "$HQ_WRITE_DIR" && pwd -P)"
  [ "$read_real" != "$write_real" ] ||
    die 2 "HQ_DIR und HQ_WRITE_DIR zeigen auf dasselbe Verzeichnis ($read_real)"
fi

if ! acquire_lock hq-sync; then
  log "ein anderer hq-Sync läuft noch - übersprungen"
  exit 0
fi

# Token nur für diesen Aufruf als Credential-Helper, nie in .git/config.
# Aus der Datei erst jetzt gelesen: ein App-Token gilt nur eine Stunde.
if ! hq_git_auth_args && [ -n "${HQ_GITHUB_TOKEN_FILE:-}" ]; then
  warn "kein GitHub-Token: $(hq_github_token_hint) - versuche es ohne"
fi

old="$(hq_git rev-parse --verify --quiet HEAD || echo none)"

# ${arr[@]+...}: leeres Array unter `set -u` auch in bash < 4.4
if ! hq_git ${HQ_GIT_AUTH[@]+"${HQ_GIT_AUTH[@]}"} \
  -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=60 \
  fetch --prune --quiet origin \
  "+refs/heads/$HQ_BRANCH:refs/remotes/origin/$HQ_BRANCH"; then
  die 3 "git fetch fehlgeschlagen (offline oder Token ungültig/abgelaufen?) - Lese-Klon bleibt auf ${old:0:12}"
fi

new="$(hq_git rev-parse --verify "refs/remotes/origin/$HQ_BRANCH")"

if [ "$old" != "none" ]; then
  ahead="$(hq_git rev-list --count "refs/remotes/origin/$HQ_BRANCH..HEAD")"
  if [ "$ahead" -gt 0 ]; then
    if [ "$HQ_SYNC_FORCE" = "1" ]; then
      warn "verwerfe $ahead lokale Commit(s) im Lese-Klon (HQ_SYNC_FORCE=1)"
    else
      hq_git log --oneline "refs/remotes/origin/$HQ_BRANCH..HEAD" >&2 || true
      die 4 "Lese-Klon hat $ahead lokale Commit(s), die nicht auf origin/$HQ_BRANCH liegen. Der Lese-Klon darf nicht beschrieben werden. Prüfen, sichern, dann mit HQ_SYNC_FORCE=1 erneut starten."
    fi
  fi
fi

dirty="$(hq_git status --porcelain --untracked-files=all)"
if [ -n "$dirty" ]; then
  count="$(printf '%s\n' "$dirty" | wc -l | tr -d ' ')"
  warn "$count geänderte/unversionierte Datei(en) im Lese-Klon werden verworfen:"
  printf '%s\n' "$dirty" | head -n 10 >&2
fi

{
  hq_git checkout --quiet --force -B "$HQ_BRANCH" "refs/remotes/origin/$HQ_BRANCH" &&
    hq_git reset --quiet --hard "refs/remotes/origin/$HQ_BRANCH" &&
    hq_git clean --quiet -ffd
} || die 5 "reset auf origin/$HQ_BRANCH fehlgeschlagen"

if [ "$old" = "$new" ]; then
  log "unverändert auf ${new:0:12}"
else
  if [ "$old" = "none" ]; then
    log "ausgecheckt: ${new:0:12}"
  else
    n="$(hq_git rev-list --count "$old..$new" 2>/dev/null || echo '?')"
    log "aktualisiert ${old:0:12} -> ${new:0:12} ($n Commit(s))"
  fi
fi

mkdir -p "$STATE_DIR"
printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$new" >"$STATE_DIR/hq-sync.ok"
