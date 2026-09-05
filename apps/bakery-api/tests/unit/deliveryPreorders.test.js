/**
 * Rechenlogik der Vorbestellungen an einer Sammelstelle. Reines JS ohne Netz -
 * `delivery-geo.core.js` wird hier bewusst nicht angefasst, damit die Tests
 * offline laufen.
 */
const core = require('../../src/services/delivery-preorders.core')

/** Die Sammelstelle aus dem Seed - Adresse bewusst leer, sie ist unbekannt. */
const KINDERGARTEN = {
  id: 'kindergarten-moersbach',
  name: 'Kindergarten Mörsbach',
  street: '',
  zip: '',
  city: 'Zweibrücken-Mörsbach',
  weekday: 6,
  window: '09:00-09:30',
  orderDeadline: { weekday: 5, time: '12:00' },
  notes: null,
  active: true,
  lat: null,
  lon: null,
  geocodeSource: null,
  geocodePrecision: null,
}

const SAMSTAG = '2026-09-12'
const MONTAG = '2026-09-14'

/** Zwei Produkte aus `hq`, so wie `loadHQProducts()` sie liefert. */
const HQ = {
  bauernbrot: { id: 'bauernbrot', name: 'Bauernbrot', price: 4.1 },
  broetchen: { id: 'broetchen', name: 'Brötchen', price: 0.45 },
}

function lookupProduct(productId) {
  return HQ[productId] || null
}

function build(body, existing) {
  return core.normalizePreorderInput(body, existing || null, {
    lookupProduct,
    pickupPoint: KINDERGARTEN,
  })
}

describe('lineTotal / orderTotal', () => {
  // Regression: `3 * 4.1` ist in Fliesskomma 12.299999999999999. Ungerundet
  // stuenden auf der Uebergabeliste 12,299999999999999 EUR - und die Summe
  // ueber mehrere Bestellungen driftete weiter.
  test('rundet die Zeilensumme kaufmaennisch auf ganze Cent', () => {
    expect(3 * 4.1).not.toBe(12.3)
    expect(core.lineTotal(3, 4.1)).toBe(12.3)
  })

  test('addiert gerundete Zeilen und rundet noch einmal', () => {
    expect(0.1 + 0.2).not.toBe(0.3)
    expect(
      core.orderTotal([
        { qty: 1, unitPrice: 0.1 },
        { qty: 1, unitPrice: 0.2 },
      ])
    ).toBe(0.3)
  })

  test('zaehlt vorhandene Zeilensummen, statt sie neu zu rechnen', () => {
    expect(core.orderTotal([{ lineTotal: 12.3 }, { lineTotal: 0.9 }])).toBe(
      13.2
    )
  })

  test('ist ohne Menge oder ohne Preis null, nicht NaN', () => {
    expect(core.lineTotal(0, 4.1)).toBe(0)
    expect(core.lineTotal(null, 4.1)).toBe(0)
    expect(core.lineTotal(2, null)).toBe(0)
    expect(core.orderTotal(null)).toBe(0)
  })
})

describe('referencePrefix / nextReference', () => {
  test('leitet das Kuerzel aus dem letzten Slug-Teil ab', () => {
    expect(core.referencePrefix('kindergarten-moersbach')).toBe('MO')
    expect(core.referencePrefix('')).toBe('VB')
  })

  test('faengt je Sammelstelle und Tag bei 01 an', () => {
    expect(core.nextReference([], KINDERGARTEN.id, SAMSTAG)).toBe(
      'MO-2026-09-12-01'
    )
  })

  test('zaehlt nur innerhalb desselben Tages weiter', () => {
    const list = [
      {
        pickupPointId: KINDERGARTEN.id,
        date: SAMSTAG,
        reference: 'MO-2026-09-12-01',
      },
      {
        pickupPointId: KINDERGARTEN.id,
        date: SAMSTAG,
        reference: 'MO-2026-09-12-02',
      },
      {
        pickupPointId: KINDERGARTEN.id,
        date: '2026-09-19',
        reference: 'MO-2026-09-19-01',
      },
    ]
    expect(core.nextReference(list, KINDERGARTEN.id, SAMSTAG)).toBe(
      'MO-2026-09-12-03'
    )
    expect(core.nextReference(list, KINDERGARTEN.id, '2026-09-19')).toBe(
      'MO-2026-09-19-02'
    )
  })

  // Die Nummer wird vor Ort zugerufen; eine stornierte Bestellung darf ihre
  // nicht an die naechste weitergeben.
  test('vergibt die Nummer einer stornierten Bestellung nicht erneut', () => {
    const list = [
      {
        pickupPointId: KINDERGARTEN.id,
        date: SAMSTAG,
        reference: 'MO-2026-09-12-01',
        status: 'cancelled',
      },
    ]
    expect(core.nextReference(list, KINDERGARTEN.id, SAMSTAG)).toBe(
      'MO-2026-09-12-02'
    )
  })
})

