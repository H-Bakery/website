#!/usr/bin/env bash
# health.sh - prüft die Box alle 5 Minuten und meldet Störungen per Telegram
# (roadmap O2). Läuft als `bakery` über bakery-health.timer.
#
# Gemeldet wird nur ein Zustandswechsel (ok -> Störung, Störung -> wieder ok),
# damit eine stundenlange Störung nicht alle 5 Minuten eine Nachricht erzeugt.
# Kann Telegram nicht senden, bleibt der alte Zustand gespeichert - der
# nächste Lauf versucht es erneut.
#
# Prüfungen (HEALTH_CHECKS, Leerzeichen-getrennt; Vorgabe alle):
#   api         GET HEALTH_API_URL   (Vorgabe http://127.0.0.1:5000/health)
#   management  GET HEALTH_MGMT_URL  (Vorgabe http://127.0.0.1:4201/; 3xx zählt als ok)
#   backup      letztes erfolgreiches Off-site-Backup jünger als BACKUP_MAX_AGE_HOURS (36).
#               Ohne Off-site-Ziel (RESTIC_REPOSITORY leer, Q4) zählt die lokale
#               Kopie der Nacht (backup/current/bakery.db): frisch = OFFEN, sonst gestört.
#   hq-sync     letzter erfolgreicher hq-Sync jünger als HQ_SYNC_MAX_AGE_MIN (90)
#   hq-token    GitHub-App-Token (HQ_GITHUB_TOKEN_FILE) jünger als HQ_TOKEN_MAX_AGE_MIN
#               (70) - es gilt 60 min, bakery-hq-token.timer erneuert alle 30 min.
#               Übersprungen (zählt als ok) ohne GH_APP_ID oder HQ_GITHUB_TOKEN_FILE
#               und mit festem HQ_GITHUB_TOKEN.
#   disk        Belegung von BAKERY_VAR unter DISK_MAX_PERCENT (90)
#   tls         HTTPS über Caddy wie ein Gerät im WLAN: https://HEALTH_TLS_HOST/
#               (im LAN-HTTP-Betrieb bis Q2 bleibt HEALTH_TLS_HOST leer)
#               mit --resolve auf 127.0.0.1, Zertifikat gültig und noch mindestens
#               HEALTH_TLS_MIN_DAYS (14) Tage - fällt die DNS-01-Erneuerung aus,
#               kommt der Alarm Wochen vor dem Ablauf. Ohne HEALTH_TLS_HOST
#               übersprungen (zählt als ok).
#
# Drei Zustände je Prüfung: ok, GESTÖRT (fail) und OFFEN (open). OFFEN heißt:
# die Box läuft, aber etwas ist noch nicht eingerichtet - das Off-site-Ziel des
# Backups oder der Alarmkanal selbst (Prüfung "alarm", läuft immer mit: ohne
# TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID steht jede Meldung nur im Journal).
# OFFEN wird wie jeder Wechsel einmal gemeldet ("NICHT EINGERICHTET"), steht bei
# jedem Lauf als eine Zeile im Log und macht den Lauf nicht rot: der Exit-Code
# - und damit `systemctl --failed` - sagt nur, ob die Box gesund ist.
#
# Wartung: existiert $STATE_DIR/maintenance und ist jünger als 30 Minuten
# (deploy.sh legt sie an), wird geprüft und geloggt, aber nichts gemeldet und
# kein Zustand gespeichert.
#
# Exit-Codes: 0 nichts gestört (OFFEN zählt nicht), 1 mindestens eine Prüfung
# gestört oder Meldung nicht zugestellt (Telegram eingerichtet, aber Senden
# fehlgeschlagen), 2 Konfiguration falsch.
set -euo pipefail

SCRIPT_NAME="health"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/scripts/lib.sh
. "$SCRIPT_DIR/lib.sh"
load_env_files

