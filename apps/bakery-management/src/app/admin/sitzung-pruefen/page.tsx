import SessionCheckPending from '../../../components/auth/SessionCheckPending'

/**
 * Ziel der Umschreibung durch `src/proxy.ts` für geschützte Seiten, die der
 * Server nicht rendern darf (kein oder veraltetes Sitzungs-Cookie, falsche
 * Rolle). Lädt keine Daten; der Browser erneuert das Token und holt die
 * Original-URL neu.
 */
export default function SessionCheckPage() {
  return <SessionCheckPending />
}
