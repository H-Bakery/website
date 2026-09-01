import { render, screen } from '@testing-library/react'

import type { ShopProduct } from '@bakery/shared/data-access'

import {
  ProductDetailPage,
  baseProductId,
  selectRelatedProducts,
} from './product-detail-page'

/* -------------------------------------------------------------------------- */
/* Umgebung                                                                    */
/* -------------------------------------------------------------------------- */

jest.mock('@bakery/shared/contexts', () => ({
  useCart: () => ({
    addToCart: jest.fn(),
    updateQuantity: jest.fn(),
    getQuantity: () => 0,
  }),
}))

/** Katalog, den die „Passt dazu"-Reihe im Test zu sehen bekommt. */
let mockCatalog: ShopProduct[] = []

jest.mock('./use-shop-products', () => ({
  useShopProduct: () => ({
    product: null,
    status: 'loading',
    notFound: false,
    error: null,
    reload: jest.fn(),
  }),
  useShopProducts: () => ({
    products: mockCatalog,
    status: 'ready',
    error: null,
    reload: jest.fn(),
  }),
}))

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
    description: 'Ein langer Fließtext über das Brot.',
    allergens: ['gluten', 'roggen', 'sesam', 'weizen'],
    allergensSource: 'rezept',
    allergenRecipe: 'Kornbrot',
    ...overrides,
  }
}

/** Ein Produkt ohne jede Allergenangabe — 51 der 103 in `hq` sehen so aus. */
function makeUndeclared(overrides: Partial<ShopProduct> = {}): ShopProduct {
  return makeProduct({
    id: 'schwarzwaelder-kirsch-torte',
    numericId: 100,
    name: 'Schwarzwälder Kirsch Torte',
    category: 'torten',
    price: 45,
    image: null,
    shortDescription: 'Kirsche, Sahne, Schokolade.',
    description: 'Nach altem Rezept, mit echtem Kirschwasser.',
    allergens: null,
    allergensSource: null,
    allergenRecipe: null,
    ...overrides,
  })
}

beforeEach(() => {
  mockCatalog = []
})

/* -------------------------------------------------------------------------- */
/* Auswahl der Empfehlungen                                                    */
/* -------------------------------------------------------------------------- */

describe('baseProductId', () => {
  it('streicht Gewichts- und Portionsendungen', () => {
    expect(baseProductId('kornbrot-500g')).toBe('kornbrot')
    expect(baseProductId('kornbrot-1000g')).toBe('kornbrot')
    expect(baseProductId('sahnerollen-1-stueck')).toBe('sahnerollen')
    expect(baseProductId('kranzkuchen-1-4-stueck')).toBe('kranzkuchen')
  })

  it('lässt einen Namen ohne Größenangabe unangetastet', () => {
    expect(baseProductId('baguette-klein')).toBe('baguette-klein')
    expect(baseProductId('croissant')).toBe('croissant')
  })
})

