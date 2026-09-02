/**
 * Tests für die Berechnungslogik der Verkaufspartner-Kennzahlen (TASK-037).
 *
 * Alle Erwartungswerte sind von Hand aus den Formeln abgeleitet:
 *
 *   Bestand nach Besuch k = Rest_k + Geliefert_k
 *   Verkauf im Intervall  = Bestand nach Besuch k − Rest_(k+1)
 *   Umsatz                = Σ (Verkauf je Produkt × Preis-Snapshot)
 *   Abverkaufsquote       = Verkauf / Geliefert
 *
 * Der Core ist dependency-frei - dieser Test braucht deshalb keine Mocks.
 */

const {
  VISIT_TYPES,
  VISIT_TYPE_LABELS,
  WEEKDAY_LABELS,
  WEEKDAY_SHORT,
  businessDateOf,
  weekdayOf,
  sortVisits,
  groupByBusinessDate,
  computeDay,
  computeDayDetail,
  computeStats,
  statsToCsv,
} = require('../../src/services/partner-stats.core')

// --- Fixtures ---------------------------------------------------------------

const BROT = {
  productId: 1,
  productSlug: 'bauernbrot',
  productName: 'Bauernbrot',
  unitPrice: 3.5,
}

const BROETCHEN = {
  productId: 2,
  productSlug: 'kaiserbroetchen',
  productName: 'Kaiserbrötchen',
  unitPrice: 0.6,
}

const PARTNER = {
  id: 1,
  name: 'CAP-Markt Homburg-Kirrberg',
  slug: 'cap-markt-homburg-kirrberg',
  settlementModel: 'commission',
}

let nextVisitId = 1

/** Ein Positionsdatensatz; `unitPrice` überschreibbar, um Preis-Snapshots zu prüfen. */
function item(product, countedQty, deliveredQty, unitPrice) {
  return {
    productId: product.productId,
    productSlug: product.productSlug,
    productName: product.productName,
    unitPrice: unitPrice == null ? product.unitPrice : unitPrice,
    countedQty,
    deliveredQty,
  }
}

/** Ein Besuch; die Uhrzeit leitet sich aus der `sequence` ab (07:00, 08:00, …). */
function visit(businessDate, visitType, sequence, items, extra) {
  const hour = String(6 + sequence).padStart(2, '0')
  return Object.assign(
    {
      id: nextVisitId++,
      partnerId: 1,
      businessDate,
      visitAt: `${businessDate}T${hour}:00:00`,
      visitType,
      sequence,
      staffId: null,
      staffName: 'Team',
      note: null,
      items,
    },
    extra || {}
  )
}

/** Ein abgeschlossener Ein-Produkt-Tag: liefern, am Ende Rest zählen. */
function simpleDay(businessDate, deliveredQty, restQty, unitPrice) {
  return [
    visit(businessDate, 'initial', 1, [item(BROT, 0, deliveredQty, unitPrice)]),
    visit(businessDate, 'pickup', 2, [item(BROT, restQty, 0, unitPrice)]),
  ]
}

/** Das durchgerechnete Beispiel aus dem Task: 20 geliefert, 10 nachgelegt, 8 zurück. */
function workedExampleVisits() {
  return [
    visit('2026-08-25', 'initial', 1, [item(BROT, 0, 20)]),
    visit('2026-08-25', 'refill', 2, [item(BROT, 5, 10)]),
    visit('2026-08-25', 'pickup', 3, [item(BROT, 8, 0)]),
  ]
}

beforeEach(() => {
  nextVisitId = 1
})

// --- Konstanten -------------------------------------------------------------

describe('Konstanten und Labels', () => {
  it('kennt genau drei Besuchstypen mit deutschen Labels', () => {
    expect(VISIT_TYPES).toEqual(['initial', 'refill', 'pickup'])
    expect(Object.keys(VISIT_TYPE_LABELS)).toEqual(VISIT_TYPES)
    expect(VISIT_TYPE_LABELS).toEqual({
      initial: 'Erstbestückung',
      refill: 'Nachlieferung',
      pickup: 'Abholung',
    })
  })

  it('deckt alle sieben ISO-Wochentage lang und kurz ab', () => {
    expect(WEEKDAY_LABELS).toEqual({
      1: 'Montag',
      2: 'Dienstag',
      3: 'Mittwoch',
      4: 'Donnerstag',
      5: 'Freitag',
      6: 'Samstag',
      7: 'Sonntag',
    })
    expect(WEEKDAY_SHORT).toEqual({
      1: 'Mo',
      2: 'Di',
      3: 'Mi',
      4: 'Do',
      5: 'Fr',
      6: 'Sa',
      7: 'So',
    })
  })
})

// --- businessDateOf / weekdayOf --------------------------------------------

