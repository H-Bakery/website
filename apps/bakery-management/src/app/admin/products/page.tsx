import { getManagementProducts } from '../../../lib/products'
import ProductListClient from './ProductListClient'

export default function AdminProductsPage() {
  const products = getManagementProducts()
  return <ProductListClient products={products} />
}
