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