describe('businessDateOf', () => {
  it('formatiert einen lokalen Zeitpunkt als YYYY-MM-DD mit führenden Nullen', () => {
    expect(businessDateOf(new Date(2026, 0, 6, 23, 30))).toBe('2026-01-06')
    expect(businessDateOf(new Date(2026, 11, 31, 22, 0))).toBe('2026-12-31')
  })

  it('hält einen frühen Morgenbesuch beim selben Geschäftstag', () => {
    expect(businessDateOf(new Date(2026, 7, 25, 5, 45))).toBe('2026-08-25')
    expect(businessDateOf('2026-08-25T05:45:00')).toBe('2026-08-25')
  })

  it('liefert null für einen unlesbaren Wert', () => {
    expect(businessDateOf('kein Datum')).toBeNull()
    expect(businessDateOf(undefined)).toBeNull()
  })
})

describe('weekdayOf', () => {
  it('zählt ISO: Montag = 1 bis Sonntag = 7', () => {
    expect(weekdayOf('2026-08-31')).toBe(1)
    expect(weekdayOf('2026-09-01')).toBe(2)
    expect(weekdayOf('2026-09-02')).toBe(3)
    expect(weekdayOf('2026-09-03')).toBe(4)
    expect(weekdayOf('2026-09-04')).toBe(5)
    expect(weekdayOf('2026-09-05')).toBe(6)
    expect(weekdayOf('2026-09-06')).toBe(7)
  })

  it('erkennt die CAP-Liefertage Dienstag bis Samstag', () => {
    expect(weekdayOf('2026-08-25')).toBe(2)
    expect(weekdayOf('2026-08-26')).toBe(3)
    expect(weekdayOf('2026-08-29')).toBe(6)
    expect(weekdayOf(businessDateOf(new Date(2026, 7, 25, 6, 30)))).toBe(2)
  })

  it('liefert null für unbrauchbare Eingaben', () => {
    expect(weekdayOf(null)).toBeNull()
    expect(weekdayOf('2026-08')).toBeNull()
    expect(weekdayOf('abcd-ef-gh')).toBeNull()
  })
})

// --- Sortierung und Gruppierung --------------------------------------------

describe('sortVisits', () => {
  it('ordnet nach Geschäftstag, dann nach sequence', () => {
    const a = visit('2026-08-26', 'initial', 1, [])
    const b = visit('2026-08-25', 'pickup', 3, [])
    const c = visit('2026-08-25', 'initial', 1, [])
    const sorted = sortVisits([a, b, c])
    expect(sorted.map((v) => [v.businessDate, v.sequence])).toEqual([
      ['2026-08-25', 1],
      ['2026-08-25', 3],
      ['2026-08-26', 1],
    ])
  })

  it('lässt sequence gegen eine nachträglich korrigierte Uhrzeit gewinnen', () => {
    const early = visit('2026-08-25', 'initial', 1, [], {
      visitAt: '2026-08-25T12:00:00',
    })
    const later = visit('2026-08-25', 'refill', 2, [], {
      visitAt: '2026-08-25T08:00:00',
    })
    expect(sortVisits([later, early]).map((v) => v.sequence)).toEqual([1, 2])
  })

  it('verändert das übergebene Array nicht', () => {
    const visits = [
      visit('2026-08-26', 'initial', 1, []),
      visit('2026-08-25', 'initial', 1, []),
    ]
    const before = visits.map((v) => v.businessDate)
    sortVisits(visits)
    expect(visits.map((v) => v.businessDate)).toEqual(before)
  })
})

describe('groupByBusinessDate', () => {
  it('gruppiert nach Geschäftstag, jede Gruppe chronologisch', () => {
    const visits = [
      visit('2026-08-26', 'pickup', 2, []),
      visit('2026-08-25', 'pickup', 2, []),
      visit('2026-08-26', 'initial', 1, []),
      visit('2026-08-25', 'initial', 1, []),
    ]
    const groups = groupByBusinessDate(visits)
    expect([...groups.keys()]).toEqual(['2026-08-25', '2026-08-26'])
    expect(groups.get('2026-08-25').map((v) => v.sequence)).toEqual([1, 2])
    expect(groups.get('2026-08-26').map((v) => v.visitType)).toEqual([
      'initial',
      'pickup',
    ])
  })

  it('lässt Besuche ohne Geschäftstag fallen', () => {
    const groups = groupByBusinessDate([
      visit('2026-08-25', 'initial', 1, []),
      {
        id: 99,
        businessDate: null,
        visitType: 'refill',
        sequence: 2,
        items: [],
      },
    ])
    expect([...groups.keys()]).toEqual(['2026-08-25'])
    expect(groups.get('2026-08-25')).toHaveLength(1)
  })
})

// --- Durchgerechnetes Beispiel ---------------------------------------------

