import MitarbeiterClient from './MitarbeiterClient'

export const metadata = {
  title: 'Mitarbeiter - Bäckerei Heusser',
}

/**
 * Dienstplan: Mitarbeiterliste (TASK-042) - nur Inhaber mit persönlicher
 * Sitzung (`PERSONAL_ONLY_ROUTES`), im Pilot für den Inhaber freigegeben
 * (Entscheidung 2026-11-08, `PILOT_ALLOWED_ROUTES`).
 */
export default function MitarbeiterPage() {
  return <MitarbeiterClient />
}
