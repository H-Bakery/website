import type { Metadata } from 'next'
import { SITE_URL } from '../../config/legal'

type OpenGraph = NonNullable<Metadata['openGraph']>
type OpenGraphImage = {
  url: string
  width: number
  height: number
  alt: string
}

export const SITE_NAME = 'Bäckerei Heusser'

/** Das allgemeine Vorschaubild (public/og-image.jpg), wie in layout.tsx. */
export const DEFAULT_OG_IMAGE: OpenGraphImage = {
  url: `${SITE_URL}/og-image.jpg`,
  width: 1200,
  height: 630,
  alt: 'Bäckerei Heusser - Frische Backwaren',
}

/**
 * `openGraph` einer Seite mit den Feldern, die jede Seite braucht.
 *
 * Next übernimmt `openGraph` einer Seite als Ganzes, nicht Feld für Feld:
 * Setzt eine Seite nur `url`, fehlen ihr Vorschaubild, `og:site_name` und
 * `og:locale` aus layout.tsx. Titel und Beschreibung ohne Angabe nimmt Next
 * aus `title`/`description` der Seite.
 */
export function pageOpenGraph(page: {
  url: string
  title?: string
  description?: string
  images?: OpenGraphImage[]
}): OpenGraph {
  return {
    siteName: SITE_NAME,
    locale: 'de_DE',
    type: 'website',
    images: [DEFAULT_OG_IMAGE],
    ...page,
  }
}