describe('computeDay - durchgerechnetes Beispiel', () => {
  // 20 geliefert -> Rest 5 (15 verkauft) + 10 nachgelegt -> Rest 8 (7 verkauft)
  it('bilanziert geliefert 30, verkauft 22, Retoure 8, Umsatz 77,00 EUR', () => {
    const day = computeDay(workedExampleVisits())
    const brot = day.products.get('bauernbrot')
    expect(brot.deliveredQty).toBe(30)
    expect(brot.soldQty).toBe(22)
    expect(brot.returnedQty).toBe(8)
    expect(brot.discrepancyQty).toBe(0)
    expect(brot.revenueCents).toBe(7700)
    expect(brot.unitPriceCents).toBe(350)
    expect(day.isOpen).toBe(false)
  })

  it('bucht den Verkauf je Intervall: 0, dann 15, dann 7', () => {
    const day = computeDay(workedExampleVisits())
    expect(day.timeline.map((t) => t.soldSinceLastQty)).toEqual([0, 15, 7])
    expect(day.timeline.map((t) => t.soldSinceLastRevenue)).toEqual([
      0, 52.5, 24.5,
    ])
    expect(day.timeline.map((t) => t.stockAfterQty)).toEqual([20, 15, 8])
    expect(day.timeline.map((t) => t.visitType)).toEqual([
      'initial',
      'refill',
      'pickup',
    ])
  })

  it('liefert die Abverkaufsquote 22/30 = 0,7333 und ist nicht vorläufig', () => {
    const stats = computeStats(workedExampleVisits())
    expect(stats.totals.deliveredQty).toBe(30)
    expect(stats.totals.soldQty).toBe(22)
    expect(stats.totals.returnedQty).toBe(8)
    expect(stats.totals.revenue).toBe(77)
    expect(stats.totals.returnValue).toBe(28)
    expect(stats.totals.sellThroughRate).toBe(0.7333)
    expect(stats.totals.returnRate).toBe(0.2667)
    expect(stats.totals.visitCount).toBe(3)
    expect(stats.totals.refillCount).toBe(1)
    expect(stats.isProvisional).toBe(false)
    expect(stats.openDates).toEqual([])
  })

  it('rechnet unabhängig von der Reihenfolge der übergebenen Besuche', () => {
    const visits = workedExampleVisits()
    const shuffled = [visits[2], visits[0], visits[1]]
    expect(
      computeDay(shuffled).timeline.map((t) => t.soldSinceLastQty)
    ).toEqual([0, 15, 7])
    expect(computeStats(shuffled).totals.revenue).toBe(77)
  })

  it('behandelt einen nicht gezählten Erstbesuch wie einen leeren Schrank', () => {
    const visits = [
      visit('2026-08-25', 'initial', 1, [item(BROT, null, 20)]),
      visit('2026-08-25', 'refill', 2, [item(BROT, 5, 10)]),
      visit('2026-08-25', 'pickup', 3, [item(BROT, 8, 0)]),
    ]
    const stats = computeStats(visits)
    expect(stats.totals.soldQty).toBe(22)
    expect(stats.totals.revenue).toBe(77)
  })
})

// --- Offener Tag ------------------------------------------------------------

describe('offener Geschäftstag (ohne Abholung)', () => {
  const openVisits = () => [
    visit('2026-08-26', 'initial', 1, [item(BROT, 0, 20)]),
    visit('2026-08-26', 'refill', 2, [item(BROT, 6, 5)]),
  ]

  it('markiert den Tag als offen und die Zahlen als vorläufig', () => {
    const stats = computeStats(openVisits())
    expect(stats.byDay[0].isOpen).toBe(true)
    expect(stats.isProvisional).toBe(true)
    expect(stats.openDates).toEqual(['2026-08-26'])
    expect(stats.totals.openDayCount).toBe(1)
    expect(stats.totals.dayCount).toBe(1)
  })

  it('zählt nur bis zum letzten gezählten Besuch als verkauft', () => {
    const stats = computeStats(openVisits())
    // 20 geliefert, bei Besuch 2 lagen noch 6 -> 14 verkauft.
    // Die 11 Stück, die danach im Schrank stehen, sind kein Verkauf.
    expect(stats.totals.deliveredQty).toBe(25)
    expect(stats.totals.soldQty).toBe(14)
    expect(stats.totals.returnedQty).toBe(0)
    expect(stats.totals.revenue).toBe(49)
    expect(stats.totals.sellThroughRate).toBe(0.56)
  })

  it('zeigt den offenen Tag auch in computeDayDetail als offen', () => {
    const detail = computeDayDetail(openVisits())
    expect(detail.isOpen).toBe(true)
    expect(detail.businessDate).toBe('2026-08-26')
    expect(detail.totals.openDayCount).toBe(1)
  })
})

// --- countedQty null --------------------------------------------------------

