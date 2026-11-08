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
#                  kopieren + daemon-reload (ruft deploy.sh bei jedem Deploy auf -
#                  immer aus dem root-eigenen Klon /opt/bakery/src, nie aus einem
#                  Release, das dem Benutzer bakery gehört)
#   --check        nur prüfen und berichten, nichts ändern
#
# Umgebung: BAKERY_REPO_URL (Vorgabe https://github.com/H-Bakery/website.git),
#           HQ_REPO_URL (Vorgabe https://github.com/H-Bakery/hq.git), dazu aus
#           /etc/bakery/*.env HQ_GITHUB_TOKEN bzw. HQ_GITHUB_TOKEN_FILE + GH_APP_ID
#           (GitHub-App, Q3) und aus /etc/caddy/bakery.env BAKERY_LAN_HTTP (Q2)
#
# Rechte (Kern der Härtung, nicht lockern):
#   /opt/bakery, /opt/bakery/bin, /opt/bakery/src   root, 0755 - was root ausführt
#   /opt/bakery/releases, repo.git                   bakery (npm ci + Build laufen dort)
#   /etc/bakery/bakery.env                           root:bakery 0640 (API + Verwaltung)
#   /etc/bakery/ops.env, restic-password             root:root 0600 (systemd liest sie als
#                                                    root; die API kommt nicht heran)
#   /etc/bakery/github-app.pem                       root:root 0600 (nur hq-token.sh)
#   /etc/bakery/hq-token                             root:bakery 0640 (App-Token, 1 h gültig)
#
# Exit-Codes: 0 ok · 1 Prüfung fehlgeschlagen (--check) · 2 falsche Umgebung
set -euo pipefail

SCRIPT_NAME="install"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/scripts/lib.sh
. "$SCRIPT_DIR/lib.sh"

BAKERY_ROOT="${BAKERY_ROOT:-/opt/bakery}"
DEPLOY_SRC="$(cd "$SCRIPT_DIR/.." && pwd)"
# Als $BAKERY_ROOT/bin/install.sh aufgerufen: Vorlagen, Units und Caddyfiles
# liegen im root-eigenen Klon (deploy.sh hält ihn auf dem aktiven Commit).
if [ ! -d "$DEPLOY_SRC/systemd" ] && [ -d "$BAKERY_ROOT/src/deploy/systemd" ]; then
  DEPLOY_SRC="$BAKERY_ROOT/src/deploy"
fi
APP_USER="${APP_USER:-bakery}"
NODE_BIN="/usr/bin/node"
NODE_MIN_MAJOR=20
UNITS="bakery-api.service bakery-management.service bakery-hq-sync.service bakery-hq-sync.timer bakery-backup.service bakery-backup.timer bakery-health.service bakery-health.timer bakery-anonymize.service bakery-anonymize.timer bakery-snapshot-preorders.service bakery-snapshot-preorders.timer bakery-hq-token.service bakery-hq-token.timer"
TIMERS="bakery-hq-token.timer bakery-hq-sync.timer bakery-backup.timer bakery-health.timer bakery-anonymize.timer bakery-snapshot-preorders.timer"

mode="full"
use_apt=0
while [ $# -gt 0 ]; do
  case "$1" in
  --apt) use_apt=1 ;;
  --units-only) mode="units" ;;
  --check) mode="check" ;;
  -h | --help)
    sed -n '2,33p' "$0"
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
  command -v caddy >/dev/null 2>&1 || problem "caddy fehlt (offizielle Paketquelle, docs/runbook.md §3.4; das DNS-Plugin erst für HTTPS, §3.7)"
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

# Platzhalter aus der Vorlage und zu offene Rechte melden.
check_config() {
  local f="$BAKERY_ETC/bakery.env" key
  if [ -f "$f" ]; then
    for key in NEXT_PUBLIC_API_URL CORS_ORIGIN; do
      if grep -qE "^$key=.*example\." "$f"; then
        problem "$f: $key enthält noch den Platzhalter aus der Vorlage (example.) - echte Domain eintragen, im LAN-HTTP-Betrieb (bis Q2) http://<IP oder Name der Box>; sonst baut deploy.sh nicht"
      fi
    done
  fi
  for f in "$BAKERY_ETC/ops.env" "$BAKERY_ETC/restic-password"; do
    [ -e "$f" ] || continue
    if [ -n "$(find "$f" \( -perm -g=r -o -perm -o=r \) -print)" ] || [ "$(stat -c %U "$f")" != "root" ]; then
      problem "$f ist nicht root:root 0600 - der Benutzer $APP_USER (und damit die API) könnte sie lesen. install.sh erneut ausführen"
    fi
  done
}

