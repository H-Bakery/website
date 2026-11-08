#!/usr/bin/env bash
# backup.sh - nächtliches Backup der SQLite-Datenbank (roadmap O2, D4).
#
# Läuft als `bakery` über bakery-backup.timer um 23:30 (gebacken wird ab 02:00).
#   1. konsistente Kopie der laufenden DB (online, WAL-sicher):
#      `sqlite3 .backup`, oder - wenn das CLI fehlt - VACUUM INTO über das
#      npm-Modul sqlite3 (sqlite-tool.js)
#   2. integrity_check der Kopie
#   3. lokal aufheben (BACKUP_KEEP_LOCAL je Label) + nach backup/current/bakery.db
#   4. restic backup off-site, dann forget --keep-daily 14 --keep-weekly 8 --prune
#   5. Zeitstempel backup/last-success (health.sh meldet, wenn er > 36 h alt ist)
#
# Aufruf:
#   backup.sh                         nächtliches Backup (lokal + off-site)
#   backup.sh --local-only [--label pre-deploy]
#                                     nur lokale Kopie (deploy.sh vor dem Umschalten)
#
# Umgebung:
#   DB_PATH              Vorgabe /var/lib/bakery/bakery.db
#   BACKUP_DIR           Vorgabe /var/lib/bakery/backup
#   BACKUP_KEEP_LOCAL    lokale Kopien je Label (Vorgabe 7)
#   BACKUP_SQLITE_METHOD auto | cli | node (Vorgabe auto)
#   APP_DIR              Release mit node_modules/sqlite3 (Vorgabe /opt/bakery/current)
#   BACKUP_EXTRA_PATHS   weitere Pfade fürs Off-site-Backup, Leerzeichen-getrennt
#   BACKUP_HOST          restic --host (Vorgabe bakery-box)
#   RESTIC_REPOSITORY, RESTIC_PASSWORD_FILE, ggf. AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY
#   RESTIC_KEEP_DAILY (14), RESTIC_KEEP_WEEKLY (8)
#   RESTIC_FORGET        1 (Vorgabe) = forget --prune hier; 0 bei Append-only-Zugang
#                        (Aufräumen dann vom Entwickler-Rechner, docs/runbook.md §5.2)
#
# Unter systemd liegt das restic-Passwort als Credential vor
# ($CREDENTIALS_DIRECTORY/restic-password, LoadCredential= in bakery-backup.service);
# /etc/bakery/restic-password und ops.env sind root:root 0600 und für den
# Benutzer bakery - also auch für die API - nicht lesbar.
#
# Exit-Codes:
#   0 ok · 2 Datenbank fehlt / Aufruf falsch · 5 kein Backup-Werkzeug
#   6 Kopie fehlerhaft · 10 restic nicht installiert · 11 Off-site-Ziel nicht konfiguriert
#   12 restic backup fehlgeschlagen · 13 restic forget/check fehlgeschlagen
#   (bei 10-13 liegt die lokale Kopie trotzdem vor)
#
# Wiederherstellen: deploy/scripts/restore.sh (siehe dort und docs/runbook.md).
set -euo pipefail

SCRIPT_NAME="backup"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/scripts/lib.sh
. "$SCRIPT_DIR/lib.sh"
load_env_files

DB_PATH="${DB_PATH:-$BAKERY_VAR/bakery.db}"
BACKUP_DIR="${BACKUP_DIR:-$BAKERY_VAR/backup}"
BACKUP_KEEP_LOCAL="${BACKUP_KEEP_LOCAL:-7}"
BACKUP_SQLITE_METHOD="${BACKUP_SQLITE_METHOD:-auto}"
APP_DIR="${APP_DIR:-/opt/bakery/current}"
BACKUP_HOST="${BACKUP_HOST:-bakery-box}"
RESTIC_KEEP_DAILY="${RESTIC_KEEP_DAILY:-14}"
RESTIC_KEEP_WEEKLY="${RESTIC_KEEP_WEEKLY:-8}"
RESTIC_FORGET="${RESTIC_FORGET:-1}"
if [ -n "${CREDENTIALS_DIRECTORY:-}" ] && [ -r "$CREDENTIALS_DIRECTORY/restic-password" ]; then
  RESTIC_PASSWORD_FILE="$CREDENTIALS_DIRECTORY/restic-password"
  export RESTIC_PASSWORD_FILE
