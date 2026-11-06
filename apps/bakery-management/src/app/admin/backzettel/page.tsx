import { redirect } from 'next/navigation'

/**
 * Platzhalter, bis die Tagesplanung (Z5) die Übersicht unter
 * `/admin/backzettel` liefert - beim Zusammenführen gilt deren `page.tsx`.
 */
export default function BackzettelPage() {
  redirect('/admin/backzettel/grundmengen')
}