describe('selectRelatedProducts', () => {
  const catalog: ShopProduct[] = [
    makeProduct({ id: 'kornbrot-500g', numericId: 1, category: 'brot' }),
    makeProduct({
      id: 'kornbrot-1000g',
      numericId: 2,
      name: 'Kornbrot 1000g',
      category: 'brot',
    }),
    makeProduct({
      id: 'mischbrot-500g',
      numericId: 3,
      name: 'Mischbrot 500g',
      category: 'brot',
    }),
    makeProduct({
      id: 'sternweck',
      numericId: 10,
      name: 'Sternweck',
      category: 'broetchen',
    }),
    makeProduct({
      id: 'laugenweck',
      numericId: 11,
      name: 'Laugenweck',
      category: 'broetchen',
    }),
    makeProduct({
      id: 'croissant',
      numericId: 20,
      name: 'Croissant',
      category: 'teilchen',
    }),
  ]

  it('nimmt nie das Produkt selbst auf', () => {
    const related = selectRelatedProducts(catalog[0], catalog)
    expect(related.map((entry) => entry.id)).not.toContain('kornbrot-500g')
  })

  it('lässt dasselbe Gebäck in einer anderen Größe weg', () => {
    // Eine andere Größe ist eine Alternative, keine Ergänzung.
    const related = selectRelatedProducts(catalog[0], catalog)
    expect(related.map((entry) => entry.id)).not.toContain('kornbrot-1000g')
  })

  it('greift zuerst in die ergänzenden Kategorien', () => {
    const related = selectRelatedProducts(catalog[0], catalog)
    // brot → broetchen, teilchen; die eigene Kategorie kommt zuletzt.
    expect(related.slice(0, 2).map((entry) => entry.category)).toEqual([
      'broetchen',
      'teilchen',
    ])
    expect(related.map((entry) => entry.id)).toContain('mischbrot-500g')
  })

  it('liefert bei gleicher Eingabe immer dieselbe Ausgabe', () => {
    const first = selectRelatedProducts(catalog[0], catalog)
    const second = selectRelatedProducts(catalog[0], [...catalog].reverse())
    expect(second.map((entry) => entry.id)).toEqual(
      first.map((entry) => entry.id)
    )
  })

  it('bevorzugt Produkte mit Bild, dann die kleinere Artikelnummer', () => {
    const withoutPicture = makeProduct({
      id: 'sternweck',
      numericId: 10,
      name: 'Sternweck',
      category: 'broetchen',
      image: 'images/',
    })
    const related = selectRelatedProducts(catalog[0], [
      catalog[0],
      withoutPicture,
      catalog[4],
    ])
    expect(related[0].id).toBe('laugenweck')
  })

  it('überspringt, was gerade nicht verfügbar ist', () => {
    const sold = catalog.map((entry) =>
      entry.id === 'sternweck' ? { ...entry, available: false } : entry
    )
    const related = selectRelatedProducts(sold[0], sold)
    expect(related.map((entry) => entry.id)).not.toContain('sternweck')
  })

  it('gibt lieber nichts zurück als eine halbe Reihe', () => {
    const lonely = makeProduct({ id: 'solo', numericId: 9, category: 'brot' })
    expect(selectRelatedProducts(lonely, [lonely])).toEqual([])
    // Ein einzelner Treffer ist noch keine Empfehlungsreihe.
    expect(selectRelatedProducts(lonely, [lonely, catalog[3]])).toEqual([])
  })
})

/* -------------------------------------------------------------------------- */
/* Die Seite                                                                   */
/* -------------------------------------------------------------------------- */

describe('ProductDetailPage', () => {
  it('rendert ein serverseitig geladenes Produkt ohne Ladezustand', () => {
    render(
      <ProductDetailPage pid="kornbrot-500g" initialProduct={makeProduct()} />
    )

    expect(screen.getByTestId('product-detail-name')).toHaveTextContent(
      'Kornbrot 500g'
    )
    expect(screen.getByTestId('product-detail-price').textContent).toMatch(
      /^2,50\s€$/
    )
  })

  it('zeigt für `null` den ehrlichen Leerzustand statt der Seite', () => {
    render(<ProductDetailPage pid="gibt-es-nicht" initialProduct={null} />)

    expect(screen.getByTestId('product-not-found')).toBeInTheDocument()
    expect(screen.queryByTestId('product-detail')).not.toBeInTheDocument()
  })

  it('lädt im Browser nach, wenn der Server nichts mitgibt', () => {
    // `undefined` heißt „konnte nicht nachsehen" — nicht „gibt es nicht".
    render(<ProductDetailPage pid="kornbrot-500g" />)

    expect(screen.queryByTestId('product-not-found')).not.toBeInTheDocument()
    expect(screen.queryByTestId('product-detail')).not.toBeInTheDocument()
  })
})

describe('Grundpreis (§ 4 PAngV)', () => {
  it('steht neben dem Preis, wenn der Name ein Gewicht trägt', () => {
    render(
      <ProductDetailPage pid="kornbrot-500g" initialProduct={makeProduct()} />
    )

    expect(screen.getByTestId('product-unit-price').textContent).toMatch(
      /Grundpreis:\s*5,00\s€\s*\/\s*kg/
    )
  })

  it('bleibt weg, wo es kein Gewicht gibt — nichts wird erfunden', () => {
    render(
      <ProductDetailPage
        pid="croissant"
        initialProduct={makeProduct({
          id: 'croissant',
          name: 'Croissant',
          category: 'teilchen',
        })}
      />
    )

    expect(screen.queryByTestId('product-unit-price')).not.toBeInTheDocument()
  })
})

