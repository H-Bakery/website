import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { alpha, createTheme, getOverlayAlpha } from '@mui/material/styles'
import manifest from '../app/manifest'
import {
  PWA_BACKGROUND_COLORS,
  PWA_ICONS,
  PWA_NAME,
  PWA_THEME_COLORS,
  SERVICE_WORKER_PATH,
  SW_CACHE_PREFIX,
  serviceWorkerUrl,
  shouldRegisterServiceWorker,
} from './pwa'

const PUBLIC_DIR = path.resolve(__dirname, '../../public')

/** Breite × Höhe aus dem IHDR-Block einer PNG-Datei. */
function pngSize(file: string): string {
  const buffer = readFileSync(file)
  expect(buffer.subarray(1, 4).toString('ascii')).toBe('PNG')
  return `${buffer.readUInt32BE(16)}x${buffer.readUInt32BE(20)}`
}

/** `#fff` → `#ffffff`, damit kurze und lange Schreibweise gleich sind. */
function hex(color: string): string {
  return color.length === 4
    ? '#' + [...color.slice(1)].map((c) => c + c).join('')
    : color.toLowerCase()
}

/** Mischt eine rgba()-Überlagerung auf eine Hex-Farbe (wie der Browser). */
function blend(baseHex: string, overlay: string): string {
  const [r, g, b, a] = overlay
    .replace(/rgba?\(|\)/g, '')
    .split(',')
    .map((part) => Number(part.trim()))
  const base = [1, 3, 5].map((i) => parseInt(baseHex.slice(i, i + 2), 16))
  return (
    '#' +
    [r, g, b]
      .map((channel, i) => Math.round(base[i] + (channel - base[i]) * a))
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('')
  )
}

describe('Web-App-Manifest', () => {
  const m = manifest()

  it('heißt „Heusser Verwaltung“ und startet im Admin-Bereich', () => {
    expect(m.name).toBe('Heusser Verwaltung')
    expect(m.name).toBe(PWA_NAME)
    expect(m.short_name).toBe('Verwaltung')
    expect(m.lang).toBe('de')
    expect(m.start_url).toBe('/admin')
    expect(m.scope).toBe('/')
    expect(m.display).toBe('standalone')
    // Eine PWA für Handy, Tablet und PC (D7) - keine feste Ausrichtung.
    expect(m.orientation).toBeUndefined()
  })

  it('nimmt die Farben des Standardmodus (dunkel)', () => {
    expect(m.theme_color).toBe(PWA_THEME_COLORS.dark)
    expect(m.background_color).toBe(PWA_BACKGROUND_COLORS.dark)
  })

  it('hat 192er und 512er Icons, je für „any“ und „maskable“', () => {
    const icons = m.icons ?? []
    for (const purpose of ['any', 'maskable'] as const) {
      const sizes = icons
        .filter((icon) => icon.purpose === purpose)
        .map((icon) => icon.sizes)
      expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']))
    }
  })

  it('verweist nur auf Icon-Dateien, die es gibt, in der angegebenen Größe', () => {
    for (const icon of manifest().icons ?? []) {
      const file = path.join(PUBLIC_DIR, icon.src)
      expect(existsSync(file)).toBe(true)
      expect(pngSize(file)).toBe(icon.sizes)
    }
    expect(pngSize(path.join(PUBLIC_DIR, PWA_ICONS.apple))).toBe('180x180')
  })
})

describe('PWA-Farben passen zum MUI-Theme der App', () => {
  // Providers.tsx: createTheme({ palette: { mode } }), AppBar mit Elevation 4.
  it('hell: AppBar = primary.main, Hintergrund = background.default', () => {
    const theme = createTheme({ palette: { mode: 'light' } })
    expect(PWA_THEME_COLORS.light).toBe(theme.palette.primary.main)
    expect(PWA_BACKGROUND_COLORS.light).toBe(
      hex(theme.palette.background.default)
    )
  })

  it('dunkel: AppBar = background.paper mit Elevation-4-Overlay', () => {
    const theme = createTheme({ palette: { mode: 'dark' } })
    const overlay = alpha('#fff', Number(getOverlayAlpha(4)))
    expect(PWA_THEME_COLORS.dark).toBe(
      blend(hex(theme.palette.background.paper), overlay)
    )
    expect(PWA_BACKGROUND_COLORS.dark).toBe(
      hex(theme.palette.background.default)
    )
  })
})

describe('shouldRegisterServiceWorker', () => {
  const ok = { nodeEnv: 'production', supported: true, secureContext: true }

  it('registriert im Produktions-Build', () => {
    expect(shouldRegisterServiceWorker(ok)).toBe(true)
  })

  it('nie in Entwicklung oder Tests', () => {
    expect(shouldRegisterServiceWorker({ ...ok, nodeEnv: 'development' })).toBe(
      false
    )
    expect(shouldRegisterServiceWorker({ ...ok, nodeEnv: 'test' })).toBe(false)
    expect(shouldRegisterServiceWorker({ ...ok, nodeEnv: undefined })).toBe(
      false
    )
  })

  it('nicht ohne Browser-Unterstützung oder ohne sicheren Kontext', () => {
    expect(shouldRegisterServiceWorker({ ...ok, supported: false })).toBe(false)
    expect(shouldRegisterServiceWorker({ ...ok, secureContext: false })).toBe(
      false
    )
  })

  it('nicht mit dem Notschalter NEXT_PUBLIC_DISABLE_SW', () => {
    expect(shouldRegisterServiceWorker({ ...ok, disabled: '1' })).toBe(false)
    expect(shouldRegisterServiceWorker({ ...ok, disabled: ' ja ' })).toBe(false)
    expect(shouldRegisterServiceWorker({ ...ok, disabled: '0' })).toBe(true)
    expect(shouldRegisterServiceWorker({ ...ok, disabled: '' })).toBe(true)
  })
})

describe('serviceWorkerUrl', () => {
  it('hängt die Build-Version an, damit ein Deploy den Worker erneuert', () => {
    expect(serviceWorkerUrl('lx3k9')).toBe('/sw.js?v=lx3k9')
    expect(serviceWorkerUrl('a b')).toBe('/sw.js?v=a%20b')
  })

  it('ohne Version die nackte Datei', () => {
    expect(serviceWorkerUrl('')).toBe(SERVICE_WORKER_PATH)
  })
})

describe('public/sw.js und lib/pwa.ts', () => {
  it('benutzen dasselbe Cache-Präfix', () => {
    const source = readFileSync(path.join(PUBLIC_DIR, 'sw.js'), 'utf8')
    expect(source).toContain(`const CACHE_PREFIX = '${SW_CACHE_PREFIX}'`)
  })

  it('die Offline-Seite sagt, was los ist', () => {
    const html = readFileSync(path.join(PUBLIC_DIR, 'offline.html'), 'utf8')
    expect(html).toContain('Keine Verbindung zum Server – bitte WLAN prüfen')
    expect(html).toContain('lang="de"')
    // Lädt nichts von Next oder fremden Hosts nach - es gibt ja keinen Server.
    expect(html).not.toMatch(/_next|https?:\/\//)
  })
})
