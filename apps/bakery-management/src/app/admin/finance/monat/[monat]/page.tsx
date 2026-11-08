import MonatsanalyseClient from '../MonatsanalyseClient'

/**
 * Monatsanalyse eines Monats (`JJJJ-MM`): Auffälligkeiten, Einnahmen und
 * Ausgaben gegen den Durchschnitt, Vergleich, Kasse gegen Konto. Die Daten
 * kommen nur über `GET /api/finance/month/:month` (Rolle Inhaber); ein
 * ungültiger Monat zeigt einen Hinweis statt einer Anfrage.
 */
export default async function MonatsanalysePage({
  params,
}: {
  params: Promise<{ monat: string }>
}) {
  const { monat } = await params
  return <MonatsanalyseClient month={monat} />
}
