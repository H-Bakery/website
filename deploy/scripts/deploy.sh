#!/usr/bin/env bash
# deploy.sh - Pull-basiertes Deploy auf der Bäckerei-Box (roadmap O3, D4).
#
# Kein GitHub-Runner: die Box holt sich den Code selbst. Jedes Release wird in
# einem eigenen Verzeichnis gebaut, während die alte Version weiterläuft; erst
# danach wird der Symlink /opt/bakery/current umgeschaltet und neu gestartet.
# Ein Rollback ist damit nur ein Umschalten zurück.
#
#   /opt/bakery/repo.git            Bare-Klon von H-Bakery/website
#   /opt/bakery/releases/<sha12>-<Zeit>   ein git-Worktree je Build, mit node_modules + dist
#   /opt/bakery/current -> releases/<...>  (WorkingDirectory der Units)
#
# Aufruf (als root, z. B. sudo /opt/bakery/bin/deploy.sh):
#   deploy.sh [REF]          REF = Branch, Tag oder Commit (Vorgabe: $DEPLOY_REF oder main)
#   deploy.sh --rollback     zurück auf das vorherige Release
#   deploy.sh --status       aktuelles/vorheriges Release und alle gebauten Releases
# Optionen für REF:
#   --no-restart             nur bauen, nicht umschalten
#   --force-install          npm ci auch dann, wenn sich package-lock.json nicht geändert hat
#   --rebuild                neu bauen, auch wenn der Commit schon gebaut ist
#                            (nötig nach Änderung von NEXT_PUBLIC_* in bakery.env)
#   --skip-backup            keine lokale DB-Kopie vor dem Umschalten
#
# Ablauf: fetch -> Worktree -> npm ci (oder node_modules des laufenden Releases
# kopieren, wenn das Lockfile gleich ist) -> sqlite3-Prüfung -> Build
# (bakery-api:bundle + bakery-management, NX_ISOLATE_PLUGINS=false NODE_ENV=production)
# -> lokale DB-Kopie -> Units/Skripte aktualisieren -> umschalten -> Neustart
# -> Health-Check. Schlägt der Health-Check fehl, wird NICHT automatisch
# zurückgeschaltet (die neue Version kann die DB schon migriert haben); das
# Skript nennt den Rollback-Befehl und die DB-Kopie.
#
# Geheimnisse: npm ci, Build und alles andere, was als APP_USER läuft, sieht
# nur eine geleerte Umgebung (env -i) mit PATH/HOME/Locale und den
# Build-Schlüsseln aus bakery.env (DEPLOY_BUILD_ENV_KEYS) - kein JWT_SECRET,
# kein HQ_GITHUB_TOKEN, keine Telegram-/restic-/AWS-Zugänge. Aus ops.env liest
# deploy.sh selbst nur TELEGRAM_*, DEPLOY_*, KEEP_RELEASES und HEALTH_*.
#
# Units und Skripte (laufen als root) kommen nie aus dem Release, das
# APP_USER gebaut hat, sondern aus dem root-eigenen Klon $BAKERY_ROOT/src,
# der denselben Commit selbst von origin holt.
#
# Exit-Codes: 0 ok · 2 Aufruf/Konfiguration · 3 git · 4 npm ci · 5 Build
#             6 sqlite3-Modul lädt nicht · 7 Health-Check nach Neustart fehlgeschlagen
#             8 Sperre belegt
set -euo pipefail

SCRIPT_NAME="deploy"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/scripts/lib.sh
. "$SCRIPT_DIR/lib.sh"
load_env_files TELEGRAM_ DEPLOY_ KEEP_RELEASES HEALTH_