HEALTH_CHECKS="${HEALTH_CHECKS:-api management backup hq-sync hq-token disk tls}"
HEALTH_TLS_HOST="${HEALTH_TLS_HOST:-}"
HEALTH_TLS_PORT="${HEALTH_TLS_PORT:-443}"
HEALTH_TLS_MIN_DAYS="${HEALTH_TLS_MIN_DAYS:-14}"
# Nur für Tests: CA-Datei für das selbst signierte Zertifikat des Stubs.
HEALTH_TLS_CAFILE="${HEALTH_TLS_CAFILE:-}"
HEALTH_API_URL="${HEALTH_API_URL:-http://127.0.0.1:5000/health}"
HEALTH_MGMT_URL="${HEALTH_MGMT_URL:-http://127.0.0.1:4201/}"
HEALTH_HTTP_TIMEOUT="${HEALTH_HTTP_TIMEOUT:-10}"
HEALTH_RETRY_DELAY="${HEALTH_RETRY_DELAY:-5}"
HEALTH_HOST_LABEL="${HEALTH_HOST_LABEL:-$(hostname -s 2>/dev/null || hostname)}"
BACKUP_DIR="${BACKUP_DIR:-$BAKERY_VAR/backup}"
BACKUP_MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-36}"
HQ_SYNC_MAX_AGE_MIN="${HQ_SYNC_MAX_AGE_MIN:-90}"
HQ_TOKEN_MAX_AGE_MIN="${HQ_TOKEN_MAX_AGE_MIN:-70}"
DISK_MAX_PERCENT="${DISK_MAX_PERCENT:-90}"
MAINTENANCE_MAX_MIN="${MAINTENANCE_MAX_MIN:-30}"

STATE_FILE="$STATE_DIR/health.state"
mkdir -p "$STATE_DIR"

if ! acquire_lock health; then
  log "ein anderer Health-Check läuft noch - übersprungen"
  exit 0
fi

# --- Prüfungen: jede gibt 0 (ok), 1 (gestört) oder 3 (offen, nicht eingerichtet)
# --- zurück und schreibt die Ursache nach stdout ---

check_http() {
  local url="$1" reason
  if reason="$(http_ok "$url" "$HEALTH_HTTP_TIMEOUT")"; then
    return 0
  fi
  # Ein zweiter Versuch fängt kurze Aussetzer (Neustart, GC-Pause) ab.
  sleep "$HEALTH_RETRY_DELAY"
  if reason="$(http_ok "$url" "$HEALTH_HTTP_TIMEOUT")"; then
    return 0
  fi
  echo "$reason ($url)"
  return 1
}

check_age() {
  local file="$1" max_seconds="$2" what="$3"
  if [ ! -f "$file" ]; then
    echo "$what: noch nie erfolgreich ($file fehlt)"
    return 1
  fi
  local age=$(($(now_epoch) - $(file_mtime "$file")))
  if [ "$age" -gt "$max_seconds" ]; then
    echo "$what: letzter Erfolg vor $((age / 3600)) h $(((age % 3600) / 60)) min"
    return 1
  fi
  return 0
}

# Backup: Maßstab ist das Off-site-Backup (backup.sh schreibt last-success erst
# nach restic). Ist kein Ziel eingerichtet, kann es nie frisch werden - dann
# zählt, ob wenigstens die lokale Kopie der Nacht entsteht.
check_backup() {
  local max=$((BACKUP_MAX_AGE_HOURS * 3600)) reason
  if reason="$(check_age "$BACKUP_DIR/last-success" "$max" "Backup")"; then
    return 0
  fi
  if [ -n "${RESTIC_REPOSITORY:-}" ]; then
    echo "$reason"
    return 1
  fi
  if reason="$(check_age "$BACKUP_DIR/current/bakery.db" "$max" "lokale DB-Kopie")"; then
    echo "Off-site-Backup nicht eingerichtet (RESTIC_REPOSITORY in ops.env leer, Q4) - gesichert wird nur lokal auf der Box"
    return 3
  fi
  echo "$reason - und kein Off-site-Backup eingerichtet (RESTIC_REPOSITORY leer, Q4; journalctl -u bakery-backup)"
  return 1
}

# Alarmkanal: ohne Telegram erfährt niemand von einer Störung.
check_alarm() {
  if telegram_configured; then
    return 0
  fi
  echo "Telegram nicht eingerichtet (TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID in ops.env leer) - Störungen stehen nur im Journal (journalctl -u bakery-health)"
  return 3
}

