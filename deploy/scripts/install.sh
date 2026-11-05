#!/usr/bin/env bash
# install.sh - richtet die Bäckerei-Box ein (roadmap O1). Idempotent: jeder
# Schritt prüft erst, ob er schon erledigt ist; vorhandene Konfiguration
# (/etc/bakery/*.env, Datenbank, hq-Klon) wird nie überschrieben.
#
# Erstinstallation (als root, aus einem beliebigen Klon des website-Repos):
#   git clone https://github.com/H-Bakery/website.git /root/website
#   sudo /root/website/deploy/scripts/install.sh [--apt]
#   -> danach /etc/bakery/*.env ausfüllen und sudo /opt/bakery/bin/deploy.sh
#
# Optionen:
#   --apt          fehlende Debian-Pakete installieren (git curl sqlite3 restic openssl)
#   --units-only   nur Skripte nach /opt/bakery/bin und Units nach /etc/systemd/system
#                  kopieren + daemon-reload (ruft deploy.sh bei jedem Deploy auf)
#   --check        nur prüfen und berichten, nichts ändern
#
# Umgebung: BAKERY_REPO_URL (Vorgabe https://github.com/H-Bakery/website.git),
#           HQ_REPO_URL (Vorgabe https://github.com/H-Bakery/hq.git), HQ_GITHUB_TOKEN
#
# Exit-Codes: 0 ok · 1 Prüfung fehlgeschlagen (--check) · 2 falsche Umgebung
set -euo pipefail

SCRIPT_NAME="install"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/scripts/lib.sh
. "$SCRIPT_DIR/lib.sh"

DEPLOY_SRC="$(cd "$SCRIPT_DIR/.." && pwd)"
BAKERY_ROOT="${BAKERY_ROOT:-/opt/bakery}"
APP_USER="${APP_USER:-bakery}"
NODE_BIN="/usr/bin/node"
NODE_MIN_MAJOR=20
UNITS="bakery-api.service bakery-management.service bakery-hq-sync.service bakery-hq-sync.timer bakery-backup.service bakery-backup.timer bakery-health.service bakery-health.timer"
TIMERS="bakery-hq-sync.timer bakery-backup.timer bakery-health.timer"

mode="full"
use_apt=0
while [ $# -gt 0 ]; do
  case "$1" in
  --apt) use_apt=1 ;;
  --units-only) mode="units" ;;
  --check) mode="check" ;;
  -h | --help)
    sed -n '2,22p' "$0"
    exit 0
    ;;
  *) die 2 "unbekanntes Argument: $1" ;;
  esac
  shift
done

problems=0
problem() {
  warn "$*"
  problems=$((problems + 1))
}

# --- Vorbedingungen ---

[ "$(uname -s)" = "Linux" ] || die 2 "install.sh läuft nur auf der Box (Linux mit systemd)"
command -v systemctl >/dev/null 2>&1 || die 2 "systemd/systemctl fehlt"
if [ "$mode" != "check" ] && [ "$(id -u)" -ne 0 ]; then
  die 2 "bitte als root ausführen (sudo)"
fi

check_node() {
  if [ ! -x "$NODE_BIN" ]; then
    problem "$NODE_BIN fehlt. Node LTS über NodeSource installieren (siehe docs/runbook.md); die Units erwarten $NODE_BIN"
    return
  fi
  local v major
  v="$("$NODE_BIN" -v)"
  major="${v#v}"
  major="${major%%.*}"
  if [ "$major" -lt "$NODE_MIN_MAJOR" ]; then
    problem "Node $v ist zu alt (mindestens $NODE_MIN_MAJOR)"
  elif [ "$major" -eq 20 ]; then
    warn "Node $v: Node 20 ist seit 30.04.2026 ohne Sicherheitsupdates - Node 22 oder 24 LTS empfohlen"
  else
    log "Node $v ok"
  fi
  command -v npm >/dev/null 2>&1 || problem "npm fehlt"
}