fi

local_only=0
label="nightly"
while [ $# -gt 0 ]; do
  case "$1" in
  --local-only) local_only=1 ;;
  --label)
    [ $# -ge 2 ] || die 2 "--label braucht einen Wert"
    label="$2"
    shift
    ;;
  -h | --help)
    sed -n '2,42p' "$0"
    exit 0
    ;;
  *) die 2 "unbekanntes Argument: $1" ;;
  esac
  shift
done
case "$label" in
*[!a-z0-9-]* | "") die 2 "--label darf nur a-z, 0-9 und - enthalten" ;;
esac

[ -f "$DB_PATH" ] || die 2 "Datenbank nicht gefunden: $DB_PATH"

if ! acquire_lock backup; then
  die 2 "ein anderes Backup läuft noch"
fi

snap_dir="$BACKUP_DIR/snapshots"
mkdir -p "$snap_dir" "$BACKUP_DIR/current"
stamp="$(date '+%Y%m%d-%H%M%S')"
final="$snap_dir/bakery-$label-$stamp.db"
tmp="$final.tmp"
rm -f "$tmp"

# --- 1+2. konsistente Kopie + Prüfung ---

method="$BACKUP_SQLITE_METHOD"
if [ "$method" = "auto" ]; then
  if command -v sqlite3 >/dev/null 2>&1; then method="cli"; else method="node"; fi
fi

case "$method" in
cli)
  command -v sqlite3 >/dev/null 2>&1 || die 5 "sqlite3-CLI nicht gefunden (BACKUP_SQLITE_METHOD=cli)"
  case "$tmp" in *"'"*) die 2 "Backup-Pfad darf kein Hochkomma enthalten: $tmp" ;; esac
  sqlite3 -bail "$DB_PATH" ".timeout 15000" ".backup '$tmp'" ||
    die 6 "sqlite3 .backup fehlgeschlagen"
  check="$(sqlite3 "$tmp" 'PRAGMA integrity_check;' 2>&1 || true)"
  [ "$check" = "ok" ] || die 6 "integrity_check der Kopie: $check"
  ;;
node)
  command -v node >/dev/null 2>&1 || die 5 "weder sqlite3-CLI noch node gefunden"
  node "$SCRIPT_DIR/sqlite-tool.js" backup "$DB_PATH" "$tmp" "$APP_DIR" >&2 || {
    rc=$?
    rm -f "$tmp"
    [ "$rc" -ne 3 ] || die 5 "kein sqlite3-CLI und npm-Modul sqlite3 nicht ladbar (APP_DIR=$APP_DIR). Abhilfe: apt install sqlite3"
    die 6 "Online-Kopie über node fehlgeschlagen (Exit $rc)"
  }
  ;;
*) die 2 "BACKUP_SQLITE_METHOD muss auto, cli oder node sein" ;;
esac

mv -f "$tmp" "$final"
chmod 0640 "$final"
size="$(wc -c <"$final" | tr -d ' ')"
log "lokale Kopie ok ($method, $size Bytes): $final"

# --- 3. lokale Aufbewahrung ---

# Dateinamen tragen den Zeitstempel, also sortiert `sort` chronologisch.
old_snapshots="$(find "$snap_dir" -maxdepth 1 -type f -name "bakery-$label-*.db" | sort -r | tail -n +"$((BACKUP_KEEP_LOCAL + 1))")"
if [ -n "$old_snapshots" ]; then
  printf '%s\n' "$old_snapshots" | while IFS= read -r f; do
    rm -f "$f"
    log "alte lokale Kopie entfernt: $(basename "$f")"
  done
fi