describe('nicht gezählter Besuch (countedQty null)', () => {
  const visits = () => [
    visit('2026-08-27', 'initial', 1, [item(BROT, 0, 20)]),
    visit('2026-08-27', 'refill', 2, [item(BROT, null, 6)]),
    visit('2026-08-27', 'pickup', 3, [item(BROT, 4, 0)]),
  ]

  it('erfindet keinen Verkauf und trägt den Bestand weiter', () => {
    const day = computeDay(visits())
    expect(day.timeline[1].soldSinceLastQty).toBe(0)
    expect(day.timeline[1].soldSinceLastRevenue).toBe(0)
    expect(day.timeline[1].items[0].countedQty).toBeNull()
    // 20 im Schrank + 6 nachgelegt = 26, obwohl nicht gezählt wurde
    expect(day.timeline[1].stockAfterQty).toBe(26)
  })

  it('holt den Verkauf beim nächsten gezählten Besuch nach', () => {
    const stats = computeStats(visits())
    expect(stats.totals.deliveredQty).toBe(26)
    expect(stats.totals.soldQty).toBe(22)
    expect(stats.totals.returnedQty).toBe(4)
    expect(stats.totals.discrepancyQty).toBe(0)
    expect(stats.totals.revenue).toBe(77)
  })
})

// --- Fehlzählung ------------------------------------------------------------

describe('Fehlzählung (mehr vorgefunden als erwartet)', () => {
  // 20 geliefert, Rest 15 (= 5 verkauft), danach werden plötzlich 18 gezählt
  const visits = () => [
    visit('2026-08-28', 'initial', 1, [item(BROT, 0, 20)]),
    visit('2026-08-28', 'refill', 2, [item(BROT, 15, 0)]),
    visit('2026-08-28', 'refill', 3, [item(BROT, 18, 0)]),
    visit('2026-08-28', 'pickup', 4, [item(BROT, 18, 0)]),
  ]

  it('bucht keinen negativen Verkauf, sondern eine Differenz', () => {
    const day = computeDay(visits())
    expect(day.timeline.map((t) => t.soldSinceLastQty)).toEqual([0, 5, 0, 0])
    expect(day.timeline[2].soldSinceLastRevenue).toBe(0)
    expect(day.products.get('bauernbrot').discrepancyQty).toBe(3)
  })

  it('kürzt die bereits gebuchten Summen nicht', () => {
    const stats = computeStats(visits())
    expect(stats.totals.soldQty).toBe(5)
    expect(stats.totals.revenue).toBe(17.5)
    expect(stats.totals.deliveredQty).toBe(20)
    expect(stats.totals.returnedQty).toBe(18)
    expect(stats.totals.discrepancyQty).toBe(3)
    expect(stats.byProduct[0].discrepancyQty).toBe(3)
  })

  it('kann durch eine Fehlzählung über 100 % Abverkauf ausweisen - erklärt durch discrepancyQty', () => {
    const stats = computeStats([
      visit('2026-08-28', 'initial', 1, [item(BROT, 0, 10)]),
      visit('2026-08-28', 'refill', 2, [item(BROT, 12, 0)]),
      visit('2026-08-28', 'pickup', 3, [item(BROT, 0, 0)]),
    ])
    expect(stats.totals.deliveredQty).toBe(10)
    expect(stats.totals.soldQty).toBe(12)
    expect(stats.totals.discrepancyQty).toBe(2)
    expect(stats.totals.sellThroughRate).toBe(1.2)
  })
})

// --- Preis-Snapshot ---------------------------------------------------------

describe('Preis-Snapshot', () => {
  // Tag A zu 3,00 EUR, Tag B zu 4,00 EUR - dieselbe Ware, späterer Preis
  const visits = () => [
    ...simpleDay('2026-08-25', 10, 4, 3.0),
    ...simpleDay('2026-09-01', 10, 2, 4.0),
  ]

  it('rechnet jeden Tag mit dem auf dem Besuch gespeicherten Preis', () => {
    const stats = computeStats(visits())
    expect(stats.byDay.map((d) => d.businessDate)).toEqual([
      '2026-08-25',
      '2026-09-01',
    ])
    // 6 Stück × 3,00 EUR - der spätere Preis von 4,00 EUR ändert daran nichts
    expect(stats.byDay[0].soldQty).toBe(6)
    expect(stats.byDay[0].revenue).toBe(18)
    expect(stats.byDay[0].returnValue).toBe(12)
    // 8 Stück × 4,00 EUR
    expect(stats.byDay[1].soldQty).toBe(8)
    expect(stats.byDay[1].revenue).toBe(32)
    expect(stats.byDay[1].returnValue).toBe(8)
  })

  it('summiert die Snapshots, statt alles mit dem aktuellen Preis zu bewerten', () => {
    const stats = computeStats(visits())
    // 14 verkaufte Stück × 4,00 EUR wären 56,00 EUR - richtig sind 50,00 EUR
    expect(stats.totals.soldQty).toBe(14)
    expect(stats.totals.revenue).toBe(50)
    expect(stats.totals.returnValue).toBe(20)
    expect(stats.byProduct[0].revenue).toBe(50)
  })

  it('zeigt je Produkt den jüngsten Preis-Snapshot an', () => {
    const stats = computeStats(visits())
    expect(stats.byProduct[0].unitPrice).toBe(4)
  })
})

