import { act, fireEvent, render, screen, within } from '@testing-library/react'

import type { ShopProduct } from '@bakery/shared/data-access'

import {
  CatalogPage,
  buildSearchIndex,
  emptyHint,
  foldSearchText,
  parseSort,
  searchIndex,
  sortProducts,
  withinEditDistance,
} from './catalog-page'

/* -------------------------------------------------------------------------- */
/* Mocks                                                                       */
/* -------------------------------------------------------------------------- */

const mockPush = jest.fn()
const mockReplace = jest.fn()
let mockParams = new URLSearchParams()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => '/products',
  useSearchParams: () => mockParams,
}))

jest.mock('@bakery/shared/contexts', () => ({
  useCart: () => ({
    addToCart: jest.fn(),
    updateQuantity: jest.fn(),
    getQuantity: () => 0,
  }),
}))

const mockFetchShopProducts = jest.fn()

jest.mock('@bakery/shared/data-access', () => ({
  ...jest.requireActual('@bakery/shared/data-access'),
  fetchShopProducts: () => mockFetchShopProducts(),
}))

/* -------------------------------------------------------------------------- */
/* Daten – echte hq-Namen, damit die Falle mit den Umlauten echt ist           */
/* -------------------------------------------------------------------------- */

let nextId = 0

function product(
  name: string,
  category: ShopProduct['category'],
  price: number,
  shortDescription = ''
): ShopProduct {
  nextId += 1
  return {
    id: `p-${nextId}`,
    numericId: nextId,
    name,
    category,
    price,
    available: true,
    seasonal: false,
    image: null,
    shortDescription,
    description: '',
  }
}

/** Die 15 Brötchen aus `hq` – nur acht tragen das Wort im Namen. */
const BROETCHEN: ShopProduct[] = [
  product('Doppelweck', 'broetchen', 0.55),
  product('Samstagsweck', 'broetchen', 0.6),
  product('Sternweck', 'broetchen', 0.6),
  product('Flitweck', 'broetchen', 0.6),
  product('Elsässer', 'broetchen', 0.7),
  product('Knusperweck', 'broetchen', 0.65),
  product('Roggenweck', 'broetchen', 0.7),
  product('Körnerweck', 'broetchen', 0.75),
  product('Mohn-Brötchen', 'broetchen', 0.7),
  product('Sesam-Brötchen', 'broetchen', 0.7),
  product('Kümmel-Brötchen', 'broetchen', 0.7),
  product('Dinkel-Brötchen', 'broetchen', 0.8),
  product('Mohn-Hörnchen', 'broetchen', 0.9),
  product('Sesam-Hörnchen', 'broetchen', 0.9),
  product('Käse-Brötchen', 'broetchen', 1.1),
]

const CATALOG: ShopProduct[] = [
  ...BROETCHEN,
  product('Kornbrot 500g', 'brot', 2.5, 'Kernig & saftig.'),
  product('Kornbrot 1000g', 'brot', 4.4),
  product('Kasten Weißbrot', 'brot', 2.9),
  product('Käsekuchen', 'kuchen', 14.0),
  product('Käsekuchen (1 Stück)', 'kuchen', 1.8),
  product('Nusskuchen', 'kuchen', 12.0),
  product('Croissant', 'teilchen', 1.2),
  product(
    'Schwarzwälder-Kirsch-Torte',
    'torten',
    22.0,
    'Sahne, Kirschen und geröstete Nüsse.'
  ),
]

const INDEX = buildSearchIndex(CATALOG)

/** Namen der Treffer – kompakter als ganze Produkte zu vergleichen. */
function hits(query: string): string[] {
  return searchIndex(INDEX, query).products.map((entry) => entry.name)
}

/* -------------------------------------------------------------------------- */
/* Falten                                                                      */
/* -------------------------------------------------------------------------- */

