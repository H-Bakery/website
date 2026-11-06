import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import PaymentNote from './PaymentNote'
import { preorder } from '../../lib/testing/preorderFixtures'
import { moneyNotes } from '../../app/admin/delivery/preorders/PreorderListClient'

describe('PaymentNote (W4-verify r3)', () => {
  it('teilbezahlt und zu viel bezahlt stehen mit Betrag in der Zeile', () => {
    const { rerender } = renderWithTheme(
      <PaymentNote preorder={preorder({ paid: true, paymentBalance: 36 })} />
    )
    expect(screen.getByText(/bezahlt · Rest 36,00\s€ offen/)).toHaveAttribute(
      'data-payment',
      'rest'
    )
    rerender(
      <PaymentNote preorder={preorder({ paid: true, paymentBalance: -3.6 })} />
    )
    expect(screen.getByText(/bezahlt · 3,60\s€ erstatten/)).toHaveAttribute(
      'data-payment',
      'refund'
    )
    rerender(
      <PaymentNote preorder={preorder({ paid: true, paymentBalance: 0 })} />
    )
    expect(screen.getByText('bezahlt')).toBeInTheDocument()
  })

  it('unbezahlt: nichts', () => {
    const { container } = renderWithTheme(
      <PaymentNote preorder={preorder({ paid: false })} />
    )
    expect(container.textContent).toBe('')
  })

  it('Sammelstelle: „Noch zu kassieren“ nennt ohne Zahlung Übergebenes und Erstattungen', () => {
    expect(moneyNotes({})).toBeNull()
    expect(
      moneyNotes({ handedOverUnpaidTotal: 3.6, refundTotal: 5.4 })
    ).toMatch(/^\+ 3,60\s€ ohne Zahlung übergeben · 5,40\s€ zu erstatten$/)
  })
})
