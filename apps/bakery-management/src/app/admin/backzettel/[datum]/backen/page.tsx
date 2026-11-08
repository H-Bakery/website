import BakeListClient from './BakeListClient'

export const metadata = {
  title: 'Backliste - Bäckerei Heusser',
}

/**
 * Backliste eines Backtags (Z10): was an dem Tag in den Ofen kommt, auch aus
 * Teig vom Vortag. Server-Komponente ohne Datenzugriff - die Liste kommt zur
 * Laufzeit von `/api/backzettel/:datum/bake-list`.
 */
export default async function BakeListPage({
  params,
}: {
  params: Promise<{ datum: string }>
}) {
  const { datum } = await params
  return <BakeListClient date={datum} />
}
