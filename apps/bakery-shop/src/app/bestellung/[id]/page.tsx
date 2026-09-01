'use client'

import React, { use } from 'react'
import { OrderConfirmation } from '@bakery/shop/feature-cart'

interface OrderPageProps {
  /** Next 16 liefert die Routen-Parameter als Promise. */
  params: Promise<{ id: string }>
}

/** Bestellbestätigung mit Bestellnummer. */
export default function OrderPage({ params }: OrderPageProps) {
  const { id } = use(params)
  return <OrderConfirmation orderId={id} />
}
