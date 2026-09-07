import TagesZielClient from './TagesZielClient'

/**
 * Tagesziel-Ampel (TASK-039): Break-even je Wochentag, Woche und Monat bis
 * zum letzten ausgewerteten Tag, Hochrechnung. Die Daten kommen
 * ausschließlich über die rollengeschützten Endpunkte `/api/finance/targets*`
 * - wie bei `/admin/finance` liest der Next-Server nichts selbst, weil er
 * keine Anmeldung prüfen kann.
 */
export default function TagesZielPage() {
  return <TagesZielClient />
}
