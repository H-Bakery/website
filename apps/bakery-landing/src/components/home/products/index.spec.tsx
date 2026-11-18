import { fireEvent, screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import Products, { normalizeSearch, searchProducts } from './index'
import { Product } from '../../../types/product'

const makeProducts = (
  category: string,
  count: number,
  firstId = 1
): Product[] =>
  Array.from({ length: count }, (_, i) => ({
    id: firstId + i,
    name: `${category} ${i + 1}`,
    category,
    price: 1 + i,
  }))

const productNames = () =>
  screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)

describe('Products pagination', () => {
  // 40 Produkte = 5 Seiten à 8; Brot 3 Seiten, Baguette 1 Seite.
  const brot = makeProducts('Brot', 20)
  const baguette = makeProducts('Baguette', 5, 100)
  const teilchen = makeProducts('Teilchen', 15, 200)
  const catalog = [...brot, ...baguette, ...teilchen]

  it('paginates 8 products per page', () => {
    renderWithTheme(<Products items={catalog} showControls />)

    expect(productNames()).toHaveLength(8)
    expect(screen.getByText('Brot 1')).toBeInTheDocument()
    expect(
      screen.getByRole('navigation', { name: 'Produkt-Seitennavigation' })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Seite 5' }))

    expect(productNames()).toEqual([
      'Teilchen 8',
      'Teilchen 9',
      'Teilchen 10',
      'Teilchen 11',
      'Teilchen 12',
      'Teilchen 13',
      'Teilchen 14',
      'Teilchen 15',
    ])
  })

  it('names the pagination buttons in German', () => {
    renderWithTheme(<Products items={catalog} showControls />)

    for (const name of [
      'Zur ersten Seite',
      'Vorherige Seite',
      'Seite 1, aktuelle Seite',
      'Seite 2',
      'Seite 5',
      'Nächste Seite',
      'Zur letzten Seite',
    ]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: /go to/i })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Seite 3' }))
    expect(
      screen.getByRole('button', { name: 'Seite 3, aktuelle Seite' })
    ).toHaveAttribute('aria-current', 'true')
  })

  it('scrolls the list top into view and focuses the list heading on page change', () => {
    const scrollIntoView = Element.prototype.scrollIntoView as jest.Mock
    scrollIntoView.mockClear()
    renderWithTheme(<Products items={catalog} showControls />)

    fireEvent.click(screen.getByRole('button', { name: 'Seite 2' }))

    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading).toHaveTextContent('Alle Produkte, Seite 2 von 5')
    expect(heading).toHaveFocus()
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.instances[0]).toBe(heading)
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    })
  })

  it('jumps without animation when the user prefers reduced motion', () => {
    const scrollIntoView = Element.prototype.scrollIntoView as jest.Mock
    scrollIntoView.mockClear()
    const original = window.matchMedia
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }))
    try {
      renderWithTheme(<Products items={catalog} showControls />)
      fireEvent.click(screen.getByRole('button', { name: 'Seite 2' }))
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: 'auto',
        block: 'start',
      })
    } finally {
      window.matchMedia = original
    }
  })

  it('shows a single-page category from the first page after switching on page 5', () => {
    renderWithTheme(
      <Products items={catalog} showControls showCategoryFilter />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Seite 5' }))
    expect(screen.getByText('Teilchen 15')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Baguette' }))

    expect(productNames()).toEqual([
      'Baguette 1',
      'Baguette 2',
      'Baguette 3',
      'Baguette 4',
      'Baguette 5',
    ])
    expect(
      screen.queryByText('Keine Produkte gefunden')
    ).not.toBeInTheDocument()
    // Eine Seite -> keine Seitennavigation nötig
    expect(
      screen.queryByRole('navigation', { name: 'Produkt-Seitennavigation' })
    ).not.toBeInTheDocument()
  })

  it('returns to page 1 of a multi-page category after switching on page 5', () => {
    renderWithTheme(
      <Products items={catalog} showControls showCategoryFilter />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Seite 5' }))

    fireEvent.click(screen.getByRole('button', { name: 'Brot' }))

    expect(productNames()).toEqual([
      'Brot 1',
      'Brot 2',
      'Brot 3',
      'Brot 4',
      'Brot 5',
      'Brot 6',
      'Brot 7',
      'Brot 8',
    ])
    expect(
      screen.getByRole('button', { name: 'Seite 1, aktuelle Seite' })
    ).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'Seite 3' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Seite 4' })).toBeNull()
  })

  it('returns to page 1 when a new product list comes in', () => {
    const { rerender } = renderWithTheme(
      <Products items={catalog} showControls />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Seite 5' }))

    rerender(<Products items={brot} showControls />)

    expect(productNames()[0]).toBe('Brot 1')
    expect(
      screen.getByRole('button', { name: 'Seite 1, aktuelle Seite' })
    ).toHaveAttribute('aria-current', 'true')
  })

  it('resets to page 1 when the search term changes', () => {
    renderWithTheme(<Products items={catalog} showControls />)
    fireEvent.click(screen.getByRole('button', { name: 'Seite 5' }))

    fireEvent.change(screen.getByLabelText('Produkte suchen'), {
      target: { value: 'Brot' },
    })

    // 20 Treffer, 3 Seiten, Seite 1 aktiv
    expect(productNames()).toHaveLength(8)
    expect(screen.getByText('Brot 1')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Seite 1, aktuelle Seite' })
    ).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'Seite 3' })).toBeInTheDocument()
  })

  it('shows the empty message only when the list is really empty', () => {
    renderWithTheme(<Products items={[]} showControls />)

    expect(screen.getByText('Keine Produkte gefunden')).toBeInTheDocument()
    expect(
      screen.queryByRole('navigation', { name: 'Produkt-Seitennavigation' })
    ).not.toBeInTheDocument()
  })
})

