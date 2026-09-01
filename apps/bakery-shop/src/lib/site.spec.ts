import { landingUrl, shopBaseUrl, shopUrl } from './site'

/**
 * @fileoverview Tests der Basis-URL-Auflösung.
 *
 * Sie entscheidet, welche Adressen in `robots.txt`, `sitemap.xml`, im
 * Vorschaubild und im JSON-LD stehen. Eine falsche Basis macht alle vier
 * zugleich wertlos, deshalb ist die Reihenfolge hier festgeschrieben.
 */

const ENV_KEYS = [
  'NEXT_PUBLIC_SHOP_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'VERCEL_URL',
  'NEXT_PUBLIC_LANDING_URL',
] as const

describe('site', () => {
  const saved = new Map<string, string | undefined>()

  beforeAll(() => {
    for (const key of ENV_KEYS) saved.set(key, process.env[key])
  })

  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key]
  })

  afterAll(() => {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  describe('shopBaseUrl', () => {
    it('bevorzugt die ausdrücklich gesetzte Produktionsdomain', () => {
      process.env.NEXT_PUBLIC_SHOP_URL = 'https://shop.baeckerei.test'
      process.env.VERCEL_PROJECT_PRODUCTION_URL = 'projekt.vercel.app'

      expect(shopBaseUrl()).toBe('https://shop.baeckerei.test')
    })

    it('nimmt die Vercel-Produktionsdomain und ergänzt das fehlende Schema', () => {
      process.env.VERCEL_PROJECT_PRODUCTION_URL = 'projekt.vercel.app'
      process.env.VERCEL_URL = 'preview-abc.vercel.app'

      expect(shopBaseUrl()).toBe('https://projekt.vercel.app')
    })

    it('fällt auf die Deployment-URL des Previews zurück', () => {
      process.env.VERCEL_URL = 'preview-abc.vercel.app'

      expect(shopBaseUrl()).toBe('https://preview-abc.vercel.app')
    })

    it('nutzt ohne jede Variable den Dev-Server – und erfindet keine Domain', () => {
      expect(shopBaseUrl()).toBe('http://localhost:4200')
    })

    it('entfernt abschließende Schrägstriche', () => {
      process.env.NEXT_PUBLIC_SHOP_URL = 'https://shop.baeckerei.test///'

      expect(shopBaseUrl()).toBe('https://shop.baeckerei.test')
    })

    it('ignoriert eine leere Variable', () => {
      process.env.NEXT_PUBLIC_SHOP_URL = '   '
      process.env.VERCEL_URL = 'preview-abc.vercel.app'

      expect(shopBaseUrl()).toBe('https://preview-abc.vercel.app')
    })
  })

  describe('shopUrl', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_SHOP_URL = 'https://shop.test'
    })

    it('gibt die Startseite mit abschließendem Schrägstrich aus', () => {
      expect(shopUrl('/')).toBe('https://shop.test/')
      expect(shopUrl()).toBe('https://shop.test/')
    })

    it('hängt Pfade mit und ohne führenden Schrägstrich korrekt an', () => {
      expect(shopUrl('/products')).toBe('https://shop.test/products')
      expect(shopUrl('products')).toBe('https://shop.test/products')
    })

    it('lässt Query-Parameter unangetastet', () => {
      expect(shopUrl('/products?category=brot')).toBe(
        'https://shop.test/products?category=brot'
      )
    })
  })

  describe('landingUrl', () => {
    it('zeigt auf die Hauptseite der Bäckerei', () => {
      expect(landingUrl()).toBe('https://xn--bckerei-heusser-0kb.de')
    })

    it('lässt sich per Variable umstellen', () => {
      process.env.NEXT_PUBLIC_LANDING_URL = 'https://baeckerei.test/'

      expect(landingUrl()).toBe('https://baeckerei.test')
    })
  })
})
