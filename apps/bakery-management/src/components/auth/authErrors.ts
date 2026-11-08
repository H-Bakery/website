import { describeBackstubeError, OFFLINE_TEXT } from '../../lib/backstubeErrors'

/** Fehler des Browsers, wenn gar keine Antwort kam (Chrome, Safari, Firefox). */
const NO_RESPONSE =
  /failed to fetch|load failed|networkerror|network request failed|timeout|aborted/i

/**
 * Fehlertext für Anmeldung und Station. Ohne Antwort vom Server (WLAN weg,
 * API aus, Caddy 502-504) stand dort früher das rohe „Failed to fetch“ des
 * Browsers - jetzt derselbe Satz wie auf dem Backstube-Tablet und im
 * Spickzettel („Keine Verbindung zum Server – bitte WLAN prüfen.“). Deutsche
 * Meldungen der API (PIN falsch, gesperrt, …) bleiben, wie sie sind.
 */
export function describeAuthError(error: unknown, fallback: string): string {
  const e = error as { status?: unknown; message?: unknown; name?: unknown }
  if (typeof e?.status === 'number') {
    return describeBackstubeError(error, fallback).text
  }
  const message = typeof e?.message === 'string' ? e.message : ''
  if (
    error instanceof TypeError ||
    e?.name === 'AbortError' ||
    NO_RESPONSE.test(message)
  ) {
    return OFFLINE_TEXT
  }
  return message || fallback
}
