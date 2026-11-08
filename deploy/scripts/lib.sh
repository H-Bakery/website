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
#
#   load_env_files                  beide Dateien vollständig
#   load_env_files PRÄFIX...        bakery.env vollständig, aus ops.env nur
#                                   Variablen, deren Name mit einem PRÄFIX
#                                   beginnt (deploy.sh: kein restic/AWS)
load_env_files() {
  if [ "${BAKERY_ENV_LOADED:-0}" = "1" ]; then
    return 0
  fi
  if [ -r "$BAKERY_ETC/bakery.env" ]; then
    set -a
    # shellcheck disable=SC1091
    . "$BAKERY_ETC/bakery.env"
    set +a
  fi
  if [ -r "$BAKERY_ETC/ops.env" ]; then
    if [ $# -eq 0 ]; then
      set -a
      # shellcheck disable=SC1091
      . "$BAKERY_ETC/ops.env"
      set +a
    else
      # In einer Subshell laden und nur die erlaubten Namen herausreichen.
      local picked
      picked="$(
        # shellcheck disable=SC1091
        . "$BAKERY_ETC/ops.env" >/dev/null 2>&1
        for name in $(compgen -v); do
          for prefix in "$@"; do
            case "$name" in
            "$prefix"*)
              printf 'export %s=%q\n' "$name" "${!name}"
              break
              ;;
            esac
          done
        done
      )"
      eval "$picked"
    fi
  fi
  export BAKERY_ENV_LOADED=1
}

# Wartungs-Markierung: health.sh meldet währenddessen nichts (max. 30 min).
maintenance_on() {
  mkdir -p "$STATE_DIR"
  touch "$STATE_DIR/maintenance"
}

maintenance_off() {
  rm -f "$STATE_DIR/maintenance"
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

# Alter einer Datei in Minuten; Rückgabe 1 (keine Ausgabe), wenn sie fehlt.
file_age_min() {
  [ -e "$1" ] || return 1
  echo $((($(now_epoch) - $(file_mtime "$1")) / 60))
}

# GitHub-Token für das private hq-Repo (Q3), zum Zeitpunkt der Verwendung
# gelesen: HQ_GITHUB_TOKEN (fester Token), sonst die erste Zeile von
# HQ_GITHUB_TOKEN_FILE (GitHub-App-Token, alle 30 min neu von hq-token.sh).
# Schreibt das Token nach stdout - nur in eine Variable übernehmen, nie loggen.
# Rückgabe 1 ohne Token (Datei fehlt, leer, unlesbar oder kein Token-Format).
# Dieselben Regeln wie apps/bakery-api/src/services/github-token.ts.
hq_github_token() {
  if [ -n "${HQ_GITHUB_TOKEN:-}" ]; then
    printf '%s' "$HQ_GITHUB_TOKEN"
    return 0
  fi
  local file="${HQ_GITHUB_TOKEN_FILE:-}" token=""
  [ -n "$file" ] && [ -f "$file" ] && [ -r "$file" ] || return 1
  token="$(<"$file")" || return 1
  # Leerraum vorn und hinten weg (auch \r\n), innen ist er ein Fehler.
  token="${token#"${token%%[![:space:]]*}"}"
  token="${token%"${token##*[![:space:]]}"}"
  # GitHub-Tokens: druckbares ASCII ohne Leerzeichen; eine zweite Zeile
  # landete sonst im Credential-Protokoll von git (password=...).
  case "$token" in
  '' | *[!!-~]*) return 1 ;;
  esac
  printf '%s' "$token"
}

# Warum hq_github_token nichts liefert - für Warnungen (ohne das Token).
hq_github_token_hint() {
  local file="${HQ_GITHUB_TOKEN_FILE:-}"
  if [ -n "${HQ_GITHUB_TOKEN:-}" ]; then
    echo "HQ_GITHUB_TOKEN ist gesetzt"
  elif [ -z "$file" ]; then
    echo "HQ_GITHUB_TOKEN und HQ_GITHUB_TOKEN_FILE sind leer"
  elif [ ! -e "$file" ]; then
    echo "HQ_GITHUB_TOKEN_FILE $file fehlt (bakery-hq-token.timer, GitHub-App-Schlüssel?)"
  elif [ ! -r "$file" ]; then
    echo "HQ_GITHUB_TOKEN_FILE $file ist nicht lesbar"
  else
    echo "HQ_GITHUB_TOKEN_FILE $file ist leer oder enthält kein gültiges Token"
  fi
}

# git-Optionen, die das Token über einen Credential-Helper aus der Umgebung
# (BAKERY_HQ_GIT_TOKEN) an git geben - nie in einer Argumentliste, einer URL
# oder .git/config. Aufruf: hq_git_auth_args; dann "${HQ_GIT_AUTH[@]}".
# Ohne Token bleibt HQ_GIT_AUTH leer (öffentliche URL oder SSH-Schlüssel).
HQ_GIT_AUTH=()
hq_git_auth_args() {
  HQ_GIT_AUTH=()
  local token=""
  token="$(hq_github_token)" || token=""
  if [ -z "$token" ]; then
    unset BAKERY_HQ_GIT_TOKEN
    return 1
  fi
  export BAKERY_HQ_GIT_TOKEN="$token"
  # shellcheck disable=SC2016 # $1 und $BAKERY_HQ_GIT_TOKEN wertet der Helper aus
  HQ_GIT_AUTH=(-c credential.helper= -c 'credential.helper=!f() { test "$1" = get || exit 0; echo username=x-access-token; echo "password=${BAKERY_HQ_GIT_TOKEN}"; }; f')
}

# Wert eines Schlüssels aus einer Env-Datei (letzte Zuweisung gewinnt), ohne
# sie zu sourcen; umschließende Anführungszeichen fallen weg.
env_file_value() {
  local file="$1" key="$2" line=""
  [ -r "$file" ] || return 0
  line="$(grep -E "^[[:space:]]*(export[[:space:]]+)?$key=" "$file" | tail -n 1 || true)"
  line="${line#*=}"
  line="${line%"${line##*[![:space:]]}"}"
  case "$line" in
  \"*\") line="${line#\"}" && line="${line%\"}" ;;
  \'*\') line="${line#\'}" && line="${line%\'}" ;;
  esac
  printf '%s' "$line"
}

# Welche Caddyfile auf die Box gehört (Q2): "lan-http" (Caddyfile.lan-http,
# Port 80 ohne TLS), solange BAKERY_LAN_HTTP=1 gesetzt ist oder BAKERY_DOMAIN
# leer bzw. noch der Platzhalter aus der Vorlage ist; sonst "https".
# $1 = Env-Datei von Caddy, Vorgabe /etc/caddy/bakery.env.
caddy_mode() {
  local file="${1:-${CADDY_ENV_FILE:-/etc/caddy/bakery.env}}" lan domain
  lan="$(env_file_value "$file" BAKERY_LAN_HTTP)"
  domain="$(env_file_value "$file" BAKERY_DOMAIN)"
  case "$lan" in
  1 | true | yes | ja)
    echo lan-http
    return 0
    ;;
  esac
  case "$domain" in
  '' | example.* | *.example.*)
    echo lan-http
    return 0
    ;;
  esac
  echo https
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
