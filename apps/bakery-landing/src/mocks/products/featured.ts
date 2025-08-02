import buns from './buns.json'
import cakes from './cakes.json'
import breads from './breads.json'
import { Product } from '../../types/product'

// Convert mock products to full Product type
const toFullProduct = (mockProduct: (typeof buns)[0]): Product => ({
  ...mockProduct,
  cost: mockProduct.price * 0.6, // Mock cost as 60% of price
  stock: 100,
  dailyTarget: 50,
  description: `${mockProduct.name} - ${mockProduct.category}`,
  isActive: true,
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
