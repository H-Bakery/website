import './global.css'

export const metadata = {
  title: 'Bäckerei Heusser – Liefertour',
  description: 'Fahrer-App für die Auslieferung der Bäckerei Heusser',
}

// Ohne diesen Viewport rendert die Karte auf dem Handy in Desktop-Breite.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#8b4513',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}
