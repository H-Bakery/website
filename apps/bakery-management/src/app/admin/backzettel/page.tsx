import BackzettelOverviewClient from './BackzettelOverviewClient'

export const metadata = {
  title: 'Backzettel - Bäckerei Heusser',
}

/** Die kommenden Produktionstage (Z5); der nächste steht vorn. */
export default function BackzettelPage() {
  return <BackzettelOverviewClient />
}
