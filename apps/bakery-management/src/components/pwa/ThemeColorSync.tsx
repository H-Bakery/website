'use client'

import { useEffect } from 'react'
import { PWA_THEME_COLORS } from '../../lib/pwa'

/**
 * Hält `<meta name="theme-color">` (Statusleiste, Titelleiste der installierten
 * App) passend zum Modus der Oberfläche. Die Metadaten in `app/layout.tsx`
 * liefern je `prefers-color-scheme` eine Farbe - die App startet aber dunkel,
 * egal was das System sagt, und der Modus lässt sich umschalten. Darum setzt
 * diese Komponente nach dem Laden alle theme-color-Tags auf den echten Modus.
 */
export default function ThemeColorSync({ mode }: { mode: 'light' | 'dark' }) {
  useEffect(() => {
    if (typeof document === 'undefined') return
    const color = PWA_THEME_COLORS[mode]
    document
      .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
      .forEach((meta) => meta.setAttribute('content', color))
  }, [mode])
  return null
}