describe('foldSearchText', () => {
  it('zieht Umlaut, Umschrift und blanke Schreibweise auf eine Form zusammen', () => {
    expect(foldSearchText('Brötchen')).toBe('brotchen')
    expect(foldSearchText('broetchen')).toBe('brotchen')
    expect(foldSearchText('BROTCHEN')).toBe('brotchen')

    expect(foldSearchText('Käsekuchen')).toBe('kasekuchen')
    expect(foldSearchText('kaesekuchen')).toBe('kasekuchen')
    expect(foldSearchText('kasekuchen')).toBe('kasekuchen')
  })

  it('behandelt ß wie ss', () => {
    expect(foldSearchText('Weißbrot')).toBe(foldSearchText('weissbrot'))
    expect(foldSearchText('Nusskuchen')).toBe(foldSearchText('nußkuchen'))
  })

  it('kürzt ss nicht auf s – das brächte falsche Treffer', () => {
    // „Nuss" darf niemals „K-nus-perweck" finden.
    expect(foldSearchText('Nuss')).toBe('nuss')
    expect(foldSearchText('Knusperweck')).toBe('knusperweck')
  })

  it('wirft Satzzeichen weg und behält Ziffern', () => {
    expect(foldSearchText('Mohn-Brötchen')).toBe('mohn brotchen')
    expect(foldSearchText('Kornbrot 500g')).toBe('kornbrot 500g')
    expect(foldSearchText('   ')).toBe('')
  })
})

describe('withinEditDistance', () => {
  it('verzeiht genau einen Fehler, auch eine Vertauschung', () => {
    expect(withinEditDistance('croisant', 'croissant', 1)).toBe(true)
    expect(withinEditDistance('bort', 'brot', 1)).toBe(true)
    expect(withinEditDistance('brot', 'brot', 1)).toBe(true)
  })

  it('lässt zwei Fehler nicht durch', () => {
    expect(withinEditDistance('croisnat', 'croissant', 1)).toBe(false)
    expect(withinEditDistance('torte', 'brot', 1)).toBe(false)
  })
})

/* -------------------------------------------------------------------------- */
/* Suche                                                                       */
/* -------------------------------------------------------------------------- */

describe('searchIndex', () => {
  it('findet alle 15 Brötchen – mit und ohne Umlaut', () => {
    // Der eigentliche Fehler: „broetchen" fand vorher null von fünfzehn.
    expect(hits('broetchen')).toHaveLength(15)
    expect(hits('Brötchen')).toHaveLength(15)
    expect(hits('brotchen')).toHaveLength(15)
    // Auch die sieben ohne das Wort im Namen sind dabei (über die Kategorie).
    expect(hits('broetchen')).toContain('Doppelweck')
  })

  it('findet Käsekuchen, Weißbrot und Nusskuchen ohne Sonderzeichen', () => {
    expect(hits('kaesekuchen')).toEqual(['Käsekuchen', 'Käsekuchen (1 Stück)'])
    expect(hits('kasekuchen')).toEqual(hits('Käsekuchen'))
    expect(hits('weissbrot')).toEqual(['Kasten Weißbrot'])
    expect(hits('nusskuchen')).toEqual(['Nusskuchen'])
  })

  it('sucht nach Teilwörtern und in beliebiger Wortfolge', () => {
    // „Körnerweck" ist ein echter Teilworttreffer, kein Zufall.
    expect(hits('korn')).toEqual([
      'Kornbrot 1000g',
      'Kornbrot 500g',
      'Körnerweck',
    ])
    expect(hits('kuchen kaese')).toEqual(['Käsekuchen', 'Käsekuchen (1 Stück)'])
  })

  it('stellt den Namenstreffer vor den Treffer im Anrisstext', () => {
    // „Nusskuchen" heißt so; die Torte erwähnt Nüsse nur im Anrisstext.
    expect(hits('nuss')).toEqual(['Nusskuchen', 'Schwarzwälder-Kirsch-Torte'])
  })

  it('zählt Brötchen zu „Brot" – aber die Brote kommen zuerst', () => {
    // Gefaltet ist `brotchen` nun einmal ein `brot` mit Anhang. Das ist
    // vertretbar (ein Brötchen ist Brot), solange die Reihenfolge stimmt.
    const found = hits('brot')
    expect(found).toContain('Kornbrot 500g')
    expect(found).toContain('Doppelweck')
    expect(found.indexOf('Kasten Weißbrot')).toBeLessThan(
      found.indexOf('Doppelweck')
    )
  })

  it('verzeiht einen Tippfehler – aber erst, wenn nichts genau passt', () => {
    const typo = searchIndex(INDEX, 'croisant')
    expect(typo.products.map((p) => p.name)).toEqual(['Croissant'])
    // Geraten ist geraten: die Seite muss das sagen dürfen.
    expect(typo.approximate).toBe(true)

    const exact = searchIndex(INDEX, 'croissant')
    expect(exact.products.map((p) => p.name)).toEqual(['Croissant'])
    expect(exact.approximate).toBe(false)

    // Vertauschte Buchstaben zählen als ein Fehler, nicht als zwei.
    const swapped = searchIndex(INDEX, 'bort')
    expect(swapped.products.map((p) => p.name)).toEqual([
      'Kasten Weißbrot',
      'Kornbrot 1000g',
      'Kornbrot 500g',
    ])
    expect(swapped.approximate).toBe(true)
  })

  it('rät nicht ins Blaue', () => {
    const nothing = searchIndex(INDEX, 'zzzzznichtsda')
    expect(nothing.products).toEqual([])
    expect(nothing.approximate).toBe(false)

    // Zu kurz für Nachsicht: drei Buchstaben ohne genauen Treffer bleiben leer.
    expect(hits('xyz')).toEqual([])
    // Und kein Brot ist ein Brötchen.
    expect(hits('brotchen')).not.toContain('Kasten Weißbrot')
  })

  it('gibt ohne Suchbegriff alles zurück', () => {
    const all = searchIndex(INDEX, '   ')
    expect(all.products).toHaveLength(CATALOG.length)
    expect(all.approximate).toBe(false)
  })
})