# GitHub-App-Token (Q3): die Datei schreibt hq-token.sh nur nach Erfolg neu,
# ihr Alter ist also das des Tokens. Ohne App (oder mit festem Token) nichts zu prüfen.
check_hq_token() {
  if [ -z "${GH_APP_ID:-}" ] || [ -z "${HQ_GITHUB_TOKEN_FILE:-}" ] || [ -n "${HQ_GITHUB_TOKEN:-}" ]; then
    log "GitHub-Token-Prüfung übersprungen (keine GitHub-App eingerichtet oder fester HQ_GITHUB_TOKEN)"
    return 0
  fi
  local reason
  if reason="$(check_age "$HQ_GITHUB_TOKEN_FILE" $((HQ_TOKEN_MAX_AGE_MIN * 60)) "GitHub-App-Token")"; then
    return 0
  fi
  echo "$reason - hq-Abgleich und Pull-Requests stehen (journalctl -u bakery-hq-token)"
  return 1
}

check_disk() {
  local used
  used="$(df -P "$BAKERY_VAR" | awk 'NR == 2 { gsub("%", "", $5); print $5 }')"
  if [ -z "$used" ]; then
    echo "Belegung von $BAKERY_VAR nicht lesbar"
    return 1
  fi
  if [ "$used" -ge "$DISK_MAX_PERCENT" ]; then
    echo "Festplatte zu ${used} % voll ($BAKERY_VAR)"
    return 1
  fi
  return 0
}

check_tls() {
  if [ -z "$HEALTH_TLS_HOST" ]; then
    log "TLS-Prüfung übersprungen (HEALTH_TLS_HOST leer)"
    return 0
  fi
  local host="$HEALTH_TLS_HOST" port="$HEALTH_TLS_PORT" code
  local ca=()
  [ -z "$HEALTH_TLS_CAFILE" ] || ca=(--cacert "$HEALTH_TLS_CAFILE")
  # Jede HTTP-Antwort zählt: hier geht es um Caddy + Zertifikat; dass API oder
  # Verwaltung dahinter fehlen, melden die Prüfungen api/management.
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time "$HEALTH_HTTP_TIMEOUT" \
    --resolve "$host:$port:127.0.0.1" ${ca[@]+"${ca[@]}"} "https://$host:$port/" 2>/dev/null)" || code="000"
  if [ "$code" = "000" ]; then
    echo "keine gültige HTTPS-Verbindung zu $host (Caddy aus oder Zertifikat ungültig/abgelaufen)"
    return 1
  fi
  command -v openssl >/dev/null 2>&1 || {
    echo "openssl fehlt - Restlaufzeit des Zertifikats nicht prüfbar"
    return 1
  }
  local cert
  cert="$(openssl s_client -connect "127.0.0.1:$port" -servername "$host" </dev/null 2>/dev/null |
    openssl x509 2>/dev/null)" || cert=""
  if [ -z "$cert" ]; then
    echo "Zertifikat von $host nicht lesbar"
    return 1
  fi
  if ! printf '%s\n' "$cert" | openssl x509 -noout -checkend $((HEALTH_TLS_MIN_DAYS * 86400)) >/dev/null 2>&1; then
    local end
    end="$(printf '%s\n' "$cert" | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)"
    echo "Zertifikat von $host läuft in weniger als $HEALTH_TLS_MIN_DAYS Tagen ab ($end) - DNS-01-Erneuerung prüfen (journalctl -u caddy -g acme)"
    return 1
  fi
  return 0
}

run_check() {
  case "$1" in
  api) check_http "$HEALTH_API_URL" ;;
  management) check_http "$HEALTH_MGMT_URL" ;;
  backup) check_backup ;;
  alarm) check_alarm ;;
  hq-sync) check_age "$STATE_DIR/hq-sync.ok" $((HQ_SYNC_MAX_AGE_MIN * 60)) "hq-Sync" ;;
  hq-token) check_hq_token ;;
  disk) check_disk ;;
  tls) check_tls ;;
  *)
    echo "unbekannte Prüfung"
    return 2
    ;;
  esac
}

label_for() {
  case "$1" in
  api) echo "API" ;;
  management) echo "Verwaltung (Web-App)" ;;
  backup) echo "Backup" ;;
  hq-sync) echo "hq-Sync" ;;
  hq-token) echo "GitHub-Token (hq)" ;;
  disk) echo "Speicherplatz" ;;
  tls) echo "HTTPS/Zertifikat" ;;
  alarm) echo "Alarmkanal" ;;
  *) echo "$1" ;;
  esac
}

