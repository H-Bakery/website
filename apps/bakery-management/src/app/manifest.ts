import type { MetadataRoute } from 'next'
import {
  PWA_BACKGROUND_COLORS,
  PWA_DEFAULT_MODE,
  PWA_DESCRIPTION,
  PWA_ICONS,
  PWA_NAME,
  PWA_SHORT_NAME,
  PWA_THEME_COLORS,
} from '../lib/pwa'

/**
 * Web-App-Manifest (F3), von Next als `/manifest.webmanifest` ausgeliefert und
 * im `<head>` verlinkt. Eine responsive PWA für Handy, Laden-Tablet, Backstube
 * und Büro-PC (D7) - darum keine feste Ausrichtung.
 *
 * Ein Manifest kennt nur eine Farbe; es nimmt die des Standardmodus (dunkel).
 * Der helle Modus setzt seine Statusleiste über `<meta name="theme-color">`
 * (`ThemeColorSync`).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/admin',
    name: PWA_NAME,
    short_name: PWA_SHORT_NAME,
    description: PWA_DESCRIPTION,
    lang: 'de',
    dir: 'ltr',
    start_url: '/admin',
    scope: '/',
    display: 'standalone',
    theme_color: PWA_THEME_COLORS[PWA_DEFAULT_MODE],
    background_color: PWA_BACKGROUND_COLORS[PWA_DEFAULT_MODE],
    categories: ['business', 'productivity'],
    icons: [
      {
        src: PWA_ICONS.any192,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: PWA_ICONS.any512,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: PWA_ICONS.maskable192,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: PWA_ICONS.maskable512,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
