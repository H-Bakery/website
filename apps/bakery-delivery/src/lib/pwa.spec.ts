import { readFileSync } from 'fs'
import path from 'path'
import {
  loadedShellUrls,
  serviceWorkerUrl,
  shouldRegisterServiceWorker,
  SW_CACHE_PREFIX,
  type ServiceWorkerEnvironment,
} from './pwa'

const env = (
  overrides: Partial<ServiceWorkerEnvironment> = {}
): ServiceWorkerEnvironment => ({
  nodeEnv: 'production',
  disabled: false,
  supported: true,
  secure: true,
  version: 'abc',
  ...overrides,
})

describe('Service Worker der Fahrer-App', () => {
  it('registriert nur im Produktions-Build, sicher und ohne Notschalter', () => {
    expect(shouldRegisterServiceWorker(env())).toBe(true)
    expect(shouldRegisterServiceWorker(env({ nodeEnv: 'development' }))).toBe(
      false
    )
    expect(shouldRegisterServiceWorker(env({ nodeEnv: 'test' }))).toBe(false)
    expect(shouldRegisterServiceWorker(env({ disabled: true }))).toBe(false)
    expect(shouldRegisterServiceWorker(env({ secure: false }))).toBe(false)
    expect(shouldRegisterServiceWorker(env({ supported: false }))).toBe(false)
  })

  it('hängt die Build-Version an die Worker-URL', () => {
    expect(serviceWorkerUrl('l2x9')).toBe('/sw.js?v=l2x9')
    expect(serviceWorkerUrl(undefined)).toBe('/sw.js')
  })

  it('hat dasselbe Cache-Präfix wie public/sw.js', () => {
    const source = readFileSync(
      path.resolve(__dirname, '../../public/sw.js'),
      'utf8'
    )
    expect(source).toContain(`const CACHE_PREFIX = '${SW_CACHE_PREFIX}'`)
  })

  it('meldet dem Worker nur die eigenen statischen Dateien', () => {
    const origin = 'https://fahrer.example.test'
    expect(
      loadedShellUrls(
        [
          { name: `${origin}/_next/static/chunks/main.js` },
          { name: `${origin}/_next/static/css/app.css?v=1` },
          { name: `${origin}/leaflet/marker-icon.png` },
          { name: `${origin}/api/deliveries/tours` },
          { name: 'https://tile.openstreetmap.org/1/2/3.png' },
          { name: 'kaputt' },
          { name: `${origin}/_next/static/chunks/main.js` },
        ],
        origin
      )
    ).toEqual([
      '/_next/static/chunks/main.js',
      '/_next/static/css/app.css?v=1',
      '/leaflet/marker-icon.png',
    ])
  })
})
