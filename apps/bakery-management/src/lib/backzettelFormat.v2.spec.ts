import {
  addonText,
  bakeDayLabel,
  bakeSourceText,
  batchesText,
  bruchAddonsText,
  bruchGroupText,
  bruchKgText,
  bruchSpareText,
  bruchStep,
  deltaDoughLines,
  deltaExtrasHighlights,
  deltaExtrasLines,
  doughsTodayText,
  fillingGramsText,
  fillingOpenNote,
  formatKnown,
  formatKnownGrams,
  hefeteigDoughText,
  hefeteigPiecesText,
  kgText,
  lineLabel,
  litersFigure,
  litersHint,
  litersLabel,
  litersText,
  minQtyText,
  variantLabel,
  weighingItemsText,
  weighingPiecesText,
} from './backzettelFormat'
import {
  SAT,
  SUN,
  TEST_CONFIG_V2,
  V2_TUE,
  saturdayV2Draft,
  v2DeltaDough,
} from './backzettelFixtures'

describe('Backzettel v2 - Anzeige-Helfer', () => {
  it('unbekannt bleibt unbekannt: „–“, nie 0', () => {
    expect(formatKnown(null)).toBe('–')
    expect(formatKnown(undefined, 'kg')).toBe('–')
    expect(formatKnown(0, 'kg')).toBe('0 kg')
    expect(formatKnown(2.5, 'kg')).toBe('2,5 kg')
    expect(formatKnownGrams(null)).toBe('–')
  })

  it('Liter: gerundet, Rundung offen, unbekannt mit Grund', () => {
    expect(litersText({ exact: 5.7, rounded: 6, reason: null })).toBe('6 L')
    expect(
      litersText({ exact: 6.47, rounded: null, reason: 'rounding_unknown' })
    ).toBe('6,47 L (Rundung offen)')
    expect(
      litersText({ exact: null, rounded: null, reason: 'kg_per_liter_unknown' })
    ).toBe('unbekannt')
    expect(litersText(null)).toBe('unbekannt')
    expect(
      litersHint({ exact: null, rounded: null, reason: 'kg_per_liter_unknown' })
    ).toBe('Liter: unbekannt (kg je Liter offen)')
    expect(
      litersHint({ exact: null, rounded: null, reason: 'dough_incomplete' })
    ).toMatch(/Teig unvollständig/)
    expect(
      litersHint({ exact: 6.47, rounded: null, reason: 'rounding_unknown' })
    ).toMatch(/Rundung offen/)
    expect(litersHint({ exact: 5.7, rounded: 6, reason: null })).toBeNull()
    expect(litersLabel({ section: 'hefeteig' })).toBe('Wasser')
    expect(litersLabel({ section: 'brot' })).toBe('Liter')
  })

  it('kg und Chargen ohne Schätzung', () => {
    expect(kgText({ kg: 11.4 })).toBe('11,4 kg')
    expect(kgText({ kg: null, kgKnown: 3 })).toBe('≥ 3 kg')
    expect(kgText({ kg: null, kgKnown: 0 })).toBe('unbekannt')
    expect(batchesText({ batches: 1, batch_max_kg: 40 })).toEqual({
      text: '1 Charge',
      hint: 'je max. 40 kg',
    })
    expect(batchesText({ batches: null, batch_max_kg: null })).toEqual({
      text: 'Chargen: unbekannt',
      hint: 'Chargengröße offen',
    })
    expect(batchesText({ batches: null, batch_max_kg: 40 }).hint).toBe(
      'Teiggewicht unbekannt'
    )
  })

  it('Zugaben: Gramm, Rundung offen, unbekannt', () => {
    const base = { id: 'test-sauer', name: 'Testsauer' }
    expect(
      addonText({
        ...base,
        grams: { exact: 18, rounded: 20 },
        reason: null,
      } as never).text
    ).toBe('Testsauer 20 g')
    expect(
      addonText({
        ...base,
        grams: { exact: 18, rounded: null },
        reason: 'rounding_unknown',
      } as never).hint
    ).toMatch(/Rundung offen/)
    const unknown = addonText({
      ...base,
      grams: null,
      reason: 'g_per_liter_unknown',
    } as never)
    expect(unknown.text).toBe('Testsauer: unbekannt')
    expect(unknown.hint).toBe('Gramm je Liter offen')
  })

  it('Backtag, Bruch-Gruppe und +1 Bruch', () => {
    expect(bakeDayLabel(SAT, SAT)).toBe('heute backen')
    expect(bakeDayLabel(SUN, SAT)).toBe('für Sonntag, 29.11.')
    const [sun, tue] = saturdayV2Draft().rolls ?? []
    expect(bruchGroupText(sun.groups[0])).toBe(
      '7 Bruch × 1.250 g – 66 Testdoppel · +4 frei'
    )
    expect(bruchGroupText(tue.groups[1])).toBe(
      '1 Bruch × ? g (Bruchgewicht offen) – 20 Testflitweck · +0 frei'
    )
    expect(bruchStep(20, 2)).toBe(10)
    expect(bruchStep(20, 3)).toBeNull()
    expect(bruchStep(null, 1)).toBeNull()
  })

  it('Bruch-Gruppe mit offener Grundmenge: „≥“, „offen“, nie 0', () => {
    const [sun] = saturdayV2Draft().rolls ?? []
    const mixed = sun.groups[1]
    const open = {
      ...mixed,
      pieces: null,
      brueche: null,
      kg: null,
      spare: null,
      spareProducts: null,
      piecesKnown: 12,
      bruecheKnown: 1,
      kgKnown: 1.2,
      complete: false,
      split: [mixed.split[0], { ...mixed.split[1], total: null }],
    }
    expect(bruchGroupText(open)).toBe(
      '≥ 1 Bruch × 2.000 g – 12 Teststern, Testkäse offen'
    )
    expect(bruchKgText(open)).toBe('Teig: ≥ 1,2 kg')
    expect(
      bruchGroupText({ ...open, bruecheKnown: 0, kgKnown: 0, piecesKnown: 0 })
    ).toMatch(/^\? Bruch/)
    expect(bruchKgText({ ...open, kgKnown: 0 })).toBe('Teig: – kg')
    // Freie Stücke in Produkten, nicht in Teigstücken.
    expect(bruchGroupText(sun.groups[0])).toMatch(/\+4 frei$/)
    expect(
      bruchGroupText({
        ...sun.groups[0],
        spareProducts: null,
        perProduct: null,
      })
    ).toMatch(/\+8 Teigstücke frei$/)
  })

  it('Zugabe je Bruch (U3): „+ 1,2 kg …“, „≥“ und „Menge offen“, nie 0', () => {
    const [sun] = saturdayV2Draft().rolls ?? []
    const g = {
      ...sun.groups[0],
      addons: [{ name: 'Testkörner', gPerBruch: 200, g: 1400, gKnown: 1400 }],
    }
    expect(bruchGroupText(g)).toBe(
      '7 Bruch × 1.250 g + 1,4 kg Testkörner – 66 Testdoppel · +4 frei'
    )
    expect(
      bruchAddonsText({
        addons: [{ name: 'Testkörner', gPerBruch: 200, g: 400, gKnown: 400 }],
      })
    ).toBe(' + 400 g Testkörner')
    expect(
      bruchAddonsText({
        addons: [{ name: 'Testkörner', gPerBruch: 200, g: null, gKnown: 200 }],
      })
    ).toBe(' + ≥ 200 g Testkörner')
    expect(
      bruchAddonsText({
        addons: [
          { name: 'Testkörner', gPerBruch: null, g: null, gKnown: null },
        ],
      })
    ).toBe(' + Testkörner (Menge offen)')
    expect(
      bruchAddonsText({
        addons: [{ name: 'Testkörner', gPerBruch: 200, g: null, gKnown: 0 }],
      })
    ).toBe(' + Testkörner (Menge offen)')
    expect(bruchAddonsText({})).toBe('')
  })

  it('Hefeteig-Karte: Stück und Teig wie der Server, offen mit „≥“', () => {
    expect(hefeteigPiecesText({ pieces: 40, piecesComplete: true })).toBe('40')
    expect(hefeteigPiecesText({ pieces: 40, piecesComplete: false })).toBe(
      '≥ 40'
    )
    expect(hefeteigPiecesText({ pieces: null })).toBe('–')
    expect(hefeteigDoughText({ dough_g: 999, kg: 6.6 })).toMatch(
      /6\.600 g|6,6 kg/
    )
    expect(hefeteigDoughText({ dough_g: null, kg: null, kgKnown: 2 })).toMatch(
      /^≥ /
    )
    expect(hefeteigDoughText({ dough_g: null, kg: null, kgKnown: 0 })).toBe('–')
    expect(hefeteigDoughText({ dough_g: null })).toBe('–')
  })

  it('Abwiegeliste: offene Grundmenge als „≥“, ohne bekannte Stück „–“/„offen“', () => {
    expect(weighingPiecesText({ pieces: 15 })).toBe('15')
    expect(weighingPiecesText({ pieces: 15, isMinimum: true })).toBe('≥ 15')
    expect(weighingPiecesText({ pieces: 0, isMinimum: true })).toBe('–')
    expect(weighingPiecesText({ pieces: null })).toBe('–')
    expect(
      weighingItemsText([
        { name: 'Testkranz', products: 3, piecesPerProduct: 2 },
        { name: 'Testzopf', products: 6, piecesPerProduct: 1, isMinimum: true },
        { name: 'Testlaib', products: 0, piecesPerProduct: 1, isMinimum: true },
        { name: 'Testring', products: 2, piecesPerProduct: null },
      ])
    ).toBe('Testkranz 3 × 2, Testzopf ≥ 6, Testlaib offen, Testring 2 × ?')
  })

  it('Nachträge für Teig und Teilmaschine: Text aus den Server-Zahlen', () => {
    const day = { date: SAT, ...v2DeltaDough() }
    expect(deltaDoughLines(day)).toEqual([
      'Testdoppel für Di: +14 Teigstücke – 1 Bruch mehr (jetzt 6)',
      'Teststern + Testkäse für So: −2 Teigstücke – gleich viele Brüche',
      'Testweck: +1,25 kg Teig (jetzt 18,25 kg) · Liter 5,5 L → 6 L',
    ])
    const [doppel] = v2DeltaDough().deltaBruch ?? []
    expect(
      deltaDoughLines({
        date: SAT,
        deltaBruch: [
          { ...doppel, brueche: 5, bruecheDelta: 0, spareProducts: 2 },
        ],
      })
    ).toEqual([
      'Testdoppel für Di: +14 Teigstücke – passt in die freien Stücke (noch +2 frei)',
    ])
    expect(
      deltaDoughLines({
        date: SAT,
        deltaBruch: [{ ...doppel, brueche: null, bruecheDelta: null }],
      })
    ).toEqual([
      'Testdoppel für Di: +14 Teigstücke – Brüche unbekannt (Stammdaten offen)',
    ])
    expect(deltaDoughLines({ date: SAT })).toEqual([])
  })

  it('Nachträge: Zugabe je Bruch (U3) - zusätzliche Gramm, offen nur bei Bruch-Änderung', () => {
    const [doppel] = v2DeltaDough().deltaBruch ?? []
    const addon = (gBefore: number | null, g: number | null) => ({
      name: 'Testkörner',
      gBefore,
      g,
      gDelta: gBefore !== null && g !== null ? g - gBefore : null,
    })
    expect(
      deltaDoughLines({
        date: SAT,
        deltaBruch: [{ ...doppel, addons: [addon(750, 900)] }],
      })
    ).toEqual([
      'Testdoppel für Di: +14 Teigstücke – 1 Bruch mehr (jetzt 6) · +150 g Testkörner (jetzt 900 g)',
    ])
    expect(
      deltaDoughLines({
        date: SAT,
        deltaBruch: [{ ...doppel, addons: [addon(null, null)] }],
      })
    ).toEqual([
      'Testdoppel für Di: +14 Teigstücke – 1 Bruch mehr (jetzt 6) · Testkörner: Menge offen',
    ])
    // passt in die freien Stücke: keine Zugabe mehr, auch offen kein Hinweis
    for (const a of [addon(750, 750), addon(null, null)]) {
      expect(
        deltaDoughLines({
          date: SAT,
          deltaBruch: [
            {
              ...doppel,
              brueche: 5,
              bruecheDelta: 0,
              spareProducts: 2,
              addons: [a],
            },
          ],
        })
      ).toEqual([
        'Testdoppel für Di: +14 Teigstücke – passt in die freien Stücke (noch +2 frei)',
      ])
    }
  })

  it('Kopfzeile „Teige heute“ aus den Kästen des Servers', () => {
    expect(doughsTodayText(saturdayV2Draft())).toBe(
      'Teige heute: Korn + Holz · Testweck für So + Di · Testflit für So + Di · Testhefe'
    )
    expect(doughsTodayText({ date: SAT, machine: [], doughs: [] })).toBeNull()
  })

  it('Füllung ohne Gramm heißt „Gramm unbekannt“, nicht 0 g', () => {
    expect(
      fillingGramsText({
        grams: 0,
        missingFillingG: true,
        items: [{ grams: null }] as never,
      })
    ).toBe('Gramm unbekannt')
    expect(
      fillingGramsText({
        grams: 1200,
        missingFillingG: true,
        items: [{ grams: 1200 }, { grams: null }] as never,
      })
    ).toBe('≥ 1,2 kg')
  })

  it('Größen-Namen und „· für …“ am Zeilennamen', () => {
    expect(variantLabel('g500', TEST_CONFIG_V2, 'test-korn')).toBe('500 g')
    expect(variantLabel('nuss', TEST_CONFIG_V2, 'test-zopf')).toBe(
      'Testnussfüllung'
    )
    expect(
      lineLabel(
        {
          itemId: 'test-doppel',
          name: 'Testdoppel',
          variant: null,
          bakeDate: V2_TUE,
          doughDate: SAT,
        },
        TEST_CONFIG_V2
      )
    ).toBe('Testdoppel · für Di 01.12.')
    expect(
      lineLabel(
        {
          itemId: 'test-korn',
          name: 'Testkorn',
          variant: null,
          variantKind: 'size',
        },
        TEST_CONFIG_V2
      )
    ).toBe('Testkorn – ohne Größe')
    expect(
      lineLabel(
        {
          itemId: 'test-korn',
          name: 'Testkorn',
          variant: 'g500',
          variantLabel: '500 g',
          bakeDate: SAT,
          doughDate: SAT,
        },
        TEST_CONFIG_V2
      )
    ).toBe('Testkorn – 500 g')
  })

  it('Quelle der Backliste', () => {
    expect(
      bakeSourceText(
        { doughDate: SAT, weekdayName: 'Samstag', status: 'confirmed' },
        V2_TUE
      )
    ).toBe('Teig vom Samstag · freigegeben')
    expect(
      bakeSourceText(
        { doughDate: V2_TUE, weekdayName: 'Dienstag', status: 'draft' },
        V2_TUE
      )
    ).toBe('Teig von heute · Entwurf')
  })

  it('Review Z10 Runde 2: offene Grundmenge mit Vorbestellung ist eine Mindestmenge, nie eine fertige Zahl', () => {
    expect(minQtyText({ total: 4, totalIsMinimum: true })).toBe('≥ 4')
    expect(minQtyText({ total: 0, totalIsMinimum: true })).toBe('offen')
    expect(minQtyText({ total: 1.5, totalIsMinimum: true }, 'Liter')).toBe(
      '≥ 1,5 L'
    )
    expect(minQtyText({ total: 0 })).toBe('0')
    expect(minQtyText({ total: 12, totalIsMinimum: false })).toBe('12')
    // Bruch-Mitglied: die bekannten 7 bleiben stehen
    const [sun] = saturdayV2Draft().rolls ?? []
    const mixed = sun.groups[1]
    const open = {
      ...mixed,
      brueche: null,
      spare: null,
      spareProducts: null,
      bruecheKnown: 1,
      complete: false,
      split: [
        { ...mixed.split[0], totalIsMinimum: false },
        { ...mixed.split[1], total: 7, doughPieces: 7, totalIsMinimum: true },
      ],
    }
    expect(bruchGroupText(open)).toBe(
      '≥ 1 Bruch × 2.000 g – 12 Teststern, ≥ 7 Testkäse'
    )
  })

  it('„frei“: ein Teigstück, das kein ganzes Produkt ist, steht in Teigstücken - nie „+0 frei“', () => {
    const [, tue] = saturdayV2Draft().rolls ?? []
    const doppel = tue.groups[0]
    expect(
      bruchSpareText({ ...doppel, spare: 1, spareProducts: 0, perProduct: 2 })
    ).toBe(' · +1 Teigstück frei')
    expect(
      bruchSpareText({ ...doppel, spare: 0, spareProducts: 0, perProduct: 2 })
    ).toBe(' · +0 frei')
  })

  it('Hefeteig: alle Grundmengen offen heißt „–“, nicht „≥ 0“', () => {
    expect(hefeteigPiecesText({ pieces: 0, piecesComplete: false })).toBe('–')
    expect(hefeteigPiecesText({ pieces: 12, piecesComplete: false })).toBe(
      '≥ 12'
    )
  })

  it('Füllung mit offener Grundmenge: „≥“ bzw. „offen“ und ein Hinweis', () => {
    const items = [
      {
        itemId: 'test-zopf',
        name: 'Testzopf',
        pieces: 3,
        filling_g: 400,
        grams: 1200,
      },
    ]
    const open = {
      grams: 1200,
      missingFillingG: false,
      baseUnset: true,
      openItems: ['Testzopf – Apfel'],
      items,
    }
    expect(fillingGramsText(open)).toBe('≥ 1,2 kg')
    expect(fillingGramsText({ ...open, grams: 0, items: [] })).toBe('offen')
    expect(fillingOpenNote(open)).toContain(
      'Grundmenge offen: Testzopf – Apfel'
    )
    expect(fillingOpenNote({ baseUnset: undefined })).toBeNull()
  })

  it('Hefeteig-Nachtrag bei unvollständigem Teig: kein „+0 g“, Gesamt als Mindestmenge', () => {
    const extras = {
      doughs: [
        {
          id: 'test-hefe',
          name: 'Testhefe',
          pieces: 4,
          totalPieces: 37,
          totalPiecesComplete: false,
          dough_g: 2400,
          totalDough_g: null,
          totalDoughKnown_g: 16500,
          batches: null,
          batchesBefore: null,
          batch_max_kg: null,
          weighing: [{ piece_g: 600, pieces: 4, total: 9 }],
        },
      ],
      fillings: [],
    }
    const [text] = deltaExtrasLines(extras)
    expect(text).toContain('4 Teigstücke mehr (+2,4 kg Teig)')
    expect(text).toContain('mit Nachträgen ≥ 37 Teigstücke, ≥ 16,5 kg Teig')
    expect(text).not.toMatch(/\+0 g|, 0 g/)
    const unknown = {
      ...extras,
      doughs: [{ ...extras.doughs[0], dough_g: null, totalDoughKnown_g: 0 }],
    }
    const [u] = deltaExtrasLines(unknown)
    expect(u).toContain('(Zusatzteig unbekannt)')
    expect(u).toContain('Teig gesamt unbekannt')
    expect(deltaExtrasHighlights(unknown)[0].amounts).toEqual(['+4 × 600 g'])
  })

  it('Nachtrag an der Maschine: offene Rundung zeigt die genauen Liter, „unbekannt“ nur ohne kg je Liter', () => {
    const base = v2DeltaDough().deltaMachine?.[0]
    if (!base) throw new Error('Fixture ohne deltaMachine')
    const at = (m: typeof base) =>
      deltaDoughLines({ date: SAT, deltaBruch: [], deltaMachine: [m] })[0]
    expect(
      at({
        ...base,
        litersBefore: {
          exact: 17.21,
          rounded: null,
          reason: 'rounding_unknown',
        },
        liters: { exact: 19.85, rounded: null, reason: 'rounding_unknown' },
      })
    ).toContain('Liter 17,21 L → 19,85 L (Rundung offen)')
    expect(
      at({
        ...base,
        litersBefore: {
          exact: null,
          rounded: null,
          reason: 'kg_per_liter_unknown',
        },
        liters: { exact: null, rounded: null, reason: 'kg_per_liter_unknown' },
      })
    ).toContain('Liter unbekannt (kg je Liter offen)')
  })

  it('große Literzahl ohne Zusatz - „Rundung offen“ steht klein darunter', () => {
    expect(
      litersFigure({ exact: 15.09, rounded: null, reason: 'rounding_unknown' })
    ).toBe('15,09 L')
    expect(litersFigure({ exact: 5.87, rounded: 6, reason: null })).toBe('6 L')
    expect(
      litersFigure({ exact: null, rounded: null, reason: 'dough_incomplete' })
    ).toBe('unbekannt')
  })
})
