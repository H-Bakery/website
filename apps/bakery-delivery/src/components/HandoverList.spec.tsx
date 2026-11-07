import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
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
      // Die übergebene ist unbezahlt (kein `paid`): das Geld fehlt noch.
      handedOverUnpaid: 1,
      handedOverUnpaidTotal: 6.1,
      refundCount: 0,
      refundTotal: 0,
    })
  })

  it('zählt Geld, das nach einer Übergabe noch fehlt, für sich (UI-Runde 1)', () => {
    // Regression: „Bar zu kassieren: 0,00 €" im Kopf, während eine ohne
    // Zahlung übergebene Bestellung „41,40 € kassieren" zeigte.
    const summary = summarizeHandover([
      preorder({ id: 1, total: 41.4, status: 'handed_over', paid: false }),
      preorder({
        id: 2,
        total: 8.65,
        status: 'handed_over',
        paid: true,
        paymentBalance: 6.4,
      }),
      preorder({ id: 3, total: 5, status: 'handed_over', paid: true }),
    ])
    expect(summary).toMatchObject({
      openTotal: 0,
      handedOverUnpaid: 2,
      handedOverUnpaidTotal: 47.8,
    })
    expect(handoverHeadline(summary)).toBe(
      `3 von 3 übergeben · Ohne Zahlung übergeben: ${formatCurrency(47.8)}`
    )
  })
})

