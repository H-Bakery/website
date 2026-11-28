#!/usr/bin/env bash
# restore.sh - holt eine gesicherte Datenbank zurück und prüft sie (roadmap O2).
#
# Für die Restore-Übung (M0-Abnahme: "ein Backup wurde auf einem anderen
# Rechner wiederhergestellt") und für den Ernstfall.
#
# Aufruf:
#   restore.sh [--snapshot ID|latest] [--target DIR]
#       holt backup/current/bakery.db aus restic nach DIR (Vorgabe: neues
#       Temp-Verzeichnis), prüft integrity_check und zeigt Zeilen je Tabelle.
#       Ändert nichts an der laufenden Box.
#   restore.sh --from-file PFAD [--target DIR]
#       dasselbe für eine lokale Kopie (z. B. backup/snapshots/bakery-pre-deploy-*.db)
#   ... --apply
#       zusätzlich einspielen: bakery-api stoppen, alte DB samt -wal/-shm nach
#       DB_PATH.vor-restore-<Zeit> verschieben, Kopie einsetzen, API starten.
#       Nur als root. Setzt währenddessen state/maintenance (kein Fehlalarm)
#       und hält die Sperre des Backups (kein nächtliches Backup mittendrin).
#       Verweigert, solange das Release aktiv ist, dessen Deploy fehlschlug
#       (state/deploy-failed): erst deploy.sh --rollback, dann einspielen -
#       sonst migriert die neue Version die Kopie sofort wieder. --force übergeht das.
#
# Umgebung wie backup.sh (DB_PATH, BACKUP_DIR, RESTIC_*). SYSTEMCTL und
# HEALTH_API_URL lassen sich für Tests ersetzen.
#
# Exit-Codes: 0 ok · 2 Aufruf falsch · 6 Kopie fehlerhaft · 10 restic fehlt
#             12 restic restore fehlgeschlagen · 14 API nach dem Einspielen nicht gesund
set -euo pipefail

SCRIPT_NAME="restore"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/scripts/lib.sh
. "$SCRIPT_DIR/lib.sh"
load_env_files

DB_PATH="${DB_PATH:-$BAKERY_VAR/bakery.db}"
BACKUP_DIR="${BACKUP_DIR:-$BAKERY_VAR/backup}"
APP_DIR="${APP_DIR:-/opt/bakery/current}"
APP_USER="${APP_USER:-bakery}"
BAKERY_ROOT="${BAKERY_ROOT:-/opt/bakery}"
SYSTEMCTL="${SYSTEMCTL:-systemctl}"
HEALTH_API_URL="${HEALTH_API_URL:-http://127.0.0.1:5000/health}"

snapshot="latest"
from_file=""
target=""
apply=0
force=0
while [ $# -gt 0 ]; do
  case "$1" in
  --snapshot)
    [ $# -ge 2 ] || die 2 "--snapshot braucht einen Wert"
    snapshot="$2"
    shift
    ;;
  --from-file)
    [ $# -ge 2 ] || die 2 "--from-file braucht einen Pfad"
    from_file="$(caller_path "$2")"
    shift
    ;;
  --target)
    [ $# -ge 2 ] || die 2 "--target braucht ein Verzeichnis"
    target="$(caller_path "$2")"
    shift
    ;;
  --apply) apply=1 ;;
  --force) force=1 ;;
  -h | --help)
    sed -n '2,27p' "$SCRIPT_DIR/restore.sh"
    exit 0
    ;;
  *) die 2 "unbekanntes Argument: $1" ;;
  esac
  shift
done

if [ -z "$target" ]; then
  target="$(mktemp -d "${TMPDIR:-/tmp}/bakery-restore.XXXXXX")"
fi
mkdir -p "$target"

# --- 1. Kopie holen ---

if [ -n "$from_file" ]; then
  [ -f "$from_file" ] || die 2 "Datei nicht gefunden: $from_file"
  restored="$target/bakery.db"
  cp -f "$from_file" "$restored"
  log "lokale Kopie übernommen: $from_file"