BAKERY_ROOT="${BAKERY_ROOT:-/opt/bakery}"
REPO="${DEPLOY_REPO:-$BAKERY_ROOT/repo.git}"
RELEASES="$BAKERY_ROOT/releases"
CURRENT="$BAKERY_ROOT/current"
APP_USER="${APP_USER:-bakery}"
SYSTEMCTL="${SYSTEMCTL:-systemctl}"
KEEP_RELEASES="${KEEP_RELEASES:-3}"
DEPLOY_SERVICES="${DEPLOY_SERVICES:-bakery-api.service bakery-management.service}"
DEPLOY_HEALTH_TIMEOUT="${DEPLOY_HEALTH_TIMEOUT:-120}"
HEALTH_API_URL="${HEALTH_API_URL:-http://127.0.0.1:5000/health}"
HEALTH_MGMT_URL="${HEALTH_MGMT_URL:-http://127.0.0.1:4201/}"
DEPLOY_NODE_OPTIONS="${DEPLOY_NODE_OPTIONS:---max-old-space-size=4096}"
# Nur für Tests: Installations-/Build-Schritt ersetzen.
DEPLOY_INSTALL_CMD="${DEPLOY_INSTALL_CMD:-}"
DEPLOY_BUILD_CMD="${DEPLOY_BUILD_CMD:-}"
DEPLOY_SKIP_NATIVE_CHECK="${DEPLOY_SKIP_NATIVE_CHECK:-0}"
# Root-eigener Klon, aus dem Units und Skripte übernommen werden.
DEPLOY_SRC_DIR="${DEPLOY_SRC_DIR:-$BAKERY_ROOT/src}"
# auto = nur als root; 1 = immer (Tests); 0 = nie
DEPLOY_UPDATE_UNITS="${DEPLOY_UPDATE_UNITS:-auto}"
# Variablen aus bakery.env, die der Build sehen darf (Namen; * am Ende = Präfix).
DEPLOY_BUILD_ENV_KEYS="${DEPLOY_BUILD_ENV_KEYS:-NEXT_PUBLIC_* API_URL HQ_PRODUCTS_DIR HQ_REPORTS_DIR HQ_FINANCE_DIR TZ}"

API_BUNDLE="dist/apps/bakery-api/bundle/main.js"
MGMT_BUILD_ID="dist/apps/bakery-management/.next/BUILD_ID"
MARKER=".bakery-release"

usage() {
  sed -n '2,44p' "$0"
}

switches_user() {
  [ "$(id -u)" -eq 0 ] && [ "$APP_USER" != "root" ]
}

# Grundumgebung jedes Befehls, der als APP_USER läuft: nur das Nötigste.
# Bewusst eine Whitelist - npm-Lifecycle-Skripte und Build-Plugins sind
# fremder Code und sollen keine Geheimnisse aus der Umgebung lesen können.
APP_ENV=()
init_app_env() {
  local home="${HOME:-/}" v
  if switches_user; then
    home="$(getent passwd "$APP_USER" 2>/dev/null | cut -d: -f6)"
    home="${home:-$BAKERY_VAR}"
  fi
  APP_ENV=(PATH="${PATH:-/usr/local/bin:/usr/bin:/bin}" HOME="$home" LANG="${LANG:-C.UTF-8}")
  for v in LC_ALL TZ TMPDIR http_proxy https_proxy no_proxy HTTP_PROXY HTTPS_PROXY NO_PROXY GIT_CONFIG_NOSYSTEM; do
    if [ -n "${!v+x}" ]; then APP_ENV+=("$v=${!v}"); fi
  done
}

# Build-Schlüssel aus DEPLOY_BUILD_ENV_KEYS als NAME=wert-Liste.
BUILD_KEYS_ENV=()
init_build_keys_env() {
  local pattern name
  BUILD_KEYS_ENV=()
  for pattern in $DEPLOY_BUILD_ENV_KEYS; do
    case "$pattern" in
    *'*')
      for name in $(compgen -v "${pattern%\*}"); do
        # nur exportierte Variablen (aus bakery.env oder der Umgebung)
        if declare -p "$name" 2>/dev/null | grep -q '^declare -[a-zA-Z]*x'; then
          BUILD_KEYS_ENV+=("$name=${!name}")
        fi
      done
      ;;
    *)
      if [ -n "${!pattern+x}" ]; then BUILD_KEYS_ENV+=("$pattern=${!pattern}"); fi
      ;;
    esac
  done
}

# Befehle, die Dateien im Release anlegen, laufen als APP_USER - nie als root -
# und immer mit geleerter Umgebung. Führende NAME=wert-Argumente setzt env.
as_app() {
  if switches_user; then
    if command -v runuser >/dev/null 2>&1; then
      runuser -u "$APP_USER" -- env -i "${APP_ENV[@]}" "$@"
    else
      sudo -u "$APP_USER" -- env -i "${APP_ENV[@]}" "$@"
    fi
  else
    env -i "${APP_ENV[@]}" "$@"
  fi
}

repo_git() {
  as_app git --git-dir="$REPO" "$@"
}

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{ print $1 }'
  else
    shasum -a 256 "$1" | awk '{ print $1 }'
  fi
}

