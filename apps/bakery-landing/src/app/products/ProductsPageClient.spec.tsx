import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import ProductsPageClient from './ProductsPageClient'
import { Product } from '../../types/product'

// Synthetisch: 12 Musterbrote (2 Seiten), ein Brot ohne „muster“, zwei
// Musterteilchen.
const products: Product[] = [
  ...Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    name: `Musterbrot ${i + 1}`,
    category: 'Brot',
    price: 2 + i / 10,
  })),
  { id: 20, name: 'Kornbrot', category: 'Brot', price: 3 },
  { id: 30, name: 'Musterschnecke', category: 'Teilchen', price: 1.2 },
  { id: 31, name: 'Musterplunder', category: 'Teilchen', price: 1.3 },
]

const productNames = () =>
  screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)

/** test-setup.ts ersetzt window.location durch ein einfaches Objekt. */
function setLocation(pathname: string, search: string) {
  Object.assign(window.location, { pathname, search, hash: '' })
}

describe('ProductsPageClient – Ansicht in der Adresse', () => {
  let replaceState: jest.SpyInstance

  beforeEach(() => {
    setLocation('/products', '')
    // Die Adresse nachführen, wie es der Browser täte.
    replaceState = jest
      .spyOn(window.history, 'replaceState')
      .mockImplementation((_state, _title, url) => {
        const next = new URL(String(url), 'http://localhost')
        setLocation(next.pathname, next.search)
      })
  })

  afterEach(() => {
    replaceState.mockRestore()
    setLocation('/', '')
  })

  const lastUrl = () =>
    replaceState.mock.calls[replaceState.mock.calls.length - 1]?.[2]

  it('stellt Kategorie, Suche und Seite nach dem Laden aus der Adresse her', async () => {
    setLocation('/products', '?kategorie=Brot&search=muster&seite=2')

    renderWithTheme(<ProductsPageClient initialProducts={products} />)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Brot' })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    )
    expect(screen.getByRole('button', { name: 'Alle' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    expect(screen.getByLabelText('Produkte suchen')).toHaveValue('muster')
    expect(
      screen.getByRole('button', { name: 'Seite 2, aktuelle Seite' })
    ).toHaveAttribute('aria-current', 'true')
    expect(productNames()).toEqual([
      'Musterbrot 9',
      'Musterbrot 10',
      'Musterbrot 11',
      'Musterbrot 12',
    ])
    // Die Adresse stimmt schon - kein überflüssiges replaceState.
    expect(replaceState).not.toHaveBeenCalled()
  })

  it('schreibt Änderungen per replaceState in die Adresse', async () => {
    renderWithTheme(<ProductsPageClient initialProducts={products} />)
    // Nichts gewählt: die Adresse bleibt ohne Parameter.
    await act(async () => undefined)
    expect(replaceState).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Brot' }))
    expect(lastUrl()).toBe('/products?kategorie=Brot')

    fireEvent.click(screen.getByRole('button', { name: 'Seite 2' }))
    expect(lastUrl()).toBe('/products?kategorie=Brot&seite=2')

    // Neue Suche: zurück auf Seite 1, die Seite fällt aus der Adresse.
    fireEvent.change(screen.getByLabelText('Produkte suchen'), {
      target: { value: 'muster' },
    })
    expect(lastUrl()).toBe('/products?kategorie=Brot&search=muster')

    fireEvent.click(screen.getByRole('button', { name: 'Alle' }))
    expect(lastUrl()).toBe('/products?search=muster')

    fireEvent.click(screen.getByRole('button', { name: 'Suche löschen' }))
    expect(lastUrl()).toBe('/products')

    // Kein neuer Verlaufseintrag. Zustand `null`: Next.js' gepatchtes
    // replaceState übernimmt seinen eigenen Zustand und führt die Adresse
    // im Router nach (mit `history.state` und `__NA` übersähe es den Aufruf).
    for (const [state, title] of replaceState.mock.calls) {
      expect(title).toBe('')
      expect(state).toBeNull()
    }
  })

  it('sucht gleich, wenn /products?search=… aufgerufen wird (SearchAction)', async () => {
    setLocation('/products', '?search=Muster+Plunder')

    renderWithTheme(<ProductsPageClient initialProducts={products} />)

    await waitFor(() =>
      expect(screen.getByLabelText('Produkte suchen')).toHaveValue(
        'Muster Plunder'
      )
    )
    expect(productNames()).toEqual(['Musterplunder'])
  })

  it('übergeht unbekannte Kategorien und ungültige Seiten', async () => {
    setLocation('/products', '?kategorie=Pizza&seite=abc&utm_source=test')

    renderWithTheme(<ProductsPageClient initialProducts={products} />)
    await act(async () => undefined)

    expect(screen.getByRole('button', { name: 'Alle' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(
      screen.getByRole('button', { name: 'Seite 1, aktuelle Seite' })
    ).toBeInTheDocument()

    // Fremde Parameter bleiben stehen, die ungültigen fallen weg.
    fireEvent.click(screen.getByRole('button', { name: 'Teilchen' }))
    expect(lastUrl()).toBe('/products?utm_source=test&kategorie=Teilchen')
  })

  it('nimmt die Kategorie auch ausgeschrieben an und klemmt zu große Seiten', async () => {
    setLocation('/products', '?kategorie=teilchen&seite=9')

    renderWithTheme(<ProductsPageClient initialProducts={products} />)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Teilchen' })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    )
    expect(productNames()).toEqual(['Musterschnecke', 'Musterplunder'])
    // Die Adresse wird auf das Gezeigte berichtigt.
    expect(lastUrl()).toBe('/products?kategorie=Teilchen')
  })

  it('benennt den Seitenpfad auf Deutsch', () => {
    renderWithTheme(<ProductsPageClient initialProducts={products} />)

    expect(
      screen.getByRole('navigation', { name: 'Seitenpfad' })
    ).toBeInTheDocument()
  })
})