else
  command -v restic >/dev/null 2>&1 || die 10 "restic ist nicht installiert (apt install restic)"
  [ -n "${RESTIC_REPOSITORY:-}" ] || die 2 "RESTIC_REPOSITORY ist nicht gesetzt"
  log "restic restore $snapshot -> $target"
  restic restore "$snapshot" --target "$target" --include "$BACKUP_DIR/current/bakery.db" ||
    die 12 "restic restore fehlgeschlagen"
  restored="$target$BACKUP_DIR/current/bakery.db"
  [ -f "$restored" ] || die 12 "im Snapshot fehlt $BACKUP_DIR/current/bakery.db"
fi

# --- 2. prüfen ---

if command -v sqlite3 >/dev/null 2>&1; then
  check="$(sqlite3 "$restored" 'PRAGMA integrity_check;' 2>&1 || true)"
  [ "$check" = "ok" ] || die 6 "integrity_check: $check"
  log "integrity_check: ok"
  sqlite3 "$restored" "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name;" |
    while IFS= read -r t; do
      n="$(sqlite3 "$restored" "SELECT COUNT(*) FROM \"$t\";")"
      printf '  %-32s %s\n' "$t" "$n" >&2
    done
else
  node "$SCRIPT_DIR/sqlite-tool.js" check "$restored" "$APP_DIR" >&2 || die 6 "Prüfung der Kopie fehlgeschlagen"
fi

if [ "$apply" -eq 0 ]; then
  log "geprüfte Kopie liegt unter: $restored"
  log "nichts eingespielt (dafür --apply)"
  echo "$restored"
  exit 0
fi

# --- 3. einspielen ---

if [ "$(id -u)" -ne 0 ] && [ "${RESTORE_ALLOW_NONROOT:-0}" != "1" ]; then
  die 2 "--apply nur als root (sudo)"
fi

failed="$( [ -f "$STATE_DIR/deploy-failed" ] && cat "$STATE_DIR/deploy-failed" || true)"
active=""
if [ -L "$BAKERY_ROOT/current" ]; then
  active="$(basename "$(readlink "$BAKERY_ROOT/current")")"
fi
if [ -n "$failed" ] && [ "$failed" = "$active" ] && [ "$force" -eq 0 ]; then
  die 2 "aktiv ist noch das fehlgeschlagene Release $failed - es würde die Kopie sofort wieder migrieren. Erst: sudo $BAKERY_ROOT/bin/deploy.sh --rollback, dann diesen Befehl wiederholen (--force übergeht die Prüfung)"
fi

if ! acquire_lock backup; then
  die 2 "ein Backup läuft gerade - in ein paar Minuten erneut versuchen"
fi
maintenance_on
trap 'maintenance_off; release_lock' EXIT

stamp="$(date '+%Y%m%d-%H%M%S')"
aside="$DB_PATH.vor-restore-$stamp"

log "stoppe bakery-api"
"$SYSTEMCTL" stop bakery-api.service

if [ -f "$DB_PATH" ]; then
  mv -f "$DB_PATH" "$aside"
  log "bisherige DB verschoben nach $aside"
fi
# WAL/SHM der alten DB MÜSSEN weg: SQLite würde sie sonst auf die
# eingespielte Datei anwenden und sie beschädigen.
for suffix in -wal -shm; do
  if [ -f "$DB_PATH$suffix" ]; then
    mv -f "$DB_PATH$suffix" "$aside$suffix"
  fi
done

cp -f "$restored" "$DB_PATH.tmp"
mv -f "$DB_PATH.tmp" "$DB_PATH"
chmod 0640 "$DB_PATH"
if [ "$(id -u)" -eq 0 ]; then
  chown "$APP_USER:$APP_USER" "$DB_PATH"
fi

log "starte bakery-api"
"$SYSTEMCTL" start bakery-api.service

for _ in $(seq 1 30); do
  if http_ok "$HEALTH_API_URL" 5 >/dev/null; then
    log "Wiederherstellung abgeschlossen, API gesund. Alte DB: $aside"
    exit 0
  fi
  sleep 2
done
die 14 "API ist nach dem Einspielen nicht gesund (journalctl -u bakery-api). Alte DB liegt unter $aside"
