import BackzettelDayClient from './BackzettelDayClient'

export const metadata = {
  title: 'Backzettel - Bäckerei Heusser',
}

/**
 * Backzettel eines Produktionstags (Z5/Z7). Server-Komponente ohne
 * Datenzugriff: der Zettel kommt zur Laufzeit von `/api/backzettel/:datum`,
 * weil Vorbestellungen ihn den ganzen Tag ändern.
 */
export default async function BackzettelDayPage({
  params,
}: {
  params: Promise<{ datum: string }>
}) {
  const { datum } = await params
  return <BackzettelDayClient date={datum} />
}