// --- Mehrere Produkte -------------------------------------------------------

describe('mehrere Produkte in einem Besuch', () => {
  const visits = () => [
    visit('2026-08-29', 'initial', 1, [
      item(BROT, 0, 10),
      item(BROETCHEN, 0, 50),
    ]),
    visit('2026-08-29', 'refill', 2, [
      item(BROT, 3, 5),
      item(BROETCHEN, 20, 30),
    ]),
    visit('2026-08-29', 'pickup', 3, [
      item(BROT, 2, 0),
      item(BROETCHEN, 10, 0),
    ]),
  ]

  it('führt je Produkt eine eigene Bilanz', () => {
    const stats = computeStats(visits())
    const brot = stats.byProduct.find((p) => p.productSlug === 'bauernbrot')
    const broetchen = stats.byProduct.find(
      (p) => p.productSlug === 'kaiserbroetchen'
    )
    // Brot: 10 + 5 geliefert, Rest 2 -> 13 verkauft × 3,50 EUR
    expect(brot).toMatchObject({
      productName: 'Bauernbrot',
      deliveredQty: 15,
      soldQty: 13,
      returnedQty: 2,
      revenue: 45.5,
      sellThroughRate: 0.8667,
    })
    // Brötchen: 50 + 30 geliefert, Rest 10 -> 70 verkauft × 0,60 EUR
    expect(broetchen).toMatchObject({
      productName: 'Kaiserbrötchen',
      deliveredQty: 80,
      soldQty: 70,
      returnedQty: 10,
      revenue: 42,
      sellThroughRate: 0.875,
    })
  })

  it('sortiert die Produktliste nach Umsatz absteigend', () => {
    const stats = computeStats(visits())
    expect(stats.byProduct.map((p) => p.productSlug)).toEqual([
      'bauernbrot',
      'kaiserbroetchen',
    ])
  })

  it('summiert die Produkte korrekt in den Tagessummen', () => {
    const stats = computeStats(visits())
    expect(stats.totals.deliveredQty).toBe(95)
    expect(stats.totals.soldQty).toBe(83)
    expect(stats.totals.returnedQty).toBe(12)
    expect(stats.totals.revenue).toBe(87.5)
    expect(stats.totals.returnValue).toBe(13)
    expect(stats.totals.sellThroughRate).toBe(0.8737)
  })

  it('fasst die Produkte je Besuch in der Timeline zusammen', () => {
    const day = computeDay(visits())
    expect(day.timeline.map((t) => t.countedQty)).toEqual([0, 23, 12])
    expect(day.timeline.map((t) => t.deliveredQty)).toEqual([60, 35, 0])
    expect(day.timeline.map((t) => t.soldSinceLastQty)).toEqual([0, 37, 46])
    expect(day.timeline.map((t) => t.soldSinceLastRevenue)).toEqual([
      0, 42.5, 45,
    ])
    expect(day.timeline.map((t) => t.stockAfterQty)).toEqual([60, 58, 12])
  })
})

// --- Unvollständige Abholung ------------------------------------------------

