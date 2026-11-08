import JahresabschlussClient from './JahresabschlussClient'

/**
 * Jahresabschluss (vorläufig): Einnahmen und Ausgaben eines Jahres über das
 * Geschäftskonto, Monat für Monat, Kasse gegen Konto und was die Sicht nicht
 * enthält. `?jahr=JJJJ` wählt das Jahr, ohne Angabe das jüngste mit
 * Bankdaten. Die Daten kommen nur über `GET /api/finance/year[/:year]`
 * (Rolle Inhaber) - der Next-Server liest nichts selbst.
 */
export default async function JahresabschlussPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = await searchParams
  const raw = Array.isArray(query.jahr) ? query.jahr[0] : query.jahr
  return (
    <JahresabschlussClient
      initialYear={raw && /^\d{4}$/.test(raw) ? raw : undefined}
    />
  )
}