describe('Vorbestellfrist', () => {
  it('warnt vor dem Warenkorb-Knopf bei einer ganzen Torte', () => {
    render(
      <ProductDetailPage
        pid="schwarzwaelder-kirsch-torte"
        initialProduct={makeUndeclared()}
      />
    )

    const notice = screen.getByTestId('product-lead-time')
    expect(notice).toHaveTextContent('Bitte vorbestellen')
    expect(notice).toHaveTextContent(/zwei Tage vorher/i)
  })

  it('schweigt beim Portionsstück aus der Theke', () => {
    render(
      <ProductDetailPage
        pid="sahnerollen-1-stueck"
        initialProduct={makeUndeclared({
          id: 'sahnerollen-1-stueck',
          name: 'Sahnerollen (1 Stück)',
          price: 2,
        })}
      />
    )

    expect(screen.queryByTestId('product-lead-time')).not.toBeInTheDocument()
  })
})

describe('Allergene', () => {
  it('nennt die deklarierten Allergene, das Rezept und die Backstube', () => {
    render(
      <ProductDetailPage pid="kornbrot-500g" initialProduct={makeProduct()} />
    )

    const block = screen.getByTestId('product-allergens')
    expect(block).toHaveTextContent('Enthält Gluten, Weizen, Roggen und Sesam.')
    expect(block).toHaveTextContent('Aus unserem Rezept „Kornbrot“.')
    expect(block).toHaveTextContent(/Rezept unserer Backstube/)
    expect(block).toHaveTextContent(/Spuren davon sind in jedem Gebäck möglich/)
  })

  it('hebt die Allergene im Satz hervor', () => {
    render(
      <ProductDetailPage pid="kornbrot-500g" initialProduct={makeProduct()} />
    )

    const emphasised = screen
      .getByTestId('product-allergen-list')
      .querySelector('strong')
    expect(emphasised).not.toBeNull()
    expect(emphasised).toHaveTextContent('Gluten, Weizen, Roggen und Sesam')
  })

  it('verschweigt keinen Schlüssel, den dieses Modul noch nicht kennt', () => {
    render(
      <ProductDetailPage
        pid="kornbrot-500g"
        initialProduct={makeProduct({ allergens: ['weizen', 'lupine'] })}
      />
    )

    expect(screen.getByTestId('product-allergen-list')).toHaveTextContent(
      'Weizen und Lupine'
    )
  })

  it('gibt ohne Angabe eine gerade Auskunft samt Telefonnummer', () => {
    render(
      <ProductDetailPage
        pid="schwarzwaelder-kirsch-torte"
        initialProduct={makeUndeclared()}
      />
    )

    const note = screen.getByTestId('product-allergens-unknown')
    expect(note).toHaveTextContent(/noch keine geprüfte Angabe/)
    expect(note).toHaveTextContent(/06841/)
    // Keine leere Liste, kein „Allergene: keine".
    expect(screen.getByTestId('product-allergens')).not.toHaveTextContent(
      'Enthält'
    )
  })

  it('behauptet nirgends Abwesenheit — weder mit noch ohne Angabe', () => {
    for (const product of [makeProduct(), makeUndeclared()]) {
      const view = render(
        <ProductDetailPage pid={product.id} initialProduct={product} />
      )
      const text = screen.getByTestId('product-allergens').textContent ?? ''
      expect(text).not.toMatch(/frei von|glutenfrei|laktosefrei|allergenfrei/i)
      expect(text).not.toMatch(/keine Allergene|ohne Allergene/i)
      view.unmount()
    }
  })
})

describe('Passt dazu', () => {
  it('zeigt die Reihe, sobald es passende Produkte gibt', () => {
    mockCatalog = [
      makeProduct(),
      makeProduct({
        id: 'sternweck',
        numericId: 10,
        name: 'Sternweck',
        category: 'broetchen',
      }),
      makeProduct({
        id: 'croissant',
        numericId: 20,
        name: 'Croissant',
        category: 'teilchen',
      }),
    ]

    render(
      <ProductDetailPage pid="kornbrot-500g" initialProduct={makeProduct()} />
    )

    const rail = screen.getByTestId('related-products')
    expect(rail).toHaveTextContent('Passt dazu')
    expect(
      screen
        .getByTestId('related-product-grid')
        .querySelectorAll('[data-testid="product-card"]')
    ).toHaveLength(2)
  })

  it('rendert gar nichts, statt die Reihe mit Füllmaterial zu strecken', () => {
    mockCatalog = [makeProduct()]

    render(
      <ProductDetailPage pid="kornbrot-500g" initialProduct={makeProduct()} />
    )

    expect(screen.queryByTestId('related-products')).not.toBeInTheDocument()
  })
})
