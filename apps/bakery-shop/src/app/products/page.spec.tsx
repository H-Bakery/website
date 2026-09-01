import React from 'react'
import { render, screen } from '@testing-library/react'
import ProductsPage from './page'

jest.mock('@bakery/shop/feature-catalog', () => ({
  CatalogPage: jest.fn(() => (
    <div data-testid="catalog-page">
      <div data-testid="product-grid">Produktliste</div>
    </div>
  )),
}))

describe('ProductsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rendert den Katalog', () => {
    render(<ProductsPage />)

    expect(screen.getByTestId('catalog-page')).toBeInTheDocument()
    expect(screen.getByTestId('product-grid')).toBeInTheDocument()
  })

  it('bindet den Katalog direkt ein, nicht über next/dynamic', () => {
    const { CatalogPage } = jest.requireMock('@bakery/shop/feature-catalog')
    render(<ProductsPage />)

    // next/dynamic löst in jsdom nicht synchron auf — deshalb ein echter Import.
    expect(CatalogPage).toHaveBeenCalledTimes(1)
  })

  it('rendert keine eigene Kopf- oder Fußzeile', () => {
    const { container } = render(<ProductsPage />)

    expect(container.querySelector('header')).toBeNull()
    expect(container.querySelector('footer')).toBeNull()
  })
})