describe('Products status and controls', () => {
  const catalog = [
    ...makeProducts('Brot', 9),
    ...makeProducts('Teilchen', 3, 100),
  ]

  it('announces the number of hits in a status line instead of a live grid', () => {
    renderWithTheme(<Products items={catalog} showControls />)

    expect(screen.getByRole('status')).toHaveTextContent('12 Produkte gefunden')
    const grid = screen
      .getAllByRole('heading', { level: 3 })[0]
      .closest('.MuiGrid-container')
    expect(grid).not.toBeNull()
    expect(grid).not.toHaveAttribute('aria-live')
    expect(document.querySelector('[aria-live]')).toBeNull()

    fireEvent.change(screen.getByLabelText('Produkte suchen'), {
      target: { value: 'Teilchen' },
    })
    expect(screen.getByRole('status')).toHaveTextContent('3 Produkte gefunden')

    fireEvent.change(screen.getByLabelText('Produkte suchen'), {
      target: { value: 'Teilchen 2' },
    })
    expect(screen.getByRole('status')).toHaveTextContent('1 Produkt gefunden')
  })

  it('shows "Standard" in the sort select', () => {
    renderWithTheme(<Products items={catalog} showControls />)

    expect(screen.getByLabelText('Sortieren nach')).toHaveTextContent(
      'Standard'
    )
  })

  it('shows the list heading with count and page', () => {
    renderWithTheme(<Products items={catalog} showControls />)

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Alle Produkte, Seite 1 von 2'
    )
    expect(screen.getByText('12 Produkte · Seite 1 von 2')).toBeInTheDocument()
  })
})

