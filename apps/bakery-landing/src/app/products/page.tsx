import { loadProducts } from '../../lib/products'
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
  openGraph: {
    title: 'Unsere Produkte - Bäckerei Heusser',
    description:
      'Brot, Brötchen, Baguettes, Kuchen, Torten und Snacks – täglich frisch gebacken in Homburg-Kirrberg.',
    url: `${SITE_URL}/products`,
    type: 'website',
  },
}

export default function ProductsPage() {
  const products = loadProducts()
  return <ProductsPageClient initialProducts={products} />
}
