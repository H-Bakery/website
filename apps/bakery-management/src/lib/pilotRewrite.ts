/**
 * Serverseitige Hälfte der Pilot-Sperre (F1 auf F2): `src/proxy.ts` schreibt
 * gesperrte `/admin`-Routen auf eine leere Ersatzseite um, damit Server-
 * Komponente und RSC-Payload einer Demo-Seite gar nicht erst entstehen (F2
 * hatte das als Lücke dokumentiert). Die URL bleibt; das Admin-Layout zeigt
 * wie bisher `PilotUnavailable`, weil `usePathname()` die Original-URL liefert.
 *
 * Erlaubte Routen stehen weiter nur in `PILOT_ALLOWED_ROUTES` (pilotMode.ts).
 * Anmeldung und Rollen prüft der Proxy danach über das Sitzungs-Cookie
 * (`lib/serverSession.ts`).
 */

import { isPilotHiddenPath, isPilotMode, isPilotPathAllowed } from './pilotMode'

export const PILOT_UNAVAILABLE_PATH = '/admin/nicht-verfuegbar'

/**
 * Ziel der Umschreibung oder `null` (Anfrage unverändert durchlassen).
 *
 * Umgeschrieben werden nur vorhandene, gesperrte Seiten
 * (`PILOT_HIDDEN_ROUTES`). Eine gesperrte Adresse ohne Seite - etwa ein
 * Lesezeichen auf eine seit B12 gelöschte Demo-Seite - geht unverändert
 * weiter und endet in der deutschen 404 (`app/not-found.tsx`), statt
 * „arbeitet noch mit Beispieldaten“ zu behaupten.
 */
export function pilotRewriteTarget(
  pathname: string,
  pilot: boolean = isPilotMode()
): string | null {
  if (!pilot || pathname === PILOT_UNAVAILABLE_PATH) return null
  if (isPilotPathAllowed(pathname, true)) return null
  return isPilotHiddenPath(pathname) ? PILOT_UNAVAILABLE_PATH : null
}
