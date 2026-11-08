import PilotUnavailable from '../../../components/pilot/PilotUnavailable'

/**
 * Ziel der Umschreibung durch `src/proxy.ts` für Routen, die im
 * Pilotbetrieb gesperrt sind. Rendert nichts aus der eigentlichen Seite;
 * das Admin-Layout zeigt anhand der Original-URL ohnehin `PilotUnavailable`.
 */
export default function PilotUnavailablePage() {
  return <PilotUnavailable />
}