/* -------------------------------------------------------------------------- */
/* Sortierung                                                                  */
/* -------------------------------------------------------------------------- */

describe('sortProducts', () => {
  const sample = [
    product('Zopf', 'kuchen', 5),
    product('Apfelkuchen', 'kuchen', 12),
    product('Brezel', 'snacks', 1.1),
  ]

  it('sortiert nach Name, Preis aufwärts und Preis abwärts', () => {
    expect(sortProducts(sample, 'name').map((p) => p.name)).toEqual([
      'Apfelkuchen',
      'Brezel',
      'Zopf',
    ])
    expect(sortProducts(sample, 'price-asc').map((p) => p.price)).toEqual([
      1.1, 5, 12,
    ])
    expect(sortProducts(sample, 'price-desc').map((p) => p.price)).toEqual([
      12, 5, 1.1,
    ])
  })

  it('lässt die Trefferreihenfolge bei „Beste Treffer" stehen', () => {
    expect(sortProducts(sample, 'relevance')).toBe(sample)
  })

  it('liest nur bekannte Werte aus der URL', () => {
    expect(parseSort('price-asc')).toBe('price-asc')
    expect(parseSort('kaese')).toBeNull()
    expect(parseSort(null)).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/* Leere Theke                                                                 */
/* -------------------------------------------------------------------------- */

describe('emptyHint', () => {
  it('nennt die Treffer, die außerhalb der Kategorie liegen', () => {
    expect(
      emptyHint({ query: 'nuss', category: 'brot', hitsElsewhere: 4 })
    ).toBe(
      'Unter „Brot“ finden wir zu „nuss“ nichts. In anderen Kategorien gibt es 4 Treffer.'
    )
    expect(
      emptyHint({ query: 'nuss', category: 'brot', hitsElsewhere: 1 })
    ).toContain('gibt es 1 Treffer.')
  })

  it('nennt nachsichtige Treffer als ähnliche, nicht als genaue', () => {
    // „croisant“ trifft nur über die Tippfehlernachsicht – das muss dastehen.
    expect(
      emptyHint({
        query: 'croisant',
        category: 'brot',
        hitsElsewhere: 1,
        approximate: true,
      })
    ).toBe(
      'Unter „Brot“ finden wir zu „croisant“ nichts. In anderen Kategorien gibt es 1 ähnlichen Treffer.'
    )
    expect(
      emptyHint({
        query: 'croisant',
        category: 'brot',
        hitsElsewhere: 3,
        approximate: true,
      })
    ).toContain('3 ähnliche Treffer.')
  })

  it('bleibt beim allgemeinen Satz, wenn es nirgends etwas gibt', () => {
    expect(
      emptyHint({ query: 'zzz', category: 'brot', hitsElsewhere: 0 })
    ).toMatch(/Zu „zzz“ finden wir hier nichts/)
    expect(
      emptyHint({ query: 'zzz', category: 'all', hitsElsewhere: 0 })
    ).toMatch(/Zu „zzz“ finden wir hier nichts/)
  })

  it('spricht ohne Suchbegriff von der Kategorie', () => {
    expect(
      emptyHint({ query: null, category: 'torten', hitsElsewhere: 0 })
    ).toBe(
      'In dieser Kategorie liegt gerade nichts. Schauen Sie in einer anderen nach.'
    )
  })
})

/* -------------------------------------------------------------------------- */
/* Seite                                                                       */
/* -------------------------------------------------------------------------- */

describe('CatalogPage', () => {
  beforeEach(() => {
    mockPush.mockClear()
    mockReplace.mockClear()
    mockParams = new URLSearchParams()
    mockFetchShopProducts.mockResolvedValue(CATALOG)
  })

  async function renderCatalog() {
    render(<CatalogPage />)
    await screen.findByTestId('product-grid')
  }

  it('zeigt die Zähler je Kategorie an den Chips', async () => {
    await renderCatalog()

    expect(screen.getByTestId('category-all')).toHaveTextContent(
      `Alle (${CATALOG.length})`
    )
    expect(screen.getByTestId('category-broetchen')).toHaveTextContent(
      'Brötchen (15)'
    )
    expect(screen.getByTestId('category-brot')).toHaveTextContent('Brot (3)')
    // Kategorien ohne Produkte verschwinden nicht – der Filter bliebe sonst
    // unter der Hand woanders stehen.
    expect(screen.getByTestId('category-snacks')).toHaveTextContent(
      'Snacks (0)'
    )
  })

  it('filtert beim Tippen sofort und faltet dabei die Umlaute', async () => {
    await renderCatalog()

    fireEvent.change(screen.getByTestId('catalog-search-input'), {
      target: { value: 'broetchen' },
    })

    const grid = screen.getByTestId('product-grid')
    expect(within(grid).getAllByTestId('product-card')).toHaveLength(15)
    // Die Zähler folgen der Suche: nur dort liegen jetzt noch Treffer.
    expect(screen.getByTestId('category-brot')).toHaveTextContent('Brot (0)')
  })

  it('weist geratene Treffer als solche aus', async () => {
    await renderCatalog()

    fireEvent.change(screen.getByTestId('catalog-search-input'), {
      target: { value: 'croisant' },
    })

    expect(screen.getByTestId('catalog-approximate')).toHaveTextContent(
      /keinen genauen Treffer/
    )

    fireEvent.change(screen.getByTestId('catalog-search-input'), {
      target: { value: 'croissant' },
    })
    expect(screen.queryByTestId('catalog-approximate')).toBeNull()
  })

  it('zeigt die leere Theke und kommt aus ihr wieder heraus', async () => {
    await renderCatalog()

    const input = screen.getByTestId('catalog-search-input')
    fireEvent.change(input, { target: { value: 'zzzzznichtsda' } })

    expect(screen.getByTestId('catalog-empty')).toBeInTheDocument()
    // Such- und Filterleiste bleiben stehen, sonst gibt es keinen Rückweg.
    expect(input).toBeInTheDocument()
    expect(screen.getByTestId('category-filter')).toBeInTheDocument()

    fireEvent.click(
      within(screen.getByTestId('catalog-empty')).getByRole('button', {
        name: 'Filter zurücksetzen',
      })
    )

    expect(screen.getByTestId('catalog-search-input')).toHaveValue('')
    expect(screen.queryByTestId('catalog-empty')).toBeNull()
  })

  it('löscht beim Nachziehen der URL kein eben getipptes Leerzeichen', async () => {
    const { rerender } = render(<CatalogPage />)
    await screen.findByTestId('product-grid')

    jest.useFakeTimers()
    try {
      const input = screen.getByTestId('catalog-search-input')
      fireEvent.change(input, { target: { value: 'brot ' } })
      act(() => {
        jest.advanceTimersByTime(400)
      })

      // Die URL bekommt den getrimmten Begriff …
      expect(mockReplace).toHaveBeenCalledWith('/products?q=brot', {
        scroll: false,
      })

      // … und wenn sie nachgezogen ist, bleibt das Feld, wie es getippt wurde.
      // Vorher sprang der Wert hier auf „brot“ zurück – samt Cursor.
      mockParams = new URLSearchParams('q=brot')
      rerender(<CatalogPage />)
      expect(screen.getByTestId('catalog-search-input')).toHaveValue('brot ')
    } finally {
      jest.useRealTimers()
    }
  })

  it('schreibt die Sortierung in die URL', async () => {
    await renderCatalog()

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Sortierung' }))
    fireEvent.click(screen.getByRole('option', { name: 'Preis aufsteigend' }))

    expect(mockPush).toHaveBeenCalledWith('/products?sort=price-asc', {
      scroll: false,
    })
  })

  it('liest Kategorie und Sortierung aus der URL', async () => {
    mockParams = new URLSearchParams('category=broetchen&sort=price-desc')
    await renderCatalog()

    expect(screen.getByTestId('category-broetchen')).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    const grid = screen.getByTestId('product-grid')
    const names = within(grid)
      .getAllByTestId('product-card-name')
      .map((node) => node.textContent)
    expect(names).toHaveLength(15)
    expect(names[0]).toBe('Käse-Brötchen') // 1,10 € – das teuerste Brötchen
  })

  it('übernimmt ?q= aus der URL in Feld und Trefferliste', async () => {
    // Der geteilte Link ist der halbe Zweck der URL-Steuerung: Wer
    // /products?q=broetchen aufruft, muss die Brötchen sehen, nicht alles.
    mockParams = new URLSearchParams('q=broetchen')
    await renderCatalog()

    expect(screen.getByTestId('catalog-search-input')).toHaveValue('broetchen')
    expect(
      within(screen.getByTestId('product-grid')).getAllByTestId('product-card')
    ).toHaveLength(15)
  })

  it('nimmt eine unbekannte Kategorie aus der URL nicht ernst', async () => {
    // Ein verstümmelter Link darf keine leere Seite ergeben.
    mockParams = new URLSearchParams('category=warengruppe-42')
    await renderCatalog()

    expect(screen.getByTestId('category-all')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(
      within(screen.getByTestId('product-grid')).getAllByTestId('product-card')
    ).toHaveLength(CATALOG.length)
  })

  it('räumt beim Zurücksetzen auch die URL auf', async () => {
    mockParams = new URLSearchParams('q=kaese&category=kuchen')
    await renderCatalog()

    fireEvent.click(screen.getByRole('button', { name: 'Filter zurücksetzen' }))

    expect(mockPush).toHaveBeenCalledWith('/products', { scroll: false })
  })

  it('zeigt bei leerer Kategorie, wo die Treffer sonst liegen', async () => {
    // „kaese" unter „Brot": hier nichts, nebenan drei (Käsekuchen ×2,
    // Käse-Brötchen). Ohne diesen Hinweis endet die Suche in einer Sackgasse.
    mockParams = new URLSearchParams('q=kaese&category=brot')
    render(<CatalogPage />)

    const empty = await screen.findByTestId('catalog-empty')
    expect(empty).toHaveTextContent('In anderen Kategorien gibt es 3 Treffer.')

    // Der Ausweg behält den Suchbegriff – nur die Kategorie fällt weg.
    fireEvent.click(
      within(empty).getByRole('button', { name: 'In allen Kategorien suchen' })
    )
    expect(mockPush).toHaveBeenCalledWith('/products?q=kaese', {
      scroll: false,
    })
  })

  it('meldet einen Ladefehler und versucht es erneut', async () => {
    mockFetchShopProducts
      .mockRejectedValueOnce(new Error('API weg'))
      .mockResolvedValueOnce(CATALOG)

    render(<CatalogPage />)

    expect(await screen.findByText('API weg')).toBeInTheDocument()
    expect(screen.queryByTestId('product-grid')).toBeNull()
    // Auch im Fehlerfall bleibt die Suchleiste stehen.
    expect(screen.getByTestId('catalog-search-input')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))

    expect(
      within(await screen.findByTestId('product-grid')).getAllByTestId(
        'product-card'
      )
    ).toHaveLength(CATALOG.length)
  })

  it('bietet „Beste Treffer" nur mit Suchbegriff an', async () => {
    await renderCatalog()

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Sortierung' }))
    expect(screen.queryByRole('option', { name: 'Beste Treffer' })).toBeNull()
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' })

    fireEvent.change(screen.getByTestId('catalog-search-input'), {
      target: { value: 'kuchen' },
    })

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Sortierung' }))
    expect(
      screen.getByRole('option', { name: 'Beste Treffer' })
    ).toBeInTheDocument()
  })
})