describe('Products category and search together', () => {
  // Synthetisch: in Brot gibt es keinen Plunder, in Teilchen schon.
  const catalog: Product[] = [
    { id: 1, name: 'Musterbrot hell', category: 'Brot', price: 2 },
    { id: 2, name: 'Musterbrot dunkel', category: 'Brot', price: 2.5 },
    { id: 3, name: 'Testplunder Apfel', category: 'Teilchen', price: 1.2 },
    { id: 4, name: 'Testplunder Kirsch', category: 'Teilchen', price: 1.3 },
    { id: 5, name: 'Probebrötchen', category: 'Brötchen', price: 0.5 },
  ]

  const renderSortiment = () =>
    renderWithTheme(
      <Products items={catalog} showControls showCategoryFilter />
    )

  it('filters by category and search at the same time', () => {
    renderSortiment()

    fireEvent.click(screen.getByRole('button', { name: 'Brot' }))
    expect(productNames()).toEqual(['Musterbrot hell', 'Musterbrot dunkel'])

    fireEvent.change(screen.getByLabelText('Produkte suchen'), {
      target: { value: 'dunkel' },
    })
    expect(productNames()).toEqual(['Musterbrot dunkel'])
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Brot')
  })

  it('points to hits in other categories and searches there on request', () => {
    renderSortiment()

    fireEvent.click(screen.getByRole('button', { name: 'Brot' }))
    fireEvent.change(screen.getByLabelText('Produkte suchen'), {
      target: { value: 'Plunder' },
    })

    expect(
      screen.getByText('In „Brot“ nichts zu „Plunder“ gefunden')
    ).toBeInTheDocument()
    expect(
      screen.getByText('In anderen Kategorien gibt es 2 Treffer.')
    ).toBeInTheDocument()
    expect(screen.queryByText('Keine Produkte gefunden')).toBeNull()

    fireEvent.click(
      screen.getByRole('button', { name: 'In allen Kategorien suchen' })
    )

    expect(productNames()).toEqual(['Testplunder Apfel', 'Testplunder Kirsch'])
    expect(screen.getByRole('button', { name: 'Alle' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByLabelText('Produkte suchen')).toHaveValue('Plunder')
  })

  it('does not point elsewhere when nothing matches anywhere', () => {
    renderSortiment()

    fireEvent.click(screen.getByRole('button', { name: 'Brot' }))
    fireEvent.change(screen.getByLabelText('Produkte suchen'), {
      target: { value: 'Pizza' },
    })

    expect(screen.getByText('Keine Produkte gefunden')).toBeInTheDocument()
    expect(
      screen.getByText('Zu „Pizza“ passt kein Produkt.')
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'In allen Kategorien suchen' })
    ).toBeNull()
  })
})

describe('normalizeSearch / searchProducts', () => {
  // Synthetische Produkte.
  const catalog: Product[] = [
    { id: 1, name: 'Testbrötchen', category: 'Brötchen', price: 0.5 },
    { id: 2, name: 'Weißbrot', category: 'Brot', price: 2 },
    { id: 3, name: 'Musterbrot Kern 500g', category: 'Brot', price: 3 },
    { id: 4, name: 'Mustersemmel Mohn', category: 'Brötchen', price: 0.6 },
    { id: 5, name: 'Probekäsekuchen', category: 'Kuchen', price: 2.2 },
    { id: 6, name: 'Probeplunder Apfel', category: 'Teilchen', price: 1.4 },
    { id: 7, name: 'Muster-Kirsch-Torte', category: 'Torten', price: 18 },
  ]
  const names = (query: string) =>
    searchProducts(catalog, query).map((p) => p.name)

  it('trims, lower-cases, spells out umlauts and splits into words', () => {
    expect(normalizeSearch('Brötchen ')).toEqual(['broetchen'])
    expect(normalizeSearch('BRÖTCHEN')).toEqual(['broetchen'])
    expect(normalizeSearch('broetchen')).toEqual(['broetchen'])
    expect(normalizeSearch('Weißbrot')).toEqual(['weissbrot'])
    expect(normalizeSearch('  Mohn-Brötchen   Sesam ')).toEqual([
      'mohn',
      'broetchen',
      'sesam',
    ])
    expect(normalizeSearch('   ')).toEqual([])
  })

  it.each(['Brötchen ', 'broetchen', 'brotchen', 'BRÖTCHEN', 'testbrö'])(
    '„%s“ findet „Testbrötchen“',
    (query) => {
      expect(names(query)).toContain('Testbrötchen')
    }
  )

  it('finds „Weißbrot“ with ss and with ß', () => {
    expect(names('weissbrot')).toEqual(['Weißbrot'])
    expect(names('Weißbrot')).toEqual(['Weißbrot'])
  })

  it('finds „Käse“ as kaese and as kase', () => {
    expect(names('kaese')).toEqual(['Probekäsekuchen'])
    expect(names('kase')).toEqual(['Probekäsekuchen'])
  })

  it('needs every word, each in the name or the category', () => {
    expect(names('muster mohn')).toEqual(['Mustersemmel Mohn'])
    expect(names('mohn muster')).toEqual(['Mustersemmel Mohn'])
    expect(names('muster sesam')).toEqual([])
    // „teilchen“ steht nur in der Kategorie
    expect(names('teilchen apfel')).toEqual(['Probeplunder Apfel'])
  })

  it('ignores hyphens in names', () => {
    expect(names('kirschtorte')).toEqual(['Muster-Kirsch-Torte'])
    expect(names('kirsch-torte')).toEqual(['Muster-Kirsch-Torte'])
  })

  it('does not drag all Brötchen into a search for „Brot“', () => {
    expect(names('brot')).toEqual(['Weißbrot', 'Musterbrot Kern 500g'])
  })

  it('returns everything for an empty search', () => {
    expect(names('')).toHaveLength(catalog.length)
    expect(names('  ')).toHaveLength(catalog.length)
  })
})

