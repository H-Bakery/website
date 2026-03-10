import React from 'react'
import { getManagementProducts } from '../../../../lib/products'
import ProductEditClient from './ProductEditClient'

export async function generateStaticParams() {
  const products = getManagementProducts()
  return products.map((product) => ({
    id: product.id,
  }))
}

export default async function ProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: productId } = await params
  const products = getManagementProducts()
  const product = products.find((p) => p.id === productId)

  return <ProductEditClient productId={productId} initialProduct={product} />
}