# GitHub-Zugang für hq (Q3): Schlüssel der App nur für root, Alter der Token-Datei.
# Ein App-Token gilt 60 min; bakery-hq-token.timer erneuert es alle 30 min.
check_github_token() {
  local key="${GH_APP_KEY:-$BAKERY_ETC/github-app.pem}"
  local file="${HQ_GITHUB_TOKEN_FILE:-}" age
  if [ -e "$key" ] &&
    { [ -n "$(find "$key" \( -perm -g=r -o -perm -o=r \) -print)" ] || [ "$(stat -c %U "$key")" != "root" ]; }; then
    problem "$key (Schlüssel der GitHub-App) ist nicht root:root 0600 - sudo chown root:root $key && sudo chmod 600 $key"
  fi
  if [ -n "${HQ_GITHUB_TOKEN:-}" ]; then
    log "GitHub-Token für hq: fester HQ_GITHUB_TOKEN (gewinnt vor HQ_GITHUB_TOKEN_FILE)"
    return 0
  fi
  if [ -z "$file" ]; then
    warn "kein GitHub-Token für hq (HQ_GITHUB_TOKEN und HQ_GITHUB_TOKEN_FILE leer) - Produktänderungen bleiben als Commits auf der Box (Q3, docs/runbook.md §3.6)"
    return 0
  fi
  # ops.env ist root:root 0600 - ohne sudo ist GH_APP_ID hier unbekannt.
  if [ -r "$BAKERY_ETC/ops.env" ]; then
    if [ -z "${GH_APP_ID:-}" ]; then
      warn "HQ_GITHUB_TOKEN_FILE ist gesetzt, aber GH_APP_ID in $BAKERY_ETC/ops.env leer - niemand erneuert $file"
    elif [ ! -e "$key" ]; then
      warn "privater Schlüssel der GitHub-App fehlt: $key (docs/runbook.md §3.6)"
    fi
  fi
  if ! age="$(file_age_min "$file")"; then
    warn "GitHub-Token-Datei $file fehlt - sudo systemctl start bakery-hq-token.service; journalctl -u bakery-hq-token"
  elif [ "$age" -gt 60 ]; then
    warn "GitHub-Token-Datei $file ist $age min alt (> 60, abgelaufen) - journalctl -u bakery-hq-token"
  else
    log "GitHub-Token-Datei $file vor $age min erneuert"
  fi
}

# Welche Caddyfile gilt (Q2) und ob die installierte dazu passt.
check_caddy() {
  [ -d /etc/caddy ] || return 0
  local cmode src
  cmode="$(caddy_mode /etc/caddy/bakery.env)"
  if [ "$cmode" = "lan-http" ]; then
    src="$DEPLOY_SRC/caddy/Caddyfile.lan-http"
    log "Caddy: LAN-HTTP (Port 80, ohne TLS) bis zum Zertifikat (Q2) - Port 80 nur aus dem LAN freigeben"
  else
    src="$DEPLOY_SRC/caddy/Caddyfile"
    log "Caddy: HTTPS über DNS-01 (intern.<BAKERY_DOMAIN>)"
  fi
  if [ -f "$src" ] && ! cmp -s "$src" /etc/caddy/Caddyfile; then
    warn "/etc/caddy/Caddyfile passt nicht zu $(basename "$src") - sudo install.sh, dann sudo systemctl restart caddy"
  fi
}

# --- Skripte + Units (auch --units-only) ---

