/**
 * @fileoverview Die Bestätigung zeigt, was der Server gebucht hat — und sagt es
 * dazu, wenn das nicht der Betrag war, der an der Kasse stand.
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'

import type { ShopOrder } from '@bakery/shared/data-access'

import { OrderConfirmation } from './order-confirmation'

let mockSearch = ''
const mockFetchShopOrder = jest.fn()

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mockSearch),
}))

jest.mock('@bakery/shared/data-access', () => ({
  ...jest.requireActual('@bakery/shared/data-access'),
  fetchShopOrder: (...args: unknown[]) => mockFetchShopOrder(...args),
}))

/** Eine Bestellung, wie `POST /api/orders` sie nach dem Neu-Bepreisen zurückgibt. */
const bookedOrder: ShopOrder = {
  id: 'D5WH-B8CM-AGTM',
  customerName: 'Erika Mustermann',
  phone: '06841 123456',
  pickupDate: '2026-09-05',
  pickupTime: '09:00',
  items: [
    {
      productId: 'kornbrot-500g',
      name: 'Kornbrot 500g',
      quantity: 1,
      price: 2.5,
    },
  ],
  total: 2.5,
  status: 'pending',
  createdAt: '2026-09-02T08:00:00.000Z',
}

describe('OrderConfirmation', () => {
  beforeEach(() => {
    mockSearch = ''
    mockFetchShopOrder.mockReset().mockResolvedValue(bookedOrder)
  })

  it('sagt die Preisänderung dazu, wenn die Kasse sie meldet', async () => {
    mockSearch = 'preis=aktualisiert'
    render(<OrderConfirmation orderId={bookedOrder.id} />)

    const notice = await screen.findByTestId('order-price-updated')
    expect(notice.textContent).toContain('Preis hat sich')
    // Der gebuchte Betrag steht daneben — nicht der von der Kasse.
    expect(screen.getByTestId('order-confirmation').textContent).toMatch(
      /Gesamt2,50\s€/
    )
  })

  it('schweigt ohne den Parameter', async () => {
    render(<OrderConfirmation orderId={bookedOrder.id} />)

    await waitFor(() =>
      expect(screen.getByTestId('order-confirmation').textContent).toContain(
        'Kornbrot 500g'
      )
    )
    expect(screen.queryByTestId('order-price-updated')).toBeNull()
  })

  it('zeigt den Hinweis nicht, wenn es keine Einzelheiten gibt, an denen er hinge', async () => {
    mockSearch = 'preis=aktualisiert'
    mockFetchShopOrder.mockResolvedValue(null)
    render(<OrderConfirmation orderId={bookedOrder.id} />)

    await waitFor(() =>
      expect(screen.getByTestId('order-confirmation').textContent).toContain(
        'können wir gerade nicht anzeigen'
      )
    )
    expect(screen.queryByTestId('order-price-updated')).toBeNull()
  })
})