describe('deadlineFor / isAfterDeadline', () => {
  test('liegt am Freitag vor dem Liefersamstag um 12 Uhr', () => {
    const iso = core.deadlineFor(SAMSTAG, KINDERGARTEN.orderDeadline)
    const at = new Date(iso)
    expect(at.getDay()).toBe(5)
    expect(at.getHours()).toBe(12)
    expect(at.getMinutes()).toBe(0)
    expect(at.getDate()).toBe(11)
  })

  test('ist null ohne Bestellschluss oder mit unsinniger Uhrzeit', () => {
    expect(core.deadlineFor(SAMSTAG, null)).toBeNull()
    expect(core.deadlineFor(SAMSTAG, { weekday: 5, time: '25:00' })).toBeNull()
    expect(
      core.deadlineFor('kein-datum', KINDERGARTEN.orderDeadline)
    ).toBeNull()
  })

  test('erkennt einen ueberschrittenen Bestellschluss', () => {
    const deadline = Date.parse(
      core.deadlineFor(SAMSTAG, KINDERGARTEN.orderDeadline)
    )
    expect(
      core.isAfterDeadline(SAMSTAG, KINDERGARTEN.orderDeadline, deadline - 1000)
    ).toBe(false)
    expect(
      core.isAfterDeadline(SAMSTAG, KINDERGARTEN.orderDeadline, deadline + 1000)
    ).toBe(true)
  })
})

