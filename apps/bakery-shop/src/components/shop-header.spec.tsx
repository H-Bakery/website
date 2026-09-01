import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { shopTheme } from '../theme/theme'
import { ShopHeader } from './shop-header'

const mockPush = jest.fn()
const mockSummary = {
  totalCount: 0,
  subtotal: 0,
  discount: 0,
  tax: 0,
  total: 0,
}

jest.mock('next/navigation', () => ({
  // Der Verweis auf mockPush passiert erst beim Aufruf, nicht beim Import.
  useRouter: () => ({
    push: (...args: unknown[]) => mockPush(...args),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/',
}))

jest.mock('@bakery/shared/contexts', () => ({
  useCart: () => ({ summary: mockSummary, items: [], isLoading: false }),
}))

function renderHeader() {
  return render(
    <ThemeProvider theme={shopTheme}>
      <ShopHeader />
    </ThemeProvider>
  )
}

describe('ShopHeader', () => {
  beforeEach(() => {
    mockPush.mockClear()
    mockSummary.totalCount = 0
    window.history.replaceState({}, '', '/')
  })

  it('rendert die Ladenzeile mit der Marken-Wortmarke', () => {
    renderHeader()

    expect(screen.getByTestId('shop-header')).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: 'Bäckerei Heusser – zur Startseite des Online-Shops',
      })
    ).toHaveAttribute('href', '/')
  })

  describe('Suche', () => {
    it('schickt den Suchbegriff als Formular an /products', () => {
      renderHeader()

      const input = screen.getByTestId('shop-search-input')
      fireEvent.change(input, { target: { value: 'Bauernbrot' } })
      fireEvent.submit(screen.getByTestId('shop-search'))

      expect(mockPush).toHaveBeenCalledWith('/products?q=Bauernbrot')
    })

    it('kodiert Umlaute und Leerzeichen', () => {
      renderHeader()

      fireEvent.change(screen.getByTestId('shop-search-input'), {
        target: { value: 'Käse Brötchen' },
      })
      fireEvent.submit(screen.getByTestId('shop-search'))

      expect(mockPush).toHaveBeenCalledWith(
        '/products?q=K%C3%A4se%20Br%C3%B6tchen'
      )
    })

    it('führt ohne Eingabe auf die vollständige Produktliste', () => {
      renderHeader()

      fireEvent.change(screen.getByTestId('shop-search-input'), {
        target: { value: '   ' },
      })
      fireEvent.submit(screen.getByTestId('shop-search'))

      expect(mockPush).toHaveBeenCalledWith('/products')
    })

    it('übernimmt einen Suchbegriff aus der URL', () => {
      window.history.replaceState({}, '', '/products?q=Brezel')
      renderHeader()

      expect(screen.getByTestId('shop-search-input')).toHaveValue('Brezel')
    })

    it('lässt sich zurücksetzen', () => {
      renderHeader()

      const input = screen.getByTestId('shop-search-input')
      fireEvent.change(input, { target: { value: 'Torte' } })
      fireEvent.click(
        screen.getByRole('button', { name: 'Suche zurücksetzen' })
      )

      expect(input).toHaveValue('')
    })
  })

  describe('Warenkorb', () => {
    it('verlinkt auf den Warenkorb', () => {
      renderHeader()

      expect(screen.getByTestId('cart-link')).toHaveAttribute('href', '/cart')
      expect(screen.getByTestId('cart-badge')).toBeInTheDocument()
    })

    it('zeigt die Anzahl der Artikel aus dem Warenkorb-Kontext', () => {
      mockSummary.totalCount = 3
      renderHeader()

      expect(screen.getByTestId('cart-badge')).toHaveTextContent('3')
      expect(screen.getByTestId('cart-link')).toHaveAttribute(
        'aria-label',
        'Warenkorb, 3 Artikel'
      )
    })

    it('nennt einen einzelnen Artikel im Singular', () => {
      mockSummary.totalCount = 1
      renderHeader()

      expect(screen.getByTestId('cart-link')).toHaveAttribute(
        'aria-label',
        'Warenkorb, 1 Artikel'
      )
    })
  })

  describe('Kategorienavigation', () => {
    it('verlinkt alle Kategorien plus die Gesamtübersicht', () => {
      renderHeader()

      const nav = screen.getByTestId('shop-category-nav')
      expect(within(nav).getByText('Alle Produkte')).toHaveAttribute(
        'href',
        '/products'
      )
      expect(within(nav).getByText('Brot')).toHaveAttribute(
        'href',
        '/products?category=brot'
      )
      expect(within(nav).getByText('Torten')).toHaveAttribute(
        'href',
        '/products?category=torten'
      )
      expect(within(nav).getAllByRole('link')).toHaveLength(8)
    })

    it('belegt nicht die Test-IDs des Katalogfilters', () => {
      renderHeader()

      expect(screen.queryByTestId('category-brot')).not.toBeInTheDocument()
      expect(screen.queryByTestId('category-all')).not.toBeInTheDocument()
      expect(screen.queryByTestId('category-filter')).not.toBeInTheDocument()
    })
  })
})
