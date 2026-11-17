import type { Metadata, Viewport } from 'next'
import ThemeRegistry from '../components/ThemeRegistry'
import { START_RAUM_ID } from '../config/raeume'
import { modelUrl } from '../lib/basePath'
import { RAUM_PARAMETER, raumAusAdresse } from '../lib/raeume/adresse'
import { VERFUEGBARE_RAEUME } from '../lib/raeume/verfuegbar'

/** Das Modell des Raums, in dem die App startet. */
const START_MODELL =
  raumAusAdresse('', VERFUEGBARE_RAEUME, START_RAUM_ID)?.modell ?? 'twin.glb'

/**
 * Mehr als ein Raum: Welches Modell gebraucht wird, steht erst in der Adresse
 * (`?raum=<id>`). Ein festes `<link rel=preload>` lüde dann für jeden Link in
 * einen anderen Raum das Modell des Ladens umsonst mit - darum setzt dieses
 * kleine Skript den Link passend zur Adresse. Bei nur einem Raum bleibt es
 * beim festen Link (kein Skript).
 */
const VORLADEN =
  VERFUEGBARE_RAEUME.length > 1
    ? `(function(){var m=${JSON.stringify(
        Object.fromEntries(
          VERFUEGBARE_RAEUME.map((r) => [r.id, modelUrl(r.modell)])
        )
      )},u=${JSON.stringify(
        modelUrl(START_MODELL)
      )};try{var r=new URLSearchParams(location.search).get(${JSON.stringify(
        RAUM_PARAMETER
      )});if(r&&Object.prototype.hasOwnProperty.call(m,r))u=m[r]}catch(e){}var l=document.createElement('link');l.rel='preload';l.setAttribute('as','fetch');l.setAttribute('crossorigin','anonymous');l.href=u;document.head.appendChild(l)})()`
    : null

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
        {VORLADEN ? (
          <script dangerouslySetInnerHTML={{ __html: VORLADEN }} />
        ) : (
          <link
            rel="preload"
            as="fetch"
            crossOrigin="anonymous"
            href={modelUrl(START_MODELL)}
          />
        )}
      </head>
      <body>
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  )
}
