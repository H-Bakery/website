import './global.css'

export const metadata = {
  title: 'Bäckerei Heusser - Lieferung',
  description: 'Lieferungs-App für Bäckerei Heusser Fahrer',
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
