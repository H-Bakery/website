#!/usr/bin/env bash
# hq-token.sh - holt ein frisches GitHub-App-Installationstoken für das private
# hq-Repo (Q3) und legt es atomar nach HQ_GITHUB_TOKEN_FILE
# (Vorgabe /etc/bakery/hq-token), root:bakery 0640.
#
# Läuft als root über bakery-hq-token.timer: beim Start und alle 30 Minuten.
# Ein Installationstoken gilt eine Stunde und nur für hq (Contents + Pull
# requests); die API, hq-sync.sh und install.sh lesen die Datei bei jeder
# Verwendung neu. Den privaten Schlüssel der App (GH_APP_KEY, root:root 0600)
# liest nur dieses Skript - der Benutzer bakery sieht nur das kurzlebige Token.
# Statt eines langlebigen Tokens (PAT) in bakery.env (roadmap D4, Q3).
#
# Umgebung (ops.env bzw. bakery.env):
#   GH_APP_ID             App-ID der GitHub-App; leer = nicht eingerichtet (Exit 0)
#   GH_APP_KEY            privater Schlüssel, Vorgabe $BAKERY_ETC/github-app.pem
#   HQ_GITHUB_TOKEN_FILE  Ziel, Vorgabe $BAKERY_ETC/hq-token
#   HQ_REPO_URL           daraus OWNER/REPO (Vorgabe https://github.com/H-Bakery/hq.git)
#   HQ_TOKEN_REPO         OWNER/REPO ausdrücklich, statt aus HQ_REPO_URL
#   HQ_TOKEN_GROUP        Gruppe der Token-Datei, Vorgabe bakery
#   GH_APP_PERMISSIONS, GITHUB_API_URL   siehe gh-app-token.mjs
#
# Das Token steht nie im Log, in einer Argumentliste oder einer Shell-Variablen:
# gh-app-token.mjs schreibt es direkt in eine Temp-Datei (0600) neben dem Ziel,
# die nach dem Setzen der Rechte per rename an seine Stelle tritt.
#
# Exit-Codes: 0 erneuert (oder App nicht eingerichtet) · 2 Konfiguration
#   (Schlüssel fehlt oder zu offen, Repo, App-ID) · 3 GitHub nicht erreichbar
#   oder Fehler - die alte Datei bleibt (gilt bis 60 min nach ihrer Erneuerung)
#   · 4 App für hq nicht installiert / Rechte fehlen · 5 Datei nicht schreibbar
set -euo pipefail

SCRIPT_NAME="hq-token"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/scripts/lib.sh
. "$SCRIPT_DIR/lib.sh"
load_env_files

APP_USER="${APP_USER:-bakery}"
HQ_TOKEN_GROUP="${HQ_TOKEN_GROUP:-$APP_USER}"
OUT="${HQ_GITHUB_TOKEN_FILE:-$BAKERY_ETC/hq-token}"
KEY="${GH_APP_KEY:-$BAKERY_ETC/github-app.pem}"
NODE_BIN="${NODE_BIN:-/usr/bin/node}"
[ -x "$NODE_BIN" ] || NODE_BIN="$(command -v node || true)"

if [ -z "${GH_APP_ID:-}" ]; then
  log "GitHub-App nicht eingerichtet (GH_APP_ID in ops.env leer) - nichts zu tun"
  exit 0
fi
[ -n "$NODE_BIN" ] || die 2 "node fehlt"

# OWNER/REPO aus der Klon-URL (https://github.com/O/R.git, git@github.com:O/R.git).
repo_from_url() {
  local path="$1"
  case "$path" in
  https://github.com/*) path="${path#https://github.com/}" ;;
  git@github.com:*) path="${path#git@github.com:}" ;;
  ssh://git@github.com/*) path="${path#ssh://git@github.com/}" ;;
  *) return 1 ;;
  esac
  path="${path%/}"
  path="${path%.git}"
  [[ "$path" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || return 1
  printf '%s' "$path"
}

repo="${HQ_TOKEN_REPO:-}"
if [ -z "$repo" ]; then
  url="${HQ_REPO_URL:-https://github.com/H-Bakery/hq.git}"
  repo="$(repo_from_url "$url")" || die 2 "HQ_REPO_URL ($url) ist keine GitHub-Adresse - HQ_TOKEN_REPO=OWNER/REPO setzen"
fi
[[ "$repo" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || die 2 "HQ_TOKEN_REPO ($repo) ist nicht OWNER/REPO"

# Der Schlüssel kann Tokens für jedes Repository der Installation erzeugen -
# lesbar nur für root. Zu offene Rechte: abbrechen statt weitermachen.
[ -f "$KEY" ] || die 2 "privater Schlüssel der GitHub-App fehlt: $KEY (Q3, docs/runbook.md §3.6)"
if [ -n "$(find "$KEY" \( -perm -040 -o -perm -004 \) -print)" ]; then
  die 2 "$KEY ist für Gruppe oder andere lesbar - sudo chown root:root $KEY && sudo chmod 600 $KEY"
fi
if [ "$(id -u)" -eq 0 ] && [ "$(stat -c %u "$KEY" 2>/dev/null || stat -f %u "$KEY")" != "0" ]; then
  die 2 "$KEY gehört nicht root - sudo chown root:root $KEY && sudo chmod 600 $KEY"
fi

dir="$(dirname "$OUT")"
[ -d "$dir" ] || die 5 "Verzeichnis für die Token-Datei fehlt: $dir"
umask 077
tmp="$(mktemp "$dir/.hq-token.XXXXXX")" || die 5 "kann in $dir nicht schreiben"
trap 'rm -f "$tmp"' EXIT

rc=0
GH_APP_ID="$GH_APP_ID" GH_APP_KEY="$KEY" "$NODE_BIN" "$SCRIPT_DIR/gh-app-token.mjs" "$repo" >"$tmp" || rc=$?
if [ "$rc" -ne 0 ]; then
  if age="$(file_age_min "$OUT")"; then
    state="$OUT bleibt (vor $age min erneuert; ein App-Token gilt 60 min)"
  else
    state="$OUT gibt es noch nicht"
  fi
  case "$rc" in 2 | 3 | 4) ;; *) rc=3 ;; esac
  die "$rc" "kein neues Token für $repo - $state"
fi
# Dieselbe Prüfung, mit der API und Skripte die Datei später lesen.
if ! (HQ_GITHUB_TOKEN="" HQ_GITHUB_TOKEN_FILE="$tmp" hq_github_token >/dev/null); then
  die 3 "gh-app-token.mjs hat kein gültiges Token geliefert"
fi

if [ "$(id -u)" -eq 0 ]; then
  chown "root:$HQ_TOKEN_GROUP" "$tmp" || die 5 "chown root:$HQ_TOKEN_GROUP $tmp fehlgeschlagen"
else
  chgrp "$HQ_TOKEN_GROUP" "$tmp" || die 5 "chgrp $HQ_TOKEN_GROUP $tmp fehlgeschlagen"
fi
chmod 0640 "$tmp"
mv -f "$tmp" "$OUT" || die 5 "kann $OUT nicht ersetzen"
log "Token für $repo erneuert: $OUT"
