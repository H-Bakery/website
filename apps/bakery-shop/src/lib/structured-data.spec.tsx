import React from 'react'
import { render } from '@testing-library/react'
import type { ShopProduct } from '@bakery/shared/data-access'
import {
  bakeryJsonLd,
  breadcrumbJsonLd,
  JsonLd,
  openingHoursJsonLd,
  productJsonLd,
  serializeJsonLd,
  type JsonLdObject,
  type JsonLdValue,
} from './structured-data'

/**
 * @fileoverview Tests der strukturierten Daten.
 *
 * Zwei davon sind keine Formalität, sondern sichern eine Rechtslage ab:
 * „Montag fehlt“ (Ruhetag darf nie als geöffnet ausgezeichnet werden) und
 * „kein aggregateRating“ (erfundene Bewertungssterne im Markup verstoßen gegen
 * § 5b Abs. 3 UWG und sind bei Google ein Grund für eine manuelle Maßnahme).
 */

const SHOP_URL = 'https://shop.test'

/**
 * Eigene Typwächter statt `Array.isArray` direkt: dessen Verengung liefert im
 * Ja-Zweig `any[]` und räumt im Nein-Zweig ein `readonly T[]` nicht aus der
 * Union. Beides würde hier `any` durch die Tests tragen.
 */
function isJsonLdObject(value: JsonLdValue): value is JsonLdObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isJsonLdArray(
  value: JsonLdValue
): value is ReadonlyArray<JsonLdValue> {
  return Array.isArray(value)
}

/** Zugriff auf verschachtelte Knoten ohne `any`. */
function child(node: JsonLdObject, key: string): JsonLdObject {
  const value = node[key]
  if (!isJsonLdObject(value)) throw new Error(`${key} ist kein Objekt`)
  return value
}

/** Zugriff auf Listen von Knoten ohne `any`. */
function children(node: JsonLdObject, key: string): JsonLdObject[] {
  const value = node[key]
  if (!isJsonLdArray(value)) throw new Error(`${key} ist keine Liste`)
  return value.map((entry, index) => {
    if (!isJsonLdObject(entry)) {
      throw new Error(`${key}[${index}] ist kein Objekt`)
    }
    return entry
  })
}

function makeProduct(overrides: Partial<ShopProduct> = {}): ShopProduct {
  return {
    id: 'kornbrot-500g',
    numericId: 1,
    name: 'Kornbrot 500g',
    category: 'brot',
    price: 2.5,
    available: true,
    seasonal: false,
    image: '/assets/images/products/kornbrot.svg',
    shortDescription: 'Kernig & saftig.',
    description: 'Unser Kornbrot 500g wird aus ausgewählten Getreidekörnern …',
    ...overrides,
  }
}

