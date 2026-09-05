import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import {
  handoverHeadline,
  HandoverList,
  summarizeHandover,
} from './HandoverList'
import type { Preorder } from '../lib/delivery-api'
import { formatCurrency } from '../lib/format'

/**
 * Die Übergabeliste ist das, was der Fahrer am Kindergarten in der Hand hat:
 * wer bekommt was, und wie viel Bargeld kommt noch rein.
 */

function preorder(overrides: Partial<Preorder> = {}): Preorder {
  return {
    id: 1,
    reference: 'MO-2026-09-12-01',
    pickupPointId: 'kindergarten-moersbach',
    date: '2026-09-12',
    customer: 'Vorbestellung 1',
    phone: null,
    items: [
      {
        productId: 'bauernbrot',
        name: 'Bauernbrot',
        qty: 2,
        unit: 'Stück',
        unitPrice: 3.05,
        lineTotal: 6.1,
      },
    ],
    total: 6.1,
    note: null,
    status: 'open',
    handedOverAt: null,
    createdAt: '2026-09-10T08:00:00.000Z',
    updatedAt: '2026-09-10T08:00:00.000Z',
    deadline: '2026-09-11T10:00:00.000Z',
    afterDeadline: false,
    ...overrides,
  }
}

describe('summarizeHandover', () => {
  it('rundet die offene Summe auf Cent', () => {
    // Ohne Rundung ergaebe 6,10 + 6,20 in Fliesskomma 12,299999999999999 -
    // und darunter stuende ein Betrag, den niemand kassieren kann.
    const summary = summarizeHandover([
      preorder({ id: 1, total: 6.1 }),
      preorder({ id: 2, total: 6.2 }),
    ])
    expect(summary.openTotal).toBe(12.3)
    expect(summary.open).toBe(2)
    expect(summary.handedOver).toBe(0)
  })

  it('zählt nur die offenen Beträge zum Bargeld', () => {
    const summary = summarizeHandover([
      preorder({ id: 1, total: 6.1, status: 'handed_over' }),
      preorder({ id: 2, total: 6.2, status: 'not_collected' }),
      preorder({ id: 3, total: 4.5 }),
    ])
    expect(summary).toEqual({
      total: 3,
      handedOver: 1,
      notCollected: 1,
      open: 1,
      openTotal: 4.5,
    })
  })
})

describe('handoverHeadline', () => {
  it('nennt Übergaben und das zu kassierende Bargeld', () => {
    const text = handoverHeadline(
      summarizeHandover([
        preorder({ id: 1, total: 6.1, status: 'handed_over' }),
        preorder({ id: 2, total: 6.2 }),
      ])
    )
    // formatCurrency setzt ein schmales geschuetztes Leerzeichen vor das
    // Eurozeichen - deshalb der Vergleich ueber die Funktion selbst.
    expect(text).toBe(
      `1 von 2 übergeben · Bar zu kassieren: ${formatCurrency(6.2)}`
    )
  })

  it('schreibt „nicht abgeholt" nur, wenn es welche gibt', () => {
    expect(handoverHeadline(summarizeHandover([preorder()]))).not.toMatch(
      /nicht abgeholt/
    )
    expect(
      handoverHeadline(
        summarizeHandover([preorder({ status: 'not_collected' })])
      )
    ).toMatch(/1 nicht abgeholt/)
  })
})

describe('HandoverList', () => {
  it('zeigt Referenz, Kunde, Artikel, Betrag und die Telefonnummer als Anruf-Link', () => {
    render(
      <HandoverList
        preorders={[preorder({ phone: '+4915112345678' })]}
        busy={false}
        onStatusChange={jest.fn()}
      />
    )

    expect(screen.getByText('MO-2026-09-12-01')).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: 'Vorbestellung 1' })
    ).toBeTruthy()
    expect(screen.getByText('2× Bauernbrot')).toBeTruthy()
    expect(screen.getByText('6,10 €')).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Anrufen' }).getAttribute('href')
    ).toBe('tel:+4915112345678')
  })

  it('hakt eine Vorbestellung ab und lässt sie zurücksetzen', () => {
    const onStatusChange = jest.fn()
    const { rerender } = render(
      <HandoverList
        preorders={[preorder()]}
        busy={false}
        onStatusChange={onStatusChange}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Übergeben' }))
    expect(onStatusChange).toHaveBeenCalledWith(1, 'handed_over')

    fireEvent.click(screen.getByRole('button', { name: 'Nicht abgeholt' }))
    expect(onStatusChange).toHaveBeenCalledWith(1, 'not_collected')

    rerender(
      <HandoverList
        preorders={[preorder({ status: 'handed_over' })]}
        busy={false}
        onStatusChange={onStatusChange}
      />
    )
    // Status nie allein ueber die Farbe: der Text steht daneben.
    expect(screen.getByText('Übergeben')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Zurücksetzen' }))
    expect(onStatusChange).toHaveBeenCalledWith(1, 'open')
  })

  it('warnt bei einer nach Bestellschluss aufgenommenen Vorbestellung', () => {
    render(
      <HandoverList
        preorders={[preorder({ afterDeadline: true })]}
        busy={false}
        onStatusChange={jest.fn()}
      />
    )
    expect(screen.getByText(/Nach Bestellschluss aufgenommen/)).toBeTruthy()
  })

  it('sagt es, wenn für den Tag nichts vorbestellt wurde', () => {
    render(
      <HandoverList preorders={[]} busy={false} onStatusChange={jest.fn()} />
    )
    expect(
      screen.getByText('Für diesen Tag liegen keine Vorbestellungen vor.')
    ).toBeTruthy()
  })
})
