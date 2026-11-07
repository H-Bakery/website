import { ApiError } from '@bakery/shared/data-access'
import { OFFLINE_TEXT } from '../../../lib/backstubeErrors'

/**
 * Fehlertext für Produkte und Backschrank. Vorher stand bei toter API oder
 * WLAN-Aussetzer die Browsermeldung „Failed to fetch“ (bzw. „Request
 * timeout“, „HTTP 502: Bad Gateway“) auf der deutschen Oberfläche.
 *
 * - kein Server erreicht (fetch-Fehler, Zeitüberschreitung, Caddy 502-504
 *   ohne Fehlercode) → „Keine Verbindung zum Server – bitte WLAN prüfen.“
 * - Antwort der API mit deutscher `message` → diese
 * - nackter Statustext → `fallback` mit Statuscode
 */
const NETWORK_MESSAGE =
  /^(Failed to fetch|Load failed|NetworkError|fetch failed|Network request failed|Request timeout)/i
const RAW_HTTP = /^HTTP \d{3}\b/

export function errorText(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status >= 502 && err.status <= 504 && !err.code) {
      return OFFLINE_TEXT
    }
    if (!err.message || RAW_HTTP.test(err.message)) {
      return `${fallback} (Fehler ${err.status})`
    }
    return err.message
  }
  if (err instanceof Error && err.message) {
    if (NETWORK_MESSAGE.test(err.message)) return OFFLINE_TEXT
    // Ein Programmfehler (TypeError „Cannot read …“) gehört nicht auf den
    // Bildschirm - dann der allgemeine Text.
    if (err instanceof TypeError) return fallback
    return err.message
  }
  return fallback
}
