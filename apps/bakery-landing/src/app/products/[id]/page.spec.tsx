import { screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import type { Product } from '../../../types/product'
import ProductPage, { generateMetadata } from './page'

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
  // Erfundenes Produkt mit einem aus dem 3D-Modell gerenderten Bild.
  {
    id: 6,
    name: 'Testbrot 500g',
    category: 'Brot',
    price: 1.5,
    image: '/produkte-3d/bilder/testbrot-500g/haupt-800.webp',
    imageUrl: '/produkte-3d/bilder/testbrot-500g/haupt-800.webp',
    renderedImage: {
      src: '/produkte-3d/bilder/testbrot-500g/haupt-800.webp',
      srcSet:
        '/produkte-3d/bilder/testbrot-500g/haupt-400.webp 400w, /produkte-3d/bilder/testbrot-500g/haupt-800.webp 800w',
      width: 800,
      height: 800,
    },
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

describe('Product detail page – aus dem 3D-Modell gerendertes Bild', () => {
  it('zeigt das Bild sofort (über der Falz), mit srcset und Maßen', async () => {
    await renderProduct('6')

    const img = screen.getByRole('img', { name: 'Testbrot 500g' })
    expect(img).toHaveAttribute(
      'src',
      '/produkte-3d/bilder/testbrot-500g/haupt-800.webp'
    )
    expect(img.getAttribute('srcset')).toMatch(/haupt-400\.webp 400w/)
    expect(img).toHaveAttribute('width', '800')
    expect(img).toHaveAttribute('height', '800')
    expect(img).toHaveAttribute('loading', 'eager')
  })

  it('sagt dazu, dass es kein Foto ist', async () => {
    await renderProduct('6')

    expect(
      screen.getByText('Digitale Darstellung – kein Foto')
    ).toBeInTheDocument()
  })

  it('sagt das nicht bei einem Produkt ohne gerendertes Bild', async () => {
    await renderProduct('3')

    expect(screen.queryByText(/Digitale Darstellung/)).not.toBeInTheDocument()
  })

  it('zeigt es bei den verwandten Produkten nachgeladen (lazy)', async () => {
    await renderProduct('3')

    const img = screen.getByRole('img', { name: 'Testbrot 500g' })
    expect(img).toHaveAttribute('loading', 'lazy')
    expect(img).toHaveAttribute('srcset')
  })

  it('nimmt für die Link-Vorschau das allgemeine Bild, nicht das transparente WebP', async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ id: '6' }),
    })

    expect(JSON.stringify(meta.openGraph)).toMatch(/\/og-image\.jpg/)
    expect(JSON.stringify(meta)).not.toMatch(/produkte-3d/)
  })
})