describe('normalizePreorderInput', () => {
  test('nimmt Name und Preis aus hq und ignoriert den Preis aus dem Body', () => {
    const result = build({
      customer: 'Familie Beispiel',
      date: SAMSTAG,
      items: [
        { productId: 'bauernbrot', qty: 3, name: 'Gratisbrot', unitPrice: 0 },
      ],
    })
    expect(result.error).toBeUndefined()
    expect(result.preorder.items[0]).toEqual({
      productId: 'bauernbrot',
      name: 'Bauernbrot',
      qty: 3,
      unit: 'Stück',
      unitPrice: 4.1,
      lineTotal: 12.3,
    })
    expect(result.preorder.total).toBe(12.3)
  })

  test('verlangt einen Kundennamen', () => {
    const result = build({
      customer: '   ',
      date: SAMSTAG,
      items: [{ productId: 'broetchen', qty: 6 }],
    })
    expect(result.message).toBe('Der Name des Kunden ist erforderlich.')
  })

  test('verlangt mindestens eine Position mit Menge', () => {
    const leer = build({ customer: 'A. Beispiel', date: SAMSTAG, items: [] })
    expect(leer.message).toBe(
      'Eine Vorbestellung braucht mindestens eine Position.'
    )
    // Menge 0 heisst "Zeile gestrichen" - die bleibt keine Bestellung.
    const null_menge = build({
      customer: 'A. Beispiel',
      date: SAMSTAG,
      items: [{ productId: 'broetchen', qty: 0 }],
    })
    expect(null_menge.message).toBe(
      'Eine Vorbestellung braucht mindestens eine Position.'
    )
  })

  test('lehnt ein unbekanntes Produkt ab', () => {
    const result = build({
      customer: 'A. Beispiel',
      date: SAMSTAG,
      items: [{ productId: 'mondbrot', qty: 1 }],
    })
    expect(result.error).toBe('Unknown product')
    expect(result.message).toContain('mondbrot')
  })

  test('lehnt einen Tag ab, an dem nicht geliefert wird', () => {
    const result = build({
      customer: 'A. Beispiel',
      date: MONTAG,
      items: [{ productId: 'broetchen', qty: 6 }],
    })
    expect(result.error).toBe('Invalid delivery day')
    expect(result.message).toBe(
      'Der 14.09.2026 ist kein Samstag — an diesem Tag wird nicht nach Mörsbach geliefert.'
    )
  })

  test('lehnt ein unmoegliches Datum ab', () => {
    const result = build({
      customer: 'A. Beispiel',
      date: '2026-02-31',
      items: [{ productId: 'broetchen', qty: 6 }],
    })
    expect(result.error).toBe('Invalid date')
  })

  test('lehnt einen unbekannten Status ab', () => {
    const result = build({
      customer: 'A. Beispiel',
      date: SAMSTAG,
      status: 'bezahlt',
      items: [{ productId: 'broetchen', qty: 6 }],
    })
    expect(result.error).toBe('Invalid status')
  })

  test('normalisiert die Telefonnummer und macht aus Unsinn null', () => {
    const gut = build({
      customer: 'A. Beispiel',
      date: SAMSTAG,
      phone: '+49 151 / 1234-5678',
      items: [{ productId: 'broetchen', qty: 6 }],
    })
    expect(gut.preorder.phone).toBe('+4915112345678')
    const schlecht = build({
      customer: 'A. Beispiel',
      date: SAMSTAG,
      phone: '12',
      items: [{ productId: 'broetchen', qty: 6 }],
    })
    expect(schlecht.preorder.phone).toBeNull()
  })

  test('behaelt beim Abhaken die bestehenden Positionen samt Preis-Snapshot', () => {
    const bestand = build({
      customer: 'A. Beispiel',
      date: SAMSTAG,
      items: [{ productId: 'bauernbrot', qty: 3 }],
    }).preorder
    // Der Preis in hq steigt spaeter - die alte Bestellung darf das nicht sehen.
    const gespeichert = {
      ...bestand,
      items: [{ ...bestand.items[0], unitPrice: 3.9, lineTotal: 11.7 }],
      total: 11.7,
    }
    const result = core.normalizePreorderInput(
      { status: 'handed_over' },
      gespeichert,
      { lookupProduct, pickupPoint: KINDERGARTEN }
    )
    expect(result.preorder.items[0].unitPrice).toBe(3.9)
    expect(result.preorder.total).toBe(11.7)
    expect(result.preorder.status).toBe('handed_over')
    expect(result.preorder.handedOverAt).not.toBeNull()
  })

  // Sonst stuende an einer wieder geoeffneten Bestellung weiter
  // "übergeben um 09:12".
  test('loescht den Uebergabezeitpunkt, wenn die Bestellung wieder offen ist', () => {
    const uebergeben = {
      customer: 'A. Beispiel',
      date: SAMSTAG,
      status: 'handed_over',
      handedOverAt: '2026-09-12T07:12:00.000Z',
      items: [
        {
          productId: 'broetchen',
          name: 'Brötchen',
          qty: 6,
          unit: 'Stück',
          unitPrice: 0.45,
          lineTotal: 2.7,
        },
      ],
    }
    const result = core.normalizePreorderInput({ status: 'open' }, uebergeben, {
      lookupProduct,
      pickupPoint: KINDERGARTEN,
    })
    expect(result.preorder.handedOverAt).toBeNull()
  })
})

