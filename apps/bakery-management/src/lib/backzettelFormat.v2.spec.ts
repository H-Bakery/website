import {
  addonText,
  bakeDayLabel,
  bakeSourceText,
  batchesText,
  bruchGroupText,
  bruchStep,
  doughsTodayText,
  fillingGramsText,
  formatKnown,
  formatKnownGrams,
  kgText,
  lineLabel,
  litersHint,
  litersLabel,
  litersText,
  variantLabel,
} from './backzettelFormat'
import {
  SAT,
  SUN,
  TEST_CONFIG_V2,
  V2_TUE,
  saturdayV2Draft,
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
    ).toBe('Liter: unbekannt (kg je Liter fehlt)')
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
      '7 Bruch × 1.150 g – 66 Testdoppel · +8 frei'
    )
    expect(bruchGroupText(tue.groups[1])).toBe(
      '1 Bruch × g unbekannt – 20 Testflitweck · +0 frei'
    )
    expect(bruchStep(20, 2)).toBe(10)
    expect(bruchStep(20, 3)).toBeNull()
    expect(bruchStep(null, 1)).toBeNull()
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
})