# Symlink atomar umsetzen (GNU mv -T); auf BSD reicht ln -sfn für Tests.
switch_current() {
  local target="$1"
  if mv --version >/dev/null 2>&1; then
    ln -sfn "$target" "$CURRENT.new"
    mv -T "$CURRENT.new" "$CURRENT"
  else
    ln -sfhn "$target" "$CURRENT" 2>/dev/null || ln -sfn "$target" "$CURRENT"
  fi
}

current_release() {
  if [ -L "$CURRENT" ]; then
    basename "$(readlink "$CURRENT")"
  fi
}

read_state() {
  [ -f "$STATE_DIR/$1" ] && cat "$STATE_DIR/$1" || true
}

write_state() {
  mkdir -p "$STATE_DIR"
  printf '%s\n' "$2" >"$STATE_DIR/$1"
}

restart_services() {
  local svc
  for svc in $DEPLOY_SERVICES; do
    log "starte neu: $svc"
    "$SYSTEMCTL" restart "$svc"
  done
}

wait_healthy() {
  local deadline=$(($(now_epoch) + DEPLOY_HEALTH_TIMEOUT))
  local api_reason mgmt_reason
  while :; do
    api_reason="" mgmt_reason=""
    api_reason="$(http_ok "$HEALTH_API_URL" 5)" || true
    mgmt_reason="$(http_ok "$HEALTH_MGMT_URL" 10)" || true
    if [ -z "$api_reason" ] && [ -z "$mgmt_reason" ]; then
      return 0
    fi
    if [ "$(now_epoch)" -ge "$deadline" ]; then
      [ -z "$api_reason" ] || log "API: $api_reason ($HEALTH_API_URL)"
      [ -z "$mgmt_reason" ] || log "Verwaltung: $mgmt_reason ($HEALTH_MGMT_URL)"
      return 1
    fi
    sleep 3
  done
}

notify() {
  if telegram_configured; then
    telegram_send "$1" || true
  fi
}

# Releases heißen <12 Zeichen Commit>-<JJJJMMTThhmmss>; alles andere unter
# releases/ (z. B. der Symlink hq -> Lese-Klon) wird nie angefasst.
is_release_name() {
  local sha="${1%%-*}" stamp="${1#*-}"
  [ "${#sha}" -eq 12 ] && [ "${#stamp}" -eq 14 ] || return 1
  case "$sha" in *[!0-9a-f]*) return 1 ;; esac
  case "$stamp" in *[!0-9]*) return 1 ;; esac
  return 0
}

# Jüngster vollständig gebauter Release-Name zu einem Commit-Präfix (oder leer).
newest_built() {
  local d best=""
  for d in "$RELEASES/$1"-*; do
    [ -f "$d/$MARKER" ] || continue
    is_release_name "$(basename "$d")" || continue
    best="$(basename "$d")"
  done
  printf '%s' "$best"
}

