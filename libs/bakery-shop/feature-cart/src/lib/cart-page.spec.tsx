/**
 * @fileoverview Warenkorb-Oberfläche: was auf dem Telefon erreichbar ist und
 * welche testids es genau einmal geben darf.
 *
 * Dieser Test hängt absichtlich am echten `@bakery/shop/feature-catalog`
 * (wegen `ShopPrice`) statt an einem Mock: `feature-catalog` importiert
 * seinerseits `@bakery/shop/feature-cart`. Bricht dieser Ringschluss zur
 * Laufzeit, fällt es hier auf und nicht erst im Browser.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

import type { CartItem } from '@bakery/shared/contexts'

import { CartPage } from './cart-page'

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

let mockItems: CartItem[] = []

jest.mock('@bakery/shared/contexts', () => ({
  useCart: () => {
    const items = mockItems
    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    )
    return {
      items,
      summary: {
        totalCount: items.reduce((sum, item) => sum + item.quantity, 0),
        subtotal,
        discount: 0,
        tax: 0,
        total: subtotal,
      },
      isLoading: false,
      updateQuantity: jest.fn(),
      removeFromCart: jest.fn(),
      clearCart: jest.fn(),
    }
  },
}))

/** Eine Warenkorbzeile, so wie `toCartProduct()` sie wirklich anlegt. */
function line(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 1,
    createdAt: '',
    updatedAt: '',
    name: 'Kornbrot 500g',
    category: 'Brot',
    type: 'fresh',
    price: 2.5,
    unit: 'Stück',
    stock: 999,
    status: 'available',
    quantity: 2,
    ...overrides,
  } as CartItem
}

/** Eine ganze Torte: numerische ID, Slug, Anzeigekategorie „Torten". */
const wholeTorte = () =>
  ({
    ...line({
      id: 77,
      name: 'Schwarzwälder Kirschtorte',
      category: 'Torten',
      price: 45,
      quantity: 1,
    }),
    slug: 'schwarzwaelder-kirsch-torte',
  } as CartItem)

describe('CartPage', () => {
  beforeEach(() => {
    mockPush.mockClear()
    mockItems = [line()]
  })

  it('zeigt die Summe genau einmal — cart-total darf sich nicht verdoppeln', () => {
    render(<CartPage />)

    const totals = screen.getAllByTestId('cart-total')
    expect(totals).toHaveLength(1)
    expect(totals[0].textContent).toMatch(/^5,00\s€$/)
  })

  it('führt den Weg zur Kasse nur unter einer cart-checkout-testid', () => {
    render(<CartPage />)

    // Die klebende Leiste hat einen zweiten „Zur Kasse"-Knopf, aber bewusst
    // keine testid: sonst bricht Playwright mit strict mode violation ab.
    expect(screen.getAllByTestId('cart-checkout')).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Zur Kasse' })).toHaveLength(2)
  })

  it('hält Summe und Kasse in einer klebenden Leiste erreichbar', () => {
    render(<CartPage />)

    const bar = screen.getByTestId('cart-sticky-bar')
    expect(bar.textContent).toContain('5,00')
    expect(bar.textContent).toContain('2 Artikel')
  })

  it('blendet die klebende Leiste bei leerem Warenkorb aus', () => {
    mockItems = []
    render(<CartPage />)

    expect(screen.queryByTestId('cart-sticky-bar')).toBeNull()
    expect(screen.queryByTestId('cart-empty')).not.toBeNull()
  })

  it('nennt den Grundpreis, wo der Name ein Gewicht trägt (§ 4 PAngV)', () => {
    render(<CartPage />)

    // Intl setzt ein geschütztes Leerzeichen vor das Währungszeichen.
    expect(screen.getByTestId('cart-item').textContent).toMatch(/5,00\s€ \/ kg/)
  })

  it('nennt keinen Grundpreis, wo es keinen gibt', () => {
    mockItems = [line({ name: 'Kaiserbrötchen', price: 0.45 })]
    render(<CartPage />)

    expect(screen.getByTestId('cart-item').textContent).not.toContain('/ kg')
  })

  it('sagt die Vorbestellfrist schon im Warenkorb an', () => {
    mockItems = [wholeTorte()]
    render(<CartPage />)

    const notice = screen.getByTestId('cart-lead-time')
    expect(notice.textContent).toContain('Ganze Torten')
    expect(notice.textContent).toContain('Frühester Abholtermin:')
  })

  it('schweigt über die Frist, solange nichts vorbestellt werden muss', () => {
    render(<CartPage />)

    expect(screen.queryByTestId('cart-lead-time')).toBeNull()
  })

  it('behält jede testid des Playwright-Vertrags', () => {
    render(<CartPage />)

    for (const id of [
      'cart-page',
      'cart-item',
      'cart-item-name',
      'cart-item-quantity',
      'cart-increase',
      'cart-decrease',
      'cart-remove',
      'cart-total',
      'cart-checkout',
    ]) {
      expect(screen.queryByTestId(id)).not.toBeNull()
    }
    // Die Menge ist ein Textknoten, kein Eingabefeld.
    expect(screen.getByTestId('cart-item-quantity').tagName).not.toBe('INPUT')
    expect(screen.getByTestId('cart-item-quantity').textContent).toBe('2')
  })
})
