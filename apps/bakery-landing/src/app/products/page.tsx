import { loadListedProducts } from '../../lib/products'
import { pageOpenGraph } from '../../lib/seo/pageMetadata'
import ProductsPageClient from './ProductsPageClient'
import { Metadata } from 'next'
import { SITE_URL } from '../../config/legal'

export const metadata: Metadata = {
  title: 'Unsere Produkte - Bäckerei Heusser',
  description:
    'Entdecken Sie unser Sortiment: Brot, Brötchen, Baguettes, Kuchen, Torten und Snacks – täglich frisch gebacken in unserer Handwerksbäckerei in Homburg-Kirrberg.',
  alternates: {
    canonical: '/products',
  },
  openGraph: pageOpenGraph({
    title: 'Unsere Produkte - Bäckerei Heusser',
    description:
      'Brot, Brötchen, Baguettes, Kuchen, Torten und Snacks – täglich frisch gebacken in Homburg-Kirrberg.',
    url: `${SITE_URL}/products`,
  }),
}

export default function ProductsPage() {
  // Nur was wir anbieten: Liste und Suche arbeiten auf dieser Auswahl.
  const products = loadListedProducts()
  return <ProductsPageClient initialProducts={products} />
}
