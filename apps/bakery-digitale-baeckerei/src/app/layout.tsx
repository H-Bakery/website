import type { Metadata, Viewport } from 'next'
import ThemeRegistry from '../components/ThemeRegistry'
import { START_RAUM_ID, findeRaum } from '../config/raeume'
import { modelUrl } from '../lib/basePath'

/** Das Modell des Raums, in dem die App startet. */
const START_MODELL = findeRaum(START_RAUM_ID)?.modell ?? 'twin.glb'

export const metadata: Metadata = {
  title: 'Digitale Bäckerei – Bäckerei Heusser',
  description:
    'Schau dich in der Bäckerei Heusser in 3D um: die Theke mit Vitrine, voll mit Backwaren.',
  // Öffentlich und verlinkt seit der Abnahme durch den Inhaber (P2): im Index,
  // mit der Adresse auf der Landingpage als einziger gültiger.
  alternates: {
    canonical: 'https://xn--bckerei-heusser-0kb.de/digitale-baeckerei/',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fff3e6' },
    { media: '(prefers-color-scheme: dark)', color: '#1c1513' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de">
      <head>
        {/* Das Modell ist der größte Brocken und würde sonst erst nach der
            ganzen JS-Kette angefragt: schon mit dem HTML laden. `fetch()` in
            loadModel.ts nimmt genau diese Antwort (gleiche URL, gleicher
            Modus) - kein zweiter Download. */}
        <link
          rel="preload"
          as="fetch"
          crossOrigin="anonymous"
          href={modelUrl(START_MODELL)}
        />
      </head>
      <body>
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  )
}
