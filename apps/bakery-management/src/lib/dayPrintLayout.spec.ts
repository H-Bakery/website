import {
  DAY_PRINT_STEPS,
  PAGE_HEIGHT_MM,
  bakeListPrintLayout,
  dayPrintHeights,
  dayPrintLayout,
  dayPrintParts,
  NOTE_LINES,
} from './dayPrintLayout'
import type { BackzettelDay, BackzettelLine } from './backzettelApi'
import {
  SAT,
  line,
  saturdayDraft,
  saturdayV2Confirmed,
  saturdayV2Draft,
  sundayBakeList,
  tuesdayBakeList,
} from './backzettelFixtures'

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
    expect(layout.step).toBe(DAY_PRINT_STEPS.length - 1)
    expect(layout.othersOnSecondSheet).toBe(true)
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
