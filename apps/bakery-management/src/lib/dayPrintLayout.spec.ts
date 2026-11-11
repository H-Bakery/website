import {
  MIN_SPLIT_LINES,
  NOTE_LINES,
  PAGE_HEIGHT_MM,
  SHEET_STEPS,
  bakeListPrintLayout,
  blockHeightMm,
  boxBakeDaysText,
  dayPrintLayout,
  dayPrintParts,
  doughPrintBlocks,
  firstHeaderMm,
  nextHeaderMm,
  packSheets,
  printBreadNote,
  sheetBlocks,
  sheetDayTypeText,
  type SheetBlock,
} from './dayPrintLayout'
import type {
  BackzettelDay,
  BackzettelLine,
  BackzettelSection,
} from './backzettelApi'
import {
  SAT,
  SUN,
  V2_TUE,
  busySaturdayV2Confirmed,
  busySaturdayV2Draft,
  line,
  saturdayDraft,
  saturdayV2Confirmed,
  saturdayV2Draft,
  sundayBakeList,
  sundayV2Sheet,
  tuesdayBakeList,
} from './backzettelFixtures'

/** Alle Teigtag-Zettel der Specs (Z10). */
const V2_DAYS: [string, () => BackzettelDay][] = [
  ['Samstag Entwurf', () => saturdayV2Draft()],
  ['Samstag freigegeben', () => saturdayV2Confirmed()],
  ['voller Samstag Entwurf', () => busySaturdayV2Draft()],
  [
    'voller Samstag freigegeben mit Nachträgen',
    () => busySaturdayV2Confirmed(),
  ],
  ['Sonntag', () => sundayV2Sheet()],
]

function section(id: string, n: number): BackzettelSection {
  return {
    id,
    label: id,
    lines: Array.from({ length: n }, (_, i) =>
      line({
        key: `${id}-${i}|`,
        itemId: `${id}-${i}`,
        name: `Test ${id} ${i}`,
        section: id,
        bakeDate: SAT,
        doughDate: SAT,
      })
    ),
  }
}

const withExtra = (
  day: BackzettelDay,
  extra: BackzettelSection
): BackzettelDay => ({ ...day, sections: [...day.sections, extra] })

/** Schlüssel aller Zeilen, die auf den Blättern stehen (übrige Abschnitte). */
function sectionKeys(blocks: SheetBlock[]): string[] {
  return blocks.flatMap((b) =>
    b.kind === 'section' ? b.lines.map((l: BackzettelLine) => l.key) : []
  )
}

describe('dayPrintParts (Z10 S6)', () => {
  it('teilt den Samstag auf: Hefeteig je Posten, übrige Abschnitte ohne Brot und Brötchen', () => {
    const parts = dayPrintParts(saturdayV2Draft())
    expect(parts.hefeteig.map((r) => r.itemId)).toEqual([
      'test-zopf',
      'test-kranz',
    ])
    // Sorten eines gefüllten Postens stehen zusammen.
    expect(parts.hefeteig[0].lines.map((l) => l.variant)).toEqual([
      'nuss',
      'mohn',
    ])
    expect(parts.others.map((s) => s.id)).toEqual(['kaffeestueckchen'])
    expect(parts.others[0].lines.map((l) => l.itemId)).toEqual(['test-plunder'])
  })

  it('sammelt offene Stammdaten und fehlende Teile einmal, ohne Schlusspunkt', () => {
    const parts = dayPrintParts(saturdayV2Draft())
    expect(parts.open).toContain(
      'Teig „Testflit“: kg je Liter ist noch offen – der Zettel zeigt nur kg'
    )
    expect(
      parts.open.filter((o) => o.includes('Bruchgewicht für Dienstag'))
    ).toHaveLength(1)
    expect(parts.open.some((o) => o.includes('Teigstücke je Produkt'))).toBe(
      true
    )
    expect(parts.hints).toEqual([
      'Grundmenge für Samstag noch nicht festgelegt: Testkorn (Kasten)',
    ])
  })

  it('ein alter Tag ohne Brot/Brötchen-Ansicht: alle Abschnitte außer Hefeteig sind „übrige“', () => {
    const parts = dayPrintParts(saturdayDraft())
    expect(parts.others.length).toBeGreaterThan(0)
    expect(parts.others.some((s) => s.id === 'hefeteig')).toBe(false)
    expect(parts.open).toEqual([])
  })
})

