import {
  addDays,
  deltaBadgeText,
  deltaExtrasLines,
  formatSignedQty,
  formatDateLong,
  formatDateShort,
  formatFactor,
  formatGrams,
  formatQty,
  formatSigned,
  hasHefeteig,
  ingredientAmount,
  isIsoDate,
  recipeHeading,
  recipeIncompleteNote,
  isoWeekday,
  lineLabel,
  neighbourProductionDay,
  nextProductionDay,
  openDeltas,
  parseDecimal,
  previouslyDoneText,
  linesWithPreorders,
  describeProductionDays,
  changedTotals,
  toggleSign,
  todayIso,
  upcomingProductionDays,
} from './backzettelFormat'
import {
  TEST_CONFIG,
  saturdayConfirmed,
  saturdayDraft,
} from './backzettelFixtures'
import { prepTaskLabel } from '../components/backzettel/PrepCard'

describe('Backzettel-Kalender', () => {
  it('prüft Daten kalendarisch', () => {
    expect(isIsoDate('2026-11-28')).toBe(true)
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('28.11.2026')).toBe(false)
    expect(isIsoDate(undefined)).toBe(false)
  })

  it('rechnet Wochentage und Tage über Monatsgrenzen', () => {
    expect(isoWeekday('2026-11-23')).toBe(1) // Montag
    expect(isoWeekday('2026-11-29')).toBe(7)
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(todayIso(new Date(2026, 10, 5, 23, 59))).toBe('2026-11-05')
  })

  it('listet die kommenden 7 Tage ohne Montag (Ruhetag)', () => {
    // Do 2026-11-26 → Do, Fr, Sa, So, (Mo), Di, Mi
    expect(upcomingProductionDays('2026-11-26')).toEqual([
      '2026-11-26',
      '2026-11-27',
      '2026-11-28',
      '2026-11-29',
      '2026-12-01',
      '2026-12-02',
    ])
    // Stammdaten mit anderen Tagen gewinnen
    expect(upcomingProductionDays('2026-11-26', [6])).toEqual(['2026-11-28'])
  })

  it('nächster Produktionstag ist der erste nach heute', () => {
    expect(nextProductionDay('2026-11-27')).toBe('2026-11-28')
    // Sonntag → über den Montag hinweg zum Dienstag
    expect(nextProductionDay('2026-11-29')).toBe('2026-12-01')
    expect(neighbourProductionDay('2026-12-01', -1)).toBe('2026-11-29')
    expect(neighbourProductionDay('2026-11-29', 1)).toBe('2026-12-01')
  })

  it('formatiert Daten deutsch', () => {
    expect(formatDateLong('2026-11-28')).toBe('Samstag, 28.11.2026')
    expect(formatDateShort('2026-12-01')).toBe('Di 01.12.')
  })
})

describe('Backzettel-Zahlen', () => {
  it('Mengen mit Einheit, Liter mit Komma', () => {
    expect(formatQty(40, 'Stück')).toBe('40')
    expect(formatQty(1.24, 'Liter')).toBe('1,24 l')
    expect(formatQty(3, 'Blech')).toBe('3 Bl.')
  })

  it('Vorzeichen, Gramm, Faktor', () => {
    expect(formatSigned(2)).toBe('+2')
    expect(formatSigned(-1.5)).toBe('−1,5')
    expect(formatSigned(0)).toBe('–')
    expect(formatGrams(450)).toBe('450 g')
    expect(formatGrams(2400)).toBe('2,4 kg')
    expect(formatFactor(1)).toBe('1,0')
    expect(formatFactor(1.25)).toBe('1,25')
  })

  it('liest Eingaben mit Komma oder Punkt, sonst NaN', () => {
    expect(parseDecimal('1,2')).toBe(1.2)
    expect(parseDecimal(' -3 ')).toBe(-3)
    expect(parseDecimal('\u22123')).toBe(-3)
    expect(parseDecimal('\u22121,5')).toBe(-1.5)
    expect(parseDecimal('abc')).toBeNaN()
    expect(parseDecimal('1,2,3')).toBeNaN()
  })
})

describe('Backzettel-Beschriftungen', () => {
  it('Sorte = Füllungsname aus den Stammdaten', () => {
    expect(
      lineLabel(
        { name: 'Testzopf gefüllt', variant: 'nuss', itemId: 'test-zopf' },
        TEST_CONFIG
      )
    ).toBe('Testzopf gefüllt – Testnussfüllung')
    expect(
      lineLabel(
        { name: 'Testzopf gefüllt', variant: null, itemId: 'test-zopf' },
        TEST_CONFIG
      )
    ).toBe('Testzopf gefüllt – ohne Füllungsangabe')
    expect(lineLabel({ name: 'X', variant: 'kirsch', itemId: 'x' }, null)).toBe(
      'X – Kirsch'
    )
  })

  it('zählt offene Nachträge und vorbestellte Stück', () => {
    expect(openDeltas(saturdayConfirmed())).toHaveLength(1)
    expect(openDeltas(saturdayDraft())).toHaveLength(0)
    expect(linesWithPreorders(saturdayDraft())).toBe(1)
    expect(hasHefeteig(saturdayDraft())).toBe(true)
    expect(hasHefeteig({ hefeteig: null, fillings: [] })).toBe(false)
  })
})