describe('summarizePreorders', () => {
  function preorder(status, items, total) {
    return { status, items, total, date: SAMSTAG }
  }

  const LISTE = [
    preorder(
      'open',
      [
        { productId: 'bauernbrot', name: 'Bauernbrot', qty: 3, unit: 'Stück' },
        { productId: 'broetchen', name: 'Brötchen', qty: 6, unit: 'Stück' },
      ],
      15
    ),
    preorder(
      'handed_over',
      [{ productId: 'broetchen', name: 'Brötchen', qty: 4, unit: 'Stück' }],
      1.8
    ),
    preorder('not_collected', [], 0),
    preorder(
      'cancelled',
      [{ productId: 'bauernbrot', name: 'Bauernbrot', qty: 99, unit: 'Stück' }],
      405.9
    ),
  ]

  test('zaehlt Anzahl, Summe und Stand je Status', () => {
    const summary = core.summarizePreorders(LISTE)
    expect(summary.count).toBe(3)
    expect(summary.open).toBe(1)
    expect(summary.handedOver).toBe(1)
    expect(summary.notCollected).toBe(1)
    expect(summary.cancelled).toBe(1)
    expect(summary.total).toBe(16.8)
  })

  // Die Backliste haengt samstags frueh in der Backstube - eine stornierte
  // Bestellung darf dort keine 99 Brote hineinrechnen.
  test('summiert die Backliste je Produkt ohne stornierte Bestellungen', () => {
    const summary = core.summarizePreorders(LISTE)
    expect(summary.byProduct).toEqual([
      { productId: 'bauernbrot', name: 'Bauernbrot', unit: 'Stück', qty: 3 },
      { productId: 'broetchen', name: 'Brötchen', unit: 'Stück', qty: 10 },
    ])
  })

  test('ist auf einer leeren Liste null und nicht NaN', () => {
    const summary = core.summarizePreorders([])
    expect(summary).toMatchObject({ count: 0, total: 0, byProduct: [] })
  })
})

describe('decoratePreorder', () => {
  test('haengt Bestellschluss und den Hinweis "danach bestellt" an', () => {
    const deadline = Date.parse(
      core.deadlineFor(SAMSTAG, KINDERGARTEN.orderDeadline)
    )
    const preorder = { date: SAMSTAG, customer: 'A. Beispiel' }
    expect(
      core.decoratePreorder(preorder, KINDERGARTEN, deadline + 60000)
    ).toMatchObject({ afterDeadline: true })
    // Nach Bestellschluss wird nicht blockiert - die Backstube muss nachtragen
    // koennen; die Oberflaeche warnt nur.
    expect(
      core.decoratePreorder(preorder, KINDERGARTEN, deadline - 60000)
    ).toMatchObject({ afterDeadline: false, customer: 'A. Beispiel' })
  })
})

describe('normalizePickupPointInput', () => {
  test('erlaubt eine leere Adresse - die des Kindergartens ist unbekannt', () => {
    const result = core.normalizePickupPointInput({}, KINDERGARTEN)
    expect(result.error).toBeUndefined()
    expect(result.pickupPoint.street).toBe('')
    expect(result.pickupPoint.weekday).toBe(6)
  })

  test('loescht die Koordinaten, wenn die Adresse nachgetragen wird', () => {
    const gefunden = {
      ...KINDERGARTEN,
      lat: 49.2,
      lon: 7.4,
      geocodeSource: 'nominatim',
    }
    const result = core.normalizePickupPointInput(
      { street: 'Musterweg 1', zip: '66482' },
      gefunden
    )
    expect(result.pickupPoint.lat).toBeNull()
    expect(result.pickupPoint.geocodeSource).toBeNull()
  })

  test('lehnt ein unsinniges Uebergabefenster und einen unsinnigen Bestellschluss ab', () => {
    expect(
      core.normalizePickupPointInput({ window: '9 bis halb 10' }, KINDERGARTEN)
        .error
    ).toBe('Invalid window')
    expect(
      core.normalizePickupPointInput(
        { orderDeadline: { weekday: 9, time: '12:00' } },
        KINDERGARTEN
      ).error
    ).toBe('Invalid order deadline')
  })

  test('verlangt einen Namen', () => {
    expect(
      core.normalizePickupPointInput({ name: '' }, KINDERGARTEN).message
    ).toBe('Der Name der Lieferstelle ist erforderlich.')
  })
})

