/**
 * Erfundene Testdaten für die Vorbestell-Specs (P1-P3). Produkt-IDs aus dem
 * synthetischen E2E-Katalog (`tools/e2e/hq-products`), Namen ausgedacht.
 */
import type {
  CatalogueProduct,
  PickupPoint,
  Preorder,
  PreorderDay,
} from '../preordersTypes'

export const CATALOGUE: CatalogueProduct[] = [
  {
    productId: 'kornbrot-500g',
    name: 'Kornbrot 500g',
    price: 2.5,
    category: 'brot',
    unit: 'Stück',
  },
  {
    productId: 'mustersemmel',
    name: 'Mustersemmel',
    price: 0.6,
    category: 'broetchen',
    unit: 'Stück',
  },
  {
    productId: 'musterweck',
    name: 'Musterweck',
    price: 0.5,
    category: 'broetchen',
    unit: 'Stück',
  },
]

export const POINT: PickupPoint = {
  id: 'kita-test',
  name: 'Kita Teststraße',
  street: 'Teststraße 1',
  zip: '12345',
  city: 'Musterdorf',
  weekday: 6,
  window: '09:00-09:30',
  orderDeadline: { weekday: 5, time: '12:00' },
  notes: null,
  active: true,
}

export function preorder(overrides: Partial<Preorder> = {}): Preorder {
  return {
    id: 7,
    code: 'LA-2026-11-13-01',
    channel: 'telefon',
    customerName: 'Erika Beispiel',
    customerPhone: '0170 000 0001',
    pickupDate: '2026-11-13',
    pickupTime: '08:30',
    pickupPointId: null,
    pickupPoint: null,
    status: 'offen',
    notCollected: false,
    notCollectedAt: null,
    paid: false,
    note: null,
    items: [
      {
        productId: 'kornbrot-500g',
        name: 'Kornbrot 500g',
        variant: '',
        unit: 'Stück',
        unitPrice: 2.4,
        quantity: 2,
        lineTotal: 4.8,
      },
    ],
    total: 4.8,
    pickedUpAt: null,
    anonymizedAt: null,
    createdBy: 1,
    updatedBy: 1,
    createdAt: '2026-11-12T09:00:00.000Z',
    updatedAt: '2026-11-12T09:00:00.000Z',
    deadline: null,
    afterDeadline: false,
    ...overrides,
  }
}

export function day(overrides: Partial<PreorderDay> = {}): PreorderDay {
  return {
    date: '2026-11-14',
    summary: {
      count: 2,
      total: 9.6,
      byStatus: { offen: 1, bereit: 1, abgeholt: 0, storniert: 1 },
      notCollected: 0,
      paid: 1,
      unpaidTotal: 4.8,
      byChannel: { telefon: 1, sammelstelle: 1 },
    },
    sums: [
      {
        productId: 'kornbrot-500g',
        variant: '',
        name: 'Kornbrot 500g',
        unit: 'Stück',
        quantity: 4,
        preorders: 2,
      },
      {
        productId: 'mustersemmel',
        variant: 'nuss',
        name: 'Mustersemmel',
        unit: 'Stück',
        quantity: 6,
        preorders: 1,
      },
    ],
    pickupPoints: [{ ...POINT, deadline: null, preorderCount: 1 }],
    preorders: [
      preorder({ pickupDate: '2026-11-14', code: 'LA-2026-11-14-01' }),
      preorder({
        id: 8,
        code: 'LA-2026-11-14-02',
        customerName: 'Max Muster',
        pickupDate: '2026-11-14',
        status: 'storniert',
      }),
    ],
    ...overrides,
  }
}

/** Nur `Date` fälschen - userEvent braucht echte Timer. */
export const ONLY_DATE: Array<
  | 'hrtime'
  | 'nextTick'
  | 'performance'
  | 'queueMicrotask'
  | 'requestAnimationFrame'
  | 'cancelAnimationFrame'
  | 'requestIdleCallback'
  | 'cancelIdleCallback'
  | 'setImmediate'
  | 'clearImmediate'
  | 'setInterval'
  | 'clearInterval'
  | 'setTimeout'
  | 'clearTimeout'
> = [
  'hrtime',
  'nextTick',
  'performance',
  'queueMicrotask',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'setImmediate',
  'clearImmediate',
  'setInterval',
  'clearInterval',
  'setTimeout',
  'clearTimeout',
]