describe('Backzettel-Helfer (Fixup)', () => {
  it('toggleSign dreht das Vorzeichen (iOS-Ziffernblock ohne Minus)', () => {
    expect(toggleSign('')).toBe('-')
    expect(toggleSign('3')).toBe('-3')
    expect(toggleSign('-3')).toBe('3')
    expect(toggleSign('\u22123')).toBe('3')
    expect(toggleSign('+2,5')).toBe('-2,5')
  })

  it('describeProductionDays aus config.days', () => {
    expect(describeProductionDays([2, 3, 4, 5, 6, 7])).toBe(
      'Die kommenden Produktionstage (Di–So). Montag ist Ruhetag.'
    )
    expect(describeProductionDays([2, 4, 6])).toBe(
      'Die kommenden Produktionstage (Di, Do, Sa). Montag, Mittwoch, Freitag und Sonntag sind Ruhetage.'
    )
    expect(describeProductionDays([1, 2, 3, 4, 5, 6, 7])).toBe(
      'Die kommenden Produktionstage (Mo–So). Kein Ruhetag.'
    )
    expect(describeProductionDays(null)).toBe('Die kommenden Produktionstage.')
  })

  it('changedTotals vergleicht die Gesamtwerte zweier Stände', () => {
    const before = saturdayDraft()
    const after = saturdayDraft()
    expect(changedTotals(before, after)).toEqual([])
    const line = after.sections[0].lines[0]
    line.total = line.total + 2
    const changes = changedTotals(before, after)
    expect(changes).toHaveLength(1)
    expect(changes[0].line.key).toBe(line.key)
    expect(changes[0].after).toBe((changes[0].before ?? 0) + 2)
  })
})

