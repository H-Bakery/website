import buns from './buns.json'
import cakes from './cakes.json'
import breads from './breads.json'
import {
  Product,
  ProductCategory,
  ProductType,
  ProductStatus,
} from '../../types/product'

// Convert mock products to full Product type
const toFullProduct = (mockProduct: any): Product => ({
  id: mockProduct.id,
  name: mockProduct.name,
  price: mockProduct.price,
  stock: 100,
  description:
    mockProduct.description || `${mockProduct.name} - ${mockProduct.category}`,
  type: ProductType.Fresh,
  status: ProductStatus.Available,
  category: mockProduct.category as ProductCategory,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  imageUrl: mockProduct.image,
})

export const featuredProducts: Product[] = [
  buns[0],
  buns[1],
  cakes[2],
  cakes[4],
  cakes[3],
  breads[1],
  breads[3],
  breads[5],
].map(toFullProduct)
