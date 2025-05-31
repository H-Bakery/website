// src/app/admin/products/[id]/page.tsx
import React from 'react'
import { PRODUCTS } from '../../../../mocks/products'
import ProductEditClient from './ProductEditClient'

// Generate static paths for all products during build
export async function generateStaticParams() {
  return PRODUCTS.map((product) => ({
    id: product.id.toString(),
  }))
}

// Server component that passes product ID to client component
export default function ProductEditPage({ params }: { params: { id: string } }) {
  const productId = params.id

  return <ProductEditClient productId={productId} />
}