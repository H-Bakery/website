import { screen, within } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import type { Product } from '../../../types/product'
import { LEGAL } from '../../../config/legal'
import { formatPrice } from '../../../utils/formatPrice'
import ProductPage, { generateMetadata, generateStaticParams } from './page'

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
  // Erfundenes Produkt, das hq als nicht angeboten führt (available: false).
  {
    id: 7,
    name: 'Probebrot Alt 750g',
    category: 'Brot',
    price: 9.87,
    image: '/assets/images/products/brot-rund.svg',
    imageUrl: '/assets/images/products/brot-rund.svg',
    description: 'Ein Brot, das es nicht mehr gibt - nur für Tests.',
    available: false,
    seasonal: false,
  },
  {
    id: 8,
    name: 'Musterbrot Dunkel 500g',
    category: 'Brot',
    price: 2.8,
    image: '/assets/images/products/brot-rund.svg',
    imageUrl: '/assets/images/products/brot-rund.svg',
    available: true,
    seasonal: false,
  },
  {
    id: 9,
    name: 'Musterbrötchen',
    category: 'Brötchen',
    price: 0.5,
    image: '/assets/images/products/broetchen.svg',
    imageUrl: '/assets/images/products/broetchen.svg',
    available: true,
    seasonal: false,
  },
]

// Nur die Daten sind erfunden; isListed und relatedProducts sind die echten.
jest.mock('../../../lib/products', () => ({
  ...jest.requireActual('../../../lib/products'),
  loadProducts: () => PRODUCTS,
}))

/** Die Produkt-Links der Seite (ohne Brotkrumen), in ihrer Reihenfolge. */
function productLinks(): string[] {
  return screen
    .getAllByRole('link')
    .map((a) => a.getAttribute('href') || '')
    .filter((href) => /^\/products\/\d+$/.test(href))
}

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

  it('verspricht nichts Unbelegtes: keine Parkplätze, keine regionalen Zutaten, keine Backzeit', async () => {
    await renderProduct('3')

    expect(screen.queryByText(/Parkpl/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Regionale Zutaten/)).not.toBeInTheDocument()
    expect(screen.queryByText(/lokalem Anbau/)).not.toBeInTheDocument()
    expect(screen.queryByText(/gebacken$/)).not.toBeInTheDocument()
    expect(screen.getByText('Frisch im Laden')).toBeInTheDocument()
    expect(
      screen.getByText(/^Ab \d{1,2}:\d{2} Uhr geöffnet$/)
    ).toBeInTheDocument()
    expect(screen.getByText('Familienbetrieb')).toBeInTheDocument()
    expect(screen.getByText('In 3. Generation')).toBeInTheDocument()
  })

  it('ruft über die internationale Nummer aus LEGAL an', async () => {
    await renderProduct('3')

    expect(
      screen.getByRole('link', { name: /Telefonisch bestellen/ })
    ).toHaveAttribute('href', LEGAL.phoneHref)
    // Jeder tel:-Link international (+49…), keiner mit der nationalen Nummer.
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).not.toMatch(/^tel:[^+]/)
    }
  })

  it('beschriftet den Seitenpfad auf Deutsch', async () => {
    await renderProduct('3')

    expect(
      screen.getByRole('navigation', { name: 'Seitenpfad' })
    ).toBeInTheDocument()
  })

  it('bleibt für ein angebotenes Produkt im Index, mit Preis und ohne Hinweis', async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ id: '3' }),
    })
    expect(meta.robots).toBeUndefined()

    await renderProduct('3')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(/Dieses Produkt bieten wir/)).toBeNull()
    // Der eigene Preis (2,50 €) - kein Nachbar kostet dasselbe.
    expect(document.body.textContent).toMatch(/2,50/)
    expect(screen.getByText('Ähnliche Produkte')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Telefonisch bestellen/ })
    ).toBeInTheDocument()
  })
})

describe('Product detail page – ähnliche Produkte', () => {
  it('zeigt die nächsten vier angebotenen der Kategorie nach diesem', async () => {
    await renderProduct('3')

    expect(screen.getByText('Ähnliche Produkte')).toBeInTheDocument()
    expect(productLinks()).toEqual([
      '/products/4',
      '/products/5',
      '/products/6',
      '/products/8',
    ])
  })

  it('springt rundum und überspringt das nicht angebotene Produkt', async () => {
    await renderProduct('6')

    // 7 ist nicht angeboten, 9 ist eine andere Kategorie.
    expect(productLinks()).toEqual([
      '/products/8',
      '/products/3',
      '/products/4',
      '/products/5',
    ])
  })

  it('macht die ganze Karte zum Link: Bild, Name und Preis liegen darin', async () => {
    await renderProduct('3')

    const link = screen.getByRole('link', { name: /Testbrot 500g/ })
    expect(link).toHaveAttribute('href', '/products/6')
    expect(
      within(link).getByRole('img', { name: 'Testbrot 500g' })
    ).toBeInTheDocument()
    expect(within(link).getByText('Testbrot 500g')).toBeInTheDocument()
    expect(within(link).getByText(/^1,50\s€$/)).toBeInTheDocument()
    expect(screen.queryByText('Produkt ansehen')).not.toBeInTheDocument()
  })
})

describe('Product detail page – nicht angeboten (available: false)', () => {
  it('sagt es deutlich und führt zum aktuellen Sortiment', async () => {
    await renderProduct('7')

    expect(
      screen.getByRole('heading', { name: 'Probebrot Alt 750g' })
    ).toBeInTheDocument()
    const hinweis = screen.getByRole('alert')
    expect(hinweis).toHaveTextContent(
      'Dieses Produkt bieten wir derzeit nicht an. Gerne beraten wir Sie telefonisch zu Alternativen'
    )
    expect(
      within(hinweis).getByRole('link', { name: LEGAL.phone })
    ).toHaveAttribute('href', LEGAL.phoneHref)
    expect(
      screen.getByRole('link', { name: /Zum aktuellen Sortiment/ })
    ).toHaveAttribute('href', '/products')
  })

  it('zeigt weder Preis noch Bestell-Knopf', async () => {
    await renderProduct('7')

    // formatPrice setzt ein geschütztes Leerzeichen; getByText macht daraus ein
    // gewöhnliches - darum der Vergleich über den Betrag.
    expect(formatPrice(9.87)).toMatch(/^9,87\s€$/)
    expect(screen.queryByText(/9,87/)).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/9,87/)
    expect(screen.queryByText(/Telefonisch bestellen/)).not.toBeInTheDocument()
    expect(screen.queryByText('Produktvorteile')).not.toBeInTheDocument()
  })

  it('zeigt angebotene Produkte der Kategorie als Alternativen', async () => {
    await renderProduct('7')

    expect(
      screen.getByText('Alternativen aus unserem Sortiment')
    ).toBeInTheDocument()
    expect(productLinks()).toEqual([
      '/products/8',
      '/products/3',
      '/products/4',
      '/products/5',
    ])
  })

  it('erscheint bei keinem anderen Produkt unter den ähnlichen', async () => {
    for (const { id } of PRODUCTS.filter((p) => p.id !== 7)) {
      const { unmount } = await renderProduct(String(id))
      expect(productLinks()).not.toContain('/products/7')
      unmount()
    }
  })

  it('ist noindex, auch für den googleBot aus dem Layout', async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ id: '7' }),
    })

    expect(meta.robots).toEqual({ index: false, follow: true })
    expect(JSON.stringify(meta.robots)).not.toMatch(/googleBot/)
  })

  it('behält seine Seite für alte Links', async () => {
    expect(await generateStaticParams()).toContainEqual({ id: '7' })
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