describe('preordersForStop', () => {
  const LISTE = [
    { id: 1, pickupPointId: KINDERGARTEN.id, date: SAMSTAG, status: 'open' },
    {
      id: 2,
      pickupPointId: KINDERGARTEN.id,
      date: SAMSTAG,
      status: 'cancelled',
    },
    {
      id: 3,
      pickupPointId: KINDERGARTEN.id,
      date: '2026-09-19',
      status: 'open',
    },
    { id: 4, pickupPointId: 'andere-stelle', date: SAMSTAG, status: 'open' },
  ]

  test('nimmt nur den Tourtag der eigenen Sammelstelle, ohne stornierte', () => {
    const list = core.preordersForStop(LISTE, KINDERGARTEN.id, SAMSTAG)
    expect(list.map((p) => p.id)).toEqual([1])
  })
})

describe('migratePickupKeys', () => {
  const SEED = { pickupPoints: [KINDERGARTEN], preorders: [], tours: [] }

  // Ein Store aus der Zeit vor den Sammelstellen liegt auf den Rechnern schon
  // herum - er darf beim Laden nicht seine Touren verlieren.
  test('ergaenzt fehlende Schluessel aus dem Seed', () => {
    const alt = { depot: {}, drivers: [], tours: [{ id: 1, stops: [] }] }
    const migriert = core.migratePickupKeys(alt, SEED)
    expect(migriert.pickupPoints).toEqual([KINDERGARTEN])
    expect(migriert.preorders).toEqual([])
    expect(alt.tours).toEqual([{ id: 1, stops: [] }])
    expect(migriert.tours).toBeUndefined()
  })

  test('laesst vorhandene Sammelstellen und Vorbestellungen in Ruhe', () => {
    const vorhanden = {
      pickupPoints: [{ ...KINDERGARTEN, street: 'Musterweg 1' }],
      preorders: [{ id: 7 }],
    }
    const migriert = core.migratePickupKeys(vorhanden, SEED)
    expect(migriert.pickupPoints[0].street).toBe('Musterweg 1')
    expect(migriert.preorders).toEqual([{ id: 7 }])
  })
})

describe('Stopp als Sammelstelle (delivery-tours.core)', () => {
  const tours = require('../../src/services/delivery-tours.core')

  test('uebernimmt pickupPointId und behaelt sie beim Abhaken', () => {
    const neu = tours.normalizeStopInput({
      customer: 'Kindergarten Mörsbach',
      street: '',
      city: 'Zweibrücken-Mörsbach',
      pickupPointId: KINDERGARTEN.id,
    })
    expect(neu.error).toBeUndefined()
    expect(neu.stop.pickupPointId).toBe(KINDERGARTEN.id)

    const abgehakt = tours.normalizeStopInput({ status: 'done' }, neu.stop)
    expect(abgehakt.stop.pickupPointId).toBe(KINDERGARTEN.id)
  })

  // Die Adresse des Kindergartens ist noch nicht bekannt und wird nicht
  // erfunden - ein Stopp ohne Strasse muss sich trotzdem abhaken lassen.
  test('erlaubt eine Sammelstelle ohne Strasse, einen normalen Stopp nicht', () => {
    expect(
      tours.normalizeStopInput({ customer: 'A. Beispiel', street: '' }).error
    ).toBe('Street is required')
    expect(
      tours.normalizeStopInput({
        customer: 'A. Beispiel',
        street: '',
        pickupPointId: KINDERGARTEN.id,
      }).error
    ).toBeUndefined()
  })

  test('ein gewoehnlicher Stopp bekommt das Feld gar nicht', () => {
    const stop = tours.normalizeStopInput({
      customer: 'A. Beispiel',
      street: 'Eckstraße 3',
    }).stop
    expect('pickupPointId' in stop).toBe(false)
  })
})

