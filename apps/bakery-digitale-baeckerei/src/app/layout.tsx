import type { Metadata, Viewport } from 'next'
import ColorSchemeScript from '../components/ColorSchemeScript'
import ThemeRegistry from '../components/ThemeRegistry'

export const metadata: Metadata = {
  title: 'Digitale Bäckerei – Bäckerei Heusser',
  description:
    'Schau dich in der Bäckerei Heusser in 3D um: die Theke mit Vitrine, voll mit Backwaren.',
  // Vorerst nicht im Index: öffentlich wird die Seite erst nach der Abnahme (P2).
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
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
    // Das Farbschema-Skript setzt ein Attribut an <html>, bevor React lädt.
    <html lang="de" suppressHydrationWarning>
      <body>
        <ColorSchemeScript />
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  )
}
