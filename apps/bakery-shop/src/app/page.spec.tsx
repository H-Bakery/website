import React from 'react'
import { render, screen } from '@testing-library/react'
import HomePage from './page'

jest.mock('@bakery/shop/feature-catalog', () => ({
  StorefrontHome: jest.fn(() => (
    <div data-testid="storefront-home">Startseite des Shops</div>
  )),
}))

describe('HomePage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rendert die Storefront-Startseite', () => {
    render(<HomePage />)

    expect(screen.getByTestId('storefront-home')).toBeInTheDocument()
  })

  it('reicht die Seite ohne eigene Logik an die Feature-Bibliothek durch', () => {
    const { StorefrontHome } = jest.requireMock('@bakery/shop/feature-catalog')
    render(<HomePage />)

    expect(StorefrontHome).toHaveBeenCalledTimes(1)
  })

  it('rendert keine eigene Kopf- oder Fußzeile — die gehört dem Layout', () => {
    const { container } = render(<HomePage />)

    expect(container.querySelector('header')).toBeNull()
    expect(container.querySelector('footer')).toBeNull()
  })
})