describe('Preis-Snapshot beim Bearbeiten', () => {
  const BESTAND = {
    id: 7,
    pickupPointId: KINDERGARTEN.id,
    date: SAMSTAG,
    customer: 'Familie Beispiel',
    phone: null,
    items: [
      {
        productId: 'bauernbrot',
        name: 'Bauernbrot',
        qty: 3,
        unit: 'Stück',
        unitPrice: 4.1,
        lineTotal: 12.3,
      },
    ],
    total: 12.3,
    note: null,
    status: 'open',
    handedOverAt: null,
  }

  // Die Erfassungsmaske schickt bei jeder Aenderung die komplette
  // Positionsliste mit. Wuerde der Preis dabei neu aus hq geholt, stiege die
  // dem Kunden genannte Summe, weil jemand am Vortag den Preis geaendert hat.
  test('behaelt Preis und Name der bestehenden Position, auch wenn hq teurer wird', () => {
    const teurer = {
      bauernbrot: { id: 'bauernbrot', name: 'Bauernbrot XL', price: 4.5 },
    }
    const result = core.normalizePreorderInput(
      { phone: '06841 2229', items: [{ productId: 'bauernbrot', qty: 3 }] },
      BESTAND,
      {
        lookupProduct: (id) => teurer[id] || null,
        pickupPoint: KINDERGARTEN,
      }
    )
    expect(result.error).toBeUndefined()
    expect(result.preorder.items[0].unitPrice).toBe(4.1)
    expect(result.preorder.items[0].name).toBe('Bauernbrot')
    expect(result.preorder.total).toBe(12.3)
  })

  test('eine geaenderte Menge rechnet mit dem alten Preis weiter', () => {
    const result = core.normalizePreorderInput(
      { items: [{ productId: 'bauernbrot', qty: 4 }] },
      BESTAND,
      { lookupProduct, pickupPoint: KINDERGARTEN }
    )
    expect(result.preorder.items[0].lineTotal).toBe(16.4)
  })

  // Neu hinzugekommene Positionen haben noch keinen Snapshot - sie holen
  // Namen und Preis wie beim Anlegen aus hq.
  test('eine neue Position holt ihren Preis aus hq', () => {
    const result = core.normalizePreorderInput(
      {
        items: [
          { productId: 'bauernbrot', qty: 3 },
          { productId: 'broetchen', qty: 6, unitPrice: 0 },
        ],
      },
      BESTAND,
      { lookupProduct, pickupPoint: KINDERGARTEN }
    )
    expect(result.preorder.items[1]).toEqual({
      productId: 'broetchen',
      name: 'Brötchen',
      qty: 6,
      unit: 'Stück',
      unitPrice: 0.45,
      lineTotal: 2.7,
    })
    expect(result.preorder.total).toBe(15)
  })
})

