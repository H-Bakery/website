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
    mockFetchShopOrder.mockRejectedValue(new Error('Server nicht erreichbar'))
    render(<OrderConfirmation orderId={bookedOrder.id} />)

    await waitFor(() =>
      expect(screen.getByTestId('order-confirmation').textContent).toContain(
        'können wir gerade nicht anzeigen'
      )
    )
    expect(screen.queryByTestId('order-price-updated')).toBeNull()
  })

  /* ------------------------------------------------------------------ */
  /* Ladezustand                                                         */
  /* ------------------------------------------------------------------ */

  it('verspricht nichts, solange der Server nicht geantwortet hat', async () => {
    // Die Route ist eine Clientkomponente mit dynamischem Parameter — dieser
    // Zustand ist das Server-HTML, das ein vertippter Link als Erstes zeigt.
    let resolveOrder: (order: ShopOrder | null) => void = () => undefined
    mockFetchShopOrder.mockReturnValue(
      new Promise<ShopOrder | null>((resolve) => {
        resolveOrder = resolve
      })
    )
    render(<OrderConfirmation orderId="GIBT-ES-NICHT" />)

    const view = screen.getByTestId('order-loading')
    expect(view.textContent).toContain('Bestellung wird geladen')
    expect(screen.getByTestId('order-number').textContent).toBe('GIBT-ES-NICHT')
    // Kein grüner Haken, kein „Danke", keine Erfolgsseite — und auch noch
    // kein „nicht gefunden".
    expect(screen.queryByTestId('order-confirmation')).toBeNull()
    expect(screen.queryByTestId('order-not-found')).toBeNull()
    expect(screen.queryByTestId('CheckCircleOutlineIcon')).toBeNull()
    expect(view.textContent).not.toContain('Danke')
    expect(view.textContent).not.toContain('legen alles für Sie zurück')

    resolveOrder(null)
    await screen.findByTestId('order-not-found')
    expect(screen.queryByTestId('order-loading')).toBeNull()
  })

  it('zeigt Haken und „Danke" erst, wenn die Bestellung da ist', async () => {
    render(<OrderConfirmation orderId={bookedOrder.id} />)

    expect(screen.queryByTestId('CheckCircleOutlineIcon')).toBeNull()

    const view = await screen.findByTestId('order-confirmation')
    expect(screen.getByTestId('CheckCircleOutlineIcon')).toBeTruthy()
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Danke – wir legen alles für Sie zurück',
      })
    ).toBeTruthy()
    expect(view.textContent).toContain('Kornbrot 500g')
    expect(screen.queryByTestId('order-loading')).toBeNull()
  })

  /* ------------------------------------------------------------------ */
  /* Unbekannter Bestellcode                                             */
  /* ------------------------------------------------------------------ */

  it('rendert für einen unbekannten Code keine Erfolgsseite', async () => {
    mockFetchShopOrder.mockResolvedValue(null)
    render(<OrderConfirmation orderId="GIBT-ES-NICHT" />)

    const view = await screen.findByTestId('order-not-found')
    expect(view.textContent).toContain('Bestellung nicht gefunden')
    expect(screen.getByTestId('order-number').textContent).toBe('GIBT-ES-NICHT')
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Bestellung nicht gefunden',
      })
    ).toBeTruthy()
    // Vorher: grüner Haken, „Danke" und „Ihre Bestellung ist trotzdem bei uns".
    expect(screen.queryByTestId('order-confirmation')).toBeNull()
    expect(view.textContent).not.toContain('Danke')
    expect(view.textContent).not.toContain('trotzdem bei uns')
  })

  it('nennt dem, der gerade bestellt hat, die Telefonnummer', async () => {
    mockFetchShopOrder.mockResolvedValue(null)
    render(<OrderConfirmation orderId="GIBT-ES-NICHT" />)

    await screen.findByTestId('order-not-found')
    expect(
      screen.getByRole('link', { name: '06841 2229' }).getAttribute('href')
    ).toBe('tel:+4968412229')
    expect(
      screen
        .getByRole('link', { name: /Weiter einkaufen/ })
        .getAttribute('href')
    ).toBe('/products')
  })

  it('behandelt einen fehlenden Code wie einen unbekannten', async () => {
    render(<OrderConfirmation orderId="" />)

    const view = await screen.findByTestId('order-not-found')
    expect(view.textContent).toContain('enthält keinen Bestellcode')
    expect(mockFetchShopOrder).not.toHaveBeenCalled()
  })

  it('unterscheidet „nicht gefunden" von „Server antwortet nicht"', async () => {
    mockFetchShopOrder.mockRejectedValue(new Error('Server nicht erreichbar'))
    render(<OrderConfirmation orderId={bookedOrder.id} />)

    await screen.findByTestId('order-unavailable')
    // Über die Bestellung selbst wissen wir nichts — also weder Erfolgsseite
    // ohne Einschränkung noch „nicht gefunden".
    expect(screen.queryByTestId('order-not-found')).toBeNull()
    expect(screen.getByTestId('order-number').textContent).toBe(bookedOrder.id)
  })
})