describe('Nachträge mit Einheit und Backmenge (W4-Verifikation)', () => {
  it('formatSignedQty hängt die Einheit an', () => {
    expect(formatSignedQty(1, 'Liter')).toBe('+1 l')
    expect(formatSignedQty(-2, 'Stück')).toBe('−2')
    expect(formatSignedQty(0.5, 'kg')).toBe('+0,5 kg')
    expect(formatSignedQty(0, 'Liter')).toBe('–')
  })

  it('deltaBadgeText sagt, was nach dem Aufrunden zu backen ist', () => {
    expect(
      deltaBadgeText({ qty: 1, open: 1, count: 1, bake: 1 }, 'Liter')
    ).toBe('Nachtrag +1 l')
    expect(
      deltaBadgeText({ qty: 0.25, open: 1, count: 1, bake: 1 }, 'Stück')
    ).toBe('Nachtrag +0,25 · 1 mehr backen')
    expect(
      deltaBadgeText({ qty: 0.25, open: 1, count: 1, bake: 0 }, 'Stück')
    ).toBe('Nachtrag +0,25 · nichts mehr backen')
    expect(
      deltaBadgeText({ qty: -0.5, open: 1, count: 1, bake: -1 }, 'Stück')
    ).toBe('Nachtrag −0,5 · 1 weniger backen')
    // Neu + Storno heben sich auf (W4-verify r3)
    expect(
      deltaBadgeText({ qty: 0, open: 1, count: 2, bake: 0 }, 'Stück')
    ).toBe('Nachtrag ±0 · nichts ändern')
    expect(deltaBadgeText({ qty: 0, open: 1, count: 2 }, 'Stück')).toBe(
      'Nachtrag ±0 · nichts ändern'
    )
    // älterer Server ohne `bake`
    expect(deltaBadgeText({ qty: 2, open: 1, count: 1 }, 'Stück')).toBe(
      'Nachtrag +2'
    )
  })

  it('deltaExtrasLines beschreibt Teig und Füllung zusätzlich', () => {
    expect(deltaExtrasLines(null)).toEqual([])
    expect(
      deltaExtrasLines({
        doughs: [
          {
            id: 'h',
            name: 'Hefeteig',
            pieces: 4,
            totalPieces: 51,
            dough_g: 2400,
            totalDough_g: 30600,
            batches: 4,
            weighing: [{ piece_g: 600, pieces: 4, total: 20 }],
          },
        ],
        fillings: [
          { id: 'mohn', name: 'Mohnfüllung', grams: 1600, totalGrams: 5200 },
        ],
      })
    ).toEqual([
      'Hefeteig: 4 Teigstücke mehr (+2,4 kg Teig): 4 × 600 g zusätzlich abwiegen; mit Nachträgen 51 Teigstücke, 30,6 kg',
      'Mohnfüllung: +1,6 kg; mit Nachträgen 5,2 kg',
    ])
  })

  it('deltaExtrasLines: eine Abnahme heißt „weniger", ohne Minus vor „abwiegen" (W4-verify r3)', () => {
    const [line] = deltaExtrasLines({
      doughs: [
        {
          id: 'h',
          name: 'Hefeteig',
          pieces: -3,
          totalPieces: 44,
          dough_g: -1700,
          totalDough_g: 26000,
          batches: 3,
          weighing: [
            { piece_g: 600, pieces: -2, total: 10 },
            { piece_g: 500, pieces: -1, total: 4 },
          ],
        },
      ],
      fillings: [],
    })
    expect(line).toBe(
      'Hefeteig: 3 Teigstücke weniger (−1,7 kg Teig): 2 × 600 g weniger abwiegen, 1 × 500 g weniger abwiegen; mit Nachträgen 44 Teigstücke, 26 kg'
    )
    expect(line).not.toMatch(/−\d+ ×/)
  })

  it('deltaExtrasLines nennt neue Chargen und das Rezept der Zusatzfüllung (W4-verify r2)', () => {
    expect(
      deltaExtrasLines({
        doughs: [
          {
            id: 'h',
            name: 'Hefeteig',
            pieces: 17,
            totalPieces: 64,
            dough_g: 10100,
            totalDough_g: 31000,
            batches: 4,
            batchesBefore: 3,
            batch_max_kg: 10,
            weighing: [],
          },
        ],
        fillings: [
          {
            id: 'nuss',
            name: 'Nussfüllung',
            grams: 6000,
            totalGrams: 9000,
            recipe: {
              title: 'Nussfüllung',
              batch_g: 2000,
              grams: 6000,
              factor: 3,
              complete: true,
              ingredients: [
                {
                  name: 'Nüsse',
                  g: 1000,
                  unit: 'g',
                  raw: '1 kg',
                  scaled_g: 3000,
                },
              ],
            },
          },
        ],
      })
    ).toEqual([
      'Hefeteig: 17 Teigstücke mehr (+10,1 kg Teig); mit Nachträgen 64 Teigstücke, 31 kg; jetzt 4 Chargen statt 3 (je max. 10 kg); den Zusatzteig in 2 Chargen ansetzen',
      'Nussfüllung: +6 kg; mit Nachträgen 9 kg; dafür Rezept „Nussfüllung“ × 3: Nüsse 3 kg',
    ])
  })

  it('rechnet ein unvollständiges Rezept nicht hoch (W4-verify r2)', () => {
    const recipe = {
      title: 'Apfelfüllung',
      batch_g: null,
      grams: 400,
      factor: null,
      complete: false,
      ingredients: [
        {
          name: 'Äpfel',
          g: null,
          unit: null,
          raw: '1 Dose (ca. 2 kg)',
          scaled_g: null,
        },
      ],
    }
    expect(recipeHeading(recipe)).toBe(
      'Rezept „Apfelfüllung“ – Grundrezept, nicht hochgerechnet'
    )
    expect(recipeIncompleteNote(recipe)).toMatch(
      /nicht hochgerechnet.*400 g Füllung/
    )
    expect(ingredientAmount(recipe.ingredients[0], recipe).text).toBe(
      '1 Dose (ca. 2 kg)'
    )
  })
})

describe('erneute Freigabe nach dem Abhaken (W4-verify r2)', () => {
  it('previouslyDoneText nennt Gebackenes und den Rest', () => {
    const line = saturdayConfirmed().sections[1].lines[0]
    line.total = 78
    line.doneAt = null
    expect(previouslyDoneText(line)).toBeNull()
    line.previouslyDone = { qty: 70, at: null, by: { id: 1, displayName: 'B' } }
    expect(previouslyDoneText(line)).toBe('bereits 70 erledigt (B) - noch +8')
    line.previouslyDone = { qty: 80, at: null, by: null }
    expect(previouslyDoneText(line)).toBe(
      'bereits 80 erledigt - jetzt 2 weniger nötig'
    )
    line.doneAt = '2026-11-28T04:00:00.000Z'
    expect(previouslyDoneText(line)).toBeNull()
  })
})

describe('Vorbereitungs-Beschriftung (W4-verify r2)', () => {
  it('nimmt variantLabel aus der YAML, sonst die ID mit großem Anfang', () => {
    expect(
      prepTaskLabel({
        id: 'x',
        name: 'Hefeteig ansetzen',
        variant: 'gross',
        variantLabel: 'groß',
      })
    ).toBe('Hefeteig ansetzen (groß)')
    expect(
      prepTaskLabel({ id: 'x', name: 'Sauerteig', variant: 'misch' })
    ).toBe('Sauerteig (Misch)')
  })
})
