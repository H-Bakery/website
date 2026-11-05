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
#   backup      letztes erfolgreiches Off-site-Backup jünger als BACKUP_MAX_AGE_HOURS (36)
#   hq-sync     letzter erfolgreicher hq-Sync jünger als HQ_SYNC_MAX_AGE_MIN (90)
#   disk        Belegung von BAKERY_VAR unter DISK_MAX_PERCENT (90)
#
# Wartung: existiert $STATE_DIR/maintenance und ist jünger als 30 Minuten
# (deploy.sh legt sie an), wird geprüft und geloggt, aber nichts gemeldet und
# kein Zustand gespeichert.
#
# Exit-Codes: 0 alles ok, 1 mindestens eine Prüfung gestört oder Meldung nicht
# zugestellt, 2 Konfiguration falsch.
set -euo pipefail

SCRIPT_NAME="health"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/scripts/lib.sh
. "$SCRIPT_DIR/lib.sh"
load_env_files

HEALTH_CHECKS="${HEALTH_CHECKS:-api management backup hq-sync disk}"
HEALTH_API_URL="${HEALTH_API_URL:-http://127.0.0.1:5000/health}"
HEALTH_MGMT_URL="${HEALTH_MGMT_URL:-http://127.0.0.1:4201/}"
HEALTH_HTTP_TIMEOUT="${HEALTH_HTTP_TIMEOUT:-10}"
HEALTH_RETRY_DELAY="${HEALTH_RETRY_DELAY:-5}"
HEALTH_HOST_LABEL="${HEALTH_HOST_LABEL:-$(hostname -s 2>/dev/null || hostname)}"
BACKUP_DIR="${BACKUP_DIR:-$BAKERY_VAR/backup}"
BACKUP_MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-36}"
HQ_SYNC_MAX_AGE_MIN="${HQ_SYNC_MAX_AGE_MIN:-90}"
DISK_MAX_PERCENT="${DISK_MAX_PERCENT:-90}"
MAINTENANCE_MAX_MIN="${MAINTENANCE_MAX_MIN:-30}"

STATE_FILE="$STATE_DIR/health.state"
mkdir -p "$STATE_DIR"

if ! acquire_lock health; then
  log "ein anderer Health-Check läuft noch - übersprungen"
  exit 0
fi

# --- Prüfungen: jede gibt 0/1 zurück und schreibt die Ursache nach stdout ---

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

run_check() {
  case "$1" in
  api) check_http "$HEALTH_API_URL" ;;
  management) check_http "$HEALTH_MGMT_URL" ;;
  backup) check_age "$BACKUP_DIR/last-success" $((BACKUP_MAX_AGE_HOURS * 3600)) "Backup" ;;
  hq-sync) check_age "$STATE_DIR/hq-sync.ok" $((HQ_SYNC_MAX_AGE_MIN * 60)) "hq-Sync" ;;
  disk) check_disk ;;
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
  disk) echo "Speicherplatz" ;;
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

for name in $HEALTH_CHECKS; do
  status="ok"
  reason=""
  rc=0
  reason="$(run_check "$name")" || rc=$?
  if [ "$rc" -eq 2 ]; then
    die 2 "HEALTH_CHECKS enthält unbekannte Prüfung: $name"
  fi
  if [ "$rc" -ne 0 ]; then
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
  elif [ "$status" = "ok" ] && [ "$prev" = "fail" ]; then
    changes_good="${changes_good}- $(label_for "$name")"$'\n'
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

notify_failed=0
if [ -n "$message" ]; then
  if [ -n "$changes_bad" ]; then
    message="${message}"$'\n'"Runbook: docs/runbook.md, Abschnitt Störungen."
  fi
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