prune_releases() {
  local keep_current keep_previous n=0 dir name
  keep_current="$(current_release)"
  keep_previous="$(read_state deploy-previous)"
  # Neueste zuerst (Änderungszeit), ältere über KEEP_RELEASES hinaus weg.
  # Release-Namen sind SHA-Präfixe, also ohne Leerzeichen - ls ist hier sicher.
  # shellcheck disable=SC2045
  for dir in $(ls -1dt "$RELEASES"/*/ 2>/dev/null); do
    dir="${dir%/}"
    name="$(basename "$dir")"
    is_release_name "$name" || continue
    n=$((n + 1))
    if [ "$n" -le "$KEEP_RELEASES" ] || [ "$name" = "$keep_current" ] || [ "$name" = "$keep_previous" ]; then
      continue
    fi
    log "entferne altes Release $name"
    repo_git worktree remove --force "$dir" 2>/dev/null || rm -rf "$dir"
  done
  repo_git worktree prune || true
}

show_status() {
  local cur prev
  cur="$(current_release)"
  prev="$(read_state deploy-previous)"
  echo "aktuell:   ${cur:-(keins)}"
  echo "vorherig:  ${prev:-(keins)}"
  echo "Releases:"
  local dir
  for dir in "$RELEASES"/*/; do
    [ -d "$dir" ] || continue
    is_release_name "$(basename "$dir")" || continue
    if [ -f "$dir$MARKER" ]; then
      echo "  $(basename "$dir")  $(tr '\n' ' ' <"$dir$MARKER")"
    else
      echo "  $(basename "$dir")  (unvollständig)"
    fi
  done
}

activate() {
  # $1 = Release-Name, $2 = Beschreibung für Log/Telegram
  local name="$1" what="$2" before
  before="$(current_release)"
  [ -f "$RELEASES/$name/$MARKER" ] || die 2 "Release $name ist nicht vollständig gebaut"
  maintenance_on
  switch_current "$RELEASES/$name"
  if [ -n "$before" ] && [ "$before" != "$name" ]; then
    write_state deploy-previous "$before"
  fi
  write_state deploy-current "$name"
  restart_services
  if wait_healthy; then
    rm -f "$STATE_DIR/deploy-failed"
    maintenance_off
    log "$what: $name läuft und ist gesund"
    notify "Bäckerei-Box: $what $name erfolgreich."
    return 0
  fi
  # restore.sh --apply verweigert sich, solange dieses Release aktiv ist:
  # es würde die eingespielte Kopie sofort wieder migrieren. (Nur beim Deploy -
  # nach einem Rollback ist das Einspielen der Kopie gerade der nächste Schritt.)
  if [ "$what" = "Deploy" ]; then
    write_state deploy-failed "$name"
  fi
  maintenance_off
  notify "Bäckerei-Box: $what $name - Health-Check fehlgeschlagen."
  log "Health-Check nach $DEPLOY_HEALTH_TIMEOUT s fehlgeschlagen. Logs: journalctl -u bakery-api -u bakery-management -n 200"
  if [ -n "$before" ] && [ "$before" != "$name" ]; then
    local pre_db
    pre_db="$(read_state deploy-pre-db)"
    log "Zurück auf die vorherige Version (Reihenfolge einhalten, docs/runbook.md §4.1):"
    log "  1. sudo $BAKERY_ROOT/bin/deploy.sh --rollback      (Release $before)"
    log "  2. nur wenn die neue Version die Datenbank migriert hat, DANACH die Kopie von vor dem Deploy:"
    log "     sudo $BAKERY_ROOT/bin/restore.sh --from-file ${pre_db:-<neueste $BAKERY_VAR/backup/snapshots/bakery-pre-deploy-*.db>} --apply"
  fi
  exit 7
}

# --- Argumente ---

mode="deploy"
ref=""
no_restart=0
force_install=0
rebuild=0
skip_backup=0
while [ $# -gt 0 ]; do
  case "$1" in
  --rollback) mode="rollback" ;;
  --status) mode="status" ;;
  --no-restart) no_restart=1 ;;
  --force-install) force_install=1 ;;
  --rebuild) rebuild=1 ;;
  --skip-backup) skip_backup=1 ;;
  -h | --help)
    usage
    exit 0
    ;;
  -*) die 2 "unbekannte Option: $1" ;;
  *)
    [ -z "$ref" ] || die 2 "nur ein REF erlaubt"
    ref="$1"
    ;;
  esac
  shift
done
ref="${ref:-${DEPLOY_REF:-main}}"
case "$ref" in
*[!A-Za-z0-9._/-]* | -*) die 2 "ungültiger REF: $ref" ;;
esac

if [ "$mode" = "status" ]; then
  show_status
  exit 0
fi

init_app_env

[ -d "$REPO" ] || die 2 "Code-Repository fehlt: $REPO (erst install.sh ausführen)"
mkdir -p "$RELEASES"

if ! acquire_lock deploy; then
  die 8 "ein anderes Deploy läuft noch"
fi

if [ "$mode" = "rollback" ]; then
  prev="$(read_state deploy-previous)"
  [ -n "$prev" ] || die 2 "kein vorheriges Release bekannt ($STATE_DIR/deploy-previous)"
  [ -d "$RELEASES/$prev" ] || die 2 "vorheriges Release $prev existiert nicht mehr"
  log "Rollback auf $prev"
  activate "$prev" "Rollback auf"
  exit 0
fi

# --- 1. holen ---

# NEXT_PUBLIC_* werden beim Build in die Web-App eingebacken. Seit F4 ist ein
# leeres NEXT_PUBLIC_API_URL der Normalfall: der Browser fragt /api auf der
# eigenen Origin, Caddy reicht es an die API weiter (gleiche Origin, kein CORS).
# Unveränderte Vorlage: der Build würde einen Host einbacken, den kein Gerät erreicht.
# Eine Domain ist nicht nötig: im LAN-HTTP-Betrieb bis Q2 ist CORS_ORIGIN
# http://<IP oder Name der Box>; der Wechsel auf HTTPS braucht keinen neuen Build.
for key in NEXT_PUBLIC_API_URL CORS_ORIGIN; do
  case "${!key:-}" in
  *example.*) die 2 "$key enthält noch den Platzhalter aus der Vorlage (${!key}) - in /etc/bakery/bakery.env die echte Domain eintragen, im LAN-HTTP-Betrieb (bis Q2) http://<IP oder Name der Box>" ;;
  esac
