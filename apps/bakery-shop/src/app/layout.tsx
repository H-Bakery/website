import './global.css'
import { RootProvider } from '@bakery/shared/contexts'

export const metadata = {
  title: 'Bäckerei Heusser - Frische Backwaren aus Beiertheim',
  description:
    'Traditionelle Handwerksbäckerei in Karlsruhe-Beiertheim. Frische Backwaren, Brot, Brötchen und Kuchen aus regionalen Zutaten.',
  keywords:
    'Bäckerei, Karlsruhe, Beiertheim, Brot, Brötchen, Kuchen, handwerklich',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Lora:wght@400;500;600&family=Ubuntu:wght@300;400;500;700&display=swap"
          rel="stylesheet"
        />
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
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  )
}
