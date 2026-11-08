import React from 'react'
import { render, within } from '@testing-library/react'
import { DoughDayPrint, printKg, printLiters } from './DoughDayPrint'
import type { BackzettelDay, BackzettelLine } from '../../lib/backzettelApi'
import {
  SAT,
  SUN,
  TEST_CONFIG_V2,
  V2_TUE,
  line,
  saturdayV2Confirmed,
  saturdayV2Draft,
  sundayV2Sheet,
  v2DeltaDough,
} from '../../lib/backzettelFixtures'

function renderPrint(day: BackzettelDay, withExtras = false) {
  return render(
    <DoughDayPrint day={day} config={TEST_CONFIG_V2} withExtras={withExtras} />
  )
}

describe('Druck eines Teigtag-Zettels (Z10 S6)', () => {
  it('Kopf mit Teigen und Stempel: Entwurf bzw. freigegeben', () => {
    const draftPage = renderPrint(saturdayV2Draft())
    const draft = within(draftPage.getByTestId('bz-print'))
    expect(
      draft.getByText('Backzettel Samstag, 28.11.2026')
    ).toBeInTheDocument()
    expect(draft.getByTestId('dd-stamp')).toHaveTextContent(
      'ENTWURF – noch nicht freigegeben'
    )
    expect(
      draft.getByText('Teige heute: Korn + Holz · Testweck für So + Di', {
        exact: false,
      })
    ).toBeInTheDocument()

    draftPage.unmount()
    const confirmed = renderPrint(saturdayV2Confirmed())
    const page = within(confirmed.getByTestId('bz-print'))
    expect(page.getByTestId('dd-stamp')).toHaveTextContent('FREIGEGEBEN')
    expect(page.getByText(/Freigegeben von Test Backstube/)).toBeInTheDocument()
  })

  it('Maschine: Liter groß, unbekannt als „–“ mit Grund - nie geschätzt', () => {
    const p = within(renderPrint(saturdayV2Draft()).getByTestId('dd-machine'))
    expect(p.getByTestId('dd-liters-test-korn-teig')).toHaveTextContent('6 L')
    expect(p.getByTestId('dd-machine-test-korn-teig')).toHaveTextContent(
      '11,4 kg · Chargen –'
    )
    expect(p.getByTestId('dd-machine-test-korn-teig')).toHaveTextContent(
      'Testsauer 20 g'
    )
    expect(p.getByTestId('dd-liters-test-weck-teig')).toHaveTextContent('5,5 L')
    expect(p.getByTestId('dd-machine-test-weck-teig')).toHaveTextContent(
      '1 Charge'
    )
    const flit = p.getByTestId('dd-machine-test-flit-teig')
    expect(p.getByTestId('dd-liters-test-flit-teig')).toHaveTextContent('–')
    expect(flit).toHaveTextContent('≥ 3 kg')
    expect(flit).toHaveTextContent('Liter unbekannt (Teig unvollständig)')
    expect(flit).toHaveClass('incomplete')
    // Hefeteig: „Wasser“ statt „Liter“
    expect(p.getByTestId('dd-machine-test-hefe')).toHaveTextContent('Wasser')
  })

  it('Brot: Größen als Spalten, offene Grundmenge als „offen“, alter Liter-Posten mit Einheit', () => {
    const p = within(renderPrint(saturdayV2Draft()).getByTestId('dd-bread'))
    expect(p.getByTestId('dd-bread-test-korn|g500')).toHaveTextContent('8')
    expect(p.getByTestId('dd-bread-test-korn|g1000')).toHaveTextContent('3')
    expect(p.getByTestId('dd-bread-test-korn|kasten')).toHaveTextContent(
      'offen'
    )
    expect(p.getByTestId('dd-bread-test-hafer|')).toHaveTextContent('1,5 L')
    expect(p.getByText('7,8 kg')).toBeInTheDocument()
    expect(p.getAllByText('Gemeinsamer Teig: Korn + Holz')).toHaveLength(2)
  })

  it('offene Grundmenge mit Vorbestellung druckt „≥ n“ mit „Grundmenge offen“ - nie die nackte Vorbestellzahl (Review Z10 Runde 2)', () => {
    const base = saturdayV2Draft()
    const open = { baseUnset: true, totalIsMinimum: true, base: 0 }
    const day: BackzettelDay = {
      ...base,
      sections: base.sections.map((sec) => ({
        ...sec,
        lines: sec.lines.map((l) =>
          l.key === 'test-korn|kasten'
            ? { ...l, ...open, preorders: 4, total: 4 }
            : l.key === 'test-zopf|mohn'
            ? { ...l, ...open, preorders: 2, total: 2 }
            : l.key === 'test-plunder|'
            ? { ...l, ...open, total: 0 }
            : l
        ),
      })),
      bread: base.bread && {
        ...base.bread,
        rows: base.bread.rows.map((r) =>
          r.itemId === 'test-korn'
            ? {
                ...r,
                cells: {
                  ...r.cells,
                  kasten: {
                    key: 'test-korn|kasten',
                    variant: 'kasten',
                    total: 4,
                    baseUnset: true,
                    totalIsMinimum: true,
                  },
                },
              }
            : r
        ),
      },
    }
    const page = within(renderPrint(day).getByTestId('bz-print'))
    expect(page.getByTestId('dd-bread-test-korn|kasten')).toHaveTextContent(
      /^≥ 4$/
    )
    expect(
      within(page.getByTestId('dd-bread')).getByText('Grundmenge offen: Kasten')
    ).toBeInTheDocument()
    // Hefeteig je Sorte: „Testmohnfüllung ≥ 2“
    expect(page.getByTestId('dd-hefe-test-zopf')).toHaveTextContent(
      'Testmohnfüllung ≥ 2'
    )
    // übrige Abschnitte: ohne Bekanntes „offen“, nie „0“
    expect(page.getByTestId('dd-line-test-plunder|')).toHaveTextContent(/offen/)
    expect(
      within(page.getByTestId('dd-line-test-plunder|')).queryByText('0')
    ).not.toBeInTheDocument()
  })

  it('Brot ohne Größe: die Menge steht beim Namen, nicht unter einer Größenspalte', () => {
    const page = renderPrint(saturdayV2Draft())
    const value = page.getByTestId('dd-bread-test-hafer|')
    expect(value.tagName).toBe('STRONG')
    expect(value.closest('td')).toHaveTextContent(/^Testhafer/)
  })

  it('Nachträge: was sie für Teig und Teilmaschine heißen', () => {
    const page = renderPrint({ ...saturdayV2Confirmed(), ...v2DeltaDough() })
    expect(page.getByTestId('print-delta-dough')).toHaveTextContent(
      'Testdoppel für Di: +14 Teigstücke – 1 Bruch mehr (jetzt 6)'
    )
    page.unmount()
    expect(
      renderPrint(saturdayV2Confirmed()).queryByTestId('print-delta-dough')
    ).not.toBeInTheDocument()
  })

  it('Brot: Korrektur mit Grund steht an der Zeile', () => {
    const day = saturdayV2Draft()
    const sections = day.sections.map((s) => ({
      ...s,
      lines: s.lines.map((l) =>
        l.key === 'test-korn|g1000'
          ? { ...l, correction: 2, correctionReason: 'Testfest' }
          : l
      ),
    }))
    const p = within(renderPrint({ ...day, sections }).getByTestId('dd-bread'))
    expect(p.getByTestId(`dd-bread-corr-test-korn|${SAT}`)).toHaveTextContent(
      '1 kg: Korr. +2 (Testfest)'
    )
    expect(
      p.queryByTestId(`dd-bread-corr-test-holz|${SAT}`)
    ).not.toBeInTheDocument()
  })

  it('Brötchen je Backtag: Brüche × Gewicht – Aufteilung, „+n frei“ nur als Hinweis', () => {
    const page = renderPrint(saturdayV2Draft())
    const sun = within(page.getByTestId(`dd-rolls-${SUN}`))
    expect(sun.getByText('für Sonntag, 29.11.')).toBeInTheDocument()
    expect(sun.getByTestId(`dd-bruch-${SUN}|test-doppel`)).toHaveTextContent(
      '7 Bruch × 1.250 g – 66 Testdoppel · +4 frei'
    )
    expect(sun.getByTestId(`dd-bruch-${SUN}|test-gemischt`)).toHaveTextContent(
      '1 Bruch × 2.000 g – 12 Teststern, 8 Testkäse'
    )
    expect(
      sun.getByTestId(`dd-bruch-${SUN}|test-gemischt`)
    ).not.toHaveTextContent('frei')
    expect(sun.getByText('Testflit klein')).toBeInTheDocument()
    const tue = within(page.getByTestId(`dd-rolls-${V2_TUE}`))
    expect(
      tue.getByTestId(`dd-bruch-${V2_TUE}|test-flitweck`)
    ).toHaveTextContent('1 Bruch × – g – 20 Testflitweck')
    // Testparty: Teigstücke je Stück offen - steht dabei, kg nicht geschätzt.
    expect(tue.getByText(/Teigstücke offen/)).toBeInTheDocument()
  })

  it('Hefeteig: gefüllter Posten in einer Zeile mit den Sorten', () => {
    const p = within(renderPrint(saturdayV2Draft()).getByTestId('dd-hefeteig'))
    expect(p.getByTestId('dd-hefe-test-zopf')).toHaveTextContent(
      'Testzopf gefülltTestnussfüllung 4 · Testmohnfüllung 2'
    )
    expect(p.getByTestId('dd-hefe-test-kranz')).toHaveTextContent('3')
    expect(p.getByText(/Testhefe: 12 Teigstücke · 6,6 kg/)).toBeInTheDocument()
  })

  it('übrige Abschnitte knapp, Offen-Fußnote, vier Notizzeilen', () => {
    const page = renderPrint(saturdayV2Draft())
    const others = within(page.getByTestId('dd-others'))
    expect(others.getByText('Kaffeestückchen')).toBeInTheDocument()
    expect(others.getByTestId('dd-line-test-plunder|')).toHaveTextContent(
      'Testplunder20'
    )
    // Brot und Brötchen stehen nicht noch einmal bei den übrigen.
    expect(others.queryByText('Brot')).not.toBeInTheDocument()
    const open = page.getByTestId('dd-open')
    expect(open).toHaveTextContent('Offen:')
    expect(open).toHaveTextContent('kg je Liter ist noch offen')
    expect(open.textContent?.match(/Bruchgewicht für Dienstag/g)).toHaveLength(
      1
    )
    expect(page.getByTestId('dd-hints')).toHaveTextContent(
      'Grundmenge für Samstag noch nicht festgelegt: Testkorn (Kasten).'
    )
    expect(
      page.getByTestId('dd-notes').querySelectorAll('.dd-note-line')
    ).toHaveLength(4)
  })

  it('Nachträge mit Backtag, nicht in den Mengen; abgehakte Zeilen mit ✓', () => {
    const confirmed = saturdayV2Confirmed()
    const day: BackzettelDay = {
      ...confirmed,
      sections: confirmed.sections.map((s) => ({
        ...s,
        lines: s.lines.map(
          (l): BackzettelLine =>
            l.key === 'test-plunder|'
              ? {
                  ...l,
                  doneAt: '2026-11-28T04:00:00.000Z',
                  doneBy: { id: 2, displayName: 'Test Backstube' },
                }
              : l
        ),
      })),
    }
    const page = renderPrint(day)
    const deltas = within(page.getByTestId('print-deltas'))
    expect(
      deltas.getByTestId(`print-delta-test-doppel|@${V2_TUE}`)
    ).toHaveTextContent('+3Testdoppel · für Di 01.12.')
    expect(
      within(page.getByTestId('dd-line-test-plunder|')).getByTestId('dd-done')
    ).toHaveTextContent(/^✓TB$/)
    // Die Brötchen-Zeile nennt den Nachtrag nur als Hinweis - das Gesamt bleibt.
    expect(
      page.getByTestId(`dd-bruch-${V2_TUE}|test-doppel`)
    ).toHaveTextContent('44 Testdoppel')
  })

  it('Abwiegeliste & Rezepte nur auf Wunsch, auf eigenen Blättern', () => {
    const without = renderPrint(saturdayV2Draft())
    expect(without.getByTestId('print-page-1')).toBeInTheDocument()
    expect(without.queryByTestId('print-page-2')).not.toBeInTheDocument()
    expect(without.queryByTestId('print-page-3')).not.toBeInTheDocument()
    without.unmount()

    const withExtras = renderPrint(saturdayV2Draft(), true)
    expect(withExtras.getByTestId('print-page-2')).toHaveClass('bz-break')
    expect(withExtras.getByTestId('print-page-3')).toHaveClass('bz-break')
    expect(
      within(withExtras.getByTestId('print-page-2')).getByText(
        'Testnussfüllung: Gramm unbekannt'
      )
    ).toBeInTheDocument()
  })

  it('zu voll für ein Blatt: übrige Abschnitte auf Blatt 2 mit Hinweis auf Seite 1', () => {
    const day = saturdayV2Draft()
    const many = Array.from({ length: 200 }, (_, i) =>
      line({
        key: `test-extra-${i}|`,
        itemId: `test-extra-${i}`,
        name: `Testposten ${i}`,
        section: 'kuchen',
        total: 1,
        bakeDate: SAT,
        doughDate: SAT,
      })
    )
    const page = renderPrint({
      ...day,
      sections: [
        ...day.sections,
        { id: 'kuchen', label: 'Kuchen', lines: many },
      ],
    })
    expect(page.getByTestId('dd-others-next')).toHaveTextContent(
      'Weitere Posten auf Blatt 2 (Kaffeestückchen, Kuchen)'
    )
    const second = within(page.getByTestId('print-dd-others'))
    expect(second.getByTestId('dd-line-test-extra-199|')).toBeInTheDocument()
    expect(page.getByTestId('print-dd-others')).toHaveClass('bz-break')
  })

  it('Sonntag ohne Teig: Hinweis auf die Backliste', () => {
    const page = renderPrint(sundayV2Sheet())
    expect(page.getByTestId('dd-empty')).toHaveTextContent('Backliste')
    expect(page.queryByTestId('dd-machine')).not.toBeInTheDocument()
  })
})

describe('Zahlen im Druck', () => {
  it('printLiters: „–“ mit Grund, genaue Liter ohne Rundung', () => {
    expect(
      printLiters({
        exact: null,
        rounded: null,
        reason: 'kg_per_liter_unknown',
      })
    ).toEqual({ text: '–', hint: 'Liter unbekannt (kg je Liter offen)' })
    expect(
      printLiters({ exact: 6.47, rounded: null, reason: 'rounding_unknown' })
    ).toEqual({ text: '6,47 L', hint: 'Rundung offen' })
    expect(printLiters({ exact: 6.47, rounded: 6.5, reason: null })).toEqual({
      text: '6,5 L',
      hint: null,
    })
  })

  it('printKg: „≥“ nur mit bekanntem Teil, sonst „– kg“ - nie 0', () => {
    expect(printKg({ kg: 12.4, kgKnown: 12.4 })).toBe('12,4 kg')
    expect(printKg({ kg: null, kgKnown: 3 })).toBe('≥ 3 kg')
    expect(printKg({ kg: null, kgKnown: 0 })).toBe('– kg')
  })
})
