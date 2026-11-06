import './global.css'
import type { Metadata, Viewport } from 'next'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter'
import Providers from './Providers'
import ServiceWorkerRegistration from '../components/pwa/ServiceWorkerRegistration'
import {
  PWA_ICONS,
  PWA_NAME,
  PWA_SHORT_NAME,
  PWA_THEME_COLORS,
} from '../lib/pwa'

export const metadata: Metadata = {
  title: 'Bäckerei Heusser - Verwaltung',
  description:
    'Verwaltungssystem für die Bäckerei Heusser - Bestellungen, Produktion und Verwaltung',
  keywords: 'Bäckerei, Management, Admin, Bestellungen, Produktion',
  // PWA (F3): Manifest kommt aus app/manifest.ts, Farben und Icons aus lib/pwa.ts.
  applicationName: PWA_NAME,
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: PWA_ICONS.any192, sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: PWA_ICONS.apple, sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: PWA_SHORT_NAME,
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
}

/**
 * Viewport und Statusleistenfarbe. `themeColor` je Systemmodus ist nur der
 * Startwert; `ThemeColorSync` (in Providers) zieht ihn auf den Modus der App.
 * Kein `maximumScale`: Zoomen muss möglich bleiben (Barrierefreiheit).
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: PWA_THEME_COLORS.light },
    { media: '(prefers-color-scheme: dark)', color: PWA_THEME_COLORS.dark },
  ],
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
      </head>
      <body>
        <AppRouterCacheProvider>
          <Providers>{children}</Providers>
        </AppRouterCacheProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}
