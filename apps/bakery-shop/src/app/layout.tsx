import React from 'react'
import type { Metadata } from 'next'
import './fonts.css'
import './global.css'
import { RootProvider } from '@bakery/shared/contexts'
import ThemeRegistry from '../theme/ThemeRegistry'
import { ShopHeader } from '../components/shop-header'
import { ShopFooter } from '../components/shop-footer'
import { shopBaseUrl } from '../lib/site'
import { JsonLd, bakeryJsonLd } from '../lib/structured-data'

export const metadata: Metadata = {
  // Ohne metadataBase bleibt og:image auf http://localhost:4200 stehen.
  metadataBase: new URL(shopBaseUrl()),
  title: {
    default: 'Online-Shop | Bäckerei Heusser Homburg',
    template: '%s | Bäckerei Heusser Online-Shop',
  },
  description:
    'Brot, Brötchen, Teilchen, Kuchen und Torten der Bäckerei Heusser online vorbestellen und in der Eckstraße 3 in Homburg abholen – frisch gebacken, ohne Anstehen, bezahlt wird im Laden.',
  keywords: [
    'Bäckerei Heusser',
    'Online-Shop',
    'Brot vorbestellen',
    'Brötchen bestellen',
    'Homburg',
    'Saarland',
    'Torten bestellen',
    'Abholung',
  ],
  applicationName: 'Bäckerei Heusser Online-Shop',
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    siteName: 'Bäckerei Heusser Online-Shop',
    title: 'Online-Shop | Bäckerei Heusser Homburg',
    description:
      'Frisch gebacken, für Sie zurückgelegt: Backwaren der Bäckerei Heusser online vorbestellen und in Homburg abholen.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de">
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png"
        />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <ThemeRegistry>
          {/* Preise im deutschen Einzelhandel sind Bruttopreise.
              taxRate 0 verhindert, dass der Warenkorb 19 % oben draufschlägt. */}
          <RootProvider cart={{ taxRate: 0 }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh',
              }}
            >
              {/* Erster fokussierbarer Knoten der Seite: ueberspringt Kopfzeile
                  und Kategorieleiste. Nur sichtbar, wenn er den Fokus hat. */}
              <a href="#inhalt" className="skip-link">
                Zum Inhalt springen
              </a>
              <ShopHeader />
              <main
                id="inhalt"
                aria-label="Inhalt"
                style={{ flex: '1 1 auto' }}
              >
                {children}
              </main>
              <ShopFooter />
            </div>
          </RootProvider>
        </ThemeRegistry>
        {/* schema.org Bakery inkl. Oeffnungszeiten - abgeleitet aus demselben
            Raster, aus dem die Kasse ihre Abholzeiten baut. */}
        <JsonLd data={bakeryJsonLd()} id="ld-bakery" />
      </body>
    </html>
  )
}
