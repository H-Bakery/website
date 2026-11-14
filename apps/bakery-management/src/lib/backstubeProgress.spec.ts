import {
  BAKE_DELTAS_ANCHOR,
  HEFETEIG_ANCHOR,
  bakeDayHeading,
  bakeProgress,
  focusStartIndex,
  isLineBaked,
  isLineDone,
  nextOpenIndex,
  openDeltaCount,
  sectionAnchor,
  sheetProgress,
  splitDone,
} from './backstubeProgress'
import {
  SAT,
  SUN,
  TUE,
  V2_TUE,
  saturdayConfirmed,
  saturdayDraft,
  saturdayV2Confirmed,
  tuesdayBakeList,
} from './backzettelFixtures'
import type { BackzettelDay, BakeList } from './backzettelApi'

function tick(day: BackzettelDay, key: string, doneAt: string): BackzettelDay {
  return {
    ...day,
    sections: day.sections.map((s) => ({
      ...s,
      lines: s.lines.map((l) => (l.key === key ? { ...l, doneAt } : l)),
    })),
  }
}

describe('sheetProgress (Überblick des Zettels)', () => {
  it('zählt erledigte Zeilen je Abschnitt in der Reihenfolge der Seite', () => {
    const day = tick(saturdayConfirmed(), 'test-weck|', '2026-11-28T02:10:00Z')
    const p = sheetProgress(day)
    expect(p).toMatchObject({ done: 1, total: 4 })
    // Samstag: die Hefeteig-Karte zuerst, wie auf der Seite.
    expect(p.entries.map((e) => e.anchor)).toEqual([
      HEFETEIG_ANCHOR,
      sectionAnchor('brot'),
      sectionAnchor('broetchen'),
      sectionAnchor('hefeteig'),
    ])
    expect(p.entries[0]).toMatchObject({ total: 0, done: 0 })
    expect(p.entries.find((e) => e.label === 'Brötchen')).toMatchObject({
      done: 1,
      total: 1,
      group: null,
    })
  })

  it('an anderen Tagen steht die Hefeteig-Karte zuletzt', () => {
    const p = sheetProgress(
      saturdayConfirmed({ date: TUE, weekday: 2, weekdayName: 'Dienstag' })
    )
    expect(p.entries[p.entries.length - 1].anchor).toBe(HEFETEIG_ANCHOR)
  })

  it('ohne Teig, Füllung und Nachtrags-Zusatz keine Hefeteig-Karte', () => {
    const p = sheetProgress(
      saturdayConfirmed({ hefeteig: null, fillings: null, deltaExtras: null })
    )
    expect(p.entries.map((e) => e.anchor)).not.toContain(HEFETEIG_ANCHOR)
  })

  it('ein Nachtrag nach dem Haken öffnet die Zeile wieder (UI-Runde 1)', () => {
    const day = tick(
      saturdayConfirmed(),
      'test-zopf|nuss',
      // vor dem offenen Nachtrag (15:00) abgehakt
      '2026-11-27T14:00:00.000Z'
    )
    const zopf = day.sections
      .flatMap((s) => s.lines)
      .find((l) => l.key === 'test-zopf|nuss')
    expect(zopf?.doneAt).toBeTruthy()
    expect(zopf && isLineDone(zopf, day.deltas)).toBe(false)
    expect(sheetProgress(day).done).toBe(0)
  })

  it('Entwurf: dieselben Abschnitte, nichts erledigt', () => {
    const p = sheetProgress(saturdayDraft())
    expect(p.done).toBe(0)
    expect(p.total).toBe(4)
  })

  it('Teigtag-Zettel: Abschnitte je Backtag mit Gruppen-Überschrift', () => {
    const p = sheetProgress(saturdayV2Confirmed())
    const groups = Array.from(new Set(p.entries.map((e) => e.group)))
    expect(groups).toEqual(
      expect.arrayContaining([
        'Heute backen',
        bakeDayHeading(SUN, SAT),
        bakeDayHeading(V2_TUE, SAT),
      ])
    )
    expect(bakeDayHeading(SUN, SAT)).toBe('Teig für Sonntag, 29.11.')
    // Sprungziel = Abschnitt-ID der Seite (`${backtag}-${abschnitt}`).
    expect(
      p.entries.some((e) => e.anchor === sectionAnchor(`${SUN}-broetchen`))
    ).toBe(true)
    expect(p.entries.reduce((n, e) => n + e.total, 0)).toBe(p.total)
  })
})

