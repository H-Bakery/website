import type { Metadata, Viewport } from 'next'
import ColorSchemeScript from '../components/ColorSchemeScript'
import ThemeRegistry from '../components/ThemeRegistry'

export const metadata: Metadata = {
  title: 'Partybrezel selbst zusammenstellen',
  description:
    'Prototyp: Partybrezel in Größe und Belag zusammenstellen - Platzhalterpreise, keine echte Bestellung.',
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbf6ef' },
    { media: '(prefers-color-scheme: dark)', color: '#16110c' },
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
