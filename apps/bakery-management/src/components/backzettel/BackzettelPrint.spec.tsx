import React from 'react'
import { render, within } from '@testing-library/react'
import { BackzettelPrint, groupDeltasForPrint } from './BackzettelPrint'
import type { BackzettelDeltaEntry } from '../../lib/backzettelApi'
import { saturdayConfirmed } from '../../lib/backzettelFixtures'

function delta(
  id: number,
  qty: number,
  extra: Partial<BackzettelDeltaEntry> = {}
): BackzettelDeltaEntry {
  return {
    id,
    key: 'test-kranz|mohn',
    itemId: 'test-kranz',
    name: 'Testkranz gefüllt',
    unit: 'Stück',
    variant: 'mohn',
    qty,
    kind: 'added',
    preorderId: 100 + id,
    preorderCode: `LA-2026-11-28-${String(id).padStart(2, '0')}`,
    createdAt: '2026-11-27T15:00:00.000Z',
    acknowledgedAt: null,
    acknowledgedBy: null,
    ...extra,
  }
}

describe('Nachträge im Ausdruck je Zeile (W4-verify r5)', () => {
  it('fasst Viertel einer Zeile zusammen und zeigt, was zu backen ist', () => {
    const groups = groupDeltasForPrint(
      [
        delta(1, 0.75),
        delta(2, 0.75),
        delta(3, -0.5, { kind: 'cancelled' }),
        delta(4, 0.25, { acknowledgedAt: '2026-11-27T16:00:00.000Z' }),
      ],
      { 'test-kranz|mohn': { qty: 1.25, open: 3, count: 4, bake: 2 } }
    )
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ qty: 1.25, bake: 2, open: 3 })
  })

  it('druckt eine Zeile mit Kästchen je Posten statt je Vorbestellung', () => {
    const base = saturdayConfirmed()
    const deltas = [
      delta(1, 0.75),
      delta(2, 0.75),
      delta(3, 0.25, {
        key: 'test-x|',
        itemId: 'test-x',
        name: 'Testbrot',
        variant: null,
      }),
    ]
    const { getByTestId } = render(
      <BackzettelPrint
        day={{
          ...base,
          deltas,
          sections: base.sections.map((s, i) =>
            i === 0
              ? {
                  ...s,
                  lines: [
                    ...s.lines,
                    {
                      ...s.lines[0],
                      id: 999,
                      key: 'test-kranz|mohn',
                      delta: { qty: 1.5, open: 2, count: 2, bake: 2 },
                    },
                  ],
                }
              : s
          ),
        }}
        config={null}
      />
    )
    const table = within(getByTestId('print-deltas'))
    expect(table.getAllByRole('row', { hidden: true })).toHaveLength(3) // Kopf + 2 Posten
    const kranz = getByTestId('print-delta-test-kranz|mohn')
    expect(kranz).toHaveTextContent(/^\+2/)
    expect(kranz).toHaveTextContent('Nachtrag +1,5 · 2 mehr backen')
    expect(kranz).toHaveTextContent('2 Nachträge')
    expect(kranz).toHaveTextContent('LA-2026-11-28-01, LA-2026-11-28-02')
    expect(kranz.querySelectorAll('.box')).toHaveLength(1)
  })
})

describe('Nachträge im Ausdruck: gesehen und ohne Zeile (W4-verify r6)', () => {
  const ACK = '2026-11-27T16:00:00.000Z'
  const weck = (id: number, qty: number, acked: boolean) =>
    delta(id, qty, {
      key: 'test-weck|',
      itemId: 'test-weck',
      name: 'Testweck',
      variant: null,
      acknowledgedAt: acked ? ACK : null,
    })

  it('gesehene Nachträge haben einen Haken, teils gesehene zeigen nur den offenen Teil', () => {
    const base = saturdayConfirmed()
    const deltas = [
      weck(1, 20, true),
      weck(2, 19, true),
      weck(3, 9, false),
      delta(4, 1, { acknowledgedAt: ACK }),
    ]
    const { getByTestId, container } = render(
      <BackzettelPrint
        day={{
          ...base,
          deltas,
          sections: base.sections.map((s, i) =>
            i === 0
              ? {
                  ...s,
                  lines: [
                    {
                      ...s.lines[0],
                      id: 998,
                      key: 'test-weck|',
                      delta: {
                        qty: 48,
                        open: 1,
                        count: 3,
                        bake: 48,
                        openQty: 9,
                        bakeOpen: 9,
                      },
                    },
                    {
                      ...s.lines[0],
                      id: 999,
                      key: 'test-kranz|mohn',
                      delta: {
                        qty: 1,
                        open: 0,
                        count: 1,
                        bake: 1,
                        openQty: 0,
                        bakeOpen: 0,
                      },
                    },
                  ],
                }
              : s
          ),
        }}
        config={null}
      />
    )
    const weckRow = getByTestId('print-delta-test-weck|')
    expect(weckRow).toHaveTextContent(/^\+9/)
    expect(weckRow).toHaveTextContent('noch offen - von +48, 39 schon gesehen')
    expect(weckRow.querySelector('.box.done')).toBeNull()
    const kranz = getByTestId('print-delta-test-kranz|mohn')
    expect(kranz).toHaveTextContent('quittiert')
    expect(getByTestId('print-delta-done-test-kranz|mohn')).toHaveTextContent(
      '✓'
    )
    // Seite 1 sagt dasselbe an der Zeile (die Testzeilen sind Liter-Posten)
    const page1 = container.textContent ?? ''
    expect(page1).toContain(
      'Nachtrag offen +9 L (von +48 L, Rest schon gesehen; Liste unten)'
    )
    expect(page1).toContain('Nachtrag +1 L · schon gesehen (Liste unten)')
  })

  it('ein Nachtrag ohne freigegebene Zeile bekommt seine Backmenge aus deltaTotals', () => {
    const base = saturdayConfirmed()
    const { getByTestId } = render(
      <BackzettelPrint
        day={{
          ...base,
          deltas: [delta(1, 0.25), delta(2, 0.25)],
          deltaTotals: {
            'test-kranz|mohn': {
              qty: 0.5,
              open: 2,
              count: 2,
              bake: 1,
              openQty: 0.5,
              bakeOpen: 1,
            },
          },
        }}
        config={null}
      />
    )
    const kranz = getByTestId('print-delta-test-kranz|mohn')
    expect(kranz).toHaveTextContent(/^\+1/)
    expect(kranz).toHaveTextContent('Nachtrag +0,5 · 1 mehr backen')
  })
})
