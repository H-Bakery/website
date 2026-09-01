import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { CartProvider, useCart } from '@bakery/shared/contexts'
import { toCartProduct } from '@bakery/shared/data-access'
import type { ShopProduct } from '@bakery/shared/data-access'
import { shopTheme } from '../theme/theme'
import { ShopHeader } from '../components/shop-header'
import { ShopFooter } from '../components/shop-footer'

/**
 * Integrationstest der Ladenchrome: Kopf- und Fußzeile zusammen, mit dem
 * echten Warenkorb-Kontext. Geprüft wird, dass der Zähler im Header
 * tatsächlich am Warenkorb hängt und dass die Landmarks stimmen.
 */

const BROT: ShopProduct = {
  id: 'kornbrot-500g',
  numericId: 1,
  name: 'Kornbrot 500g',
  category: 'brot',
  price: 2.5,
  available: true,
  seasonal: false,
  image: '/assets/images/products/kornbrot.svg',
  shortDescription: 'Kräftiges Kornbrot',
  description: 'Kräftiges Kornbrot aus eigener Herstellung.',
}

function AddToCartProbe() {
  const { addToCart, clearCart } = useCart()
  return (
    <>
      <button type="button" onClick={() => addToCart(toCartProduct(BROT), 2)}>
        Testartikel hinzufügen
      </button>
      <button type="button" onClick={() => clearCart()}>
        Testwarenkorb leeren
      </button>
    </>
  )
}

function renderChrome() {
  return render(
    <ThemeProvider theme={shopTheme}>
      <CartProvider enablePersistence={false} taxRate={0}>
        <ShopHeader />
        <main>
          <AddToCartProbe />
        </main>
        <ShopFooter />
      </CartProvider>
    </ThemeProvider>
  )
}

describe('Shop-Chrome', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
  })

  it('rendert Kopfzeile, Inhalt und Fußzeile', () => {
    renderChrome()

    expect(screen.getByTestId('shop-header')).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByTestId('shop-footer')).toBeInTheDocument()
  })

  it('stellt Such- und Kategorie-Landmarks bereit', () => {
    renderChrome()

    expect(screen.getByRole('search')).toBeInTheDocument()
    expect(
      screen.getByRole('navigation', { name: 'Produktkategorien' })
    ).toBeInTheDocument()
  })

  it('zählt hinzugefügte Artikel im Warenkorb-Badge mit', () => {
    renderChrome()

    expect(screen.getByTestId('cart-badge')).not.toHaveTextContent('2')

    act(() => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Testartikel hinzufügen' })
      )
    })

    expect(screen.getByTestId('cart-badge')).toHaveTextContent('2')
    expect(screen.getByTestId('cart-link')).toHaveAttribute(
      'aria-label',
      'Warenkorb, 2 Artikel'
    )

    act(() => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Testwarenkorb leeren' })
      )
    })

    expect(screen.getByTestId('cart-link')).toHaveAttribute(
      'aria-label',
      'Warenkorb, 0 Artikel'
    )
  })

  it('bietet im Shop keinen WhatsApp-Bestellweg an', () => {
    renderChrome()

    expect(screen.queryByText(/WhatsApp/i)).not.toBeInTheDocument()
    expect(document.querySelector('a[href*="wa.me"]')).not.toBeInTheDocument()
  })

  it('macht die Suche per Tastatur bedienbar', () => {
    renderChrome()

    const input = screen.getByTestId('shop-search-input')
    act(() => input.focus())
    expect(document.activeElement).toBe(input)
  })
})
