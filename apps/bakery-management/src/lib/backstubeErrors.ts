/**
 * Fehlertexte für das Backstube-Tablet (Z6). Was der Browser oder ein Proxy
 * meldet (`Failed to fetch`, `HTTP 502: Bad Gateway`, `Request timeout`),
 * gehört nicht auf ein deutsches Tablet; die deutsche `message` der API nur
 * dann, wenn der Server die Anfrage selbst beantwortet und abgelehnt hat (4xx).
 */

export const OFFLINE_TEXT = 'Keine Verbindung zum Server – bitte WLAN prüfen.'

export interface BackstubeErrorText {
  text: string
  /** Server nicht erreicht (Netz, Zeitüberschreitung, Caddy 502-504). */
  offline: boolean
}

const RAW_HTTP = /^HTTP \d{3}\b/

export function describeBackstubeError(
  error: unknown,
  fallback: string
): BackstubeErrorText {
  const e = error as { status?: unknown; code?: unknown; message?: unknown }
  const status = typeof e?.status === 'number' ? e.status : undefined
  const code = typeof e?.code === 'string' ? e.code : undefined
  const message = typeof e?.message === 'string' ? e.message : ''

  // Keine HTTP-Antwort: fetch-TypeError, Zeitüberschreitung, Abbruch.
  if (status === undefined) return { text: OFFLINE_TEXT, offline: true }
  // Caddy vor der API meldet 502-504 ohne JSON-Kennung: API nicht erreichbar.
  if (status >= 502 && status <= 504 && !code) {
    return { text: OFFLINE_TEXT, offline: true }
  }
  if (status >= 400 && status < 500 && message && !RAW_HTTP.test(message)) {
    return { text: message, offline: false }
  }
  if (status >= 500) {
    return {
      text: `${fallback} Fehler auf dem Server (${status}) – bitte im Büro Bescheid geben.`,
      offline: false,
    }
  }
  return { text: `${fallback} (Fehler ${status})`, offline: false }
}
