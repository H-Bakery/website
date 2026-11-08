import MitarbeiterClient from './MitarbeiterClient'

export const metadata = {
  title: 'Mitarbeiter - Bäckerei Heusser',
}

/**
 * Dienstplan: Mitarbeiterliste (TASK-042) - nur Inhaber mit persönlicher
 * Sitzung (`PERSONAL_ONLY_ROUTES`), im Pilotbetrieb gesperrt
 * (`PILOT_HIDDEN_ROUTES`).
 */
export default function MitarbeiterPage() {
  return <MitarbeiterClient />
}
