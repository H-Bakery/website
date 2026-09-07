import './global.css'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter'
import Providers from './Providers'

export const metadata = {
  title: 'Bäckerei Heusser - Management System',
  description:
    'Verwaltungssystem für die Bäckerei Heusser - Bestellungen, Produktion und Verwaltung',
  keywords: 'Bäckerei, Management, Admin, Bestellungen, Produktion',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // global.css setzt `scroll-behavior: smooth` auf <html>. Next schaltet das
    // bei clientseitiger Navigation kurz ab, damit die Seite nicht animiert
    // nach oben rollt - aber nur, wenn es per data-scroll-behavior davon weiß;
    // sonst warnt es im Dev-Modus bei jedem Seitenwechsel.
    <html lang="de" data-scroll-behavior="smooth">
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
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <AppRouterCacheProvider>
          <Providers>{children}</Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  )
}
