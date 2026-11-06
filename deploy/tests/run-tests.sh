#!/usr/bin/env bash
# run-tests.sh - lokale Tests der Box-Skripte (läuft auf macOS und Linux, ohne
# root, ohne systemd, ohne Netz). Alle Daten sind synthetisch und liegen in
# einem Temp-Verzeichnis.
#
#   deploy/tests/run-tests.sh
#
# Umgebung:
#   TEST_TMP        Arbeitsverzeichnis (Vorgabe: mktemp -d, wird am Ende gelöscht;
#                   KEEP_TEST_TMP=1 behält es zur Fehlersuche)
#   TEST_PORT_BASE  fünf Ports ab hier: API-Stub, Verwaltungs-Stub, Telegram-Stub,
#                   zwei garantiert geschlossene (Vorgabe 5120)
#   TEST_PID_DIR    wohin die PID-Dateien der Stubs geschrieben werden
#
# Nicht abgedeckt (braucht die Box): install.sh, systemd-Units, Caddy, restic
# gegen ein echtes Repository, npm ci/Build im Release.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS="$(cd "$HERE/../scripts" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"

CREATED_TMP=0
if [ -z "${TEST_TMP:-}" ]; then
  TEST_TMP="$(mktemp -d "${TMPDIR:-/tmp}/bakery-deploy-tests.XXXXXX")"
  CREATED_TMP=1
fi
TEST_PID_DIR="${TEST_PID_DIR:-$TEST_TMP}"
BASE="${TEST_PORT_BASE:-5120}"
P_API=$BASE
P_MGMT=$((BASE + 1))
P_TG=$((BASE + 2))
P_CLOSED=$((BASE + 3))
P_CLOSED2=$((BASE + 4))
# Nach dem Test "Telegram nicht erreichbar" wird P_CLOSED2 zum HTTPS-Stub.
P_TLS=$P_CLOSED2

mkdir -p "$TEST_TMP" "$TEST_PID_DIR"
pass=0
fail=0
STUB_PIDS=""

cleanup() {
  local pid
  for pid in $STUB_PIDS; do
    kill "$pid" 2>/dev/null || true
  done
  STUB_PIDS=""
  rm -f "$TEST_PID_DIR"/stub-*.pid
  if [ "$CREATED_TMP" -eq 1 ] && [ "${KEEP_TEST_TMP:-0}" != "1" ] && [ -d "$TEST_TMP" ]; then
    rm -rf "$TEST_TMP"
  fi
}
# Auch bei Abbruch (Strg-C, SIGPIPE durch `| head`) Stubs beenden und aufräumen.
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP
trap 'exit 141' PIPE

ok() {
  pass=$((pass + 1))
  printf '  ok    %s\n' "$1"
}

nok() {
  fail=$((fail + 1))
  printf '  FAIL  %s\n' "$1"
  if [ -n "${2:-}" ] && [ -f "$2" ]; then
    sed 's/^/        | /' "$2" | tail -n 15
  fi
}

# expect CODE NAME CMD... - führt CMD aus, Ausgabe nach $TEST_TMP/last.log
expect() {
  local want="$1" name="$2"
  shift 2
  local rc=0
  "$@" >"$TEST_TMP/last.log" 2>&1 || rc=$?
  if [ "$rc" -eq "$want" ]; then
    ok "$name (exit $rc)"
  else
    nok "$name: exit $rc, erwartet $want" "$TEST_TMP/last.log"
  fi
}

check() {
  local name="$1"
  shift
  if "$@"; then ok "$name"; else nok "$name" "$TEST_TMP/last.log"; fi
}

log_has() {
  grep -q -- "$1" "$TEST_TMP/last.log"
}