const items: Product[] = [
  { id: 1, name: 'Bauernbrot', category: 'brot', price: 3.5 },
  { id: 2, name: 'Laugenbrezel', category: 'broetchen', price: 0.9 },
  { id: 3, name: 'Erdbeertorte', category: 'torten', price: 18 },
]

const search = () => screen.getByLabelText('Produkte suchen')

describe('Products search', () => {
  it('renders search field and sort select with controls enabled', () => {
    renderWithTheme(<Products items={items} showControls />)

    expect(search()).toBeInTheDocument()
    expect(screen.getByLabelText('Sortieren nach')).toBeInTheDocument()
    expect(screen.getByText('Bauernbrot')).toBeInTheDocument()
  })

  it('keeps the search field mounted when the search has no hits', () => {
    renderWithTheme(<Products items={items} showControls />)

    fireEvent.change(search(), { target: { value: 'Pizza' } })

    expect(screen.getByText('Keine Produkte gefunden')).toBeInTheDocument()
    expect(search()).toBeInTheDocument()
    expect(search()).toHaveValue('Pizza')
    expect(screen.getByLabelText('Sortieren nach')).toBeInTheDocument()
  })

  it('shows the products again after the search term is corrected', () => {
    renderWithTheme(<Products items={items} showControls />)

    fireEvent.change(search(), { target: { value: 'Pizza' } })
    expect(screen.queryByText('Bauernbrot')).not.toBeInTheDocument()

    fireEvent.change(search(), { target: { value: 'Brot' } })

    expect(screen.getByText('Bauernbrot')).toBeInTheDocument()
    expect(
      screen.queryByText('Keine Produkte gefunden')
    ).not.toBeInTheDocument()
  })

  it('offers "Suche zurücksetzen" in the empty state and clears the term', () => {
    renderWithTheme(<Products items={items} showControls />)

    fireEvent.change(search(), { target: { value: 'Pizza' } })
    fireEvent.click(screen.getByRole('button', { name: 'Suche zurücksetzen' }))

    expect(search()).toHaveValue('')
    expect(search()).toHaveFocus()
    expect(screen.getByText('Bauernbrot')).toBeInTheDocument()
    expect(screen.getByText('Laugenbrezel')).toBeInTheDocument()
    expect(screen.getByText('Erdbeertorte')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Suche zurücksetzen' })
    ).not.toBeInTheDocument()
  })

  it('clears the term via the X button inside the field', () => {
    renderWithTheme(<Products items={items} showControls />)

    expect(
      screen.queryByRole('button', { name: 'Suche löschen' })
    ).not.toBeInTheDocument()

    fireEvent.change(search(), { target: { value: 'Torte' } })
    expect(screen.getByText('Erdbeertorte')).toBeInTheDocument()
    expect(screen.queryByText('Bauernbrot')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Suche löschen' }))

    expect(search()).toHaveValue('')
    expect(search()).toHaveFocus()
    expect(screen.getByText('Bauernbrot')).toBeInTheDocument()
  })

  it('does not offer a reset when there are simply no products', () => {
    renderWithTheme(<Products items={[]} showControls />)

    expect(screen.getByText('Keine Produkte gefunden')).toBeInTheDocument()
    expect(search()).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Suche zurücksetzen' })
    ).not.toBeInTheDocument()
  })
})