describe('unvollständige Abholung (nicht jedes Produkt gezählt)', () => {
  // 10 Brot + 6 Brötchen geliefert; bei der Abholung wird nur das Brot gezählt.
  const visits = () => [
    visit('2026-08-25', 'initial', 1, [
      item(BROT, 0, 10),
      item(BROETCHEN, 0, 6),
    ]),
    visit('2026-08-25', 'pickup', 2, [item(BROT, 2, 0)]),
  ]

  it('schließt den Tag, markiert ihn aber als unvollständig', () => {
    const day = computeDay(visits())
    expect(day.isOpen).toBe(false)
    expect(day.isComplete).toBe(false)
    expect(day.uncountedQty).toBe(6)
    expect(day.uncountedProducts).toEqual([
      {
        productId: 2,
        productSlug: 'kaiserbroetchen',
        productName: 'Kaiserbrötchen',
        stockQty: 6,
      },
    ])
  })

  it('bucht die ungezählten Stücke weder als Verkauf noch als Retoure', () => {
    const stats = computeStats(visits())
    const broetchen = stats.byProduct.find(
      (p) => p.productSlug === 'kaiserbroetchen'
    )
    expect(broetchen).toMatchObject({
      deliveredQty: 6,
      soldQty: 0,
      returnedQty: 0,
      uncountedQty: 6,
    })
    const brot = stats.byProduct.find((p) => p.productSlug === 'bauernbrot')
    expect(brot).toMatchObject({ soldQty: 8, returnedQty: 2, uncountedQty: 0 })
    expect(stats.totals.uncountedQty).toBe(6)
    expect(stats.totals.incompleteDayCount).toBe(1)
  })

  it('macht die Zahlen vorläufig, obwohl kein Tag offen ist', () => {
    const stats = computeStats(visits())
    expect(stats.openDates).toEqual([])
    expect(stats.incompleteDates).toEqual(['2026-08-25'])
    expect(stats.isProvisional).toBe(true)
    expect(stats.byDay[0]).toMatchObject({
      isOpen: false,
      isComplete: false,
      uncountedQty: 6,
    })
  })

  it('gilt als vollständig, sobald jedes Produkt mit Bestand gezählt ist', () => {
    const complete = [
      visits()[0],
      visit('2026-08-25', 'pickup', 2, [
        item(BROT, 2, 0),
        item(BROETCHEN, 2, 0),
      ]),
    ]
    const stats = computeStats(complete)
    expect(stats.isProvisional).toBe(false)
    expect(stats.incompleteDates).toEqual([])
    expect(stats.totals.uncountedQty).toBe(0)
    expect(stats.totals.returnedQty).toBe(4)
    expect(computeDay(complete)).toMatchObject({
      isComplete: true,
      uncountedQty: 0,
      uncountedProducts: [],
    })
  })

  it('verlangt keine Zählung für ein Produkt, das schon leer war', () => {
    // Brötchen bei der Nachlieferung mit 0 gezählt und nichts nachgelegt:
    // bei der Abholung liegt keins mehr da, also fehlt auch keine Zählung.
    const stats = computeStats([
      visits()[0],
      visit('2026-08-25', 'refill', 2, [item(BROETCHEN, 0, 0)]),
      visit('2026-08-25', 'pickup', 3, [item(BROT, 2, 0)]),
    ])
    expect(stats.isProvisional).toBe(false)
    expect(stats.totals.uncountedQty).toBe(0)
  })

  it('zeigt die Unvollständigkeit auch in computeDayDetail', () => {
    const detail = computeDayDetail(visits())
    expect(detail.isOpen).toBe(false)
    expect(detail.isComplete).toBe(false)
    expect(detail.uncountedQty).toBe(6)
    expect(detail.uncountedProducts.map((p) => p.productName)).toEqual([
      'Kaiserbrötchen',
    ])
  })

  it('weist die Unvollständigkeit im CSV aus', () => {
    const lines = statsToCsv(computeStats(visits()), PARTNER).split('\r\n')
    expect(lines).toContain(
      'Hinweis;Vorläufig - 1 Tag(e) mit ungezählten Produkten bei der Abholung'
    )
    expect(lines).toContain('Kaiserbrötchen;0,60;6;0;0;0,0%;0,00;6')
    expect(lines).toContain(
      '2026-08-25;Di;unvollständig;2;16;8;2;50,0%;28,00;6'
    )
    expect(lines).toContain('Ungezählt;6')
  })

  it('nennt im CSV-Hinweis beide Gründe, wenn beides vorkommt', () => {
    const lines = statsToCsv(
      computeStats([
        ...visits(),
        visit('2026-08-26', 'initial', 1, [item(BROT, 0, 10)]),
      ]),
      PARTNER
    ).split('\r\n')
    expect(lines).toContain(
      'Hinweis;Vorläufig - 1 Tag(e) ohne Abholung, 1 Tag(e) mit ungezählten Produkten bei der Abholung'
    )
  })
})

// --- Rest über Nacht --------------------------------------------------------

describe('Rest über Nacht', () => {
  // Dienstag ohne Abholung, Mittwoch findet das Team 6 Stück vor.
  const visits = () => [
    visit('2026-08-25', 'initial', 1, [item(BROT, 0, 20)]),
    visit('2026-08-26', 'initial', 1, [item(BROT, 6, 14)]),
    visit('2026-08-26', 'pickup', 2, [item(BROT, 5, 0)]),
  ]

  it('macht aus dem übernommenen Rest auf keinem der beiden Tage einen Verkauf', () => {
    const stats = computeStats(visits())
    const [dienstag, mittwoch] = stats.byDay
    expect(dienstag.businessDate).toBe('2026-08-25')
    expect(dienstag.soldQty).toBe(0)
    expect(dienstag.revenue).toBe(0)
    // Mittwoch: 6 vorgefunden + 14 gelegt = 20, Rest 5 -> 15 verkauft.
    // Die 6 aus der Nacht sind kein Verkauf, weder hier noch am Dienstag.
    expect(mittwoch.soldQty).toBe(15)
    expect(mittwoch.revenue).toBe(52.5)
    expect(stats.totals.soldQty).toBe(15)
  })

  it('markiert den Vortag ohne Abholung als offen und vorläufig', () => {
    const stats = computeStats(visits())
    expect(stats.byDay[0].isOpen).toBe(true)
    expect(stats.byDay[1].isOpen).toBe(false)
    expect(stats.isProvisional).toBe(true)
    expect(stats.openDates).toEqual(['2026-08-25'])
  })

  it('weist den Übertrag als Differenz aus, nicht als Verkauf', () => {
    const stats = computeStats(visits())
    // Der Bestandsautomat startet je Geschäftstag bei 0, deshalb erscheinen die
    // 6 übernommenen Stück als Differenz - und die Quote steigt über 100 %.
    expect(stats.byDay[1].discrepancyQty).toBe(6)
    expect(stats.byDay[1].deliveredQty).toBe(14)
    expect(stats.byDay[1].sellThroughRate).toBe(1.0714)
    expect(stats.totals.discrepancyQty).toBe(6)
  })
})

