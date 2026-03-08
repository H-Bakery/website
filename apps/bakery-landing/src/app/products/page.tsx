import { loadProducts } from '../../lib/products'
import ProductsPageClient from './ProductsPageClient'

export default function ProductsPage() {
  const products = loadProducts()
  return <ProductsPageClient initialProducts={products} />
}