describe('bakeProgress (Überblick der Backliste)', () => {
  function baked(list: BakeList, key: string): BakeList {
    return {
      ...list,
      sections: list.sections.map((s) => ({
        ...s,
        lines: s.lines.map((l) =>
          l.key === key ? { ...l, bakedAt: '2026-12-01T04:00:00Z' } : l
        ),
      })),
    }
  }

  it('zählt gebackene Zeilen; ein Entwurf zählt nie als gebacken', () => {
    const list = baked(
      baked(tuesdayBakeList(), `test-doppel|@${V2_TUE}`),
      'test-korn|g500'
    )
    const korn = list.sections[0].lines[0]
    expect(korn.sheetStatus).toBe('draft')
    expect(isLineBaked(korn)).toBe(false)
    const p = bakeProgress(list)
    expect(p).toMatchObject({ done: 1, total: 4 })
    expect(p.entries.map((e) => [e.label, e.done, e.total])).toEqual([
      ['Brot', 0, 1],
      ['Brötchen', 1, 3],
      ['Nachträge', 0, 1],
    ])
    expect(p.entries[2].anchor).toBe(BAKE_DELTAS_ANCHOR)
  })

  it('ohne Nachträge kein Eintrag „Nachträge“', () => {
    const p = bakeProgress(tuesdayBakeList({ deltas: [] }))
    expect(p.entries.map((e) => e.label)).toEqual(['Brot', 'Brötchen'])
  })
})

describe('Erledigte zuklappen und Bäcker-Ansicht (UI-Runde 2)', () => {
  const entry = (label: string, done: number, total: number) => ({
    anchor: `bs-anchor-${label}`,
    label,
    group: null,
    done,
    total,
  })

  it('splitDone: Erledigte zur Seite, gerade Abgehakte bleiben stehen', () => {
    const lines = [
      { k: 'a', done: true },
      { k: 'b', done: false },
      { k: 'c', done: true },
      { k: 'd', done: false },
    ]
    const r = splitDone(
      lines,
      (l) => l.done,
      (l) => l.k === 'c'
    )
    expect(r.shown.map((l) => l.k)).toEqual(['b', 'c', 'd'])
    expect(r.hidden.map((l) => l.k)).toEqual(['a'])
  })

  it('Bäcker-Ansicht beginnt beim ersten offenen Abschnitt', () => {
    expect(focusStartIndex([])).toBe(-1)
    expect(
      focusStartIndex([
        entry('Hefeteig & Füllungen', 0, 0),
        entry('Brot', 3, 3),
        entry('Brötchen', 1, 4),
      ])
    ).toBe(2)
    // Alles erledigt: der erste Abschnitt.
    expect(focusStartIndex([entry('Brot', 3, 3), entry('Kuchen', 1, 1)])).toBe(
      0
    )
  })

  it('nächster offener Abschnitt ringsum, sonst -1', () => {
    const entries = [
      entry('Brot', 1, 3),
      entry('Brötchen', 2, 2),
      entry('Kuchen', 0, 1),
    ]
    expect(nextOpenIndex(entries, 0)).toBe(2)
    expect(nextOpenIndex(entries, 2)).toBe(0)
    expect(nextOpenIndex([entry('Brot', 1, 3)], 0)).toBe(-1)
  })

  it('openDeltaCount zählt nur nicht quittierte Nachträge', () => {
    const deltas = tuesdayBakeList().deltas
    expect(openDeltaCount(deltas)).toBe(
      deltas.filter((d) => !d.acknowledgedAt).length
    )
    expect(
      openDeltaCount(
        deltas.map((d) => ({ ...d, acknowledgedAt: '2026-12-01T03:00:00Z' }))
      )
    ).toBe(0)
  })
})