port_open() {
  (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

start_stub() {
  local port="$1" logfile="$2"
  shift 2
  python3 "$HERE/stub_server.py" "$port" "$logfile" "$@" &
  local pid=$!
  STUB_PIDS="$STUB_PIDS $pid"
  echo "$pid" >"$TEST_PID_DIR/stub-$port.pid"
  local _
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    port_open "$port" && return 0
    sleep 0.2
  done
  echo "Stub auf Port $port startet nicht" >&2
  exit 1
}

# gemeinsame Umgebung: nichts aus /etc/bakery laden, alles im Temp-Verzeichnis
export BAKERY_ENV_LOADED=1
export BAKERY_ETC="$TEST_TMP/etc"
export BAKERY_VAR="$TEST_TMP/var"
export STATE_DIR="$BAKERY_VAR/state"
export GIT_AUTHOR_NAME="Test" GIT_AUTHOR_EMAIL="test@example.invalid"
export GIT_COMMITTER_NAME="Test" GIT_COMMITTER_EMAIL="test@example.invalid"
export GIT_CONFIG_NOSYSTEM=1
export HOME="$TEST_TMP/home"
mkdir -p "$BAKERY_ETC" "$BAKERY_VAR" "$HOME"
unset TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID RESTIC_REPOSITORY RESTIC_PASSWORD RESTIC_PASSWORD_FILE HQ_GITHUB_TOKEN

for p in "$P_CLOSED" "$P_CLOSED2"; do
  if port_open "$p"; then
    echo "Port $p ist belegt - TEST_PORT_BASE anders setzen" >&2
    exit 1
  fi
done

echo "Arbeitsverzeichnis: $TEST_TMP"

# ---------------------------------------------------------------------------
echo "sqlite-tool.js"

DB="$TEST_TMP/sample.db"
node -e "
const sqlite3 = require(require.resolve('sqlite3', { paths: ['$REPO_ROOT'] }));
const db = new sqlite3.Database('$DB');
db.serialize(() => {
  db.run('PRAGMA journal_mode=WAL');
  db.run('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');
  db.run(\"INSERT INTO users (name) VALUES ('Testperson A'), ('Testperson B')\");
  db.run('CREATE TABLE preorders (id INTEGER PRIMARY KEY, qty INTEGER)');
  db.run('INSERT INTO preorders (qty) VALUES (3)');
});
db.close();
" >"$TEST_TMP/last.log" 2>&1 || {
  echo "Test-DB lässt sich nicht anlegen (npm-Modul sqlite3 im Repo?)" >&2
  cat "$TEST_TMP/last.log" >&2
  exit 1
}

expect 0 "selftest im Repo" node "$SCRIPTS/sqlite-tool.js" selftest "$REPO_ROOT"
expect 3 "selftest ohne node_modules -> Modul fehlt" env APP_DIR= node "$SCRIPTS/sqlite-tool.js" selftest "$TEST_TMP/leer"
expect 0 "backup (VACUUM INTO) einer WAL-DB" node "$SCRIPTS/sqlite-tool.js" backup "$DB" "$TEST_TMP/copy.db" "$REPO_ROOT"
expect 0 "check der Kopie" node "$SCRIPTS/sqlite-tool.js" check "$TEST_TMP/copy.db" "$REPO_ROOT"
check "check zählt Zeilen" log_has "users .* 2"
printf 'kein sqlite' >"$TEST_TMP/broken.db"
expect 1 "check einer kaputten Datei" node "$SCRIPTS/sqlite-tool.js" check "$TEST_TMP/broken.db" "$REPO_ROOT"

# ---------------------------------------------------------------------------
echo "lib.sh"

ETC2="$TEST_TMP/etc2"
mkdir -p "$ETC2"
cat >"$ETC2/bakery.env" <<'ENVFILE'
NEXT_PUBLIC_API_URL=https://intern.baeckerei.test
NEXT_PUBLIC_PILOT_MODE=1
CORS_ORIGIN=https://intern.baeckerei.test
API_URL=http://127.0.0.1:5000
JWT_SECRET=sentinel-jwt-0815
HQ_GITHUB_TOKEN=sentinel-hq-0815
ENVFILE
cat >"$ETC2/ops.env" <<'ENVFILE'
TELEGRAM_CHAT_ID=7
AWS_SECRET_ACCESS_KEY=sentinel-aws-0815
RESTIC_PASSWORD_FILE=/nirgends
DEPLOY_REF="mit Leer zeichen"
ENVFILE
# shellcheck disable=SC2016
expect 0 "load_env_files mit Präfixen" env -u BAKERY_ENV_LOADED BAKERY_ETC="$ETC2" bash -c '
  . "$1"; load_env_files TELEGRAM_ DEPLOY_
  echo "chat=${TELEGRAM_CHAT_ID:-} aws=${AWS_SECRET_ACCESS_KEY:-leer} pw=${RESTIC_PASSWORD_FILE:-leer} ref=${DEPLOY_REF:-} api=${NEXT_PUBLIC_API_URL:-}"' _ "$SCRIPTS/lib.sh"
check "ops.env: nur TELEGRAM_/DEPLOY_ übernommen" log_has "chat=7 aws=leer pw=leer ref=mit Leer zeichen api=https://intern.baeckerei.test"
# shellcheck disable=SC2016
expect 0 "load_env_files ohne Präfixe lädt alles" env -u BAKERY_ENV_LOADED BAKERY_ETC="$ETC2" bash -c '
  . "$1"; load_env_files; echo "aws=${AWS_SECRET_ACCESS_KEY:-leer}"' _ "$SCRIPTS/lib.sh"
check "ops.env vollständig" log_has "aws=sentinel-aws-0815"

# ---------------------------------------------------------------------------
echo "hq-sync.sh"

ORIGIN="$TEST_TMP/hq-origin.git"
SEED="$TEST_TMP/hq-seed"
export HQ_DIR="$BAKERY_VAR/hq"
git init --quiet --bare --initial-branch=main "$ORIGIN"
git init --quiet --initial-branch=main "$SEED"
mkdir -p "$SEED/products"
printf -- '---\nid: testbrot\nname: Testbrot\nprice: 1.00\n---\nSynthetisch.\n' >"$SEED/products/1-testbrot.md"
git -C "$SEED" add -A && git -C "$SEED" commit --quiet -m "seed"
git -C "$SEED" remote add origin "$ORIGIN" && git -C "$SEED" push --quiet origin main
git clone --quiet "$ORIGIN" "$HQ_DIR"

expect 2 "ohne Markierung bakery.role -> Abbruch" "$SCRIPTS/hq-sync.sh"
check "Meldung nennt den Befehl" log_has "config bakery.role read-clone"
git -C "$HQ_DIR" config bakery.role read-clone
expect 0 "erster Sync" "$SCRIPTS/hq-sync.sh"
check "Statusdatei geschrieben" test -f "$STATE_DIR/hq-sync.ok"
check "unverändert gemeldet" log_has "unverändert"

printf 'neu\n' >"$SEED/products/2-neu.md"
git -C "$SEED" add -A && git -C "$SEED" commit --quiet -m "zweites Produkt" && git -C "$SEED" push --quiet origin main
printf 'lokal geändert\n' >>"$HQ_DIR/products/1-testbrot.md"
printf 'unversioniert\n' >"$HQ_DIR/products/99-fremd.md"
expect 0 "Sync nach neuem Commit + lokale Änderungen" "$SCRIPTS/hq-sync.sh"
check "auf origin/main" test "$(git -C "$HQ_DIR" rev-parse HEAD)" = "$(git -C "$ORIGIN" rev-parse main)"
check "lokale Änderung verworfen" sh -c "! grep -q 'lokal geändert' '$HQ_DIR/products/1-testbrot.md'"
check "unversionierte Datei entfernt" test ! -e "$HQ_DIR/products/99-fremd.md"
check "aktualisiert gemeldet" log_has "aktualisiert .*1 Commit"

git -C "$HQ_DIR" commit --quiet --allow-empty -m "verbotener lokaler Commit"
expect 4 "lokaler Commit im Lese-Klon -> Abbruch" "$SCRIPTS/hq-sync.sh"
check "lokaler Commit bleibt erhalten" sh -c "git -C '$HQ_DIR' log -1 --format=%s | grep -q verboten"
expect 0 "HQ_SYNC_FORCE=1 verwirft ihn" env HQ_SYNC_FORCE=1 "$SCRIPTS/hq-sync.sh"

expect 2 "HQ_WRITE_DIR = HQ_DIR -> Abbruch" env HQ_WRITE_DIR="$HQ_DIR" "$SCRIPTS/hq-sync.sh"

git -C "$HQ_DIR" checkout --quiet -b irgendwas
expect 0 "anderer Branch ausgecheckt -> zurück auf main" "$SCRIPTS/hq-sync.sh"
check "Branch ist main" test "$(git -C "$HQ_DIR" rev-parse --abbrev-ref HEAD)" = "main"

mv "$ORIGIN" "$ORIGIN.weg"
expect 3 "origin nicht erreichbar -> exit 3" "$SCRIPTS/hq-sync.sh"
mv "$ORIGIN.weg" "$ORIGIN"

expect 2 "HQ_DIR ohne Klon -> exit 2" env HQ_DIR="$TEST_TMP/nix" "$SCRIPTS/hq-sync.sh"

# ---------------------------------------------------------------------------
echo "health.sh"

TG_LOG="$TEST_TMP/telegram.log"
: >"$TG_LOG"
start_stub "$P_API" "$TEST_TMP/api-stub.log"
start_stub "$P_MGMT" "$TEST_TMP/mgmt-stub.log"
start_stub "$P_TG" "$TG_LOG"

export HEALTH_API_URL="http://127.0.0.1:$P_API/health"
export HEALTH_MGMT_URL="http://127.0.0.1:$P_MGMT/"
export HEALTH_RETRY_DELAY=0
export HEALTH_CHECKS="api management"
export HEALTH_HOST_LABEL="testbox"
TG_ENV=(TELEGRAM_BOT_TOKEN=123:geheim TELEGRAM_CHAT_ID=42 TELEGRAM_API_URL="http://127.0.0.1:$P_TG")
rm -f "$STATE_DIR/health.state"

tg_count() { grep -c '^POST' "$TG_LOG" 2>/dev/null || true; }

expect 0 "alles gesund" env "${TG_ENV[@]}" "$SCRIPTS/health.sh"
check "keine Nachricht beim ersten gesunden Lauf" test "$(tg_count)" = "0"

expect 1 "API aus -> Störung" env "${TG_ENV[@]}" HEALTH_API_URL="http://127.0.0.1:$P_CLOSED/health" "$SCRIPTS/health.sh"
check "eine Telegram-Nachricht" test "$(tg_count)" = "1"
check "Nachricht nennt die API" grep -q "STÖRUNG Bäckerei-Box testbox" "$TG_LOG"
check "Token nicht im Stub-Log" sh -c "! grep -q geheim '$TG_LOG'"

expect 1 "API weiter aus -> keine zweite Nachricht" env "${TG_ENV[@]}" HEALTH_API_URL="http://127.0.0.1:$P_CLOSED/health" "$SCRIPTS/health.sh"
check "weiterhin eine Nachricht" test "$(tg_count)" = "1"

expect 0 "API wieder da -> Entwarnung" env "${TG_ENV[@]}" "$SCRIPTS/health.sh"
check "zweite Nachricht: WIEDER OK" sh -c "test \"\$(grep -c '^POST' '$TG_LOG')\" = 2 && grep -q 'WIEDER OK auf testbox' '$TG_LOG'"

expect 1 "Telegram nicht erreichbar bei Störung" env TELEGRAM_BOT_TOKEN=1 TELEGRAM_CHAT_ID=1 TELEGRAM_API_URL="http://127.0.0.1:$P_CLOSED2" HEALTH_MGMT_URL="http://127.0.0.1:$P_CLOSED/" "$SCRIPTS/health.sh"
check "Zustand bleibt ok, damit erneut gemeldet wird" grep -q "management=ok" "$STATE_DIR/health.state"
expect 1 "nächster Lauf meldet nach" env "${TG_ENV[@]}" HEALTH_MGMT_URL="http://127.0.0.1:$P_CLOSED/" "$SCRIPTS/health.sh"
check "Nachricht nennt die Verwaltung" grep -q "Verwaltung (Web-App): keine Verbindung" "$TG_LOG"
expect 0 "zurück auf gesund" env "${TG_ENV[@]}" "$SCRIPTS/health.sh"

before="$(tg_count)"
touch "$STATE_DIR/maintenance"
expect 1 "Wartung: Störung ohne Nachricht" env "${TG_ENV[@]}" HEALTH_API_URL="http://127.0.0.1:$P_CLOSED/health" "$SCRIPTS/health.sh"
check "keine Nachricht während Wartung" test "$(tg_count)" = "$before"
check "Zustand während Wartung unverändert" grep -q "api=ok" "$STATE_DIR/health.state"
rm -f "$STATE_DIR/maintenance"

expect 1 "ohne Telegram: Störung nur im Log" env HEALTH_API_URL="http://127.0.0.1:$P_CLOSED/health" "$SCRIPTS/health.sh"
check "Log sagt, dass Telegram fehlt" log_has "Telegram nicht konfiguriert"
expect 0 "ohne Telegram: wieder gesund" "$SCRIPTS/health.sh"

mkdir -p "$BAKERY_VAR/backup"
expect 1 "Backup-Prüfung: noch nie gesichert" env HEALTH_CHECKS="backup" "$SCRIPTS/health.sh"
touch -t 202001010000 "$BAKERY_VAR/backup/last-success"
expect 1 "Backup-Prüfung: zu alt" env HEALTH_CHECKS="backup" "$SCRIPTS/health.sh"
touch "$BAKERY_VAR/backup/last-success"
expect 0 "Backup-Prüfung: frisch" env HEALTH_CHECKS="backup" "$SCRIPTS/health.sh"
expect 0 "hq-Sync-Prüfung: frisch" env HEALTH_CHECKS="hq-sync" "$SCRIPTS/health.sh"
expect 0 "Platten-Prüfung" env HEALTH_CHECKS="disk" "$SCRIPTS/health.sh"
expect 1 "Platten-Prüfung mit Grenze 0 %" env HEALTH_CHECKS="disk" DISK_MAX_PERCENT=0 "$SCRIPTS/health.sh"
expect 2 "unbekannte Prüfung" env HEALTH_CHECKS="quatsch" "$SCRIPTS/health.sh"

# HTTPS über "Caddy" (Stub mit selbst signiertem Zertifikat auf P_TLS)
TLS_HOST="intern.baeckerei.test"
openssl req -x509 -newkey rsa:2048 -nodes -days 200 -subj "/CN=$TLS_HOST" \
  -addext "subjectAltName=DNS:$TLS_HOST" -keyout "$TEST_TMP/tls.key" -out "$TEST_TMP/tls.crt" >/dev/null 2>&1
start_stub "$P_TLS" "$TEST_TMP/tls-stub.log" "$TEST_TMP/tls.crt" "$TEST_TMP/tls.key"
TLS_ENV=(HEALTH_CHECKS=tls HEALTH_TLS_HOST="$TLS_HOST" HEALTH_TLS_PORT="$P_TLS" HEALTH_TLS_CAFILE="$TEST_TMP/tls.crt")
expect 0 "TLS ohne HEALTH_TLS_HOST übersprungen" env HEALTH_CHECKS=tls HEALTH_TLS_HOST= "$SCRIPTS/health.sh"
check "Log: übersprungen" log_has "TLS-Prüfung übersprungen"
expect 0 "TLS gültig, Restlaufzeit reicht" env "${TLS_ENV[@]}" "$SCRIPTS/health.sh"
expect 1 "TLS: Zertifikat läuft bald ab (Grenze 300 Tage)" env "${TLS_ENV[@]}" HEALTH_TLS_MIN_DAYS=300 "$SCRIPTS/health.sh"
check "Meldung nennt Ablauf und acme" sh -c "grep -q 'weniger als 300 Tagen' '$TEST_TMP/last.log' && grep -q 'acme' '$TEST_TMP/last.log'"
expect 1 "TLS: Zertifikat nicht vertrauenswürdig" env "${TLS_ENV[@]}" HEALTH_TLS_CAFILE= "$SCRIPTS/health.sh"
check "Meldung: keine gültige HTTPS-Verbindung" log_has "keine gültige HTTPS-Verbindung"
expect 1 "TLS: Caddy aus" env "${TLS_ENV[@]}" HEALTH_TLS_PORT="$P_CLOSED" "$SCRIPTS/health.sh"
expect 0 "TLS wieder gut" env "${TLS_ENV[@]}" "$SCRIPTS/health.sh"

# ---------------------------------------------------------------------------
echo "backup.sh / restore.sh"

export DB_PATH="$BAKERY_VAR/bakery.db"
export BACKUP_DIR="$BAKERY_VAR/backup"
cp "$DB" "$DB_PATH"
rm -f "$BACKUP_DIR/last-success"
NO_RESTIC_PATH="/usr/bin:/bin:/usr/sbin:/sbin:$(dirname "$(command -v node)")"

expect 2 "DB fehlt" env DB_PATH="$TEST_TMP/gibtsnicht.db" "$SCRIPTS/backup.sh"
expect 10 "CLI-Kopie ok, restic fehlt -> exit 10" env PATH="$NO_RESTIC_PATH" BACKUP_SQLITE_METHOD=cli "$SCRIPTS/backup.sh"
check "Meldung: restic nicht installiert" log_has "restic ist nicht installiert"
check "lokale Kopie trotzdem da" sh -c "ls '$BACKUP_DIR'/snapshots/bakery-nightly-*.db >/dev/null"
check "kein last-success ohne Off-site" test ! -e "$BACKUP_DIR/last-success"
expect 10 "node-Kopie (ohne sqlite3-CLI) ok, restic fehlt" env PATH="$NO_RESTIC_PATH" BACKUP_SQLITE_METHOD=node APP_DIR="$REPO_ROOT" "$SCRIPTS/backup.sh"
check "Log nennt Methode node" log_has "lokale Kopie ok (node"
expect 5 "node-Kopie ohne sqlite3-Modul -> exit 5" env PATH="$NO_RESTIC_PATH" BACKUP_SQLITE_METHOD=node APP_DIR="$TEST_TMP/leer" "$SCRIPTS/backup.sh"

for _ in 1 2 3; do
  env BACKUP_KEEP_LOCAL=2 "$SCRIPTS/backup.sh" --local-only --label probe >"$TEST_TMP/last.log" 2>&1
  sleep 1
done
check "lokale Aufbewahrung: 2 von 3 behalten" test "$(find "$BACKUP_DIR/snapshots" -name 'bakery-probe-*.db' | wc -l | tr -d ' ')" = "2"
expect 2 "ungültiges Label" "$SCRIPTS/backup.sh" --local-only --label 'a b'

# restic-Attrappe: protokolliert die Aufrufe
FAKEBIN="$TEST_TMP/fakebin"
mkdir -p "$FAKEBIN"
cat >"$FAKEBIN/restic" <<EOF
#!/bin/sh
echo "restic \$*" >>"$TEST_TMP/restic.log"
exit \${FAKE_RESTIC_EXIT:-0}
EOF
chmod +x "$FAKEBIN/restic"
printf 'testpasswort\n' >"$BAKERY_ETC/restic-password"
printf 'TELEGRAM_CHAT_ID=1\n' >"$BAKERY_ETC/ops.env"
printf 'PORT=5000\n' >"$BAKERY_ETC/bakery.env"

expect 11 "restic da, Ziel fehlt -> exit 11" env PATH="$FAKEBIN:$PATH" "$SCRIPTS/backup.sh"
check "Meldung nennt Q4" log_has "Q4"
expect 11 "Passwortdatei fehlt -> exit 11" env PATH="$FAKEBIN:$PATH" RESTIC_REPOSITORY="$TEST_TMP/repo" RESTIC_PASSWORD_FILE="$TEST_TMP/nix" "$SCRIPTS/backup.sh"
rm -f "$BACKUP_DIR/last-success" "$TEST_TMP/restic.log"
expect 0 "voller Lauf mit restic-Attrappe" env PATH="$FAKEBIN:$PATH" RESTIC_REPOSITORY="$TEST_TMP/repo" RESTIC_PASSWORD_FILE="$BAKERY_ETC/restic-password" "$SCRIPTS/backup.sh"
check "restic backup mit current/bakery.db" grep -q "restic backup .*backup/current/bakery.db" "$TEST_TMP/restic.log"
check "Passwortdatei nicht im Backup" sh -c "! grep -q 'restic-password' '$TEST_TMP/restic.log'"
check "ops.env nicht im Backup" sh -c "! grep -q 'ops.env' '$TEST_TMP/restic.log'"
check "bakery.env im Backup" grep -q "restic backup .*$BAKERY_ETC/bakery.env" "$TEST_TMP/restic.log"
check "forget --keep-daily 14 --keep-weekly 8 --prune" grep -q "restic forget .*--keep-daily 14 --keep-weekly 8 --prune" "$TEST_TMP/restic.log"
check "last-success geschrieben" test -f "$BACKUP_DIR/last-success"
: >"$TEST_TMP/restic.log"
mkdir -p "$TEST_TMP/creds" && printf 'credpw\n' >"$TEST_TMP/creds/restic-password"
expect 0 "RESTIC_FORGET=0 + Credential aus systemd" env PATH="$FAKEBIN:$PATH" RESTIC_FORGET=0 CREDENTIALS_DIRECTORY="$TEST_TMP/creds" RESTIC_REPOSITORY="$TEST_TMP/repo" RESTIC_PASSWORD_FILE="$TEST_TMP/nix" "$SCRIPTS/backup.sh"
check "kein forget bei RESTIC_FORGET=0" sh -c "! grep -q 'restic forget' '$TEST_TMP/restic.log'"
check "Log: Append-only" log_has "RESTIC_FORGET=0"
expect 12 "restic backup schlägt fehl -> exit 12" env PATH="$FAKEBIN:$PATH" FAKE_RESTIC_EXIT=1 RESTIC_REPOSITORY="$TEST_TMP/repo" RESTIC_PASSWORD_FILE="$BAKERY_ETC/restic-password" "$SCRIPTS/backup.sh"

SNAP="$(find "$BACKUP_DIR/snapshots" -name 'bakery-nightly-*.db' | sort | tail -n 1)"
expect 0 "restore --from-file prüft die Kopie" "$SCRIPTS/restore.sh" --from-file "$SNAP" --target "$TEST_TMP/restore1"
check "restore zeigt Tabellen" log_has "users"
expect 6 "restore einer kaputten Datei" "$SCRIPTS/restore.sh" --from-file "$TEST_TMP/broken.db" --target "$TEST_TMP/restore2"

STUB_SYSTEMCTL="$FAKEBIN/systemctl"
cat >"$STUB_SYSTEMCTL" <<EOF
#!/bin/sh
if [ -e "$STATE_DIR/maintenance" ]; then m=ja; else m=nein; fi
echo "systemctl \$* wartung=\$m" >>"$TEST_TMP/systemctl.log"
EOF
chmod +x "$STUB_SYSTEMCTL"
printf 'wal' >"$DB_PATH-wal"
printf 'shm' >"$DB_PATH-shm"
expect 0 "restore --apply (Attrappe systemctl)" env RESTORE_ALLOW_NONROOT=1 SYSTEMCTL="$STUB_SYSTEMCTL" "$SCRIPTS/restore.sh" --from-file "$SNAP" --target "$TEST_TMP/restore3" --apply
check "API gestoppt und gestartet" sh -c "grep -q 'stop bakery-api' '$TEST_TMP/systemctl.log' && grep -q 'start bakery-api' '$TEST_TMP/systemctl.log'"
check "Wartung während stop/start gesetzt" sh -c "grep -q 'stop bakery-api.service wartung=ja' '$TEST_TMP/systemctl.log' && grep -q 'start bakery-api.service wartung=ja' '$TEST_TMP/systemctl.log'"
check "Wartung danach entfernt" test ! -e "$STATE_DIR/maintenance"
check "alte -wal/-shm beiseite gelegt" sh -c "test ! -e '$DB_PATH-wal' && test ! -e '$DB_PATH-shm' && ls '$DB_PATH'.vor-restore-*-wal >/dev/null"
expect 0 "eingespielte DB ist gültig" node "$SCRIPTS/sqlite-tool.js" check "$DB_PATH" "$REPO_ROOT"
expect 2 "--apply ohne root verweigert" "$SCRIPTS/restore.sh" --from-file "$SNAP" --apply
# laufendes Backup hält die Sperre -> kein Einspielen
if command -v flock >/dev/null 2>&1; then
  (flock 9 && sleep 5) 9>"$STATE_DIR/backup.lock" &
  holder=$!
  sleep 0.5
else
  mkdir "$STATE_DIR/backup.lockdir"
  holder=""
fi
: >"$TEST_TMP/systemctl.log"
expect 2 "--apply während eines Backups verweigert" env RESTORE_ALLOW_NONROOT=1 SYSTEMCTL="$STUB_SYSTEMCTL" "$SCRIPTS/restore.sh" --from-file "$SNAP" --target "$TEST_TMP/restore4" --apply
check "API nicht angefasst" test ! -s "$TEST_TMP/systemctl.log"
if [ -n "$holder" ]; then
  kill "$holder" 2>/dev/null
  wait "$holder" 2>/dev/null
else
  rmdir "$STATE_DIR/backup.lockdir"
fi

# ---------------------------------------------------------------------------
echo "deploy.sh"

W_ORIGIN="$TEST_TMP/website-origin.git"
W_SEED="$TEST_TMP/website-seed"
export BAKERY_ROOT="$TEST_TMP/opt"
git init --quiet --bare --initial-branch=main "$W_ORIGIN"
git init --quiet --initial-branch=main "$W_SEED"
printf '{"lockfileVersion": 3}\n' >"$W_SEED/package-lock.json"
# Attrappe von install.sh: deploy.sh ruft sie aus dem root-eigenen Klon auf.
mkdir -p "$W_SEED/deploy/scripts"
cat >"$W_SEED/deploy/scripts/install.sh" <<STUB
#!/bin/sh
echo "units \$* \$(git -C "\$(dirname "\$0")/../.." rev-parse HEAD)" >>"$TEST_TMP/units.log"
STUB
chmod +x "$W_SEED/deploy/scripts/install.sh"
git -C "$W_SEED" add -A && git -C "$W_SEED" commit --quiet -m "Release eins"
git -C "$W_SEED" remote add origin "$W_ORIGIN" && git -C "$W_SEED" push --quiet origin main
mkdir -p "$BAKERY_ROOT/releases"
git clone --quiet --bare "$W_ORIGIN" "$BAKERY_ROOT/repo.git"
git --git-dir="$BAKERY_ROOT/repo.git" config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'
ln -s "$BAKERY_VAR/hq" "$BAKERY_ROOT/releases/hq"
git clone --quiet "$W_ORIGIN" "$TEST_TMP/src"

: >"$TEST_TMP/systemctl.log"
DEPLOY_ENV=(APP_USER="$(id -un)" SYSTEMCTL="$STUB_SYSTEMCTL" DEPLOY_SKIP_NATIVE_CHECK=1
  DEPLOY_HEALTH_TIMEOUT=3 DB_PATH="$TEST_TMP/keine.db" NEXT_PUBLIC_API_URL="https://intern.baeckerei.test"
  DEPLOY_UPDATE_UNITS=1 DEPLOY_SRC_DIR="$TEST_TMP/src"
  DEPLOY_INSTALL_CMD="mkdir -p node_modules && echo installiert > node_modules/.marker && env > '$TEST_TMP/install-env.txt'"
  DEPLOY_BUILD_CMD="mkdir -p dist/apps/bakery-api/bundle dist/apps/bakery-management/.next && echo '//' > dist/apps/bakery-api/bundle/main.js && echo test > dist/apps/bakery-management/.next/BUILD_ID && env > '$TEST_TMP/build-env.txt'")

# Release-Verzeichnisse heißen <sha12>-<Zeit>; verglichen wird der Commit-Teil.
rel() { basename "$(readlink "$BAKERY_ROOT/current")" | cut -c1-12; }
active_ok() { test -f "$(readlink "$BAKERY_ROOT/current")/.bakery-release" && test -f "$(readlink "$BAKERY_ROOT/current")/dist/apps/bakery-api/bundle/main.js"; }
sha12() { git -C "$W_SEED" rev-parse HEAD | cut -c1-12; }

# F4: leer = gleiche Origin (Caddy) - kein Abbruch, es geht bis zur REF-Suche.
expect 3 "leeres NEXT_PUBLIC_API_URL ist erlaubt (gleiche Origin)" env "${DEPLOY_ENV[@]}" NEXT_PUBLIC_API_URL= "$SCRIPTS/deploy.sh" gibtsnicht
expect 2 "NEXT_PUBLIC_API_URL aus der Vorlage -> Abbruch" env "${DEPLOY_ENV[@]}" NEXT_PUBLIC_API_URL=https://intern.example.de "$SCRIPTS/deploy.sh" main
check "Meldung nennt den Platzhalter" log_has "Platzhalter aus der Vorlage"
expect 2 "CORS_ORIGIN aus der Vorlage -> Abbruch" env "${DEPLOY_ENV[@]}" CORS_ORIGIN=https://intern.example.de "$SCRIPTS/deploy.sh" main
expect 2 "ungültiger REF" env "${DEPLOY_ENV[@]}" "$SCRIPTS/deploy.sh" "main;rm"
expect 3 "unbekannter REF" env "${DEPLOY_ENV[@]}" "$SCRIPTS/deploy.sh" gibtsnicht
# Erstes Deploy liest bakery.env/ops.env aus ETC2 (mit Geheimnis-Attrappen)
# und bekommt zusätzlich Geheimnisse aus der aufrufenden Umgebung.
expect 0 "erstes Deploy" env -u BAKERY_ENV_LOADED "${DEPLOY_ENV[@]}" BAKERY_ETC="$ETC2" \
  TELEGRAM_BOT_TOKEN=sentinel-tg-0815 RESTIC_PASSWORD=sentinel-restic-0815 "$SCRIPTS/deploy.sh" main
FIRST="$(sha12)"
check "npm ci sieht keine Geheimnisse" sh -c "test -s '$TEST_TMP/install-env.txt' && ! grep -q sentinel '$TEST_TMP/install-env.txt'"
check "Build sieht keine Geheimnisse" sh -c "test -s '$TEST_TMP/build-env.txt' && ! grep -q sentinel '$TEST_TMP/build-env.txt'"
check "Build sieht NEXT_PUBLIC_*/API_URL aus bakery.env" sh -c "grep -q '^NEXT_PUBLIC_API_URL=https://intern.baeckerei.test' '$TEST_TMP/build-env.txt' && grep -q '^NEXT_PUBLIC_PILOT_MODE=1' '$TEST_TMP/build-env.txt' && grep -q '^API_URL=' '$TEST_TMP/build-env.txt' && grep -q '^NODE_ENV=production' '$TEST_TMP/build-env.txt'"
check "npm ci ohne Build-Schlüssel" sh -c "! grep -q '^NEXT_PUBLIC_' '$TEST_TMP/install-env.txt' && grep -q '^HUSKY=0' '$TEST_TMP/install-env.txt'"
check "Units aus dem root-eigenen Klon, gleicher Commit" grep -q "units --units-only $(git -C "$W_SEED" rev-parse HEAD)" "$TEST_TMP/units.log"
check "current zeigt auf Release eins" test "$(rel)" = "$FIRST"
check "Dienste neu gestartet" grep -q "restart bakery-api.service" "$TEST_TMP/systemctl.log"
check "Wartungsmarkierung wieder entfernt" test ! -e "$STATE_DIR/maintenance"

printf 'zwei\n' >"$W_SEED/README.md"
git -C "$W_SEED" add -A && git -C "$W_SEED" commit --quiet -m "Release zwei" && git -C "$W_SEED" push --quiet origin main
SECOND="$(sha12)"
expect 0 "zweites Deploy (Lockfile gleich -> node_modules kopiert)" env "${DEPLOY_ENV[@]}" DEPLOY_INSTALL_CMD= "$SCRIPTS/deploy.sh"
check "Log: node_modules kopiert" log_has "kopiere node_modules"
check "node_modules im neuen Release" test -f "$BAKERY_ROOT/current/node_modules/.marker"
check "current zeigt auf Release zwei" test "$(rel)" = "$SECOND"
check "vorheriges Release vermerkt" test "$(cut -c1-12 "$STATE_DIR/deploy-previous")" = "$FIRST"
expect 0 "--status" env "${DEPLOY_ENV[@]}" "$SCRIPTS/deploy.sh" --status
check "Status nennt beide Releases" sh -c "grep -q '$FIRST' '$TEST_TMP/last.log' && grep -q '$SECOND' '$TEST_TMP/last.log'"
check "Status listet den hq-Symlink nicht" sh -c "! grep -q '  hq ' '$TEST_TMP/last.log'"

expect 0 "--rollback" env "${DEPLOY_ENV[@]}" "$SCRIPTS/deploy.sh" --rollback
check "current wieder Release eins" test "$(rel)" = "$FIRST"
expect 0 "erneut main (schon gebaut, kein Build)" env "${DEPLOY_ENV[@]}" "$SCRIPTS/deploy.sh" main
check "Log: schon gebaut" log_has "schon gebaut"
check "current wieder Release zwei" test "$(rel)" = "$SECOND"

ACTIVE_DIR="$(readlink "$BAKERY_ROOT/current")"
sleep 1
expect 0 "--no-restart --rebuild des aktiven Commits baut daneben" env "${DEPLOY_ENV[@]}" "$SCRIPTS/deploy.sh" --no-restart --rebuild main
check "current unverändert" test "$(readlink "$BAKERY_ROOT/current")" = "$ACTIVE_DIR"
check "laufendes Release beim Rebuild unangetastet" active_ok
check "zweiter Build desselben Commits liegt daneben" test "$(find "$BAKERY_ROOT/releases" -maxdepth 1 -name "$SECOND-*" | wc -l | tr -d ' ')" = "2"

printf 'drei\n' >"$W_SEED/README.md"
git -C "$W_SEED" add -A && git -C "$W_SEED" commit --quiet -m "Release drei" && git -C "$W_SEED" push --quiet origin main
THIRD="$(sha12)"
expect 7 "Health-Check schlägt fehl -> exit 7" env "${DEPLOY_ENV[@]}" HEALTH_API_URL="http://127.0.0.1:$P_CLOSED/health" "$SCRIPTS/deploy.sh" main
check "Rollback-Hinweis" log_has "deploy.sh --rollback"
check "Hinweis: erst Rollback, dann restore" awk '/1\. sudo .*deploy\.sh --rollback/ { r = NR } /restore\.sh --from-file/ { s = NR } END { exit !(r && s && r < s) }' "$TEST_TMP/last.log"
check "fehlgeschlagenes Release vermerkt" test "$(cut -c1-12 "$STATE_DIR/deploy-failed")" = "$THIRD"
expect 2 "restore --apply auf dem fehlgeschlagenen Release verweigert" env RESTORE_ALLOW_NONROOT=1 SYSTEMCTL="$STUB_SYSTEMCTL" "$SCRIPTS/restore.sh" --from-file "$SNAP" --target "$TEST_TMP/restore5" --apply
check "Meldung: erst --rollback" log_has "Erst: sudo .*deploy.sh --rollback"
check "kein automatisches Zurückschalten" test "$(rel)" = "$THIRD"
check "Wartungsmarkierung entfernt" test ! -e "$STATE_DIR/maintenance"
expect 0 "Rollback nach fehlgeschlagenem Deploy" env "${DEPLOY_ENV[@]}" "$SCRIPTS/deploy.sh" --rollback
check "zurück auf Release zwei" test "$(rel)" = "$SECOND"
check "deploy-failed nach Rollback entfernt" test ! -e "$STATE_DIR/deploy-failed"
expect 0 "restore --apply nach dem Rollback erlaubt" env RESTORE_ALLOW_NONROOT=1 SYSTEMCTL="$STUB_SYSTEMCTL" "$SCRIPTS/restore.sh" --from-file "$SNAP" --target "$TEST_TMP/restore6" --apply

sleep 1
expect 5 "Build ohne API-Bundle -> exit 5" env "${DEPLOY_ENV[@]}" DEPLOY_BUILD_CMD='mkdir -p dist' "$SCRIPTS/deploy.sh" --rebuild main
check "aktives Release unberührt" sh -c "test \"\$(basename \"\$(readlink '$BAKERY_ROOT/current')\" | cut -c1-12)\" = '$SECOND'"
check "aktives Release noch vollständig" active_ok

for n in vier fuenf; do
  printf '%s\n' "$n" >"$W_SEED/README.md"
  git -C "$W_SEED" add -A && git -C "$W_SEED" commit --quiet -m "Release $n" && git -C "$W_SEED" push --quiet origin main
  sleep 1
  env "${DEPLOY_ENV[@]}" KEEP_RELEASES=2 "$SCRIPTS/deploy.sh" main >"$TEST_TMP/last.log" 2>&1
done
count="$(find "$BAKERY_ROOT/releases" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
check "alte Releases aufgeräumt (2 behalten, $count da)" test "$count" = "2"
check "hq-Symlink unter releases/ bleibt" test -L "$BAKERY_ROOT/releases/hq"
check "Worktree-Liste aufgeräumt" sh -c "test \"\$(git --git-dir='$BAKERY_ROOT/repo.git' worktree list | grep -c releases/)\" = 2"

# DB vorhanden -> Kopie vor dem Umschalten
cp "$DB" "$TEST_TMP/live.db"
expect 0 "Deploy mit DB legt pre-deploy-Kopie an" env "${DEPLOY_ENV[@]}" DB_PATH="$TEST_TMP/live.db" APP_DIR="$REPO_ROOT" BACKUP_SQLITE_METHOD=cli "$SCRIPTS/deploy.sh" main
check "pre-deploy-Kopie vorhanden" sh -c "ls '$BACKUP_DIR'/snapshots/bakery-pre-deploy-*.db >/dev/null"
check "Pfad der Kopie vermerkt" sh -c "test -f \"\$(cat '$STATE_DIR/deploy-pre-db')\""

# Ein Commit, den es nur im Code-Repository der Box gibt (nicht auf origin),
# wird gebaut, aber nie aktiviert: der root-eigene Klon kennt ihn nicht.
EVIL="$TEST_TMP/evil"
git clone --quiet "$W_ORIGIN" "$EVIL"
printf 'manipuliert\n' >"$EVIL/README.md"
git -C "$EVIL" commit --quiet -am "nur lokal"
git -C "$EVIL" push --quiet "$BAKERY_ROOT/repo.git" HEAD:refs/heads/lokal
BEFORE_EVIL="$(readlink "$BAKERY_ROOT/current")"
expect 3 "Commit nicht auf origin -> nicht umgeschaltet" env "${DEPLOY_ENV[@]}" "$SCRIPTS/deploy.sh" lokal
check "current unverändert" test "$(readlink "$BAKERY_ROOT/current")" = "$BEFORE_EVIL"
check "Meldung nennt origin" log_has "nicht vorhanden"

# ---------------------------------------------------------------------------
# bakery-management.service (W4-Verifikation Runde 5): mit
# `--hostname 127.0.0.1` hielt Next die Rewrites des Proxys für externe URLs
# (es schreibt Loopback-Ziele auf `localhost` um) - 500 auf jeder Seite ohne
# gültiges Cookie. Gebunden wird über `localhost`, IPv4 zuerst.
UNIT_MGMT="$REPO_ROOT/deploy/systemd/bakery-management.service"
check "Verwaltung bindet über localhost, nicht 127.0.0.1" sh -c "grep '^ExecStart=' '$UNIT_MGMT' | grep -q -- '--hostname localhost ' && ! grep '^ExecStart=' '$UNIT_MGMT' | grep -q -- '--hostname 127.0.0.1'"
check "Verwaltung: localhost wird 127.0.0.1 (ipv4first)" sh -c "grep '^ExecStart=' '$UNIT_MGMT' | grep -q -- '/usr/bin/node --dns-result-order=ipv4first '"

# ---------------------------------------------------------------------------
echo
echo "Ergebnis: $pass ok, $fail fehlgeschlagen"
[ "$fail" -eq 0 ]
