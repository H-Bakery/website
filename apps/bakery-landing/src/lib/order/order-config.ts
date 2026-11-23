import type { RenderedProductImage } from '../../types/product'

export const ORDER_CONFIG = {
  maxQuantity: 20,
  pickupDays: 14,
  pickupPlace: 'Laden',
  nextDayCutoff: null as string | null, // Uhrzeit im Laden (HH:mm)
  showEstimate: true,
  maxWhatsAppUrlLength: 2000,
  rememberNameByDefault: true,
  // null erlaubt alle verfügbaren Kategorien aus hq.
  orderableCategories: null as readonly string[] | null,
}

export interface OrderProduct {
  id: string
  name: string
  category: string
  price: number | null
  available: boolean
  image: string | null
  renderedImage?: RenderedProductImage
}

export function isOrderable(
  product: OrderProduct | undefined
): product is OrderProduct {
  return Boolean(
    product?.available &&
      (!ORDER_CONFIG.orderableCategories ||
        ORDER_CONFIG.orderableCategories.includes(product.category))
  )
}
