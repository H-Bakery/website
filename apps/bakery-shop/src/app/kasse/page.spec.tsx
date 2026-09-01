import React from 'react'
import { render, screen } from '@testing-library/react'
import Kasse from './page'

jest.mock('@bakery/shop/feature-cart', () => ({
  CheckoutPage: jest.fn(() => (
    <form data-testid="checkout-page">
      <input data-testid="customer-name" />
      <button data-testid="submit-order" type="submit">
        Bestellung abschicken
      </button>
    </form>
  )),
}))

describe('Kasse', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rendert das Bestellformular', () => {
    render(<Kasse />)

    expect(screen.getByTestId('checkout-page')).toBeInTheDocument()
    expect(screen.getByTestId('submit-order')).toBeInTheDocument()
  })

  it('bietet keinen WhatsApp-Bestellweg an', () => {
    render(<Kasse />)

    expect(screen.queryByText(/WhatsApp/i)).not.toBeInTheDocument()
  })
})