done

init_build_keys_env

log "hole $ref"
repo_git fetch --prune --tags --quiet origin || die 3 "git fetch fehlgeschlagen"
sha="$(repo_git rev-parse --verify --quiet "refs/remotes/origin/$ref^{commit}" ||
  repo_git rev-parse --verify --quiet "$ref^{commit}" || true)"
[ -n "$sha" ] || die 3 "REF nicht gefunden: $ref"
short="${sha:0:12}"
subject="$(repo_git log -1 --format=%s "$sha")"
log "Commit $short: $subject"

# --- 2. Worktree ---

# Jeder Build bekommt ein neues Verzeichnis <sha12>-<Zeit>. So wird nie das
# Verzeichnis gelöscht oder überschrieben, aus dem die laufende Version läuft -
# auch nicht bei --rebuild desselben Commits (z. B. nach geänderter NEXT_PUBLIC_*).
name="$(newest_built "$short")"
if [ -n "$name" ] && [ "$rebuild" -eq 0 ]; then
  dir="$RELEASES/$name"
  log "Release $name ist schon gebaut - kein neuer Build"
else
  active="$(current_release)"
  for stale in "$RELEASES/$short"-*; do
    [ -d "$stale" ] && [ ! -f "$stale/$MARKER" ] && [ "$(basename "$stale")" != "$active" ] || continue
    log "entferne unvollständigen Build $(basename "$stale")"
    repo_git worktree remove --force "$stale" 2>/dev/null || rm -rf "$stale"
  done
  name="$short-$(date '+%Y%m%d%H%M%S')"
  dir="$RELEASES/$name"
  [ ! -e "$dir" ] || die 2 "$dir existiert schon - eine Sekunde warten und erneut starten"
  log "baue Release $name"
  repo_git worktree prune
  repo_git worktree add --quiet --detach "$dir" "$sha" || die 3 "git worktree add fehlgeschlagen"

  # --- 3. Abhängigkeiten ---

  lock_hash="$(sha256_of "$dir/package-lock.json" 2>/dev/null || echo none)"
  cur="$(current_release)"
  cur_hash=""
  if [ -n "$cur" ] && [ -f "$RELEASES/$cur/.bakery-lock-hash" ]; then
    cur_hash="$(cat "$RELEASES/$cur/.bakery-lock-hash")"
  fi
  install_env=(HUSKY=0 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 PUPPETEER_SKIP_DOWNLOAD=1 CYPRESS_INSTALL_BINARY=0)
  if [ -n "$DEPLOY_INSTALL_CMD" ]; then
    (cd "$dir" && as_app "${install_env[@]}" sh -c "$DEPLOY_INSTALL_CMD") || die 4 "Installation fehlgeschlagen"
  elif [ "$force_install" -eq 0 ] && [ "$lock_hash" = "$cur_hash" ] && [ -d "$RELEASES/$cur/node_modules" ]; then
    log "package-lock.json unverändert - kopiere node_modules von $cur"
    as_app cp -a "$RELEASES/$cur/node_modules" "$dir/node_modules" || die 4 "Kopieren von node_modules fehlgeschlagen"
  else
    log "npm ci (dauert auf dem Pi einige Minuten)"
    (cd "$dir" && as_app "${install_env[@]}" npm ci --no-audit --no-fund) || die 4 "npm ci fehlgeschlagen"
  fi
  as_app sh -c "printf '%s\n' '$lock_hash' > '$dir/.bakery-lock-hash'"

  # --- 4. natives sqlite3 (D12) ---

  if [ "$DEPLOY_SKIP_NATIVE_CHECK" != "1" ]; then
    as_app node "$SCRIPT_DIR/sqlite-tool.js" selftest "$dir" ||
      die 6 "sqlite3 lädt im Release nicht (kein Prebuild für diese Plattform?). Abhilfe: apt install build-essential python3 && cd $dir && npm rebuild sqlite3 --build-from-source"
  fi

  # --- 5. Build ---

  build_env=(${BUILD_KEYS_ENV[@]+"${BUILD_KEYS_ENV[@]}"} NX_DAEMON=false NX_ISOLATE_PLUGINS=false
    NX_NO_CLOUD=true NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS="$DEPLOY_NODE_OPTIONS")
  if [ -n "$DEPLOY_BUILD_CMD" ]; then
    (cd "$dir" && as_app "${build_env[@]}" sh -c "$DEPLOY_BUILD_CMD") || die 5 "Build fehlgeschlagen"
  else
    log "baue bakery-api:bundle"
    (cd "$dir" && as_app "${build_env[@]}" npx nx run bakery-api:bundle) ||
      die 5 "Build bakery-api:bundle fehlgeschlagen"
    log "baue bakery-management"
    (cd "$dir" && as_app "${build_env[@]}" npx nx build bakery-management) ||
      die 5 "Build bakery-management fehlgeschlagen"
  fi
  [ -f "$dir/$API_BUNDLE" ] || die 5 "nach dem Build fehlt $API_BUNDLE"
  [ -f "$dir/$MGMT_BUILD_ID" ] || die 5 "nach dem Build fehlt $MGMT_BUILD_ID"

  as_app sh -c "printf 'sha=%s ref=%s built=%s\n' '$sha' '$ref' '$(date '+%Y-%m-%dT%H:%M')' > '$dir/$MARKER'"
  log "Release $name gebaut"
