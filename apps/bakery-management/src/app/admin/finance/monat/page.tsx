import MonatsanalyseClient from './MonatsanalyseClient'

/**
 * Monatsanalyse ohne Monat in der Adresse: zeigt, was `GET
 * /api/finance/month` als Vorgabe liefert (den jüngsten vollständigen
 * Monat). Pfeile und Auswahl führen weiter auf `/admin/finance/monat/JJJJ-MM`.
 */
export default function MonatsanalyseDefaultPage() {
  return <MonatsanalyseClient />
}
