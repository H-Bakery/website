# shellcheck shell=bash
# Gemeinsame Helfer der Box-Skripte (deploy/scripts/*.sh). Wird per `source`
# geladen, nie direkt ausgeführt. Läuft mit bash >= 3.2 (macOS-Tests) und auf
# der Box (Debian/Ubuntu, bash 5).
#
# Konvention: Logs gehen nach stderr (systemd schreibt sie ins Journal),
# Fehler enden mit `die <exit-code> <text>`.

SCRIPT_NAME="${SCRIPT_NAME:-$(basename "$0" .sh)}"

# Standardpfade der Box (roadmap §4). Jede Variable lässt sich per Umgebung
# überschreiben - die Tests unter deploy/tests tun genau das.
BAKERY_ETC="${BAKERY_ETC:-/etc/bakery}"
BAKERY_VAR="${BAKERY_VAR:-/var/lib/bakery}"
STATE_DIR="${STATE_DIR:-$BAKERY_VAR/state}"

log() {
  printf '%s [%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$SCRIPT_NAME" "$*" >&2
}

warn() {
  log "WARNUNG: $*"
}

die() {
  local code="$1"
  shift
  log "FEHLER: $*"
  exit "$code"
}

# Lädt /etc/bakery/bakery.env und ops.env, wenn das Skript von Hand (nicht
# über systemd) gestartet wurde und die Dateien lesbar sind. systemd setzt die
# Variablen selbst über EnvironmentFile=; dann ist BAKERY_ENV_LOADED gesetzt.
load_env_files() {
  if [ "${BAKERY_ENV_LOADED:-0}" = "1" ]; then
    return 0
  fi
  local f
  for f in "$BAKERY_ETC/bakery.env" "$BAKERY_ETC/ops.env"; do
    if [ -r "$f" ]; then
      set -a
      # shellcheck disable=SC1090
      . "$f"
      set +a
    fi
  done
  export BAKERY_ENV_LOADED=1
}

# Einfache Sperre, damit sich zwei Läufe (Timer + Hand) nicht überholen.
# flock auf Linux, mkdir-Sperre als Rückfall (macOS hat kein flock).
# Rückgabe 0 = Sperre erhalten, 1 = läuft schon.
_LOCK_DIR=""
acquire_lock() {
  local name="$1"
  local dir="${LOCK_DIR:-$STATE_DIR}"
  mkdir -p "$dir"
  if command -v flock >/dev/null 2>&1; then
    exec 9>"$dir/$name.lock"
    flock -n 9 || return 1
    return 0
  fi
  if mkdir "$dir/$name.lockdir" 2>/dev/null; then
    _LOCK_DIR="$dir/$name.lockdir"
    trap 'release_lock' EXIT
    return 0
  fi
  return 1
}

release_lock() {
  if [ -n "$_LOCK_DIR" ]; then
    rmdir "$_LOCK_DIR" 2>/dev/null || true
    _LOCK_DIR=""
  fi
}

# Änderungszeit einer Datei in Sekunden seit 1970 (GNU- und BSD-stat).
file_mtime() {
  stat -c %Y "$1" 2>/dev/null || stat -f %m "$1"
}

now_epoch() {
  date +%s
}

# Telegram-Nachricht über die Bot-API. TELEGRAM_API_URL ist nur für Tests da
# (lokaler Stub statt api.telegram.org). Rückgabe != 0, wenn nicht gesendet.
telegram_configured() {
  [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]
}

telegram_send() {
  local text="$1"
  if ! telegram_configured; then
    log "Telegram nicht konfiguriert (TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID) - Nachricht nur im Log: $text"
    return 2
  fi
  local base="${TELEGRAM_API_URL:-https://api.telegram.org}"
  # Token steht in der URL: kein -v, keine URL in Fehlermeldungen ausgeben.
  if curl -fsS --max-time 20 -o /dev/null \
    --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=${text}" \
    --data-urlencode "disable_web_page_preview=true" \
    "${base%/}/bot${TELEGRAM_BOT_TOKEN}/sendMessage" 2>/dev/null; then
    return 0
  fi
  warn "Telegram-Nachricht konnte nicht gesendet werden"
  return 1
}

# HTTP-Prüfung: 0 bei Status < 400 (Weiterleitungen zählen als gesund).
# Schreibt bei Fehler eine kurze Ursache nach stdout.
http_ok() {
  local url="$1"
  local timeout="${2:-10}"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time "$timeout" "$url" 2>/dev/null)" || code="000"
  if [ "$code" = "000" ]; then
    echo "keine Verbindung"
    return 1
  fi
  if [ "$code" -ge 400 ]; then
    echo "HTTP $code"
    return 1
  fi
  return 0
}

# Prüft, ob das native sqlite3-Modul im Release lädt und eine Datenbank
# öffnen kann (D12, O1). $1 = Verzeichnis mit node_modules.
check_sqlite_native() {
  local app_dir="$1"
  local here
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  node "$here/sqlite-tool.js" selftest "$app_dir"
}