previous_state() {
  [ -f "$STATE_FILE" ] || return 0
  awk -F= -v k="$1" '$1 == k { print $2 }' "$STATE_FILE"
}

# --- Lauf ---

new_state=""
failures=0
changes_bad=""
changes_good=""
changes_open=""

# Der Alarmkanal wird immer geprüft, auch wenn HEALTH_CHECKS in ops.env ihn nicht nennt.
case " $HEALTH_CHECKS " in
*" alarm "*) ;;
*) HEALTH_CHECKS="$HEALTH_CHECKS alarm" ;;
esac

for name in $HEALTH_CHECKS; do
  status="ok"
  reason=""
  rc=0
  reason="$(run_check "$name")" || rc=$?
  if [ "$rc" -eq 2 ]; then
    die 2 "HEALTH_CHECKS enthält unbekannte Prüfung: $name"
  fi
  if [ "$rc" -eq 3 ]; then
    status="open"
    log "$(label_for "$name"): OFFEN - $reason"
  elif [ "$rc" -ne 0 ]; then
    status="fail"
    failures=$((failures + 1))
    log "$(label_for "$name"): GESTÖRT - $reason"
  else
    log "$(label_for "$name"): ok"
  fi
  new_state="${new_state}${name}=${status}"$'\n'

  prev="$(previous_state "$name")"
  if [ "$status" = "fail" ] && [ "$prev" != "fail" ]; then
    changes_bad="${changes_bad}- $(label_for "$name"): ${reason}"$'\n'
  elif [ "$status" = "open" ] && [ "$prev" != "open" ]; then
    changes_open="${changes_open}- $(label_for "$name"): ${reason}"$'\n'
  elif [ "$status" = "ok" ] && [ "$prev" = "fail" ]; then
    changes_good="${changes_good}- $(label_for "$name")"$'\n'
  elif [ "$status" = "ok" ] && [ "$prev" = "open" ]; then
    changes_good="${changes_good}- $(label_for "$name") (jetzt eingerichtet)"$'\n'
  fi
done

maintenance="$STATE_DIR/maintenance"
if [ -f "$maintenance" ]; then
  age=$(($(now_epoch) - $(file_mtime "$maintenance")))
  if [ "$age" -le $((MAINTENANCE_MAX_MIN * 60)) ]; then
    log "Wartung aktiv (seit $((age / 60)) min) - keine Meldung, Zustand unverändert"
    [ "$failures" -eq 0 ] || exit 1
    exit 0
  fi
  warn "Wartungs-Markierung ist älter als $MAINTENANCE_MAX_MIN min und wird ignoriert: $maintenance"
fi

message=""
if [ -n "$changes_bad" ]; then
  message="STÖRUNG Bäckerei-Box ${HEALTH_HOST_LABEL}:"$'\n'"${changes_bad}"
fi
if [ -n "$changes_good" ]; then
  [ -z "$message" ] || message="${message}"$'\n'
  message="${message}WIEDER OK auf ${HEALTH_HOST_LABEL}:"$'\n'"${changes_good}"
fi

if [ -n "$changes_bad" ]; then
  message="${message}Runbook: docs/runbook.md, Abschnitt Störungen."$'\n'
fi
if [ -n "$changes_open" ]; then
  [ -z "$message" ] || message="${message}"$'\n'
  message="${message}NICHT EINGERICHTET auf ${HEALTH_HOST_LABEL} (wird nur einmal gemeldet):"$'\n'"${changes_open}"
fi

notify_failed=0
if [ -n "$message" ]; then
  send_rc=0
  telegram_send "$message" || send_rc=$?
  if [ "$send_rc" -eq 1 ]; then
    # Senden fehlgeschlagen: alten Zustand behalten, nächster Lauf versucht es neu.
    notify_failed=1
  fi
fi

if [ "$notify_failed" -eq 0 ]; then
  tmp="$STATE_FILE.tmp"
  printf '%s' "$new_state" >"$tmp"
  mv -f "$tmp" "$STATE_FILE"
fi

if [ "$failures" -gt 0 ] || [ "$notify_failed" -eq 1 ]; then
  exit 1
fi
exit 0