check_tools() {
  local missing="" t
  for t in git curl sqlite3 restic openssl; do
    command -v "$t" >/dev/null 2>&1 || missing="$missing $t"
  done
  if [ -n "$missing" ] && [ "$use_apt" -eq 1 ] && [ "$mode" = "full" ]; then
    log "installiere:$missing"
    # shellcheck disable=SC2086
    DEBIAN_FRONTEND=noninteractive apt-get install -y $missing
    missing=""
    for t in git curl sqlite3 restic openssl; do
      command -v "$t" >/dev/null 2>&1 || missing="$missing $t"
    done
  fi
  [ -z "$missing" ] || problem "fehlende Programme:$missing (apt install$missing, oder install.sh --apt)"
  command -v caddy >/dev/null 2>&1 || problem "caddy fehlt (eigenes apt-Repo + DNS-Plugin, siehe docs/runbook.md)"
}

check_timezone() {
  local tz=""
  tz="$(timedatectl show -p Timezone --value 2>/dev/null || true)"
  if [ "$tz" = "Europe/Berlin" ]; then
    log "Zeitzone Europe/Berlin ok"
  elif [ "$mode" = "full" ]; then
    log "setze Zeitzone Europe/Berlin (war: ${tz:-unbekannt})"
    timedatectl set-timezone Europe/Berlin
  else
    problem "Zeitzone ist ${tz:-unbekannt}, erwartet Europe/Berlin"
  fi
}

check_sqlite_release() {
  if [ -d "$BAKERY_ROOT/current/node_modules" ]; then
    if as_app_node_check; then
      log "natives sqlite3 im aktuellen Release ok"
    else
      problem "natives sqlite3 lädt im aktuellen Release nicht (D12) - siehe docs/runbook.md"
    fi
  else
    log "noch kein Release - die sqlite3-Prüfung macht deploy.sh nach npm ci"
  fi
}

as_app_node_check() {
  local run=()
  if [ "$(id -u)" -eq 0 ]; then run=(runuser -u "$APP_USER" --); fi
  # O1: genau dieser Einzeiler muss im Release gehen, danach ein echter Datenbank-Test.
  (cd "$BAKERY_ROOT/current" && ${run[@]+"${run[@]}"} "$NODE_BIN" -e "require('sqlite3')") &&
    ${run[@]+"${run[@]}"} "$NODE_BIN" "$SCRIPT_DIR/sqlite-tool.js" selftest "$BAKERY_ROOT/current"
}

# --- Skripte + Units (auch --units-only) ---

