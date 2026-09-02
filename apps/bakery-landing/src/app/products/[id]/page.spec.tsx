import { screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import type { Product } from '../../../types/product'
import ProductPage from './page'

jest.mock('next/navigation', () => ({
  notFound: jest.fn(),
}))

// Drei gewöhnliche hq-Produkte ohne jedes Qualitätsmerkmal. Die numerischen
// IDs 3 und 4 sind absichtlich gewählt: das alte `product.id % 3 === 0`
// hätte Nr. 3 ein Abzeichen gegeben, Nr. 4 nicht.
const PRODUCTS: Product[] = [
  {
    id: 3,
    name: 'Mischbrot 500g',
    category: 'Brot',
    price: 2.5,
    image: '/assets/images/products/mischbrot.svg',
    imageUrl: '/assets/images/products/mischbrot.svg',
    description: 'Kräftig & mild zugleich — das klassische Mischbrot.',
    available: true,
    seasonal: false,
  },
  {
    id: 4,
    name: 'Mischbrot 1000g',
    category: 'Brot',
    price: 4.4,
    image: '/assets/images/products/mischbrot.svg',
    imageUrl: '/assets/images/products/mischbrot.svg',
    description: 'Kräftig & mild zugleich — das klassische Mischbrot in groß.',
    available: true,
    seasonal: false,
  },
  {
    id: 5,
    name: 'Kornbrot 500g',
    category: 'Brot',
    price: 3.2,
    image: '/assets/images/products/brot-rund.svg',
    imageUrl: '/assets/images/products/brot-rund.svg',
    available: true,
    seasonal: false,
  },
]

jest.mock('../../../lib/products', () => ({
  loadProducts: () => PRODUCTS,
}))

async function renderProduct(id: string) {
  const page = await ProductPage({ params: Promise.resolve({ id }) })
  return renderWithTheme(page)
}

describe('Product detail page', () => {
  it.each(['3', '4'])(
    'zeigt für Produkt %s kein erfundenes Qualitäts-Abzeichen',
    async (id) => {
      await renderProduct(id)

      expect(screen.queryByText('Premium Qualität')).not.toBeInTheDocument()
    }
  )

  it('nennt die Erfahrung wie die Über-uns-Seite als "Über 90 Jahre"', async () => {
    await renderProduct('3')

    expect(screen.getByText('Über 90 Jahre Erfahrung')).toBeInTheDocument()
    expect(screen.getByText('Seit 1933 in Familienbesitz')).toBeInTheDocument()
    expect(screen.queryByText(/^90 Jahre Erfahrung$/)).not.toBeInTheDocument()
  })

  it('rendert den Produktnamen und die Handwerks-Merkmale', async () => {
    await renderProduct('4')

    expect(
      screen.getByRole('heading', { name: 'Mischbrot 1000g' })
    ).toBeInTheDocument()
    expect(screen.getByText('Handwerksqualität')).toBeInTheDocument()
  })
})
