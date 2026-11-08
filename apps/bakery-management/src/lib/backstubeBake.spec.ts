import { bakeDeltaGroups } from './backstubeBake'
import type { BackzettelDeltaEntry, BakeList } from './backzettelApi'
import { SAT, V2_TUE, tuesdayBakeList } from './backzettelFixtures'

const KEY = `test-doppel|@${V2_TUE}`

function delta(
  id: number,
  qty: number,
  extra: Partial<BackzettelDeltaEntry> = {}
): BackzettelDeltaEntry {
  return {
    ...tuesdayBakeList().deltas[0],
    id,
    qty,
    ...extra,
  }
}

/** Dienstag mit den gegebenen Nachträgen; `lineDelta` an der Doppel-Zeile. */
function list(
  deltas: BackzettelDeltaEntry[],
  lineDelta: Record<string, number> | null
): Pick<BakeList, 'deltas' | 'sections'> {
  const base = tuesdayBakeList()
  return {
    deltas,
    sections: base.sections.map((s) => ({
      ...s,
      lines: s.lines.map((l) =>
        l.key === KEY
          ? {
              ...l,
              delta: lineDelta
                ? ({ open: 0, count: deltas.length, ...lineDelta } as never)
                : null,
            }
          : l
      ),
    })),
  }
}

describe('bakeDeltaGroups (Z10 O5)', () => {
  it('offen: große Zahl = was der Server aufgerundet zu backen sagt', () => {
    const [g] = bakeDeltaGroups(list([delta(31, 2.5)], { qty: 2.5, bake: 3 }))
    expect(g).toMatchObject({
      key: KEY,
      state: 'open',
      qty: 2.5,
      figure: 3,
      bakedFigure: null,
      tickable: true,
      toggleIds: [31],
      toggleTo: true,
      bakedAt: null,
    })
  })

  it('gebacken: Tippen nimmt alle zurück, Name und Zeit des letzten Hakens', () => {
    const by = { id: 2, displayName: 'Test Backstube' }
    const [g] = bakeDeltaGroups(
      list(
        [
          delta(31, 3, { bakedAt: '2026-12-01T04:00:00.000Z', bakedBy: by }),
          delta(32, 1, { bakedAt: '2026-12-01T04:30:00.000Z', bakedBy: by }),
        ],
        { qty: 4, bake: 4 }
      )
    )
    expect(g).toMatchObject({
      state: 'baked',
      figure: 4,
      tickable: true,
      toggleIds: [31, 32],
      toggleTo: false,
      bakedAt: '2026-12-01T04:30:00.000Z',
      bakedBy: by,
    })
  })

  it('teils: ein später gekommener Nachtrag ist offen - nur er wird abgehakt', () => {
    const [g] = bakeDeltaGroups(
      list(
        [delta(31, 3, { bakedAt: '2026-12-01T04:00:00.000Z' }), delta(32, 2)],
        { qty: 5, bake: 5, bakedQty: 3, bakeUnbaked: 2 }
      )
    )
    expect(g).toMatchObject({
      state: 'partial',
      figure: 2,
      bakedFigure: 3,
      toggleIds: [32],
      toggleTo: true,
    })
  })

  it('ohne passende Zeilenzahlen (ältere Server, Nachtrag ohne Zeile): die Summe', () => {
    const groups = bakeDeltaGroups(
      list(
        [
          delta(31, 3, { bakedAt: '2026-12-01T04:00:00.000Z' }),
          delta(32, 2),
          delta(40, 4, {
            key: 'test-neu|',
            itemId: 'test-neu',
            name: 'Testneu',
            doughDate: V2_TUE,
          }),
        ],
        // Zeile meint andere Nachträge (Summe 9): nicht übernehmen.
        { qty: 9, bake: 9, bakedQty: 3, bakeUnbaked: 6 }
      )
    )
    expect(groups.map((g) => [g.key, g.state, g.figure])).toEqual([
      [KEY, 'partial', 2],
      ['test-neu|', 'open', 4],
    ])
  })

  it('nichts zusätzlich zu backen (abbestellt): kein Haken', () => {
    const [g] = bakeDeltaGroups(
      list([delta(31, -3, { kind: 'cancelled' })], { qty: -3, bake: -3 })
    )
    expect(g).toMatchObject({ state: 'open', figure: -3, tickable: false })
    const [zero] = bakeDeltaGroups(
      list([delta(31, 2), delta(32, -2)], { qty: 0, bake: 0 })
    )
    expect(zero).toMatchObject({ figure: 0, tickable: false })
  })

  it('keine Nachträge: keine Gruppen; Teigtag bleibt am Nachtrag', () => {
    expect(bakeDeltaGroups(list([], null))).toEqual([])
    const [g] = bakeDeltaGroups(list([delta(31, 3)], null))
    expect(g.first.doughDate).toBe(SAT)
    expect(g.figure).toBe(3)
  })
})
