import HilfeClient from './HilfeClient'

export const metadata = {
  title: 'Hilfe - Bäckerei Heusser',
}

/**
 * P6 - Hilfe für alle Rollen: Kurzanleitung der eigenen Rolle zuerst (Reiter
 * für die anderen), Papierbetrieb mit Regel, Vorbestellschein und
 * Backzettel-Notfallblatt. Alles druckbar, je Blatt eine A4-Seite.
 */
export default function HilfePage() {
  return <HilfeClient />
}
