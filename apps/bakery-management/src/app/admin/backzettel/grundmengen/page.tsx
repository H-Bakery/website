import GrundmengenClient from './GrundmengenClient'

export const metadata = {
  title: 'Grundmengen - Bäckerei Heusser',
}

/**
 * Grundmengen je Posten und Wochentag (Z4, roadmap §5.5 Bildschirm 1).
 * Gelesen und gespeichert wird über `/api/backzettel/config*` (nur mit
 * Sitzung); der Next-Server liest hier nichts selbst.
 */
export default function GrundmengenPage() {
  return <GrundmengenClient />
}
