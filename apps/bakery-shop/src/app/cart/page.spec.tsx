import React from 'react'
import { render, screen } from '@testing-library/react'
import Cart from './page'

jest.mock('@bakery/shop/feature-cart', () => ({
  CartPage: jest.fn(() => (
    <div data-testid="cart-page">
      <div data-testid="cart-total">0,00 €</div>
    </div>
  )),
}))

describe('Cart Page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rendert den Warenkorb', () => {
    render(<Cart />)

    expect(screen.getByTestId('cart-page')).toBeInTheDocument()
    expect(screen.getByTestId('cart-total')).toBeInTheDocument()
  })

  it('delegiert die gesamte Warenkorb-Logik an die Feature-Bibliothek', () => {
    const { CartPage } = jest.requireMock('@bakery/shop/feature-cart')
    render(<Cart />)

    expect(CartPage).toHaveBeenCalledTimes(1)
  })

  it('rendert keine eigene Kopf- oder Fußzeile', () => {
    const { container } = render(<Cart />)

    expect(container.querySelector('header')).toBeNull()
    expect(container.querySelector('footer')).toBeNull()
  })
})
