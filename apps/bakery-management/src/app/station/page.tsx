import StationClient from './StationClient'

export const metadata = {
  title: 'Station - Bäckerei Heusser',
}

/**
 * PIN-Station für gemeinsam genutzte Tablets (F1). Liegt bewusst außerhalb
 * von `/admin`: ohne Seitenleiste und ohne RouteGuard - die Seite entscheidet
 * selbst anhand des Stations-Tokens dieses Geräts, was sie zeigt.
 */
export default function StationPage() {
  return <StationClient />
}