describe('handoverHeadline', () => {
  it('nennt Übergaben und das zu kassierende Bargeld', () => {
    const text = handoverHeadline(
      summarizeHandover([
        preorder({ id: 1, total: 6.1, status: 'handed_over', paid: true }),
        preorder({ id: 2, total: 6.2 }),
      ])
    )
    // formatCurrency setzt ein schmales geschuetztes Leerzeichen vor das
    // Eurozeichen - deshalb der Vergleich ueber die Funktion selbst.
    expect(text).toBe(
      `1 von 2 übergeben · Bar zu kassieren: ${formatCurrency(6.2)}`
    )
  })

  it('lässt Beträge von 0,00 € weg', () => {
    expect(
      handoverHeadline(
        summarizeHandover([
          preorder({ status: 'handed_over', paid: true, paymentBalance: 0 }),
        ])
      )
    ).toBe('1 von 1 übergeben')
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

    // Unbezahlt: „Übergeben" fragt erst nach dem Geld und nennt den Betrag.
    fireEvent.click(screen.getByRole('button', { name: 'Übergeben' }))
    expect(onStatusChange).not.toHaveBeenCalled()
    expect(screen.getByRole('group').textContent).toContain(
      `Noch nicht bezahlt: ${formatCurrency(6.1)} kassieren.`
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Bezahlt und übergeben' })
    )
    expect(onStatusChange).toHaveBeenCalledWith(1, 'handed_over', true)

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

  it('bietet dem Fahrer kein Zurücknehmen einer Übergabe an (API: 403)', () => {
    const onStatusChange = jest.fn()
    render(
      <HandoverList
        preorders={[
          preorder({ id: 1, status: 'handed_over' }),
          preorder({
            id: 2,
            reference: 'MO-2026-09-12-02',
            status: 'not_collected',
          }),
        ]}
        busy={false}
        onStatusChange={onStatusChange}
        canUndoHandover={false}
      />
    )

    expect(screen.getByText('Zurücknehmen kann der Verkauf.')).toBeTruthy()
    // Regression: auch „Nicht abgeholt" darf er nicht auf „Offen" setzen
    // (API: Fahrer nur `abgeholt`/`nicht_abgeholt`, sonst 403) - der Knopf
    // endete in einer Fehlermeldung. Kam die Familie doch, übergibt er direkt.
    expect(screen.queryByRole('button', { name: 'Zurücksetzen' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Übergeben' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Ohne Zahlung übergeben' })
    )
    expect(onStatusChange).toHaveBeenCalledWith(2, 'handed_over', false)
  })

  it('lässt eine nicht abgeholte Bestellung doch noch übergeben (Inhaber auch zurücksetzen)', () => {
    const onStatusChange = jest.fn()
    render(
      <HandoverList
        preorders={[preorder({ status: 'not_collected', paid: true })]}
        busy={false}
        onStatusChange={onStatusChange}
      />
    )

    // Vorab bezahlt, nichts offen: ein Tipp übergibt direkt.
    fireEvent.click(screen.getByRole('button', { name: 'Übergeben' }))
    expect(onStatusChange).toHaveBeenCalledWith(1, 'handed_over', undefined)
    fireEvent.click(screen.getByRole('button', { name: 'Zurücksetzen' }))
    expect(onStatusChange).toHaveBeenCalledWith(1, 'open')
    expect(screen.queryByRole('button', { name: 'Nicht abgeholt' })).toBeNull()
  })

  it('sperrt nur die Zeile, deren Abhaken noch unterwegs ist', () => {
    // Die naechste Familie steht schon vor dem Fahrer; der haengende PATCH
    // der vorigen darf ihren Knopf nicht ausgrauen.
    render(
      <HandoverList
        preorders={[
          preorder({ id: 101, customer: 'Vorbestellung 1' }),
          preorder({ id: 102, customer: 'Vorbestellung 2' }),
        ]}
        busy={false}
        busyIds={new Set([101])}
        onStatusChange={jest.fn()}
      />
    )

    const buttons = screen.getAllByRole('button', {
      name: 'Übergeben',
    }) as HTMLButtonElement[]
    expect(buttons.map((b) => b.disabled)).toEqual([true, false])
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

describe('Bezahlstand (Abschluss-Verifikation next)', () => {
  // (a) vorab bezahlt, (b) teurer geworden, (c) billiger geworden,
  // (d) storniert und bezahlt, (e) unbezahlt
  const prepaid = preorder({
    id: 1,
    total: 4.5,
    paid: true,
    paidAmount: 4.5,
    paymentBalance: 0,
  })
  const topUp = preorder({
    id: 2,
    reference: 'MO-2026-09-12-02',
    customer: 'Rest',
    total: 8.65,
    paid: true,
    paidAmount: 2.25,
    paymentBalance: 6.4,
  })
  const refund = preorder({
    id: 3,
    reference: 'MO-2026-09-12-03',
    customer: 'Erstattung',
    total: 1.8,
    paid: true,
    paidAmount: 4.5,
    paymentBalance: -2.7,
  })
  const cancelled = preorder({
    id: 4,
    reference: 'MO-2026-09-12-04',
    customer: 'Storno',
    total: 9.6,
    status: 'cancelled',
    paid: true,
    paidAmount: 9.6,
    paymentBalance: -9.6,
  })
  const unpaid = preorder({
    id: 5,
    reference: 'MO-2026-09-12-05',
    customer: 'Unbezahlt',
    total: 6.1,
    paid: false,
    paidAmount: null,
    paymentBalance: 0,
  })
  const all = [prepaid, topUp, refund, cancelled, unpaid]

  it('kassiert Vorkasse nicht ein zweites Mal und nennt Rest und Erstattungen', () => {
    const summary = summarizeHandover(all)
    expect(summary).toMatchObject({
      total: 4,
      open: 4,
      openTotal: 12.5, // 6,40 Rest + 6,10 unbezahlt
      refundTotal: 12.3, // 2,70 + 9,60
      refundCount: 2,
    })
    expect(handoverHeadline(summary)).toBe(
      `0 von 4 übergeben · Bar zu kassieren: ${formatCurrency(
        12.5
      )} · Zurückzugeben: ${formatCurrency(12.3)}`
    )
  })

  it('zeigt je Zeile, was mit dem Geld zu tun ist', () => {
    render(
      <HandoverList preorders={all} busy={false} onStatusChange={jest.fn()} />
    )
    expect(screen.getByTestId('payment-1').textContent).toBe(
      'Bezahlt – nichts zu kassieren'
    )
    expect(screen.getByTestId('payment-2').textContent).toBe(
      `Bezahlt – Rest ${formatCurrency(6.4)} kassieren`
    )
    expect(screen.getByTestId('payment-3').textContent).toBe(
      `${formatCurrency(2.7)} zurückgeben`
    )
    expect(screen.getByTestId('payment-4').textContent).toBe(
      `Storniert – ${formatCurrency(9.6)} zurückgeben`
    )
    expect(screen.getByTestId('payment-5').textContent).toBe(
      `${formatCurrency(6.1)} kassieren`
    )
  })

  it('fragt bei Rest und Erstattung, ob das Geld geflossen ist', () => {
    const onStatusChange = jest.fn()
    render(
      <HandoverList
        preorders={[topUp, refund, cancelled]}
        busy={false}
        onStatusChange={onStatusChange}
      />
    )
    const handOver = (customer: string) =>
      fireEvent.click(
        within(
          screen
            .getByRole('heading', { name: customer })
            .closest('li') as HTMLElement
        ).getByRole('button', { name: 'Übergeben' })
      )
    handOver('Rest')
    expect(screen.getByRole('group').textContent).toContain(
      `Rest ${formatCurrency(6.4)} kassieren.`
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Rest kassiert und übergeben' })
    )
    expect(onStatusChange).toHaveBeenLastCalledWith(2, 'handed_over', true)
    handOver('Rest')
    fireEvent.click(screen.getByRole('button', { name: 'Ohne Rest übergeben' }))
    expect(onStatusChange).toHaveBeenLastCalledWith(2, 'handed_over', undefined)
    handOver('Erstattung')
    expect(screen.getByRole('group').textContent).toContain(
      `${formatCurrency(2.7)} an die Kundschaft zurückgeben.`
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Erstattet und übergeben' })
    )
    expect(onStatusChange).toHaveBeenLastCalledWith(3, 'handed_over', true)
    handOver('Erstattung')
    fireEvent.click(
      screen.getByRole('button', { name: 'Ohne Erstattung übergeben' })
    )
    expect(onStatusChange).toHaveBeenLastCalledWith(3, 'handed_over', undefined)
    // „Abbrechen" schließt die Frage, ohne etwas zu senden.
    const calls = onStatusChange.mock.calls.length
    handOver('Rest')
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(onStatusChange).toHaveBeenCalledTimes(calls)
    expect(
      screen.queryByRole('button', { name: 'Ohne Rest übergeben' })
    ).toBeNull()
    // Die stornierte hat keinen Knopf - erfassen kann das der Verkauf.
    expect(screen.getByText('Erfassen kann das der Verkauf.')).toBeTruthy()
  })
})

describe('Übergabe ohne Zahlung (UI-Runde 1)', () => {
  it('fragt bei einer unbezahlten nach dem Geld, statt sie still als bezahlt zu buchen', () => {
    // Regression: ein Tipp auf „Übergeben" schickte nur `{ status }`, und
    // der Server buchte die Bestellung als bezahlt - auch wenn die Familie
    // die Tüte ohne Geld mitnahm.
    const onStatusChange = jest.fn()
    render(
      <HandoverList
        preorders={[preorder({ total: 89, paid: false, paymentBalance: 0 })]}
        busy={false}
        onStatusChange={onStatusChange}
        canUndoHandover={false}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Übergeben' }))
    expect(onStatusChange).not.toHaveBeenCalled()
    expect(
      screen.getByRole('group', { name: 'Übergabe an Vorbestellung 1' })
    ).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: 'Ohne Zahlung übergeben' })
    )
    expect(onStatusChange).toHaveBeenCalledWith(1, 'handed_over', false)
  })

  it('zeigt das offene Geld an einer ohne Zahlung übergebenen und lässt es nachträglich kassieren', () => {
    const onStatusChange = jest.fn()
    render(
      <HandoverList
        preorders={[
          preorder({
            total: 41.4,
            status: 'handed_over',
            paid: false,
            paymentBalance: 0,
          }),
        ]}
        busy={false}
        onStatusChange={onStatusChange}
        canUndoHandover={false}
      />
    )
    expect(screen.getByTestId('payment-1').textContent).toBe(
      `Ohne Zahlung übergeben – ${formatCurrency(41.4)} offen`
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Nachträglich kassiert' })
    )
    expect(onStatusChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Kassiert' }))
    expect(onStatusChange).toHaveBeenCalledWith(1, 'handed_over', true)
    // Zurücknehmen bleibt dem Verkauf.
    expect(screen.getByText('Zurücknehmen kann der Verkauf.')).toBeTruthy()
  })

  it('sortiert nach Name wie die Abholliste, stornierte zuletzt', () => {
    render(
      <HandoverList
        preorders={[
          preorder({ id: 1, customer: 'Zander', reference: 'MO-1' }),
          preorder({
            id: 2,
            customer: 'Ahorn',
            reference: 'MO-2',
            status: 'cancelled',
            paid: true,
            paymentBalance: -6.1,
          }),
          preorder({ id: 3, customer: 'Öztürk', reference: 'MO-3' }),
          preorder({ id: 4, customer: 'Birke', reference: 'MO-4' }),
        ]}
        busy={false}
        onStatusChange={jest.fn()}
      />
    )
    expect(
      screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)
    ).toEqual(['Birke', 'Öztürk', 'Zander', 'Ahorn'])
  })
})