describe('Tagestyp und Backtage im Kopf (U8)', () => {
  it('nennt, was heute gebacken und für welche Tage Teig gemacht wird', () => {
    expect(sheetDayTypeText(saturdayV2Draft())).toBe(
      'Heute backen + Teig für So 29.11. und Di 01.12.'
    )
    expect(sheetDayTypeText(sundayV2Sheet())).toBe(
      'Backtag ohne Teig – was gebacken wird, steht auf der Backliste'
    )
    // nur Teig, nichts für heute (z. B. Teigtag vor einem Schließtag)
    const onlyLater = saturdayV2Draft({
      bakeDates: saturdayV2Draft().bakeDates?.filter((b) => b.date !== SAT),
    })
    expect(sheetDayTypeText(onlyLater)).toBe(
      'Nur Teig für So 29.11. und Di 01.12.'
    )
    // ohne Teig für später
    const today = saturdayV2Draft({
      bakeDates: saturdayV2Draft().bakeDates?.filter((b) => b.date === SAT),
    })
    expect(sheetDayTypeText(today)).toBe('Heute backen')
  })

  it('ohne `bakeDates` (ältere Server) aus den Backtagen der Zeilen', () => {
    expect(sheetDayTypeText(saturdayV2Draft({ bakeDates: undefined }))).toBe(
      'Heute backen + Teig für So 29.11. und Di 01.12.'
    )
  })

  it('Backtage je Teig kurz: „heute + So + Di“', () => {
    const day = busySaturdayV2Draft()
    const box = (id: string) => day.machine!.find((b) => b.id === id)!
    expect(boxBakeDaysText(day, box('test-weck-teig'))).toBe('heute + So + Di')
    expect(boxBakeDaysText(day, box('test-korn-teig'))).toBe('heute')
    expect(boxBakeDaysText(day, box('test-dinkelweck-teig'))).toBe('So')
    expect(
      boxBakeDaysText({ date: SAT, doughs: [] }, box('test-weck-teig'))
    ).toBe('')
  })
})

describe('doughPrintBlocks: je Teig ein Block (U8)', () => {
  it('Reihenfolge der Kästen vom Server (= `doughs:` der YAML), Sammelblöcke dahinter', () => {
    const blocks = doughPrintBlocks(busySaturdayV2Draft())
    expect(blocks.map((b) => b.key)).toEqual([
      'test-korn-teig',
      'test-misch-teig',
      'test-roggen-teig',
      'weiteres-brot',
      'test-weck-teig',
      'test-flit-teig',
      'test-dinkelweck-teig',
      'test-hefe',
    ])
  })

  it('ordnet Brot über den Teig der Zeile zu, auch bei gemeinsamem Teig', () => {
    const [korn] = doughPrintBlocks(busySaturdayV2Draft())
    expect(korn.bread.map((r) => r.itemId)).toEqual(['test-korn', 'test-holz'])
    const weiteres = doughPrintBlocks(busySaturdayV2Draft()).find(
      (b) => b.key === 'weiteres-brot'
    )
    expect(weiteres?.box).toBeNull()
    expect(weiteres?.bread.map((r) => r.itemId)).toEqual(['test-hafer'])
  })

  it('Brötchen je Backtag chronologisch, Einzelstücke über die Teile der Teige', () => {
    const weck = doughPrintBlocks(busySaturdayV2Draft()).find(
      (b) => b.key === 'test-weck-teig'
    )!
    expect(weck.rolls.map((r) => r.bakeDate)).toEqual([SAT, SUN, V2_TUE])
    expect(weck.rolls[0].singles.map((s) => s.itemId)).toEqual([
      'test-weck-hell',
      'test-stange',
    ])
    expect(weck.rolls[1].groups.map((g) => g.group)).toEqual([
      'test-doppel',
      'test-gemischt',
      'test-kornweck',
    ])
  })

  it('Brot aus einem anderen Teig (`from_dough`, ohne eigenen Teig) kommt über seinen Teil in den Block', () => {
    const day = saturdayV2Draft()
    const bread = day.bread!
    const doughs = day.doughs!.map((d) =>
      d.id === 'test-weck-teig'
        ? {
            ...d,
            parts: [
              ...d.parts,
              {
                kind: 'from_dough',
                itemId: 'test-hafer',
                name: 'Testhafer',
                bakeDate: SAT,
                kg: null,
              },
            ],
          }
        : d
    )
    const blocks = doughPrintBlocks({ ...day, bread, doughs })
    expect(
      blocks.find((b) => b.key === 'test-weck-teig')?.bread.map((r) => r.itemId)
    ).toEqual(['test-hafer'])
    expect(blocks.some((b) => b.key === 'weiteres-brot')).toBe(false)
  })

  it('jede Brot-Zeile, Bruch-Gruppe, Einzelstück und jeder Hefeteig-Posten steht in genau einem Block', () => {
    for (const [, make] of V2_DAYS) {
      const day = make()
      const blocks = doughPrintBlocks(day)
      const bread = blocks.flatMap((b) => b.bread)
      expect(bread).toHaveLength(day.bread?.rows.length ?? 0)
      const groups = blocks.flatMap((b) => b.rolls.flatMap((r) => r.groups))
      const singles = blocks.flatMap((b) => b.rolls.flatMap((r) => r.singles))
      const rolls = day.rolls ?? []
      expect(groups).toHaveLength(rolls.flatMap((r) => r.groups).length)
      expect(singles).toHaveLength(rolls.flatMap((r) => r.singles).length)
      expect(blocks.flatMap((b) => b.hefeteig)).toHaveLength(
        dayPrintParts(day).hefeteig.length
      )
    }
  })
})

