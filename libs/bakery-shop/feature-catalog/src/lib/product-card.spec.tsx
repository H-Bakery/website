import { fireEvent, render, screen } from '@testing-library/react'

import type { ShopProduct } from '@bakery/shared/data-access'

import { ShopProductCard } from './product-card'

const mockAddToCart = jest.fn()
const mockUpdateQuantity = jest.fn()

/** Menge, die der gemockte Warenkorb für dieses Produkt meldet. */
let mockCartQuantity = 0

jest.mock('@bakery/shared/contexts', () => ({
  useCart: () => ({
    addToCart: mockAddToCart,
    updateQuantity: mockUpdateQuantity,
    getQuantity: () => mockCartQuantity,
  }),
}))

const product: ShopProduct = {
  id: 'kornbrot-500g',
  numericId: 1,
  name: 'Kornbrot 500g',
  category: 'brot',
  price: 2.5,
  available: true,
  seasonal: false,
  image: '/assets/images/products/kornbrot.svg',
  shortDescription: 'Kernig & saftig.',
  description: 'Langer Fließtext.',
}

describe('ShopProductCard', () => {
  beforeEach(() => {
    mockAddToCart.mockClear()
    mockUpdateQuantity.mockClear()
    mockCartQuantity = 0
  })

  it('zeigt Name und Preis in deutscher Schreibweise', () => {
    render(<ShopProductCard product={product} />)

    expect(screen.getByTestId('product-card-name')).toHaveTextContent(
      'Kornbrot 500g'
    )
    // Intl setzt ein geschütztes Leerzeichen vor das Währungszeichen.
    // Der Zusatz (Grundpreis bzw. „pro Stück") steht bewusst außerhalb der testid.
    expect(screen.getByTestId('product-card-price').textContent).toMatch(
      /^2,50\s€$/
    )
  })

  describe('Grundpreis (§ 4 PAngV)', () => {
    it('zeigt den Grundpreis bei Ware nach Gewicht', () => {
      render(<ShopProductCard product={product} />)

      // 2,50 € für 500 g → 5,00 € je Kilogramm, direkt neben dem Endpreis.
      expect(screen.getByTestId('product-card-unit-price').textContent).toMatch(
        /^5,00\s€ \/ kg$/
      )
      expect(
        screen.getByTestId('product-card-unit-price').textContent
      ).not.toContain('pro Stück')
    })

    it('zeigt „pro Stück" ohne Gewicht im Namen – nichts wird erfunden', () => {
      render(
        <ShopProductCard
          product={{
            ...product,
            id: 'sternweck',
            numericId: 2,
            name: 'Sternweck',
          }}
        />
      )

      expect(screen.getByTestId('product-card-unit-price')).toHaveTextContent(
        'pro Stück'
      )
      expect(
        screen.getByTestId('product-card-unit-price').textContent
      ).not.toMatch(/\/ kg/)
    })
  })

  it('verlinkt auf den lesbaren Slug, nicht auf die numerische Id', () => {
    render(<ShopProductCard product={product} />)

    expect(screen.getByRole('link', { name: /ansehen/i })).toHaveAttribute(
      'href',
      '/products/kornbrot-500g'
    )
  })

  it('legt das Produkt in den Warenkorb und bestätigt sichtbar', () => {
    render(<ShopProductCard product={product} />)

    fireEvent.click(screen.getByTestId('add-to-cart'))

    expect(mockAddToCart).toHaveBeenCalledTimes(1)
    expect(mockAddToCart.mock.calls[0][0]).toMatchObject({
      id: 1,
      name: 'Kornbrot 500g',
      price: 2.5,
    })
    expect(screen.getByTestId('add-to-cart')).toHaveTextContent('Hinzugefügt')
  })

  it('sperrt den Button, wenn das Produkt nicht verfügbar ist', () => {
    render(<ShopProductCard product={{ ...product, available: false }} />)

    expect(screen.getByTestId('add-to-cart')).toBeDisabled()
    expect(screen.getByText('Zur Zeit nicht verfügbar')).toBeInTheDocument()
  })

  it('zeigt den Saisonal-Hinweis nur bei saisonalen Produkten', () => {
    const { rerender } = render(<ShopProductCard product={product} />)
    expect(screen.queryByText('Saisonal')).not.toBeInTheDocument()

    rerender(<ShopProductCard product={{ ...product, seasonal: true }} />)
    expect(screen.getByText('Saisonal')).toBeInTheDocument()
  })

  describe('Mengenregler', () => {
    it('bleibt verborgen, solange nichts im Warenkorb liegt', () => {
      render(<ShopProductCard product={product} />)

      expect(screen.queryByTestId('card-quantity')).not.toBeInTheDocument()
      expect(screen.getByTestId('add-to-cart')).toBeInTheDocument()
    })

    it('zeigt die Menge aus dem Warenkorb, sobald etwas drin liegt', () => {
      mockCartQuantity = 3
      render(<ShopProductCard product={product} />)

      expect(screen.getByTestId('card-quantity-input')).toHaveValue('3')
      // Der schnelle Ein-Klick-Weg bleibt daneben bestehen.
      expect(screen.getByTestId('add-to-cart')).toBeInTheDocument()
    })

    it('erhöht und verringert die Menge im Warenkorb', () => {
      mockCartQuantity = 3
      render(<ShopProductCard product={product} />)

      fireEvent.click(screen.getByTestId('card-quantity-increase'))
      expect(mockUpdateQuantity).toHaveBeenLastCalledWith(1, 4)

      fireEvent.click(screen.getByTestId('card-quantity-decrease'))
      expect(mockUpdateQuantity).toHaveBeenLastCalledWith(1, 2)
    })

    it('setzt eine getippte Menge in einem Schritt – zehn Brötchen, kein zehnfacher Klick', () => {
      mockCartQuantity = 1
      render(<ShopProductCard product={product} />)

      fireEvent.change(screen.getByTestId('card-quantity-input'), {
        target: { value: '10' },
      })

      expect(mockUpdateQuantity).toHaveBeenLastCalledWith(1, 10)
    })

    it('lässt nur Ziffern zu und deckelt bei zwei Stellen', () => {
      mockCartQuantity = 1
      render(<ShopProductCard product={product} />)

      const input = screen.getByTestId('card-quantity-input')
      fireEvent.change(input, { target: { value: '4a2' } })

      expect(mockUpdateQuantity).toHaveBeenLastCalledWith(1, 42)
      expect(input).toHaveValue('42')

      fireEvent.change(input, { target: { value: '123' } })
      expect(mockUpdateQuantity).toHaveBeenLastCalledWith(1, 12)
    })

    it('springt beim Leeren des Feldes nicht auf 0', () => {
      mockCartQuantity = 5
      render(<ShopProductCard product={product} />)

      const input = screen.getByTestId('card-quantity-input')
      fireEvent.change(input, { target: { value: '' } })

      expect(mockUpdateQuantity).not.toHaveBeenCalled()
      fireEvent.blur(input)
      expect(input).toHaveValue('5')
    })
  })

  describe('Bildfläche', () => {
    it('zeigt das echte Bild, wenn der Pfad brauchbar ist', () => {
      render(<ShopProductCard product={product} />)

      expect(
        screen.getByRole('img', { name: 'Kornbrot 500g' })
      ).toHaveAttribute('src', '/assets/images/products/kornbrot.svg')
      expect(screen.queryByText('Noch ohne Foto')).not.toBeInTheDocument()
    })

    it('zeigt statt des Müllwerts „images/" einen benannten Platzhalter', () => {
      render(<ShopProductCard product={{ ...product, image: 'images/' }} />)

      // Kein <img>: ein unbrauchbarer Pfad wird gar nicht erst angefragt.
      expect(
        screen.queryByRole('img', { name: 'Kornbrot 500g' })
      ).not.toBeInTheDocument()
      expect(screen.getByText('Noch ohne Foto')).toBeInTheDocument()
      // Der Platzhalter nennt die Kategorie – er liest sich als Absicht,
      // nicht als Fehler.
      expect(
        screen.getByRole('img', { name: 'Brot – Noch ohne Foto' })
      ).toBeInTheDocument()
    })
  })
})