install_units() {
  install -d -m 0755 "$BAKERY_ROOT/bin"
  local f
  for f in "$DEPLOY_SRC"/scripts/*.sh "$DEPLOY_SRC"/scripts/*.js "$DEPLOY_SRC"/scripts/*.mjs; do
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
  # /opt/bakery gehört root: sonst könnte bakery (oder ein npm-Skript beim
  # Build) bin/ umbenennen und root ein eigenes deploy.sh unterschieben.
  install -d -m 0755 -o root -g root "$BAKERY_ROOT" "$BAKERY_ROOT/bin"
  install -d -m 0755 -o "$APP_USER" -g "$APP_USER" "$BAKERY_ROOT/releases"
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
    if [ "$name" = "ops" ]; then
      install -m 0600 -o root -g root "$example" "$real"
    else
      install -m 0640 -o root -g "$APP_USER" "$example" "$real"
    fi
    log "$real aus Beispiel angelegt - bitte ausfüllen"
  done
  # Ältere Installationen hatten ops.env als root:bakery 0640 - nachziehen.
  chown root:root "$BAKERY_ETC/ops.env"
  chmod 0600 "$BAKERY_ETC/ops.env"
  real="$BAKERY_ETC/bakery.env"
  if grep -qE '^JWT_SECRET=$' "$real"; then
    local secret
    secret="$(openssl rand -hex 32)"
    sed -i "s/^JWT_SECRET=\$/JWT_SECRET=$secret/" "$real"
    log "JWT_SECRET erzeugt"
  fi
  if [ ! -f "$BAKERY_ETC/restic-password" ]; then
    (umask 0077 && openssl rand -base64 32 >"$BAKERY_ETC/restic-password")
    log "$BAKERY_ETC/restic-password erzeugt - ZUSÄTZLICH im Passwort-Safe des Inhabers ablegen, sonst ist das Off-site-Backup wertlos"
  fi
  # bakery-backup.service bekommt es per LoadCredential=, sonst niemand.
  chown root:root "$BAKERY_ETC/restic-password"
  chmod 0600 "$BAKERY_ETC/restic-password"
  if [ -f /etc/caddy/bakery.env ]; then
    report_missing_keys "$DEPLOY_SRC/caddy/caddy.env.example" /etc/caddy/bakery.env
  elif [ -d /etc/caddy ]; then
    install -m 0640 -o root -g caddy "$DEPLOY_SRC/caddy/caddy.env.example" /etc/caddy/bakery.env 2>/dev/null ||
      install -m 0600 "$DEPLOY_SRC/caddy/caddy.env.example" /etc/caddy/bakery.env
    log "/etc/caddy/bakery.env angelegt - Domain und DNS-Token eintragen (Q2)"
  fi
}

# LAN-HTTP (Caddyfile.lan-http, Port 80) solange BAKERY_LAN_HTTP=1 oder noch
# keine Domain eingetragen ist (Q2), sonst HTTPS über DNS-01 (Caddyfile).
# Der Wechsel braucht nur install.sh + Neustart von Caddy, keinen Deploy.
ensure_caddyfile() {
  [ -d /etc/caddy ] || return 0
  local cmode src
  cmode="$(caddy_mode /etc/caddy/bakery.env)"
  src="$DEPLOY_SRC/caddy/Caddyfile"
  if [ "$cmode" = "lan-http" ]; then
    src="$DEPLOY_SRC/caddy/Caddyfile.lan-http"
    log "Caddy im LAN-HTTP-Betrieb (BAKERY_LAN_HTTP=1 oder noch keine Domain, Q2): http://<IP oder Name der Box>, Port 80 nur aus dem LAN"
  fi
  if cmp -s "$src" /etc/caddy/Caddyfile; then
    return 0
  fi
  if [ -f /etc/caddy/Caddyfile ]; then
    cp -f /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.vor-bakery-$(date +%Y%m%d%H%M%S)"
  fi
  install -m 0644 "$src" /etc/caddy/Caddyfile
  log "/etc/caddy/Caddyfile installiert ($(basename "$src"), vorherige Datei gesichert) - sudo systemctl restart caddy"
}

# GitHub-App statt PAT (Q3, 2026-11-08): der Schlüssel ist nur für root lesbar,
# das kurzlebige Token für bakery. Fehlt das Token oder ist es älter als 40 min,
# holt install.sh gleich eins - die hq-Klone unten brauchen es.
ensure_github_app() {
  local key="${GH_APP_KEY:-$BAKERY_ETC/github-app.pem}"
  local out="${HQ_GITHUB_TOKEN_FILE:-$BAKERY_ETC/hq-token}" age
  if [ -f "$key" ]; then
    chown root:root "$key"
    chmod 0600 "$key"
  fi
  if [ -f "$out" ]; then
    chown "root:$APP_USER" "$out"
    chmod 0640 "$out"
  fi
  if [ -n "${HQ_GITHUB_TOKEN:-}" ]; then
    log "HQ_GITHUB_TOKEN ist gesetzt (fester Token) - die GitHub-App wird nicht benutzt"
    return 0
  fi
  if [ -z "${GH_APP_ID:-}" ]; then
    warn "kein GitHub-Zugang für hq: GH_APP_ID ($BAKERY_ETC/ops.env) und HQ_GITHUB_TOKEN sind leer (Q3, docs/runbook.md §3.6). Danach install.sh erneut ausführen."
    return 0
  fi
  if [ ! -f "$key" ]; then
    warn "privater Schlüssel der GitHub-App fehlt: $key (root:root 0600, docs/runbook.md §3.6) - bis dahin kein Token. Danach install.sh erneut ausführen."
    return 0
  fi
  [ -n "${HQ_GITHUB_TOKEN_FILE:-}" ] ||
    warn "HQ_GITHUB_TOKEN_FILE in $BAKERY_ETC/bakery.env ist leer - API und hq-sync.sh finden das App-Token nicht (Vorgabe $BAKERY_ETC/hq-token)"
  if age="$(file_age_min "$out")" && [ "$age" -lt 40 ]; then
    log "GitHub-App-Token vorhanden: $out (vor $age min erneuert)"
    return 0
  fi
  if HQ_GITHUB_TOKEN_FILE="$out" bash "$SCRIPT_DIR/hq-token.sh"; then
    log "GitHub-App-Token geholt: $out"
  else
    warn "kein GitHub-App-Token (siehe oben) - bakery-hq-token.timer versucht es alle 30 min"
  fi
}

ensure_code_repo() {
  local repo="$BAKERY_ROOT/repo.git"
  local url="${BAKERY_REPO_URL:-https://github.com/H-Bakery/website.git}"
  if [ -d "$repo/objects" ]; then
    log "Code-Repository vorhanden: $repo"
    return 0
  fi
  # /opt/bakery gehört root - das leere Zielverzeichnis legt root für bakery an.
  install -d -m 0755 -o "$APP_USER" -g "$APP_USER" "$repo"
  runuser -u "$APP_USER" -- git clone --quiet --bare "$url" "$repo"
  runuser -u "$APP_USER" -- git --git-dir="$repo" config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'
  runuser -u "$APP_USER" -- git --git-dir="$repo" fetch --quiet origin
  log "Code-Repository geklont: $repo"
}

# Root-eigener Klon: Quelle für Units und Skripte bei jedem Deploy (deploy.sh
# checkt dort denselben Commit aus, den es gebaut hat - von origin geholt).
ensure_src_clone() {
  local src="$BAKERY_ROOT/src"
  local url="${BAKERY_REPO_URL:-https://github.com/H-Bakery/website.git}"
  if [ -d "$src/.git" ]; then
    chown -R root:root "$src"
    log "root-eigener Klon vorhanden: $src"
    return 0
  fi
  git clone --quiet "$url" "$src"
  log "root-eigener Klon angelegt: $src"
}

ensure_hq_clone() {
  local hq="${HQ_DIR:-$BAKERY_VAR/hq}"
  local url="${HQ_REPO_URL:-https://github.com/H-Bakery/hq.git}"
  if [ -d "$hq/.git" ]; then
    # Markierung nur auf Klonen, die install.sh selbst angelegt hat. Auf einem
    # fremden Klon würde sie die Schutzprüfung von hq-sync.sh (reset --hard)
    # aushebeln - zeigt HQ_DIR versehentlich auf einen Schreib-Klon, gingen
    # dessen Commits verloren.
    if [ "$(runuser -u "$APP_USER" -- git -C "$hq" config --get bakery.role || true)" = "read-clone" ]; then
      log "hq-Lese-Klon vorhanden: $hq"
    else
      problem "$hq ist ein Git-Klon ohne Markierung als Lese-Klon. Nur wenn das wirklich der Lese-Klon ist (hq-sync.sh setzt ihn hart auf origin/main): sudo -u $APP_USER git -C $hq config bakery.role read-clone"
    fi
    return 0
  fi
  # Token zum Zeitpunkt des Klonens (fester Token oder App-Token-Datei); es
  # erreicht git nur über die Umgebung (runuser ohne -l reicht sie durch).
  if ! hq_git_auth_args; then
    warn "hq-Lese-Klon fehlt und es gibt kein GitHub-Token: $(hq_github_token_hint) (Q3). Danach install.sh erneut ausführen."
    return 0
  fi
  runuser -u "$APP_USER" -- env GIT_TERMINAL_PROMPT=0 git "${HQ_GIT_AUTH[@]}" \
    clone --quiet --branch main "$url" "$hq"
  runuser -u "$APP_USER" -- git -C "$hq" config bakery.role read-clone
  log "hq-Lese-Klon angelegt: $hq"
}

# Schreib-Klon (B5b): eigener Klon, Worktree auf app/edits (rollende PR), dazu
# ein zweiter Worktree auf main für die Snapshots (Z9, data/production/**).
# Wie beim Lese-Klon: nur selbst angelegte Klone werden markiert; einen
# vorhandenen fasst install.sh nicht an.
ensure_hq_write_clone() {
  local w="${HQ_WRITE_DIR:-}"
  local snap="${HQ_SNAPSHOT_DIR:-}"
  local url="${HQ_REPO_URL:-https://github.com/H-Bakery/hq.git}"
  if [ -z "$w" ]; then
    warn "HQ_WRITE_DIR ist leer - kein hq-Schreib-Klon (B5b). Die API startet in Produktion ohne ihn nicht."
    return 0
  fi
  if [ -d "$w/.git" ]; then
    if [ "$(runuser -u "$APP_USER" -- git -C "$w" config --get bakery.role || true)" = "write-clone" ]; then
      log "hq-Schreib-Klon vorhanden: $w"
    else
      problem "$w ist ein Git-Klon ohne Markierung als Schreib-Klon. Prüfen (Branch app/edits?), dann: sudo -u $APP_USER git -C $w config bakery.role write-clone"
    fi
  else
    if ! hq_git_auth_args; then
      warn "hq-Schreib-Klon fehlt und es gibt kein GitHub-Token: $(hq_github_token_hint) (Q3). Danach install.sh erneut ausführen."
      return 0
    fi
    runuser -u "$APP_USER" -- env GIT_TERMINAL_PROMPT=0 git "${HQ_GIT_AUTH[@]}" \
      clone --quiet --branch main "$url" "$w"
    # main bleibt frei für den Snapshot-Worktree; geschrieben wird auf app/edits.
    runuser -u "$APP_USER" -- git -C "$w" checkout --quiet -b app/edits origin/main
    runuser -u "$APP_USER" -- git -C "$w" config bakery.role write-clone
    log "hq-Schreib-Klon angelegt: $w (app/edits)"
  fi
  if [ -z "$snap" ]; then
    warn "HQ_SNAPSHOT_DIR ist leer - keine Snapshots nach hq (Z9)."
    return 0
  fi
  if [ -e "$snap" ]; then
    [ -f "$snap/.git" ] ||
      problem "$snap existiert, ist aber kein Worktree des Schreib-Klons (erwartet: git -C $w worktree add $snap main)"
    log "hq-Snapshot-Worktree vorhanden: $snap"
    return 0
  fi
  if [ -d "$w/.git" ]; then
    runuser -u "$APP_USER" -- git -C "$w" worktree add --quiet "$snap" main
    log "hq-Snapshot-Worktree angelegt: $snap (main)"
  fi
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
  load_env_files
  check_node
  check_tools
  check_timezone
  id "$APP_USER" >/dev/null 2>&1 || problem "Benutzer $APP_USER fehlt"
  [ -f "$BAKERY_ETC/bakery.env" ] || problem "$BAKERY_ETC/bakery.env fehlt"
  [ -d "$BAKERY_ROOT/repo.git" ] || problem "$BAKERY_ROOT/repo.git fehlt"
  [ -d "$BAKERY_ROOT/src/.git" ] || problem "$BAKERY_ROOT/src fehlt (root-eigener Klon für Units, install.sh)"
  check_config
  check_github_token
  check_caddy
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
ensure_github_app
ensure_code_repo
ensure_src_clone
ensure_hq_clone
ensure_hq_write_clone
ensure_caddyfile
install_units
check_sqlite_release
check_config

cat >&2 <<EOF

Einrichtung abgeschlossen$([ "$problems" -eq 0 ] || echo " mit $problems offenen Punkt(en) (siehe WARNUNG oben)").
Nächste Schritte (docs/runbook.md, Inbetriebnahme):
  1. $BAKERY_ETC/bakery.env und $BAKERY_ETC/ops.env ausfüllen; GitHub-App-Schlüssel
     nach $BAKERY_ETC/github-app.pem (root:root 0600), dann install.sh erneut
  2. /etc/caddy/bakery.env: BAKERY_LAN_HTTP=1 bis Q2, sonst Domain + DNS-Token;
     dann systemctl restart caddy
  3. sudo $BAKERY_ROOT/bin/deploy.sh main
  4. sudo $BAKERY_ROOT/bin/install.sh --check
EOF