if [ "$local_only" -eq 1 ]; then
  echo "$final"
  exit 0
fi

# Fester Name für restic: der Restore findet die DB immer unter demselben Pfad.
cp -f "$final" "$BACKUP_DIR/current/bakery.db.tmp"
mv -f "$BACKUP_DIR/current/bakery.db.tmp" "$BACKUP_DIR/current/bakery.db"

# --- 4. off-site mit restic ---

command -v restic >/dev/null 2>&1 ||
  die 10 "restic ist nicht installiert (apt install restic). Nur die lokale Kopie wurde angelegt: $final"
[ -n "${RESTIC_REPOSITORY:-}" ] ||
  die 11 "RESTIC_REPOSITORY ist nicht gesetzt (Off-site-Ziel, Q4) - siehe /etc/bakery/ops.env. Nur lokal gesichert: $final"
if [ -z "${RESTIC_PASSWORD:-}" ]; then
  if [ -z "${RESTIC_PASSWORD_FILE:-}" ] || [ ! -r "$RESTIC_PASSWORD_FILE" ]; then
    die 11 "RESTIC_PASSWORD_FILE fehlt oder ist nicht lesbar (${RESTIC_PASSWORD_FILE:-nicht gesetzt})"
  fi
fi
export RESTIC_REPOSITORY

paths=("$BACKUP_DIR/current/bakery.db")
# Aus /etc/bakery nur lesbare Dateien (bakery.env). ops.env und das restic-
# Passwort sind für bakery absichtlich unlesbar - sie öffnen das Backup selbst
# und gehören in den Passwort-Safe, nicht ins Backup. Ebenso nie ins Backup:
# der Schlüssel der GitHub-App und das daraus erzeugte Token (Q3) - das Token
# gilt eine Stunde und entsteht nach einer Wiederherstellung neu.
for f in "$BAKERY_ETC"/*; do
  [ -f "$f" ] || continue
  case "$(basename "$f")" in restic-password | ops.env | github-app.pem | hq-token) continue ;; esac
  [ "$f" != "${RESTIC_PASSWORD_FILE:-}" ] || continue
  [ "$f" != "${HQ_GITHUB_TOKEN_FILE:-}" ] || continue
  [ "$f" != "${GH_APP_KEY:-}" ] || continue
  if [ -r "$f" ]; then
    paths+=("$f")
  else
    log "nicht lesbar, nicht off-site gesichert: $f"
  fi
done
for p in ${BACKUP_EXTRA_PATHS:-}; do
  if [ -e "$p" ]; then paths+=("$p"); else warn "BACKUP_EXTRA_PATHS: $p existiert nicht - übersprungen"; fi
done

log "restic backup -> $RESTIC_REPOSITORY (${#paths[@]} Pfad(e))"
restic backup --quiet --host "$BACKUP_HOST" --tag bakery --tag "$label" "${paths[@]}" ||
  die 12 "restic backup fehlgeschlagen (Repository nicht initialisiert? -> restic init; Netz?). Lokal gesichert: $final"

if [ "$RESTIC_FORGET" = "1" ]; then
  restic forget --quiet --host "$BACKUP_HOST" --tag bakery \
    --keep-daily "$RESTIC_KEEP_DAILY" --keep-weekly "$RESTIC_KEEP_WEEKLY" --prune ||
    die 13 "restic forget/prune fehlgeschlagen - das Backup selbst ist gespeichert"
else
  log "RESTIC_FORGET=0: kein forget/prune (Append-only-Zugang) - Aufräumen vom Entwickler-Rechner"
fi

# Sonntags zusätzlich die Struktur des Repositorys prüfen (schnell, ohne alle Daten zu lesen).
if [ "$(date +%u)" = "7" ]; then
  restic check --quiet || die 13 "restic check meldet Fehler - Repository prüfen (docs/runbook.md)"
fi

# --- 5. Erfolg für health.sh vermerken ---

printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$(basename "$final")" >"$BACKUP_DIR/last-success"
log "Backup abgeschlossen"
