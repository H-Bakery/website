/**
 * Unit tests for the real shop product data layer
 */

import {
  ProductCategory,
  ProductStatus,
  ProductType,
} from '@bakery/shared/types'
import {
  SHOP_CATEGORIES,
  ShopProduct,
  fetchShopProduct,
  fetchShopProducts,
  formatEuro,
  isShopCategory,
  resolveShopApiBaseUrl,
  shopCategoryLabel,
  toCartProduct,
} from './shop-products'

const mockFetch = jest.fn()

/** Builds a minimal Response-like object; only `ok`/`status`/`json` are used. */
function jsonResponse(
  body: unknown,
  init: { ok?: boolean; status?: number } = {}
): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response
}

const RAW_KORNBROT = {
  id: 'kornbrot-500g',
  numeric_id: 1,
  name: 'Kornbrot 500g',
  category: 'brot',
  price: 2.5,
  available: true,
  seasonal: false,
  image: '/assets/images/products/kornbrot.svg',
  short_description: 'Kräftiges Mischbrot mit Körnern.',
  description: 'Ein kräftiges Mischbrot, das über Nacht geführt wird.',
}

const RAW_TORTE = {
  id: 'erdbeertorte',
  numeric_id: 42,
  name: 'Erdbeertorte',
  category: 'torten',
  price: 18,
  available: false,
  seasonal: true,
  image: null,
  short_description: 'Nur im Sommer.',
  description: '',
}