install_units() {
  install -d -m 0755 "$BAKERY_ROOT/bin"
  local f
  for f in "$DEPLOY_SRC"/scripts/*.sh "$DEPLOY_SRC"/scripts/*.js; do
    install -m 0755 "$f" "$BAKERY_ROOT/bin/$(basename "$f")"
  done
  # lib.sh wird nur gesourct
  chmod 0644 "$BAKERY_ROOT/bin/lib.sh"

  local changed=0 u
  for u in $UNITS; do
    if ! cmp -s "$DEPLOY_SRC/systemd/$u" "/etc/systemd/system/$u"; then
      install -m 0644 "$DEPLOY_SRC/systemd/$u" "/etc/systemd/system/$u"
      log "Unit aktualisiert: $u"
      changed=1
    fi
  done

  if [ -d /etc/systemd/system/caddy.service.d ] || command -v caddy >/dev/null 2>&1; then
    install -d -m 0755 /etc/systemd/system/caddy.service.d
    if ! cmp -s "$DEPLOY_SRC/caddy/caddy.service.d/bakery.conf" /etc/systemd/system/caddy.service.d/bakery.conf; then
      install -m 0644 "$DEPLOY_SRC/caddy/caddy.service.d/bakery.conf" /etc/systemd/system/caddy.service.d/bakery.conf
      changed=1
    fi
  fi

  if [ "$changed" -eq 1 ]; then
    systemctl daemon-reload
  fi
  local t
  for t in $TIMERS; do
    systemctl enable --now "$t" >/dev/null 2>&1 || warn "konnte $t nicht aktivieren"
  done
  systemctl enable bakery-api.service bakery-management.service >/dev/null 2>&1 || true
}

# --- Box-Grundlagen ---

ensure_user() {
  if id "$APP_USER" >/dev/null 2>&1; then
    log "Benutzer $APP_USER vorhanden"
  else
    useradd --system --home-dir "$BAKERY_VAR" --no-create-home --shell /usr/sbin/nologin \
      --user-group "$APP_USER"
    log "Benutzer $APP_USER angelegt"
  fi
}

ensure_dirs() {
  install -d -m 0750 -o root -g "$APP_USER" "$BAKERY_ETC"
  install -d -m 0750 -o "$APP_USER" -g "$APP_USER" "$BAKERY_VAR" "$STATE_DIR" \
    "$BAKERY_VAR/backup" "$BAKERY_VAR/backup/snapshots" "$BAKERY_VAR/backup/current"
  install -d -m 0755 -o "$APP_USER" -g "$APP_USER" "$BAKERY_ROOT" "$BAKERY_ROOT/releases"
  install -d -m 0755 "$BAKERY_ROOT/bin"
  # Rückfallpfad der Loader (<monorepo>/../hq) zeigt so auch ohne HQ_*_DIR auf den Lese-Klon.
  # Releases liegen unter releases/<sha>, ihr ../hq ist releases/hq.
  [ -e "$BAKERY_ROOT/releases/hq" ] || ln -s "$BAKERY_VAR/hq" "$BAKERY_ROOT/releases/hq"
}

# Neue Schlüssel aus dem Beispiel melden, die in der echten Datei fehlen.
report_missing_keys() {
  local example="$1" real="$2" k
  grep -E '^[A-Z_][A-Z0-9_]*=' "$example" | cut -d= -f1 | while IFS= read -r k; do
    grep -qE "^$k=" "$real" || warn "$real: Schlüssel $k fehlt (siehe $(basename "$example"))"
  done
}

ensure_env() {
  local name example real
  for name in bakery ops; do
    example="$DEPLOY_SRC/$name.env.example"
    real="$BAKERY_ETC/$name.env"
    if [ -f "$real" ]; then
      report_missing_keys "$example" "$real"
      continue
    fi
    install -m 0640 -o root -g "$APP_USER" "$example" "$real"
    log "$real aus Beispiel angelegt - bitte ausfüllen"
  done
  real="$BAKERY_ETC/bakery.env"
  if grep -qE '^JWT_SECRET=$' "$real"; then
    local secret
    secret="$(openssl rand -hex 32)"
    sed -i "s/^JWT_SECRET=\$/JWT_SECRET=$secret/" "$real"
    log "JWT_SECRET erzeugt"
  fi
  if [ ! -f "$BAKERY_ETC/restic-password" ]; then
    (umask 0037 && openssl rand -base64 32 >"$BAKERY_ETC/restic-password")
    chown root:"$APP_USER" "$BAKERY_ETC/restic-password"
    log "$BAKERY_ETC/restic-password erzeugt - ZUSÄTZLICH im Passwort-Safe des Inhabers ablegen, sonst ist das Off-site-Backup wertlos"
  fi
  if [ -f /etc/caddy/bakery.env ]; then
    report_missing_keys "$DEPLOY_SRC/caddy/caddy.env.example" /etc/caddy/bakery.env
  elif [ -d /etc/caddy ]; then
    install -m 0640 -o root -g caddy "$DEPLOY_SRC/caddy/caddy.env.example" /etc/caddy/bakery.env 2>/dev/null ||
      install -m 0600 "$DEPLOY_SRC/caddy/caddy.env.example" /etc/caddy/bakery.env
    log "/etc/caddy/bakery.env angelegt - Domain und DNS-Token eintragen (Q2)"
  fi
}

ensure_caddyfile() {
  [ -d /etc/caddy ] || return 0
  if cmp -s "$DEPLOY_SRC/caddy/Caddyfile" /etc/caddy/Caddyfile; then
    return 0
  fi
  if [ -f /etc/caddy/Caddyfile ]; then
    cp -f /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.vor-bakery-$(date +%Y%m%d%H%M%S)"
  fi
  install -m 0644 "$DEPLOY_SRC/caddy/Caddyfile" /etc/caddy/Caddyfile
  log "/etc/caddy/Caddyfile installiert (vorherige Datei gesichert)"
}

ensure_code_repo() {
  local repo="$BAKERY_ROOT/repo.git"
  local url="${BAKERY_REPO_URL:-https://github.com/H-Bakery/website.git}"
  if [ -d "$repo" ]; then
    log "Code-Repository vorhanden: $repo"
    return 0
  fi
  runuser -u "$APP_USER" -- git clone --quiet --bare "$url" "$repo"
  runuser -u "$APP_USER" -- git --git-dir="$repo" config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'
  runuser -u "$APP_USER" -- git --git-dir="$repo" fetch --quiet origin
  log "Code-Repository geklont: $repo"
}

ensure_hq_clone() {
  local hq="${HQ_DIR:-$BAKERY_VAR/hq}"
  local url="${HQ_REPO_URL:-https://github.com/H-Bakery/hq.git}"
  if [ -d "$hq/.git" ]; then
    runuser -u "$APP_USER" -- git -C "$hq" config bakery.role read-clone
    log "hq-Lese-Klon vorhanden: $hq"
    return 0
  fi
  if [ -z "${HQ_GITHUB_TOKEN:-}" ]; then
    warn "hq-Lese-Klon fehlt und HQ_GITHUB_TOKEN ist leer (Q3). Nach dem Eintragen in $BAKERY_ETC/bakery.env install.sh erneut ausführen."
    return 0
  fi
  export HQ_GITHUB_TOKEN
  # shellcheck disable=SC2016 # wertet der Credential-Helper aus
  runuser -u "$APP_USER" -- env HQ_GITHUB_TOKEN="$HQ_GITHUB_TOKEN" GIT_TERMINAL_PROMPT=0 git \
    -c credential.helper= \
    -c 'credential.helper=!f() { test "$1" = get || exit 0; echo username=x-access-token; echo "password=${HQ_GITHUB_TOKEN}"; }; f' \
    clone --quiet --branch main "$url" "$hq"
  runuser -u "$APP_USER" -- git -C "$hq" config bakery.role read-clone
  log "hq-Lese-Klon angelegt: $hq"
}

# --- Ablauf ---

case "$mode" in
units)
  [ "$(id -u)" -eq 0 ] || die 2 "--units-only braucht root"
  install_units
  log "Skripte und Units aktualisiert"
  exit 0
  ;;
check)
  check_node
  check_tools
  check_timezone
  id "$APP_USER" >/dev/null 2>&1 || problem "Benutzer $APP_USER fehlt"
  [ -f "$BAKERY_ETC/bakery.env" ] || problem "$BAKERY_ETC/bakery.env fehlt"
  [ -d "$BAKERY_ROOT/repo.git" ] || problem "$BAKERY_ROOT/repo.git fehlt"
  check_sqlite_release
  if [ "$problems" -gt 0 ]; then
    die 1 "$problems Problem(e) gefunden"
  fi
  log "alles ok"
  exit 0
  ;;
esac

check_node
check_tools
check_timezone
ensure_user
ensure_dirs
ensure_env
load_env_files
ensure_code_repo
ensure_hq_clone
ensure_caddyfile
install_units
check_sqlite_release

cat >&2 <<EOF

Einrichtung abgeschlossen$([ "$problems" -eq 0 ] || echo " mit $problems offenen Punkt(en) (siehe WARNUNG oben)").
Nächste Schritte (docs/runbook.md, Inbetriebnahme):
  1. $BAKERY_ETC/bakery.env und $BAKERY_ETC/ops.env ausfüllen
  2. /etc/caddy/bakery.env: Domain + DNS-Token, dann systemctl restart caddy
  3. sudo $BAKERY_ROOT/bin/deploy.sh main
  4. sudo $BAKERY_ROOT/bin/install.sh --check
EOF
