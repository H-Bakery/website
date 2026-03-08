import buns from './buns.json'
import cakes from './cakes.json'
import breads from './breads.json'
import { Product } from '../../types/product'

// Convert mock products to Product type
const toFullProduct = (mockProduct: any): Product => ({
  id: mockProduct.id,
  name: mockProduct.name,
  price: mockProduct.price,
  description:
    mockProduct.description || `${mockProduct.name} - ${mockProduct.category}`,
  category: mockProduct.category,
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