describe('structured-data', () => {
  const originalShopUrl = process.env.NEXT_PUBLIC_SHOP_URL

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SHOP_URL = SHOP_URL
  })

  afterAll(() => {
    process.env.NEXT_PUBLIC_SHOP_URL = originalShopUrl
  })

  /* ---------------------------------------------------------------------- */
  /* Öffnungszeiten                                                          */
  /* ---------------------------------------------------------------------- */

  describe('openingHoursJsonLd', () => {
    it('weist den Montag NICHT als geöffnet aus – er ist Ruhetag', () => {
      const serialized = JSON.stringify(openingHoursJsonLd())

      expect(serialized).not.toContain('Monday')
      expect(serialized).not.toContain('Montag')
      expect(serialized).not.toContain('Ruhetag')
    })

    it('leitet alle sechs Öffnungstage aus der Wochentabelle ab', () => {
      const days = openingHoursJsonLd().flatMap((spec) => {
        const value = spec['dayOfWeek']
        return Array.isArray(value) ? value : []
      })

      expect(days).toEqual(
        expect.arrayContaining([
          'https://schema.org/Tuesday',
          'https://schema.org/Wednesday',
          'https://schema.org/Thursday',
          'https://schema.org/Friday',
          'https://schema.org/Saturday',
          'https://schema.org/Sunday',
        ])
      )
      expect(days).toHaveLength(6)
    })

    it('übernimmt die Zeiten unverändert aus pickup.ts', () => {
      const specs = openingHoursJsonLd()

      const byDay = (day: string) =>
        specs.find((spec) => {
          const value = spec['dayOfWeek']
          return (
            Array.isArray(value) && value.includes(`https://schema.org/${day}`)
          )
        })

      expect(byDay('Tuesday')).toMatchObject({
        opens: '05:30',
        closes: '13:30',
      })
      expect(byDay('Saturday')).toMatchObject({
        opens: '05:30',
        closes: '12:30',
      })
      expect(byDay('Sunday')).toMatchObject({
        opens: '08:00',
        closes: '11:00',
      })
    })

    it('gibt geschlossene Tage gar nicht aus, statt 00:00–00:00 zu behaupten', () => {
      for (const spec of openingHoursJsonLd()) {
        expect(spec['opens']).not.toEqual(spec['closes'])
      }
    })
  })

  /* ---------------------------------------------------------------------- */
  /* Der Betrieb                                                             */
  /* ---------------------------------------------------------------------- */

  describe('bakeryJsonLd', () => {
    it('beschreibt die Bäckerei mit Anschrift und Telefon', () => {
      const node = bakeryJsonLd()

      expect(node['@type']).toBe('Bakery')
      expect(node['name']).toBe('Bäckerei Heusser')
      expect(node['telephone']).toBe('+49 6841 2229')
      expect(node['url']).toBe(`${SHOP_URL}/`)
      expect(child(node, 'address')).toMatchObject({
        '@type': 'PostalAddress',
        streetAddress: 'Eckstraße 3',
        postalCode: '66424',
        addressLocality: 'Homburg',
        addressCountry: 'DE',
      })
    })

    it('führt die Öffnungszeiten und damit auch dort keinen Montag', () => {
      const node = bakeryJsonLd()

      expect(children(node, 'openingHoursSpecification')).toHaveLength(3)
      expect(JSON.stringify(node)).not.toContain('Monday')
    })

    it('erfindet weder Bewertung noch Preisniveau', () => {
      const serialized = JSON.stringify(bakeryJsonLd())

      expect(serialized).not.toContain('aggregateRating')
      expect(serialized).not.toContain('review')
      expect(serialized).not.toContain('priceRange')
    })
  })

  /* ---------------------------------------------------------------------- */
  /* Produkte                                                                */
  /* ---------------------------------------------------------------------- */

  describe('productJsonLd', () => {
    it('gibt KEIN aggregateRating und keine review aus', () => {
      const serialized = JSON.stringify(productJsonLd(makeProduct()))

      expect(serialized).not.toContain('aggregateRating')
      expect(serialized).not.toContain('reviewCount')
      expect(serialized).not.toContain('ratingValue')
      expect(serialized).not.toContain('"review"')
    })

    it('beschreibt Produkt und Angebot in Euro', () => {
      const node = productJsonLd(makeProduct())

      expect(node['@type']).toBe('Product')
      expect(node['name']).toBe('Kornbrot 500g')
      expect(node['sku']).toBe('kornbrot-500g')
      expect(node['productID']).toBe('1')
      expect(node['category']).toBe('Brot')
      expect(node['url']).toBe(`${SHOP_URL}/products/kornbrot-500g`)

      expect(child(node, 'offers')).toMatchObject({
        '@type': 'Offer',
        priceCurrency: 'EUR',
        price: '2.50',
        availability: 'https://schema.org/InStock',
        itemCondition: 'https://schema.org/NewCondition',
        availableDeliveryMethod: 'https://schema.org/OnSitePickup',
        url: `${SHOP_URL}/products/kornbrot-500g`,
      })
    })

    it('meldet ein nicht verfügbares Produkt als OutOfStock', () => {
      const node = productJsonLd(makeProduct({ available: false }))

      expect(child(node, 'offers')['availability']).toBe(
        'https://schema.org/OutOfStock'
      )
    })

    it('nennt den langen Fließtext als Beschreibung, nicht den Teaser', () => {
      const node = productJsonLd(makeProduct())

      expect(node['description']).toContain('Getreidekörnern')
    })

    it('weicht auf den Teaser aus, wenn kein Fließtext existiert', () => {
      const node = productJsonLd(makeProduct({ description: '' }))

      expect(node['description']).toBe('Kernig & saftig.')
    })

    it('verschweigt den Müllwert "images/" statt eine tote Bild-URL zu melden', () => {
      const junk = productJsonLd(makeProduct({ image: 'images/' }))
      const missing = productJsonLd(makeProduct({ image: null }))

      expect(junk['image']).toBeUndefined()
      expect(missing['image']).toBeUndefined()
    })

    it('macht ein brauchbares Bild absolut', () => {
      const node = productJsonLd(makeProduct())

      expect(node['image']).toBe(
        `${SHOP_URL}/assets/images/products/kornbrot.svg`
      )
    })

    it('verweist als Verkäufer auf denselben Betriebsknoten wie bakeryJsonLd', () => {
      const seller = child(
        child(productJsonLd(makeProduct()), 'offers'),
        'seller'
      )

      expect(seller['@id']).toBe(bakeryJsonLd()['@id'])
    })
  })

  /* ---------------------------------------------------------------------- */
  /* Brotkrümelpfad                                                          */
  /* ---------------------------------------------------------------------- */

  describe('breadcrumbJsonLd', () => {
    it('nummeriert die Stationen ab 1 und macht Pfade absolut', () => {
      const node = breadcrumbJsonLd([
        { name: 'Startseite', url: '/' },
        { name: 'Brot', url: '/products?category=brot' },
        { name: 'Kornbrot 500g', url: '/products/kornbrot-500g' },
      ])

      expect(node['@type']).toBe('BreadcrumbList')
      expect(children(node, 'itemListElement')).toEqual([
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Startseite',
          item: `${SHOP_URL}/`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Brot',
          item: `${SHOP_URL}/products?category=brot`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'Kornbrot 500g',
          item: `${SHOP_URL}/products/kornbrot-500g`,
        },
      ])
    })

    it('lässt eine bereits absolute URL unangetastet', () => {
      const node = breadcrumbJsonLd([
        { name: 'Website', url: 'https://example.test/seite' },
      ])

      expect(children(node, 'itemListElement')[0]['item']).toBe(
        'https://example.test/seite'
      )
    })
  })

  /* ---------------------------------------------------------------------- */
  /* Ausgabe                                                                 */
  /* ---------------------------------------------------------------------- */

  describe('serializeJsonLd', () => {
    it('kann aus dem script-Block nicht ausbrechen', () => {
      const serialized = serializeJsonLd({
        name: '</script><img src=x onerror=alert(1)>',
      })

      expect(serialized).not.toContain('</script>')
      expect(serialized).not.toContain('<')
      expect(serialized).toContain('\\u003c')
    })

    it('bleibt trotz Escaping gültiges, wertgleiches JSON', () => {
      const payload = { name: 'Brot & Brötchen <frisch>' }

      expect(JSON.parse(serializeJsonLd(payload))).toEqual(payload)
    })
  })

  describe('JsonLd', () => {
    it('rendert einen ld+json-Block mit dem Knoten', () => {
      const { container } = render(
        <JsonLd data={bakeryJsonLd()} id="ld-bakery" />
      )

      const script = container.querySelector(
        'script#ld-bakery[type="application/ld+json"]'
      )
      expect(script).not.toBeNull()

      const parsed = JSON.parse(script?.textContent ?? '{}')
      expect(parsed['@type']).toBe('Bakery')
      expect(parsed['@context']).toBe('https://schema.org')
    })

    it('gibt mehrere Knoten als Array aus', () => {
      const { container } = render(
        <JsonLd data={[bakeryJsonLd(), productJsonLd(makeProduct())]} />
      )

      const parsed = JSON.parse(
        container.querySelector('script')?.textContent ?? 'null'
      )
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed).toHaveLength(2)
    })
  })
})