describe('checkStatusTransition / cancelPreorder', () => {
  const UEBERGEBEN = {
    id: 3,
    pickupPointId: KINDERGARTEN.id,
    date: SAMSTAG,
    customer: 'Familie Beispiel',
    items: [
      {
        productId: 'bauernbrot',
        name: 'Bauernbrot',
        qty: 1,
        unit: 'Stück',
        unitPrice: 4.1,
        lineTotal: 4.1,
      },
    ],
    total: 4.1,
    status: 'handed_over',
    handedOverAt: '2026-09-12T07:12:00.000Z',
  }

  // Das Geld liegt in der Kasse: ein Storno loeschte den Beleg dafuer.
  test('storniert eine bereits uebergebene Bestellung nicht', () => {
    const result = core.cancelPreorder(UEBERGEBEN)
    expect(result.preorder).toBeUndefined()
    expect(result.status).toBe(409)
    expect(result.message).toMatch(/bereits übergeben/)
  })

  test('storniert eine offene Bestellung und loescht keinen Uebergabezeitpunkt', () => {
    const result = core.cancelPreorder({ ...UEBERGEBEN, status: 'open' })
    expect(result.preorder.status).toBe('cancelled')
    expect(result.preorder.handedOverAt).toBeNull()
  })

  test('lehnt auch den Weg ueber PATCH ab', () => {
    const result = core.normalizePreorderInput(
      { status: 'cancelled' },
      UEBERGEBEN,
      {
        lookupProduct,
        pickupPoint: KINDERGARTEN,
      }
    )
    expect(result.preorder).toBeUndefined()
    expect(result.status).toBe(409)
  })

  // So kommt ein Nachlauf aus der Offline-Warteschlange an, der die
  // Stornierung von gestern noch nicht kennt.
  test('belebt eine stornierte Bestellung nicht durch nachgesendetes Abhaken', () => {
    const storniert = { ...UEBERGEBEN, status: 'cancelled', handedOverAt: null }
    const result = core.normalizePreorderInput(
      { status: 'handed_over' },
      storniert,
      { lookupProduct, pickupPoint: KINDERGARTEN }
    )
    expect(result.preorder).toBeUndefined()
    expect(result.status).toBe(409)
    expect(result.message).toMatch(/storniert/)
  })

  test('laesst den Weg zurueck auf "offen" offen', () => {
    expect(core.checkStatusTransition('cancelled', 'open')).toBeNull()
    expect(core.checkStatusTransition('handed_over', 'open')).toBeNull()
    const result = core.normalizePreorderInput({ status: 'open' }, UEBERGEBEN, {
      lookupProduct,
      pickupPoint: KINDERGARTEN,
    })
    expect(result.error).toBeUndefined()
    expect(result.preorder.handedOverAt).toBeNull()
  })
})

describe('Sammelstellen-Stopp einer Tour', () => {
  const SAMSTAG_STOPP = {
    id: 2,
    pickupPointId: KINDERGARTEN.id,
    customer: 'Kindergarten Mörsbach',
  }

  test('findet die Sammelstellen eines Liefertags', () => {
    expect(
      core.pickupPointsForDate([KINDERGARTEN], SAMSTAG).map((p) => p.id)
    ).toEqual([KINDERGARTEN.id])
    // Montag: an diesem Tag wird nicht geliefert.
    expect(core.pickupPointsForDate([KINDERGARTEN], MONTAG)).toEqual([])
    expect(
      core.pickupPointsForDate([{ ...KINDERGARTEN, active: false }], SAMSTAG)
    ).toEqual([])
  })

  test('baut aus der Sammelstelle einen Stopp ohne erfundene Adresse', () => {
    const stop = core.buildPickupStop(KINDERGARTEN)
    expect(stop.pickupPointId).toBe(KINDERGARTEN.id)
    expect(stop.customer).toBe('Kindergarten Mörsbach')
    expect(stop.street).toBe('')
    expect(stop.lat).toBeNull()
    expect(stop.timeWindow).toBe('09:00-09:30')
  })

  test('uebernimmt vorhandene Koordinaten der Sammelstelle', () => {
    const stop = core.buildPickupStop({
      ...KINDERGARTEN,
      street: 'Musterweg 1',
      lat: 49.2,
      lon: 7.3,
      geocodeSource: 'nominatim',
      geocodePrecision: 'house',
    })
    expect(stop.lat).toBe(49.2)
    expect(stop.geocodePrecision).toBe('house')
  })

  // Ohne diesen Stopp erreichen die Vorbestellungen den Fahrer nie.
  test('erkennt einen Liefertag ohne Sammelstellen-Stopp', () => {
    const tourList = [
      { date: SAMSTAG, stops: [SAMSTAG_STOPP] },
      { date: '2026-09-19', stops: [{ id: 1, customer: 'A. Beispiel' }] },
    ]
    expect(core.hasPickupStop(tourList, KINDERGARTEN.id, SAMSTAG)).toBe(true)
    expect(core.hasPickupStop(tourList, KINDERGARTEN.id, '2026-09-19')).toBe(
      false
    )
    expect(core.hasPickupStop([], KINDERGARTEN.id, SAMSTAG)).toBe(false)
  })
})
