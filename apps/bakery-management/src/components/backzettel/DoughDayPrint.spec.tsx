import React from 'react'
import { render, within } from '@testing-library/react'
import { DoughDayPrint, printKg, printLiters } from './DoughDayPrint'
import type { BackzettelDay, BackzettelLine } from '../../lib/backzettelApi'
import {
  SAT,
  SUN,
  TEST_CONFIG_V2,
  V2_TUE,
  busySaturdayV2Confirmed,
  busySaturdayV2Draft,
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

/** Eine Zeile des Tages ändern (alle Abschnitte). */
function patchLines(
  day: BackzettelDay,
  patch: (l: BackzettelLine) => BackzettelLine
): BackzettelDay {
  return {
    ...day,
    sections: day.sections.map((s) => ({ ...s, lines: s.lines.map(patch) })),
  }
}

describe('Druck eines Teigtag-Zettels (U8)', () => {
  it('Kopf: Wochentag und Datum groß, Tagestyp gerahmt, Stempel Entwurf bzw. freigegeben', () => {
    const draftPage = renderPrint(saturdayV2Draft())
    const draft = within(draftPage.getByTestId('print-page-1'))
    expect(draft.getByTestId('dd-title')).toHaveTextContent(
      /^Samstag\s*28\.11\.2026$/
    )
    expect(draft.getByTestId('dd-stamp')).toHaveTextContent(
      'ENTWURF – noch nicht freigegeben'
    )
    expect(draft.getByTestId('dd-daytype')).toHaveTextContent(
      'Heute backen + Teig für So 29.11. und Di 01.12.'
    )
    draftPage.unmount()

    const confirmed = within(
      renderPrint(saturdayV2Confirmed()).getByTestId('print-page-1')
    )
    expect(confirmed.getByTestId('dd-stamp')).toHaveTextContent('FREIGEGEBEN')
    expect(confirmed.getByTestId('dd-meta')).toHaveTextContent(
      /freigegeben von Test Backstube/
    )
  })

  it('„Teige heute“ zuerst: Liter groß, unbekannt als „–“ mit Grund - nie geschätzt', () => {
    const page = renderPrint(saturdayV2Draft())
    const p = within(page.getByTestId('dd-machine'))
    // erster Block auf Blatt 1
    expect(
      page.getByTestId('print-page-1').querySelector('.dd-block')
    ).toHaveAttribute('data-testid', 'dd-machine')
    expect(p.getByTestId('dd-liters-test-korn-teig')).toHaveTextContent(/^6 L$/)
    const korn = p.getByTestId('dd-machine-test-korn-teig')
    expect(korn).toHaveTextContent('11,4 kg')
    expect(korn).toHaveTextContent('+ Testsauer 20 g')
    expect(korn).toHaveTextContent('heute')
    const weck = p.getByTestId('dd-machine-test-weck-teig')
    expect(p.getByTestId('dd-liters-test-weck-teig')).toHaveTextContent('5,5 L')
    expect(weck).toHaveTextContent('1 Charge')
    expect(weck).toHaveTextContent('So + Di')
    const flit = p.getByTestId('dd-machine-test-flit-teig')
    expect(p.getByTestId('dd-liters-test-flit-teig')).toHaveTextContent(/^–$/)
    expect(flit).toHaveTextContent('≥ 3 kg')
    expect(flit).toHaveTextContent('Liter unbekannt (Teig unvollständig)')
    expect(flit).toHaveClass('incomplete')
    // Hefeteig: „Wasser“ statt „Liter“
    expect(p.getByTestId('dd-machine-test-hefe')).toHaveTextContent('Wasser')
  })

  it('je Teig ein Block in der Reihenfolge der Kästen, die Liter im Kopf des Blocks', () => {
    const page = renderPrint(busySaturdayV2Draft())
    const order = page
      .getAllByTestId(/^dd-dough-(?!fig)/)
      .map((el) => el.getAttribute('data-testid'))
    expect(order).toEqual([
      'dd-dough-test-korn-teig',
      'dd-dough-test-misch-teig',
      'dd-dough-test-roggen-teig',
      // Spezialbrot ohne Teig direkt hinter dem letzten Brot-Teig
      'dd-dough-weiteres-brot',
      'dd-dough-test-weck-teig',
      'dd-dough-test-flit-teig',
      'dd-dough-test-dinkelweck-teig',
      'dd-dough-test-hefe',
    ])
    expect(page.getByTestId('dd-dough-fig-test-korn-teig')).toHaveTextContent(
      '12 L · 23,6 kg'
    )
    // Liter unbekannt: im Block nur kg, der Grund steht bei „Teige heute“.
    expect(page.getByTestId('dd-dough-fig-test-roggen-teig')).toHaveTextContent(
      /^≥ 44,5 kg$/
    )
    expect(page.getByTestId('dd-dough-fig-test-hefe')).toHaveTextContent(
      'Wasser 3 L · 13,8 kg'
    )
  })

  it('Brot im Block seines Teigs: Größen als Spalten, offene Grundmenge als „offen“, Spezialbrot mit Einheit unter „Menge“', () => {
    const page = renderPrint(saturdayV2Draft())
    const korn = within(page.getByTestId('dd-dough-test-korn-teig'))
    expect(korn.getByTestId('dd-bread-test-korn|g500')).toHaveTextContent('8')
    expect(korn.getByTestId('dd-bread-test-korn|g1000')).toHaveTextContent('3')
    expect(korn.getByTestId('dd-bread-test-korn|kasten')).toHaveTextContent(
      'offen'
    )
    expect(korn.getByText('7,8 kg')).toBeInTheDocument()
    expect(korn.getAllByText(/Gemeinsamer Teig: Korn \+ Holz/)).toHaveLength(2)
    // Testhafer (alter Liter-Posten, kein Teig): eigener Block, Spalte „Menge“
    const weiteres = within(page.getByTestId('dd-dough-weiteres-brot'))
    expect(weiteres.getByText('Weiteres Brot')).toBeInTheDocument()
    expect(weiteres.getByText('Menge')).toBeInTheDocument()
    expect(weiteres.queryByText('500 g')).not.toBeInTheDocument()
    expect(weiteres.getByTestId('dd-bread-test-hafer|')).toHaveTextContent(
      /^1,5 L$/
    )
  })

  it('offene Grundmenge mit Vorbestellung druckt „≥ n“ mit „Grundmenge offen“ - nie die nackte Vorbestellzahl', () => {
    const base = saturdayV2Draft()
    const open = { baseUnset: true, totalIsMinimum: true, base: 0 }
    const day: BackzettelDay = {
      ...patchLines(base, (l) =>
        l.key === 'test-korn|kasten'
          ? { ...l, ...open, preorders: 4, total: 4 }
          : l.key === 'test-zopf|mohn'
          ? { ...l, ...open, preorders: 2, total: 2 }
          : l.key === 'test-plunder|'
          ? { ...l, ...open, total: 0 }
          : l
      ),
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
      page.getByTestId(`dd-bread-detail-test-korn|${SAT}`)
    ).toHaveTextContent('Grundmenge offen: Kasten')
    // Hefeteig je Sorte eine Zeile: „≥ 2 Testmohnfüllung“
    const mohn = page.getByTestId('dd-line-test-zopf|mohn')
    expect(mohn).toHaveTextContent(/^≥ 2Testmohnfüllung/)
    expect(mohn).toHaveTextContent('Grundmenge offen')
    // übrige Abschnitte: ohne Bekanntes „offen“, nie „0“
    const plunder = page.getByTestId('dd-line-test-plunder|')
    expect(plunder).toHaveTextContent(/^offen/)
    expect(within(plunder).queryByText('0')).not.toBeInTheDocument()
  })

  it('Brot: Korrektur mit Grund steht klein unter dem Namen', () => {
    const day = patchLines(saturdayV2Draft(), (l) =>
      l.key === 'test-korn|g1000'
        ? { ...l, correction: 2, correctionReason: 'Testfest' }
        : l
    )
    const page = renderPrint(day)
    expect(
      page.getByTestId(`dd-bread-detail-test-korn|${SAT}`)
    ).toHaveTextContent('1 kg: Korr. +2 (Testfest)')
    expect(
      page.getByTestId(`dd-bread-detail-test-holz|${SAT}`)
    ).not.toHaveTextContent('Korr.')
  })

  it('Brötchen im Block ihres Teigs, je Backtag: Bruch groß, × Gewicht, Aufteilung mit „+n frei“', () => {
    const page = renderPrint(saturdayV2Draft())
    const weck = within(page.getByTestId('dd-dough-test-weck-teig'))
    const sun = within(weck.getByTestId(`dd-rolls-test-weck-teig-${SUN}`))
    expect(sun.getByText('für Sonntag, 29.11.')).toBeInTheDocument()
    const doppel = sun.getByTestId(`dd-bruch-${SUN}|test-doppel`)
    expect(within(doppel).getByText('7 Bruch')).toHaveClass('qty')
    expect(doppel).toHaveTextContent('× 1.250 g')
    expect(doppel).toHaveTextContent('66 Testdoppel · +4 frei')
    const gemischt = sun.getByTestId(`dd-bruch-${SUN}|test-gemischt`)
    expect(gemischt).toHaveTextContent('1 Bruch× 2.000 g')
    expect(gemischt).toHaveTextContent('12 Teststern, 8 Testkäse')
    expect(gemischt).not.toHaveTextContent('frei')
    // Backtage chronologisch: So vor Di
    const days = weck
      .getAllByTestId(/^dd-rolls-test-weck-teig-/)
      .map((el) => el.getAttribute('data-testid'))
    expect(days).toEqual([
      `dd-rolls-test-weck-teig-${SUN}`,
      `dd-rolls-test-weck-teig-${V2_TUE}`,
    ])
    // Testflit: Einzelstück und Bruch mit offenem Gewicht im Block des Flitteigs
    const flit = within(page.getByTestId('dd-dough-test-flit-teig'))
    expect(
      flit.getByTestId(`dd-single-test-flit-klein|@${SUN}`)
    ).toHaveTextContent('10je 300 gTestflit klein')
    expect(flit.getByTestId(`dd-bruch-${V2_TUE}|test-flitweck`)).toHaveClass(
      'incomplete'
    )
    expect(
      flit.getByTestId(`dd-bruch-${V2_TUE}|test-flitweck`)
    ).toHaveTextContent('× – g')
    // Testparty: Teigstücke je Stück offen - steht dabei, kg nicht geschätzt.
    expect(
      flit.getByTestId(`dd-single-test-party|@${V2_TUE}`)
    ).toHaveTextContent('Teigstücke offen')
  })

  it('Hefeteig im Block seines Teigs: gefüllte Posten mit einer Zeile und einem Kästchen je Sorte', () => {
    const page = renderPrint(saturdayV2Draft())
    const hefe = within(page.getByTestId('dd-dough-test-hefe'))
    expect(
      hefe.getByText(/Testhefe: 12 Teigstücke · 6,6 kg/)
    ).toBeInTheDocument()
    const zopf = within(hefe.getByTestId('dd-hefe-test-zopf'))
    expect(zopf.getByText('Testzopf gefüllt')).toBeInTheDocument()
    expect(zopf.getByTestId('dd-line-test-zopf|nuss')).toHaveTextContent(
      /^4Testnussfüllung$/
    )
    expect(zopf.getByTestId('dd-line-test-zopf|mohn')).toHaveTextContent(
      /^2Testmohnfüllung$/
    )
    expect(
      hefe.getByTestId('dd-hefe-test-zopf').querySelectorAll('.box')
    ).toHaveLength(2)
    expect(hefe.getByTestId('dd-hefe-test-kranz')).toHaveTextContent(
      /^3Testkranz$/
    )
  })

  it('übrige Abschnitte: Menge groß links, Fußnoten, vier Notizzeilen', () => {
    const page = renderPrint(saturdayV2Draft())
    const kaffee = within(page.getByTestId('dd-section-kaffeestueckchen'))
    expect(kaffee.getByText('Kaffeestückchen')).toBeInTheDocument()
    const plunder = kaffee.getByTestId('dd-line-test-plunder|')
    expect(plunder.firstElementChild).toHaveClass('qty')
    expect(plunder).toHaveTextContent(/^20Testplunder/)
    // Brot, Brötchen und Hefeteig stehen nicht noch einmal als Abschnitt.
    expect(page.queryByTestId('dd-section-brot')).not.toBeInTheDocument()
    expect(page.queryByTestId('dd-section-broetchen')).not.toBeInTheDocument()
    expect(page.queryByTestId('dd-section-hefeteig')).not.toBeInTheDocument()
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

  it('Zukauf-Hinweis und note stehen fett an der Zeile - in Abschnitten, beim Brot und bei Brötchen', () => {
    const hint = {
      purchased: true,
      note: 'mit Käse bestreuen',
      hint: 'Zukauf – auflegen · mit Käse bestreuen',
    }
    const day = patchLines(saturdayV2Draft(), (l) =>
      l.itemId === 'test-plunder' ||
      l.key === 'test-holz|g500' ||
      l.key === `test-kaese|@${SUN}`
        ? { ...l, ...hint }
        : l
    )
    const page = renderPrint(day)
    const row = page.getByTestId('dd-line-test-plunder|')
    const strong = within(row).getByTestId('dd-hint-test-plunder|')
    expect(strong.tagName).toBe('STRONG')
    expect(strong).toHaveTextContent('Zukauf – auflegen · mit Käse bestreuen')
    expect(
      within(page.getByTestId(`dd-bread-row-test-holz|${SAT}`)).getByTestId(
        'dd-hint-test-holz|g500'
      )
    ).toHaveTextContent('Zukauf – auflegen')
    expect(page.getByTestId(`dd-bruch-${SUN}|test-gemischt`)).toHaveTextContent(
      'Zukauf – auflegen · mit Käse bestreuen'
    )
  })

  it('Nachträge mit Backtag, nicht in den Mengen; abgehakte Zeilen mit ✓ und Kürzel', () => {
    const day = patchLines(saturdayV2Confirmed(), (l) =>
      l.key === 'test-plunder|'
        ? {
            ...l,
            doneAt: '2026-11-28T04:00:00.000Z',
            doneBy: { id: 2, displayName: 'Test Backstube' },
          }
        : l
    )
    const page = renderPrint(day)
    const deltas = within(page.getByTestId('print-deltas'))
    expect(
      deltas.getByTestId(`print-delta-test-doppel|@${V2_TUE}`)
    ).toHaveTextContent('+3Testdoppel · für Di 01.12.')
    expect(
      within(page.getByTestId('dd-line-test-plunder|')).getByTestId('dd-done')
    ).toHaveTextContent(/^✓TB$/)
    // Die Brötchen-Zeile nennt den Nachtrag nicht in der Zahl - das Gesamt bleibt.
    expect(
      page.getByTestId(`dd-bruch-${V2_TUE}|test-doppel`)
    ).toHaveTextContent('44 Testdoppel')
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

  it('Zeilen ohne Teig-Zuordnung landen in Sammelblöcken - nie weggelassen', () => {
    // Ohne Teile der Teige weiß der Druck nicht, zu welchem Teig die
    // Einzelstücke gehören; Bruch-Gruppen und Brot tragen ihren Teig selbst.
    const day = saturdayV2Draft({
      doughs: saturdayV2Draft().doughs?.map((d) => ({ ...d, parts: [] })),
    })
    const page = renderPrint(day)
    const rest = within(page.getByTestId('dd-dough-weitere-broetchen'))
    expect(rest.getByText('Weitere Brötchen')).toBeInTheDocument()
    expect(
      rest.getByTestId(`dd-single-test-flit-klein|@${SUN}`)
    ).toBeInTheDocument()
    expect(
      rest.getByTestId(`dd-single-test-party|@${V2_TUE}`)
    ).toBeInTheDocument()
    // Hefeteig-Posten: in den Hefeteig-Kasten (Abschnitt „hefeteig“)
    expect(
      within(page.getByTestId('dd-dough-test-hefe')).getByTestId(
        'dd-hefe-test-zopf'
      )
    ).toBeInTheDocument()
  })

  it('voller Samstag: mehrere Blätter mit Kopf, jede Zeile genau einmal, kein Block geteilt', () => {
    for (const day of [busySaturdayV2Draft(), busySaturdayV2Confirmed()]) {
      const page = renderPrint(day)
      const root = page.getByTestId('bz-print')
      const sheets = Array.from(root.querySelectorAll('section.dd-sheet'))
      expect(sheets.length).toBeGreaterThan(1)
      expect(sheets.length).toBeLessThanOrEqual(3)
      expect(root).toHaveAttribute('data-print-sheets', String(sheets.length))
      sheets.slice(1).forEach((sheet, i) => {
        expect(sheet).toHaveClass('bz-break')
        expect(sheet).toHaveTextContent(
          `Samstag, 28.11.2026 – Blatt ${i + 2} von ${sheets.length}`
        )
      })
      expect(
        within(sheets[0] as HTMLElement).getByTestId('dd-meta')
      ).toHaveTextContent(`Blatt 1 von ${sheets.length}`)
      // Brot und Brötchen über ihre Zellen, die übrigen als Zeile - je einmal.
      for (const sec of day.sections) {
        for (const l of sec.lines) {
          if (sec.id === 'brot' || sec.id === 'broetchen') continue
          expect(page.getAllByTestId(`dd-line-${l.key}`)).toHaveLength(1)
        }
      }
      expect(page.getAllByTestId(/^dd-bruch-/)).toHaveLength(10)
      expect(page.getAllByTestId(/^dd-single-/)).toHaveLength(4)
      expect(page.getByTestId('dd-bread-test-roggen|kasten')).toHaveTextContent(
        'offen'
      )
      // jeder Block steht ganz auf einem Blatt
      for (const id of ['dd-machine', 'dd-dough-test-weck-teig']) {
        expect(page.getAllByTestId(id)).toHaveLength(1)
      }
      // Notizen nur auf dem letzten Blatt
      expect(
        within(sheets[sheets.length - 1] as HTMLElement).queryByTestId(
          'dd-notes'
        ) ?? null
      ).not.toBeNull()
      page.unmount()
    }
  })

  it('ein Abschnitt höher als ein Blatt geht weiter unter „… (Forts.)“, jede Zeile einmal', () => {
    const day = saturdayV2Draft()
    const many = Array.from({ length: 120 }, (_, i) =>
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
    const forts = page.getAllByTestId('dd-section-kuchen-forts')
    expect(forts.length).toBeGreaterThanOrEqual(1)
    for (const f of forts) {
      expect(f.firstElementChild).toHaveTextContent('Kuchen (Forts.)')
      expect(
        f.querySelectorAll('[data-testid^="dd-line-"]').length
      ).toBeGreaterThanOrEqual(3)
    }
    for (let i = 0; i < 120; i++) {
      expect(page.getAllByTestId(`dd-line-test-extra-${i}|`)).toHaveLength(1)
    }
  })

  it('Sonntag ohne Teig: Tagestyp und Hinweis auf die Backliste', () => {
    const page = renderPrint(sundayV2Sheet())
    expect(page.getByTestId('dd-daytype')).toHaveTextContent(
      'Backtag ohne Teig'
    )
    expect(page.getByTestId('dd-empty')).toHaveTextContent('Backliste')
    expect(page.queryByTestId('dd-machine')).not.toBeInTheDocument()
    expect(page.getByTestId('bz-print')).toHaveAttribute(
      'data-print-sheets',
      '1'
    )
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
