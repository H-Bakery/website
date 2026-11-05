/**
 * Serverseitige Hälfte der Pilot-Sperre (F1 auf F2): `src/proxy.ts` schreibt
 * gesperrte `/admin`-Routen auf eine leere Ersatzseite um, damit Server-
 * Komponente und RSC-Payload einer Demo-Seite gar nicht erst entstehen (F2
 * hatte das als Lücke dokumentiert). Die URL bleibt; das Admin-Layout zeigt
 * wie bisher `PilotUnavailable`, weil `usePathname()` die Original-URL liefert.
 *
 * Erlaubte Routen stehen weiter nur in `PILOT_ALLOWED_ROUTES` (pilotMode.ts).
 * Anmeldung und Rollen prüft der Proxy nicht - die Tokens liegen in
 * `localStorage`, der Server sieht sie nicht (RouteGuard, API).
 */

import { isPilotMode, isPilotPathAllowed } from './pilotMode'

export const PILOT_UNAVAILABLE_PATH = '/admin/nicht-verfuegbar'

/** Ziel der Umschreibung oder `null` (Anfrage unverändert durchlassen). */
export function pilotRewriteTarget(
  pathname: string,
  pilot: boolean = isPilotMode()
): string | null {
  if (!pilot || pathname === PILOT_UNAVAILABLE_PATH) return null
  return isPilotPathAllowed(pathname, true) ? null : PILOT_UNAVAILABLE_PATH
}
