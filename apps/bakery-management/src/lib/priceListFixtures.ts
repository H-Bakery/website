/**
 * Synthetische Preisliste für Specs - gebaut mit dem echten Core der API
 * (`price-list.core.js`), damit die Specs dasselbe Dokument sehen wie die
 * Seite. Erfundene Produkte und Preise, nichts aus hq.
 */
import type { PriceListDoc } from './priceListApi'

// eslint-disable-next-line @typescript-eslint/no-var-requires, @nx/enforce-module-boundaries
const core = require('../../../bakery-api/src/services/price-list.core') as {
  buildPriceList: (
    products: unknown[],
    options?: Record<string, unknown>
  ) => PriceListDoc
  CATEGORY_LABELS: Record<string, string>
}

export const priceListCore = core

let nextId = 1
function product(
  name: string,
  category: string,
  price: number | undefined,
  extra: Record<string, unknown> = {}
) {
  const numeric_id = nextId++
  return {
    id: `p-${numeric_id}`,
    numeric_id,
    name,
    category,
    price,
    available: true,
    seasonal: false,
    allergens: null,
    ...extra,
  }
}

export const SYNTHETIC_PRODUCTS = [
  product('Musterbrot 500g', 'brot', 2.5, { allergens: ['gluten', 'weizen'] }),
  product('Musterbrot 1000g', 'brot', 4.4, { allergens: ['gluten', 'weizen'] }),
  product('Probekruste 750g', 'brot', 3.9),
  product('Musterweck', 'broetchen', 0.45),
  product('Musterbaguette klein', 'baguette', 1.5),
  product('Musterbaguette groß', 'baguette', 2.6),
  product('Musterkuchen', 'kuchen', 14),
  product('Musterkuchen (1 Stück)', 'kuchen', 1.6),
  product('Saisonstollen', 'kuchen', 9.95, { seasonal: true }),
  product('Testtorte Sahne', 'torten', 32),
  product('Testschnecke', 'teilchen', 1.7, { available: false }),
  product('Probeplunder', 'teilchen', undefined),
]

export const SYNTHETIC_PARTNER = {
  id: 7,
  name: 'Testmarkt Musterstadt',
  street: 'Musterweg 1',
  zip: '00000',
  city: 'Musterstadt',
  settlementModel: 'commission',
  assortmentSource: 'templates',
}

export function syntheticPriceList(
  options: Record<string, unknown> = {}
): PriceListDoc {
  return core.buildPriceList(SYNTHETIC_PRODUCTS, {
    today: '2026-11-13',
    allergenText: (keys: string[]) => keys.join(', '),
    ...options,
  })
}