describe('printBreadNote: gemeinsamer Teig im Block nur einmal (U8)', () => {
  it('im Kasten-Block ohne „Gemeinsamer Teig“, sonst unverändert', () => {
    const note = 'Kasten zuerst · Gemeinsamer Teig: Korn + Holz'
    expect(printBreadNote(note, true)).toBe('Kasten zuerst')
    expect(printBreadNote('Gemeinsamer Teig: Korn + Holz', true)).toBeNull()
    expect(printBreadNote(note, false)).toBe(note)
    expect(printBreadNote(null, true)).toBeNull()
  })
})

describe('dayPrintLayout: Blätter (U8)', () => {
  it('lesbar: nie unter 9 pt, Mengen mindestens 13 pt', () => {
    for (const s of SHEET_STEPS) {
      expect(s.fontPt).toBeGreaterThanOrEqual(9)
      expect(s.qtyPt).toBeGreaterThanOrEqual(13)
      expect(s.bigPt).toBeGreaterThan(s.qtyPt)
    }
  })

  it('jede Stufe ist dichter als die vorige', () => {
    const day = busySaturdayV2Draft()
    const parts = dayPrintParts(day)
    const blocks = sheetBlocks(day, parts)
    const total = SHEET_STEPS.map((s) =>
      blocks.reduce((n, b) => n + blockHeightMm(b, day, parts, s), 0)
    )
    for (let i = 1; i < total.length; i++) {
      expect(total[i]).toBeLessThan(total[i - 1])
    }
  })

  it('Liter zuerst: „Teige heute“ ist der erste Block, Fußnoten am Ende', () => {
    const blocks = sheetBlocks(busySaturdayV2Confirmed())
    expect(blocks[0].kind).toBe('doughs')
    expect(blocks.map((b) => b.kind).slice(-2)).toEqual(['deltas', 'footnotes'])
  })

  it.each(V2_DAYS)(
    '%s: jedes Blatt passt, jeder Block steht genau einmal',
    (_n, make) => {
      const day = make()
      const layout = dayPrintLayout(day)
      expect(layout.sheets.length).toBeGreaterThanOrEqual(1)
      for (const sheet of layout.sheets) {
        expect(sheet.estimatedMm).toBeLessThanOrEqual(PAGE_HEIGHT_MM)
        expect(sheet.blocks.length).toBeGreaterThan(0)
      }
      const keys = layout.sheets.flatMap((s) => s.blocks.map((b) => b.key))
      expect(keys).toEqual(sheetBlocks(day).map((b) => b.key))
      expect(layout.noteLines).toBeGreaterThanOrEqual(0)
      expect(layout.noteLines).toBeLessThanOrEqual(NOTE_LINES)
    }
  )

  it('so wenige Blätter wie möglich, bei gleicher Zahl die luftigste Stufe', () => {
    for (const [, make] of V2_DAYS) {
      const day = make()
      const parts = dayPrintParts(day)
      const blocks = sheetBlocks(day, parts)
      const counts = SHEET_STEPS.map(
        (s) => packSheets(day, parts, blocks, s).sheets.length
      )
      const layout = dayPrintLayout(day)
      expect(layout.sheets.length).toBe(Math.min(...counts))
      expect(layout.step).toBe(counts.indexOf(Math.min(...counts)))
    }
  })

  it('Sonntag: ein Blatt, luftig, alle Notizzeilen; der kleine Samstag höchstens zwei Blätter', () => {
    for (const day of [sundayV2Sheet()]) {
      const layout = dayPrintLayout(day)
      expect(layout.sheets).toHaveLength(1)
      expect(layout.step).toBe(0)
      expect(layout.noteLines).toBe(NOTE_LINES)
    }
    expect(dayPrintLayout(saturdayV2Draft()).sheets.length).toBeLessThanOrEqual(
      2
    )
  })

  it('der volle Samstag (≈ 60 Zeilen) geht auf höchstens drei Blätter, Grenzen nur zwischen Blöcken', () => {
    for (const day of [busySaturdayV2Draft(), busySaturdayV2Confirmed()]) {
      const layout = dayPrintLayout(day)
      expect(layout.sheets.length).toBeGreaterThanOrEqual(2)
      expect(layout.sheets.length).toBeLessThanOrEqual(3)
      // das erste Blatt beginnt mit den Litern
      expect(layout.sheets[0].blocks[0].kind).toBe('doughs')
    }
  })

  it('Blatt-Köpfe: Blatt 1 groß, ab Blatt 2 eine Zeile', () => {
    for (const s of SHEET_STEPS) {
      expect(firstHeaderMm(s)).toBeGreaterThan(nextHeaderMm(s))
    }
  })

  it('ein Abschnitt höher als ein Blatt wird geteilt: jedes Stück mit Überschrift und mindestens drei Zeilen, keine Zeile doppelt', () => {
    const day = withExtra(saturdayV2Draft(), section('test-viele', 150))
    const layout = dayPrintLayout(day)
    const blocks = layout.sheets.flatMap((s) => s.blocks)
    const chunks = blocks.filter(
      (b) => b.kind === 'section' && b.section.id === 'test-viele'
    ) as Extract<SheetBlock, { kind: 'section' }>[]
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    expect(chunks[0].continued).toBe(false)
    for (const c of chunks.slice(1)) expect(c.continued).toBe(true)
    for (const c of chunks) {
      expect(c.lines.length).toBeGreaterThanOrEqual(MIN_SPLIT_LINES)
    }
    const keys = sectionKeys(chunks)
    expect(keys).toHaveLength(150)
    expect(new Set(keys).size).toBe(150)
    for (const sheet of layout.sheets) {
      expect(sheet.estimatedMm).toBeLessThanOrEqual(PAGE_HEIGHT_MM)
    }
  })

  it('ein kleiner Abschnitt, der nicht mehr passt, kommt ganz auf das nächste Blatt', () => {
    const day = withExtra(busySaturdayV2Draft(), section('test-klein', 5))
    const layout = dayPrintLayout(day)
    const chunks = layout.sheets
      .flatMap((s) => s.blocks)
      .filter((b) => b.kind === 'section' && b.section.id === 'test-klein')
    expect(chunks).toHaveLength(1)
  })
})

describe('bakeListPrintLayout (Z10 S6)', () => {
  it('kurze Listen luftig in einer Spalte', () => {
    expect(bakeListPrintLayout(sundayBakeList())).toMatchObject({
      step: 0,
      columns: 1,
    })
    expect(bakeListPrintLayout(tuesdayBakeList()).columns).toBe(1)
  })

  it('sehr lange Listen in zwei Spalten statt auf zwei Blättern', () => {
    const list = tuesdayBakeList()
    const many = Array.from({ length: 120 }, (_, i) =>
      line({ key: `test-x-${i}|`, itemId: `test-x-${i}`, name: `Test ${i}` })
    )
    const layout = bakeListPrintLayout({
      ...list,
      sections: [{ id: 'broetchen', label: 'Brötchen', lines: many }],
    })
    expect(layout.columns).toBe(2)
  })
})