// --- Zeitraumfilter ---------------------------------------------------------

describe('computeStats - Zeitraumfilter', () => {
  const visits = () => [
    ...simpleDay('2026-08-25', 10, 2),
    ...simpleDay('2026-08-26', 10, 3),
    ...simpleDay('2026-08-27', 10, 4),
    ...simpleDay('2026-08-28', 10, 5),
  ]

  it('rechnet ohne Grenzen über alle Tage', () => {
    const stats = computeStats(visits())
    expect(stats.range).toEqual({ from: null, to: null })
    expect(stats.totals.dayCount).toBe(4)
    expect(stats.totals.deliveredQty).toBe(40)
    expect(stats.totals.soldQty).toBe(26)
    expect(stats.totals.revenue).toBe(91)
  })

  it('schneidet an beiden Grenzen inklusive ab', () => {
    const stats = computeStats(visits(), {
      from: '2026-08-26',
      to: '2026-08-27',
    })
    expect(stats.range).toEqual({ from: '2026-08-26', to: '2026-08-27' })
    expect(stats.byDay.map((d) => d.businessDate)).toEqual([
      '2026-08-26',
      '2026-08-27',
    ])
    expect(stats.totals.deliveredQty).toBe(20)
    expect(stats.totals.soldQty).toBe(13)
    expect(stats.totals.revenue).toBe(45.5)
  })

  it('erlaubt eine einseitig offene Grenze', () => {
    const stats = computeStats(visits(), { from: '2026-08-27' })
    expect(stats.byDay.map((d) => d.businessDate)).toEqual([
      '2026-08-27',
      '2026-08-28',
    ])
    expect(stats.totals.soldQty).toBe(11)
    expect(stats.totals.revenue).toBe(38.5)
  })

  it('liefert für einen leeren Zeitraum saubere Nullwerte', () => {
    const stats = computeStats(visits(), {
      from: '2026-09-01',
      to: '2026-09-30',
    })
    expect(stats.byDay).toEqual([])
    expect(stats.byProduct).toEqual([])
    expect(stats.byWeekday).toEqual([])
    expect(stats.totals.dayCount).toBe(0)
    expect(stats.totals.revenue).toBe(0)
    expect(stats.totals.sellThroughRate).toBeNull()
    expect(stats.isProvisional).toBe(false)
  })
})

// --- Wochentagsmittel -------------------------------------------------------

describe('computeStats - Mittelwerte je Wochentag', () => {
  // Drei Dienstage plus ein offener Mittwoch
  const visits = () => [
    ...simpleDay('2026-08-25', 10, 2),
    visit('2026-08-26', 'initial', 1, [item(BROT, 0, 12)]),
    visit('2026-08-26', 'refill', 2, [item(BROT, 5, 0)]),
    ...simpleDay('2026-09-01', 20, 6),
    ...simpleDay('2026-09-08', 25, 9),
  ]

  it('mittelt mehrere gleiche Wochentage', () => {
    const stats = computeStats(visits())
    const dienstag = stats.byWeekday.find((w) => w.weekday === 2)
    // geliefert 10+20+25 = 55, verkauft 8+14+16 = 38, Retoure 2+6+9 = 17
    // Umsatz 28,00 + 49,00 + 56,00 = 133,00 EUR
    expect(dienstag).toEqual({
      weekday: 2,
      weekdayLabel: 'Dienstag',
      dayCount: 3,
      openDayCount: 0,
      avgDeliveredQty: 18.3,
      avgSoldQty: 12.7,
      avgReturnedQty: 5.7,
      avgRevenue: 44.33,
      sellThroughRate: 0.6909,
    })
  })

  it('zählt offene Tage je Wochentag mit', () => {
    const stats = computeStats(visits())
    const mittwoch = stats.byWeekday.find((w) => w.weekday === 3)
    expect(mittwoch).toEqual({
      weekday: 3,
      weekdayLabel: 'Mittwoch',
      dayCount: 1,
      openDayCount: 1,
      avgDeliveredQty: 12,
      avgSoldQty: 7,
      avgReturnedQty: 0,
      avgRevenue: 24.5,
      sellThroughRate: 0.5833,
    })
  })

  it('sortiert die Wochentage aufsteigend', () => {
    const stats = computeStats(visits())
    expect(stats.byWeekday.map((w) => w.weekday)).toEqual([2, 3])
    expect(stats.byDay.map((d) => d.weekday)).toEqual([2, 3, 2, 2])
  })
})

