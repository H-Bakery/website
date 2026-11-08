import {
  DAY_PRINT_STEPS,
  KEEP_SECTION_LINES,
  MIN_SPLIT_LINES,
  PAGE_HEIGHT_MM,
  bakeListPrintLayout,
  dayPrintHeights,
  dayPrintLayout,
  dayPrintParts,
  dayPrintSecondSheetHeight,
  NOTE_LINES,
  printColumnRows,
  printColumns,
} from './dayPrintLayout'
import type {
  BackzettelDay,
  BackzettelLine,
  BackzettelSection,
} from './backzettelApi'
import {
  SAT,
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

const lineCount = (day: BackzettelDay) =>
  day.sections.reduce((n, s) => n + s.lines.length, 0)

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

function section(id: string, n: number, from = 0): BackzettelSection {
  return {
    id,
    label: id,
    lines: Array.from({ length: n }, (_, i) =>
      line({
        key: `${id}-${from + i}|`,
        itemId: `${id}-${from + i}`,
        name: `Test ${id} ${from + i}`,
        section: id,
      })
    ),
  }
}

/** Ein voller Samstag: n erfundene Zeilen in drei übrigen Abschnitten. */
function busySaturday(extraLines: number): BackzettelDay {
  const day = saturdayV2Draft()
  const ids = ['laugen', 'kaffeestueckchen', 'kuchen']
  const sections = ids.map((id) => ({
    id,
    label: id,
    lines: [] as BackzettelLine[],
  }))
  for (let i = 0; i < extraLines; i++) {
    sections[i % 3].lines.push(
      line({
        key: `test-extra-${i}|`,
        itemId: `test-extra-${i}`,
        name: `Testposten ${i}`,
        section: ids[i % 3],
        total: 10 + i,
        preorders: i % 4 === 0 ? 2 : 0,
        bakeDate: SAT,
        doughDate: SAT,
      })
    )
  }
  return {
    ...day,
    sections: [
      ...day.sections.filter((s) => s.id !== 'kaffeestueckchen'),
      ...sections,
    ],
  }
}

describe('dayPrintParts (Z10 S6)', () => {
  it('teilt den Samstag auf: Hefeteig je Posten, übrige Abschnitte ohne Brot und Brötchen', () => {
    const parts = dayPrintParts(saturdayV2Draft())
    expect(parts.hefeteig.map((r) => r.itemId)).toEqual([
      'test-zopf',
      'test-kranz',
    ])
    // Sorten eines gefüllten Postens stehen zusammen in einer Zeile.
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

describe('dayPrintLayout (Z10 S6)', () => {
  it('der Beispiel-Samstag passt luftig auf eine Seite', () => {
    const layout = dayPrintLayout(saturdayV2Draft())
    expect(layout).toMatchObject({ step: 0, othersOnSecondSheet: false })
    expect(layout.estimatedMm).toBeLessThanOrEqual(PAGE_HEIGHT_MM)
  })

  it('jede Stufe ist dichter als die vorige', () => {
    const day = busySaturday(40)
    const parts = dayPrintParts(day)
    const heights = DAY_PRINT_STEPS.map((s) => {
      const h = dayPrintHeights(day, parts, s)
      return h.fixed + h.others
    })
    for (let i = 1; i < heights.length; i++) {
      expect(heights[i]).toBeLessThan(heights[i - 1])
    }
  })

  it('ein voller Samstag (≈ 60 Zeilen mit Nachträgen) wird dichter gesetzt, bleibt aber auf einer Seite', () => {
    const confirmed = saturdayV2Confirmed()
    const day = { ...busySaturday(45), deltas: confirmed.deltas }
    const layout = dayPrintLayout(day)
    expect(layout.step).toBeGreaterThan(0)
    expect(layout.othersOnSecondSheet).toBe(false)
    expect(layout.estimatedMm).toBeLessThanOrEqual(PAGE_HEIGHT_MM)
  })

  it('vor Blatt 2 werden erst die Notizzeilen gekürzt', () => {
    // Die Zahl der Zeilen suchen, bei der es mit allen Notizzeilen gerade
    // nicht mehr passt - dort darf es noch kein Blatt 2 geben.
    let n = 40
    while (
      dayPrintLayout(busySaturday(n)).noteLines === NOTE_LINES &&
      !dayPrintLayout(busySaturday(n)).othersOnSecondSheet
    ) {
      n += 1
    }
    const layout = dayPrintLayout(busySaturday(n))
    expect(layout.othersOnSecondSheet).toBe(false)
    expect(layout.noteLines).toBeLessThan(NOTE_LINES)
    expect(layout.step).toBe(DAY_PRINT_STEPS.length - 1)
    expect(layout.estimatedMm).toBeLessThanOrEqual(PAGE_HEIGHT_MM)
    // Normale Tage behalten alle Notizzeilen.
    expect(dayPrintLayout(saturdayV2Draft()).noteLines).toBe(NOTE_LINES)
  })

  it('passt es auch knapp nicht, kommen die übrigen Abschnitte auf Blatt 2 - nie weggelassen', () => {
    const layout = dayPrintLayout(busySaturday(200))
    expect(layout.othersOnSecondSheet).toBe(true)
    // Seite 1 ohne die Abschnitte passt wieder luftig, mit allen Notizzeilen.
    expect(layout.step).toBe(0)
    expect(layout.noteLines).toBe(NOTE_LINES)
    expect(layout.estimatedMm).toBeLessThanOrEqual(PAGE_HEIGHT_MM)
  })

  it('ohne Blatt 2 gibt es keine eigene Dichte für Blatt 2', () => {
    expect(dayPrintLayout(saturdayV2Draft()).secondSheet).toBeNull()
  })

  // Review Z10: Blatt 2 erbte die luftige Stufe von Seite 1 und lief bei
  // 75-100 Zeilen übriger Abschnitte auf ein drittes Blatt, obwohl es knapp
  // gesetzt auf eines passte.
  const withExtra = (
    day: BackzettelDay,
    extra: BackzettelSection
  ): BackzettelDay => ({ ...day, sections: [...day.sections, extra] })
  const secondSheetDays: [string, () => BackzettelDay][] = [
    [
      'voller Samstag freigegeben + 60 Laugen',
      () =>
        withExtra(busySaturdayV2Confirmed(), section('test-laugen-viele', 60)),
    ],
    [
      'voller Samstag Entwurf + 70 Zeilen',
      () => withExtra(busySaturdayV2Draft(), section('test-viele', 70)),
    ],
    [
      'voller Samstag Entwurf + 100 Zeilen',
      () => withExtra(busySaturdayV2Draft(), section('test-viele', 100)),
    ],
  ]
  it.each(secondSheetDays)(
    '%s: Blatt 2 wählt seine Stufe nach der eigenen Höhe und bleibt ein Blatt',
    (_name, make) => {
      const day = make()
      const parts = dayPrintParts(day)
      const layout = dayPrintLayout(day)
      expect(layout.othersOnSecondSheet).toBe(true)
      const second = layout.secondSheet
      expect(second).not.toBeNull()
      if (!second) return
      expect(second.estimatedMm).toBeLessThanOrEqual(PAGE_HEIGHT_MM)
      expect(second.estimatedMm).toBe(
        Math.round(
          dayPrintSecondSheetHeight(day, parts, DAY_PRINT_STEPS[second.step])
        )
      )
      // Die luftigste passende Stufe: eine Stufe luftiger passt nicht mehr.
      if (second.step > 0) {
        expect(
          dayPrintSecondSheetHeight(
            day,
            parts,
            DAY_PRINT_STEPS[second.step - 1]
          )
        ).toBeGreaterThan(PAGE_HEIGHT_MM)
      }
    }
  )

  it('in der Stufe von Seite 1 liefe Blatt 2 über - es wird dichter gesetzt als Seite 1', () => {
    const day = withExtra(busySaturdayV2Draft(), section('test-viele', 100))
    const parts = dayPrintParts(day)
    const layout = dayPrintLayout(day)
    expect(
      dayPrintSecondSheetHeight(day, parts, DAY_PRINT_STEPS[layout.step])
    ).toBeGreaterThan(PAGE_HEIGHT_MM)
    expect(layout.secondSheet?.step).toBeGreaterThan(layout.step)
    expect(layout.secondSheet?.estimatedMm).toBeLessThanOrEqual(PAGE_HEIGHT_MM)
  })

  it('Blatt 2 bleibt ein Blatt, solange es in der dichtesten Stufe passt', () => {
    const densest = DAY_PRINT_STEPS[DAY_PRINT_STEPS.length - 1]
    for (let n = 30; n <= 160; n += 5) {
      const day = withExtra(busySaturdayV2Draft(), section('test-viele', n))
      const layout = dayPrintLayout(day)
      if (!layout.secondSheet) continue
      const fitsDensest =
        dayPrintSecondSheetHeight(day, dayPrintParts(day), densest) <=
        PAGE_HEIGHT_MM
      if (fitsDensest) {
        expect(layout.secondSheet.estimatedMm).toBeLessThanOrEqual(
          PAGE_HEIGHT_MM
        )
      } else {
        expect(layout.secondSheet.step).toBe(DAY_PRINT_STEPS.length - 1)
      }
    }
  })

  it('ohne übrige Abschnitte gibt es kein Blatt 2, auch wenn es eng wird', () => {
    const day = saturdayV2Draft()
    const huge = {
      ...day,
      sections: day.sections.filter((s) => s.id !== 'kaffeestueckchen'),
      warnings: Array.from({ length: 200 }, (_, i) => ({
        code: 'base_unset',
        message: `Grundmenge für Samstag noch nicht festgelegt: Testposten ${i}.`,
      })),
    }
    expect(dayPrintLayout(huge).othersOnSecondSheet).toBe(false)
  })
})

describe('der volle Samstag (≈ 60 Zeilen) auf einer Seite (Z10, §9 Nr. 3)', () => {
  it('ist der größte Teigtag-Zettel der Specs', () => {
    const counts = V2_DAYS.map(([, make]) => lineCount(make()))
    expect(lineCount(busySaturdayV2Draft())).toBe(Math.max(...counts))
    expect(lineCount(busySaturdayV2Draft())).toBeGreaterThanOrEqual(56)
    expect(busySaturdayV2Confirmed().deltas).toHaveLength(6)
  })

  it.each(V2_DAYS)('%s passt auf ein Blatt, ohne Blatt 2', (_name, make) => {
    const layout = dayPrintLayout(make())
    expect(layout.othersOnSecondSheet).toBe(false)
    expect(layout.estimatedMm).toBeLessThanOrEqual(PAGE_HEIGHT_MM)
  })

  it('der volle Samstag behält mindestens zwei Notizzeilen', () => {
    expect(
      dayPrintLayout(busySaturdayV2Draft()).noteLines
    ).toBeGreaterThanOrEqual(2)
    expect(
      dayPrintLayout(busySaturdayV2Confirmed()).noteLines
    ).toBeGreaterThanOrEqual(2)
  })
})

describe('printColumns: zwei Spalten, keine Überschrift ohne Zeilen (Z10)', () => {
  it('kurze Abschnitte bleiben ganz, die Spalten sind etwa gleich hoch', () => {
    const [left, right] = printColumns([
      section('laugen', 3),
      section('kaffee', 6),
      section('kuchen', 4),
    ])
    expect(left.map((c) => c.section.id)).toEqual(['laugen', 'kaffee'])
    expect(right.map((c) => c.section.id)).toEqual(['kuchen'])
    expect([...left, ...right].some((c) => c.continued)).toBe(false)
  })

  it('ein langer Abschnitt bricht um: rechts „Forts.“, mindestens drei Zeilen je Seite', () => {
    const long = section('kaffee', 14)
    const [left, right] = printColumns([section('laugen', 2), long])
    const first = left[left.length - 1]
    const rest = right[0]
    expect(first.section.id).toBe('kaffee')
    expect(first.continued).toBe(false)
    expect(rest).toMatchObject({ continued: true })
    expect(rest.section.id).toBe('kaffee')
    expect(first.lines.length).toBeGreaterThanOrEqual(MIN_SPLIT_LINES)
    expect(rest.lines.length).toBeGreaterThanOrEqual(MIN_SPLIT_LINES)
    // nichts verloren, Reihenfolge bleibt
    expect([...first.lines, ...rest.lines].map((l) => l.key)).toEqual(
      long.lines.map((l) => l.key)
    )
    const h = [printColumnRows(left), printColumnRows(right)]
    expect(Math.abs(h[0] - h[1])).toBeLessThanOrEqual(2)
  })

  it(`bis ${KEEP_SECTION_LINES} Zeilen bricht kein Abschnitt um, auch wenn es schief wird`, () => {
    const [left, right] = printColumns([section('kaffee', KEEP_SECTION_LINES)])
    expect(left).toHaveLength(1)
    expect(left[0].lines).toHaveLength(KEEP_SECTION_LINES)
    expect(right).toEqual([])
  })

  it('jede Zeile steht genau einmal, jede Spalte beginnt mit einer Überschrift', () => {
    const sections = [
      section('a', 9),
      section('b', 2),
      section('c', 12),
      section('d', 1),
    ]
    const cols = printColumns(sections)
    const keys = cols.flat().flatMap((c) => c.lines.map((l) => l.key))
    expect(keys).toEqual(sections.flatMap((s) => s.lines.map((l) => l.key)))
    for (const col of cols)
      for (const c of col) expect(c.lines.length).toBeGreaterThan(0)
    expect(cols.flat().filter((c) => c.continued).length).toBeLessThanOrEqual(1)
  })

  it('der volle Samstag: Kaffeestückchen (9 Zeilen) brechen mit „Forts.“ um oder bleiben ganz', () => {
    const parts = dayPrintParts(busySaturdayV2Draft())
    expect(parts.others.map((s) => s.id)).toEqual([
      'laugen',
      'kaffeestueckchen',
      'kuchen',
    ])
    const cols = printColumns(parts.others)
    for (const c of cols.flat()) {
      if (c.continued)
        expect(c.lines.length).toBeGreaterThanOrEqual(MIN_SPLIT_LINES)
    }
    expect(cols.flat().reduce((n, c) => n + c.lines.length, 0)).toBe(16)
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
