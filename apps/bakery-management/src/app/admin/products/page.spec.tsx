import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import ProductListClient from './ProductListClient'
import type { ManagementProduct } from '../../../lib/products'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/admin/products',
}))

const products: ManagementProduct[] = [
  {
    id: 'roggenbrot',
    name: 'Roggenbrot',
    category: 'Brot',
    categoryKey: 'brot',
    price: 4.5,
    status: 'active',
    image: null,
    description: 'Kräftig',
  },
  {
    id: 'stollen',
    name: 'Christstollen',
    category: 'Kuchen',
    categoryKey: 'kuchen',
    price: 12,
    status: 'seasonal',
    image: '/img/stollen.svg',
    description: '',
  },
  {
    id: 'altbrot',
    name: 'Altbrot',
    category: 'Brot',
    categoryKey: 'brot',
    price: 1,
    status: 'unavailable',
    image: null,
    description: '',
  },
]

describe('ProductListClient (admin/products)', () => {
  beforeEach(() => mockPush.mockClear())

  it('renders heading, statistics and product rows', () => {
    renderWithTheme(<ProductListClient products={products} />)
    expect(
      screen.getByRole('heading', { name: /Produktverwaltung/ })
    ).toBeInTheDocument()
    expect(screen.getByText('Produktliste (3)')).toBeInTheDocument()
    expect(screen.getByText('Roggenbrot')).toBeInTheDocument()
    expect(screen.getByText('Christstollen')).toBeInTheDocument()
    expect(screen.getByText('4.50 €')).toBeInTheDocument()
    expect(
      screen.getByText('Verfügbar', { selector: '.MuiChip-label' })
    ).toBeInTheDocument()
    expect(
      screen.getByText('Saisonal', { selector: '.MuiChip-label' })
    ).toBeInTheDocument()
    expect(
      screen.getByText('Nicht verfügbar', { selector: '.MuiChip-label' })
    ).toBeInTheDocument()
  })

  it('navigates to edit page and to new-product page', () => {
    renderWithTheme(<ProductListClient products={products} />)
    fireEvent.click(screen.getByLabelText('Roggenbrot bearbeiten'))
    expect(mockPush).toHaveBeenCalledWith('/admin/products/roggenbrot')

    fireEvent.click(screen.getByRole('button', { name: /Neues Produkt/ }))
    expect(mockPush).toHaveBeenCalledWith('/admin/products/new')
  })

  it('shows an empty state when no products are available', () => {
    renderWithTheme(<ProductListClient products={[]} />)
    expect(screen.getByText('Keine Produkte gefunden.')).toBeInTheDocument()
    expect(screen.getByText('Produktliste (0)')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })
})