// --- Tagesdetail ------------------------------------------------------------

describe('computeDayDetail', () => {
  it('liefert Timeline und Tagessummen für einen abgeschlossenen Tag', () => {
    const detail = computeDayDetail(workedExampleVisits())
    expect(detail.businessDate).toBe('2026-08-25')
    expect(detail.isOpen).toBe(false)
    expect(detail.timeline).toHaveLength(3)
    expect(detail.timeline.map((t) => t.visitId)).toEqual([1, 2, 3])
    expect(detail.totals.soldQty).toBe(22)
    expect(detail.totals.revenue).toBe(77)
    expect(detail.byProduct).toHaveLength(1)
    expect(detail.byProduct[0].productName).toBe('Bauernbrot')
  })

  it('kommt mit einem Tag ohne Besuche zurecht', () => {
    const detail = computeDayDetail([])
    expect(detail.businessDate).toBeNull()
    expect(detail.isOpen).toBe(true)
    expect(detail.timeline).toEqual([])
    expect(detail.totals.dayCount).toBe(0)
    expect(detail.byProduct).toEqual([])
  })
})

// --- CSV --------------------------------------------------------------------

describe('statsToCsv', () => {
  const reportVisits = () => [
    ...workedExampleVisits(),
    visit('2026-08-26', 'initial', 1, [item(BROT, 0, 10)]),
    visit('2026-08-26', 'refill', 2, [item(BROT, 4, 0)]),
  ]

  const reportCsv = () =>
    statsToCsv(
      computeStats(reportVisits(), { from: '2026-08-25', to: '2026-08-26' }),
      PARTNER
    )

  it('schreibt einen Kopf mit Partner, Abrechnungsmodell und Zeitraum', () => {
    const lines = reportCsv().split('\r\n')
    expect(lines[0]).toBe('Partner-Report')
    expect(lines).toContain('Partner;CAP-Markt Homburg-Kirrberg')
    expect(lines).toContain('Abrechnungsmodell;Kommission')
    expect(lines).toContain('Zeitraum;2026-08-25 bis 2026-08-26')
  })

  it('weist offene Tage als vorläufig aus', () => {
    const lines = reportCsv().split('\r\n')
    expect(lines).toContain('Hinweis;Vorläufig - 1 Tag(e) ohne Abholung')
  })

  it('lässt den Hinweis weg, wenn alle Tage abgeschlossen sind', () => {
    const csv = statsToCsv(computeStats(workedExampleVisits()), PARTNER)
    expect(csv).not.toContain('Hinweis')
  })

  it('trennt mit Semikolon und schreibt deutsche Dezimalkommas', () => {
    const csv = reportCsv()
    const lines = csv.split('\r\n')
    expect(lines).toContain(
      'Produkt;Einzelpreis;Geliefert;Verkauft;Retoure;Abverkaufsquote;Umsatz;Ungezählt'
    )
    // 40 geliefert, 28 verkauft, 8 zurück -> 98,00 EUR, Quote 70,0 %
    expect(lines).toContain('Bauernbrot;3,50;40;28;8;70,0%;98,00;0')
    expect(lines.filter((line) => /\d\.\d/.test(line))).toEqual([])
  })

  it('listet jeden Geschäftstag mit Wochentagskürzel und Status', () => {
    const lines = reportCsv().split('\r\n')
    expect(lines).toContain(
      '2026-08-25;Di;abgeschlossen;3;30;22;8;73,3%;77,00;0'
    )
    expect(lines).toContain('2026-08-26;Mi;offen;2;10;6;0;60,0%;21,00;0')
  })

  it('schließt mit dem Gesamtblock ab', () => {
    const lines = reportCsv().split('\r\n')
    expect(lines.slice(-8)).toEqual([
      'Gesamt',
      'Geliefert;40',
      'Verkauft;28',
      'Retoure;8',
      'Abverkaufsquote;70,0%',
      'Umsatz;98,00',
      'Retourenwert;28,00',
      'Ungezählt;0',
    ])
  })

  it('benennt das Modell Festkauf und maskiert Semikolon und Anführungszeichen', () => {
    const csv = statsToCsv(computeStats(workedExampleVisits()), {
      name: 'CAP-Markt; Filiale "Kirrberg"',
      settlementModel: 'firm_sale',
    })
    const lines = csv.split('\r\n')
    expect(lines).toContain('Partner;"CAP-Markt; Filiale ""Kirrberg"""')
    expect(lines).toContain('Abrechnungsmodell;Festkauf')
  })

  it('exportiert einen leeren Zeitraum ohne Quote statt mit 0 %', () => {
    const lines = statsToCsv(computeStats([]), PARTNER).split('\r\n')
    expect(lines).toContain('Zeitraum; bis ')
    expect(lines).toContain('Abverkaufsquote;')
    expect(lines).toContain('Umsatz;0,00')
    expect(lines).toContain('Retourenwert;0,00')
  })
})
