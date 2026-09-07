import FinanceClient from './FinanceClient'

/**
 * Finanzen: Monatsverlauf, Kostenstruktur und Hinweise aus dem bereinigten
 * `finance-summary.json`. Die Daten kommen ausschließlich über die
 * rollengeschützten Endpunkte `/api/finance/*` - der Next-Server dieser App
 * liest sie bewusst nicht selbst, weil er keine Anmeldung prüfen kann.
 */
export default function FinancePage() {
  return <FinanceClient />
}
