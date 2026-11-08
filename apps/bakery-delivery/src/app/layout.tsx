import './global.css'
import { THEME_COLOR, THEME_INIT_SCRIPT } from '../lib/theme'
import { AuthGate } from '../components/AuthGate'
import { ServiceWorkerRegistration } from '../components/ServiceWorkerRegistration'

export const metadata = {
  title: 'Bäckerei Heusser – Liefertour',
  description: 'Fahrer-App für die Auslieferung der Bäckerei Heusser',
}

// Ohne diesen Viewport rendert die Karte auf dem Handy in Desktop-Breite.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME_COLOR.light },
    { media: '(prefers-color-scheme: dark)', color: THEME_COLOR.dark },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // `suppressHydrationWarning`: das Skript unten setzt `data-theme` auf genau
    // diesem Element, bevor React hydriert. Ohne den Hinweis meldete React den
    // Unterschied zum Server-Markup - der Unterschied ist hier der Zweck.
    <html lang="de" suppressHydrationWarning>
      <head>
        {/* Vor dem ersten Paint, sonst blitzt die helle Seite auf. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        {/* B8: ohne Anmeldung nur das Anmeldeformular. */}
        <AuthGate>{children}</AuthGate>
        {/* Startet die App auch im Funkloch (gespeicherte Tour). */}
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}
