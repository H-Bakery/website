import BackstubeClient from './BackstubeClient'

export const metadata = {
  title: 'Backstube - Bäckerei Heusser',
}

/**
 * Backstube-Tablet (Z6): Startseite der Rolle Backstube, außerhalb von
 * `/admin` - ohne Seitenleiste. Die Rolle prüfen `src/proxy.ts` (Server) und
 * der RouteGuard (Browser); der Zettel kommt zur Laufzeit von
 * `/api/backzettel`.
 */
export default function BackstubePage() {
  return <BackstubeClient />
}