fi

if [ "$no_restart" -eq 1 ]; then
  log "--no-restart: gebaut, nicht umgeschaltet. Aktiv bleibt: $(current_release)"
  exit 0
fi

if [ "$(current_release)" = "$name" ] && [ "$rebuild" -eq 0 ]; then
  log "Release $name ist bereits aktiv - starte nur neu"
fi

# --- 6. DB-Kopie vor dem Umschalten (Migrationen laufen beim Start) ---

rm -f "$STATE_DIR/deploy-pre-db"
if [ "$skip_backup" -eq 0 ]; then
  db="${DB_PATH:-$BAKERY_VAR/bakery.db}"
  if [ -f "$db" ]; then
    backup_env=(DB_PATH="$db" APP_DIR="$dir" BAKERY_ENV_LOADED=1 BAKERY_ETC="$BAKERY_ETC"
      BAKERY_VAR="$BAKERY_VAR" STATE_DIR="$STATE_DIR")
    for v in BACKUP_DIR BACKUP_KEEP_LOCAL BACKUP_SQLITE_METHOD LOCK_DIR; do
      if [ -n "${!v+x}" ]; then backup_env+=("$v=${!v}"); fi
    done
    pre_db="$(as_app "${backup_env[@]}" "$SCRIPT_DIR/backup.sh" --local-only --label pre-deploy)" ||
      die 2 "DB-Kopie vor dem Deploy fehlgeschlagen - abgebrochen, nichts umgeschaltet (--skip-backup erzwingt)"
    write_state deploy-pre-db "$pre_db"
    log "DB-Kopie vor dem Umschalten: $pre_db"
  else
    log "noch keine Datenbank ($db) - keine Kopie nötig"
  fi
fi

# --- 7. Units und Skripte übernehmen - aus dem root-eigenen Klon, nicht aus dem Release ---

# Das Release gehört APP_USER (npm-Skripte liefen darin). Was root ausführt,
# kommt deshalb aus $DEPLOY_SRC_DIR: root holt denselben Commit selbst von origin.
# Fehlt der Commit dort, stammt er nicht von origin - dann wird nichts umgeschaltet.
update_units() {
  [ -d "$DEPLOY_SRC_DIR/.git" ] ||
    die 2 "root-eigener Klon $DEPLOY_SRC_DIR fehlt (install.sh legt ihn an)"
  git -C "$DEPLOY_SRC_DIR" fetch --quiet --prune --tags origin ||
    die 3 "git fetch im Klon $DEPLOY_SRC_DIR fehlgeschlagen"
  git -C "$DEPLOY_SRC_DIR" -c advice.detachedHead=false checkout --quiet --force --detach "$sha" 2>/dev/null ||
    die 3 "Commit $short ist im Klon $DEPLOY_SRC_DIR (von origin) nicht vorhanden - stammt er wirklich von origin? Nichts umgeschaltet."
  "$DEPLOY_SRC_DIR/deploy/scripts/install.sh" --units-only || die 2 "Aktualisieren der Units fehlgeschlagen"
}

case "$DEPLOY_UPDATE_UNITS" in
1) update_units ;;
0) ;;
*) if [ "$(id -u)" -eq 0 ]; then update_units; fi ;;
esac

# --- 8. umschalten, neu starten, prüfen ---

activate "$name" "Deploy"
prune_releases