describe('shop-products', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env['NEXT_PUBLIC_API_URL']
    global.fetch = mockFetch as unknown as typeof fetch
  })

  describe('SHOP_CATEGORIES', () => {
    it('covers exactly the seven real categories with German labels', () => {
      expect(SHOP_CATEGORIES.map((c) => c.key)).toEqual([
        'brot',
        'broetchen',
        'baguette',
        'teilchen',
        'snacks',
        'kuchen',
        'torten',
      ])
      expect(SHOP_CATEGORIES.map((c) => c.label)).toEqual([
        'Brot',
        'Brötchen',
        'Baguette',
        'Teilchen',
        'Snacks',
        'Kuchen',
        'Torten',
      ])
    })

    it('exposes a type guard and a label lookup', () => {
      expect(isShopCategory('broetchen')).toBe(true)
      expect(isShopCategory('getraenke')).toBe(false)
      expect(isShopCategory(undefined)).toBe(false)
      expect(shopCategoryLabel('broetchen')).toBe('Brötchen')
    })
  })

  describe('resolveShopApiBaseUrl', () => {
    it('falls back to localhost:5000', () => {
      expect(resolveShopApiBaseUrl()).toBe('http://localhost:5000')
    })

    it('uses NEXT_PUBLIC_API_URL and strips trailing slashes', () => {
      process.env['NEXT_PUBLIC_API_URL'] = 'https://api.example.com/'
      expect(resolveShopApiBaseUrl()).toBe('https://api.example.com')
    })
  })

  describe('fetchShopProducts', () => {
    it('keeps "not declared" (null) apart from "declared as free of the 14 allergens" ([])', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: [
            { ...RAW_KORNBROT, allergens: ['weizen', 'gluten', 'weizen'] },
            { ...RAW_TORTE, allergens: [] },
            { ...RAW_KORNBROT, id: 'ohne-angabe', numeric_id: 99 },
          ],
        })
      )

      const [declared, empty, missing] = await fetchShopProducts()

      // Dedupliziert und sortiert, damit die Anzeige stabil bleibt.
      expect(declared.allergens).toEqual(['gluten', 'weizen'])
      // Eine leere Liste ist eine Aussage der Bäckerei und darf nicht zu null verfallen.
      expect(empty.allergens).toEqual([])
      // Kein Feld im Markdown heißt "nicht deklariert" - niemals Freiheit behaupten.
      expect(missing.allergens).toBeNull()
    })

    it('maps snake_case to camelCase and keeps teaser and body apart', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, data: [RAW_KORNBROT] })
      )

      const products = await fetchShopProducts()

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/products',
        expect.objectContaining({ headers: { Accept: 'application/json' } })
      )
      expect(products).toHaveLength(1)
      expect(products[0]).toEqual<ShopProduct>({
        id: 'kornbrot-500g',
        numericId: 1,
        name: 'Kornbrot 500g',
        category: 'brot',
        price: 2.5,
        available: true,
        seasonal: false,
        image: '/assets/images/products/kornbrot.svg',
        shortDescription: 'Kräftiges Mischbrot mit Körnern.',
        description: 'Ein kräftiges Mischbrot, das über Nacht geführt wird.',
        // Ohne Angaben im Markdown: null = "nicht deklariert".
        allergens: null,
        allergensSource: null,
        allergenRecipe: null,
      })
      // The two description fields must never be collapsed into one.
      expect(products[0].shortDescription).not.toBe(products[0].description)
    })

    it('tolerates a bare array payload', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([RAW_KORNBROT, RAW_TORTE]))

      const products = await fetchShopProducts()

      expect(products.map((p) => p.id)).toEqual([
        'kornbrot-500g',
        'erdbeertorte',
      ])
      expect(products[1]).toMatchObject({
        numericId: 42,
        available: false,
        seasonal: true,
        image: null,
      })
    })

    it('applies defaults and skips unusable records', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          data: [
            { id: 'brezel', name: 'Brezel', category: 'snacks', price: '1.2' },
            { numeric_id: 7, name: 'Ohne Id' },
            { id: 'ohne-name', numeric_id: 8 },
            null,
          ],
        })
      )

      const products = await fetchShopProducts()

      expect(products).toHaveLength(1)
      expect(products[0]).toMatchObject({
        id: 'brezel',
        numericId: 0,
        price: 1.2,
        available: true,
        seasonal: false,
        image: null,
        shortDescription: '',
        description: '',
      })
    })

    it('throws a German error on an HTTP failure', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ error: 'boom' }, { ok: false, status: 500 })
      )

      await expect(fetchShopProducts()).rejects.toThrow(
        'Produkte konnten nicht geladen werden.'
      )
    })

    it('throws a German error on a network failure', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

      await expect(fetchShopProducts()).rejects.toThrow(
        'Produkte konnten nicht geladen werden.'
      )
    })

    it('throws a German error when the body is not JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token <')
        },
      } as unknown as Response)

      await expect(fetchShopProducts()).rejects.toThrow(
        'Produkte konnten nicht geladen werden.'
      )
    })
  })

  describe('fetchShopProduct', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue(
        jsonResponse({ success: true, data: [RAW_KORNBROT, RAW_TORTE] })
      )
    })

    it('matches by slug id', async () => {
      const product = await fetchShopProduct('kornbrot-500g')
      expect(product?.name).toBe('Kornbrot 500g')
    })

    it('matches by numeric id', async () => {
      const product = await fetchShopProduct('42')
      expect(product?.id).toBe('erdbeertorte')
    })

    it('matches a slug case-insensitively', async () => {
      const product = await fetchShopProduct('Kornbrot-500g')
      expect(product?.numericId).toBe(1)
    })

    it('returns null for an unknown id instead of throwing', async () => {
      await expect(fetchShopProduct('gibt-es-nicht')).resolves.toBeNull()
      await expect(fetchShopProduct('9999')).resolves.toBeNull()
    })

    it('returns null for an empty id without hitting the API', async () => {
      await expect(fetchShopProduct('  ')).resolves.toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('formatEuro', () => {
    // Intl separates the amount from the currency symbol with a non-breaking
    // space (U+00A0, U+202F in some ICU builds) — normalise before comparing.
    const normalize = (value: string) =>
      value.replace(/[\u00a0\u202f\s]+/g, ' ')

    it('formats German prices with a comma and the euro sign', () => {
      expect(normalize(formatEuro(2.5))).toBe('2,50 €')
      expect(normalize(formatEuro(18))).toBe('18,00 €')
    })

    it('uses a dot as the thousands separator', () => {
      expect(normalize(formatEuro(1234.5))).toBe('1.234,50 €')
    })

    it('falls back to zero for non-finite input', () => {
      expect(normalize(formatEuro(Number.NaN))).toBe('0,00 €')
    })
  })

  describe('toCartProduct', () => {
    const kornbrot: ShopProduct = {
      id: 'kornbrot-500g',
      numericId: 1,
      name: 'Kornbrot 500g',
      category: 'brot',
      price: 2.5,
      available: true,
      seasonal: false,
      image: '/assets/images/products/kornbrot.svg',
      shortDescription: 'Kräftiges Mischbrot mit Körnern.',
      description: 'Langer Fließtext aus der Markdown-Datei.',
    }

    it('uses the numeric id as the cart key and keeps the slug', () => {
      const product = toCartProduct(kornbrot)
      expect(product.id).toBe(1)
      expect(product.slug).toBe('kornbrot-500g')
    })

    it('maps categories onto the ProductCategory enum', () => {
      expect(toCartProduct(kornbrot).category).toBe(ProductCategory.Bread)
      expect(
        toCartProduct({ ...kornbrot, category: 'baguette' }).category
      ).toBe(ProductCategory.Bread)
      expect(
        toCartProduct({ ...kornbrot, category: 'broetchen' }).category
      ).toBe(ProductCategory.Buns)
      expect(toCartProduct({ ...kornbrot, category: 'torten' }).category).toBe(
        ProductCategory.SpecialCakes
      )
    })

    it('derives status, stock and type from availability and season', () => {
      const available = toCartProduct(kornbrot)
      expect(available.status).toBe(ProductStatus.Available)
      expect(available.type).toBe(ProductType.Fresh)
      // Cart validation compares quantity against stock — must not block orders.
      expect(available.stock).toBeGreaterThan(0)

      const seasonal = toCartProduct({ ...kornbrot, seasonal: true })
      expect(seasonal.type).toBe(ProductType.Seasonal)

      const soldOut = toCartProduct({ ...kornbrot, available: false })
      expect(soldOut.status).toBe(ProductStatus.OutOfStock)
      expect(soldOut.stock).toBe(0)
      expect(soldOut.isActive).toBe(false)
    })

    it('keeps the real image path and shows the teaser as the cart description', () => {
      const product = toCartProduct(kornbrot)
      expect(product.image).toBe('/assets/images/products/kornbrot.svg')
      expect(product.imageUrl).toBe('/assets/images/products/kornbrot.svg')
      expect(product.description).toBe('Kräftiges Mischbrot mit Körnern.')
      expect(toCartProduct({ ...kornbrot, image: null }).image).toBeUndefined()
    })

    it('produces deterministic values so SSR and hydration agree', () => {
      expect(toCartProduct(kornbrot)).toEqual(toCartProduct(kornbrot))
    })
  })
})
