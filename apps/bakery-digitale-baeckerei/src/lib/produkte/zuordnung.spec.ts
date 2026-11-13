import type {
  Belegung,
  BelegungDatei,
  ProduktInfo,
  ProduktSnapshot,
} from './types'
import {
  DATEN_ZEIT_MS,
  belegungVon,
  eintraegeFuer,
  ladeProduktdaten,
} from './zuordnung'

// Nur erfundene Produkte, keine Preise.
const produkt = (id: string, name: string): ProduktInfo => ({
  id,
  name,
  kategorie: 'brot',
  kurztext: `${name} nur für Tests.`,
  text: '',
})

const SNAPSHOT: ProduktSnapshot = {
  version: 1,
  erstellt: '2026-01-02T03:04:05.000Z',
  produkte: {
    'testbrot-500g': {
      ...produkt('testbrot-500g', 'Testbrot'),
      einheit: '500 g',
    },
    testkeks: produkt('testkeks', 'Testkeks'),
  },
}

const BELEGUNG: Belegung = {
  version: 1,
  quelle: { commit: 'fixture' },
  slots: [
    { slot: 'testregal/ebene-1/platz-01', produkt: 'testbrot-500g', anzahl: 4 },
    { slot: 'testtheke/vitrine/platz-01', produkt: 'testkeks' },
    { slot: 'testregal/ebene-1/platz-02', produkt: 'gibt-es-nicht' },
    { slot: 'testregal/ebene-2/platz-01', produkt: 'testkeks', anzahl: 2 },
    { slot: 'testregal-zwei/platz-01', produkt: 'testbrot-500g' },
    { slot: 'testtheke/vitrine/platz-02', produkt: 'toString' },
  ],
}

describe('eintraegeFuer', () => {
  it('nimmt die Plätze der genannten Möbel, in der Reihenfolge der Belegung', () => {
    expect(eintraegeFuer(BELEGUNG, SNAPSHOT, ['testregal/'])).toEqual([
      {
        slot: 'testregal/ebene-1/platz-01',
        produkt: SNAPSHOT.produkte['testbrot-500g'],
        anzahl: 4,
      },
      {
        slot: 'testregal/ebene-2/platz-01',
        produkt: SNAPSHOT.produkte.testkeks,
        anzahl: 2,
      },
    ])
  })

  it('ein Präfix mit „/“ trifft kein Möbel, das nur ähnlich heißt', () => {
    const slots = eintraegeFuer(BELEGUNG, SNAPSHOT, ['testregal/']).map(
      (e) => e.slot
    )
    expect(slots).not.toContain('testregal-zwei/platz-01')
  })

  it('mehrere Möbel an einem Blickpunkt', () => {
    expect(
      eintraegeFuer(BELEGUNG, SNAPSHOT, ['testtheke/', 'testregal-zwei/']).map(
        (e) => e.slot
      )
    ).toEqual(['testtheke/vitrine/platz-01', 'testregal-zwei/platz-01'])
  })

  it('lässt Plätze aus, deren Produkt nicht im Snapshot steht', () => {
    const produkte = eintraegeFuer(BELEGUNG, SNAPSHOT, [
      'testregal/',
      'testtheke/',
    ]).map((e) => e.produkt.id)
    expect(produkte).toEqual(['testbrot-500g', 'testkeks', 'testkeks'])
  })

  it('erfindet keine Anzahl', () => {
    const [eintrag] = eintraegeFuer(BELEGUNG, SNAPSHOT, ['testtheke/'])
    expect(eintrag).not.toHaveProperty('anzahl')
  })

  it('ohne Möbel oder ohne Plätze: leer', () => {
    expect(eintraegeFuer(BELEGUNG, SNAPSHOT, [])).toEqual([])
    expect(
      eintraegeFuer({ ...BELEGUNG, slots: [] }, SNAPSHOT, ['testregal/'])
    ).toEqual([])
  })
})

describe('ladeProduktdaten', () => {
  const realFetch = global.fetch
  afterEach(() => {
    global.fetch = realFetch
  })

  const antwort = (body: unknown, status = 200) =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        if (body instanceof Error) throw body
        return body
      },
    } as Response)

  const mockFetch = (files: Record<string, Response | Error>) => {
    const fn = jest.fn(async (url: RequestInfo | URL) => {
      const hit = files[String(url)]
      if (hit === undefined) return antwort(null, 404)
      if (hit instanceof Error) throw hit
      return hit
    })
    global.fetch = fn as unknown as typeof fetch
    return fn
  }

  /** `belegung.json`, wie sync-model sie schreibt: je Raum eine Belegung. */
  const DATEI = {
    version: 3,
    raeume: {
      laden: { quelle: BELEGUNG.quelle, slots: BELEGUNG.slots },
      backstube: { quelle: { commit: 'x' }, slots: [] },
    },
  }

  it('lädt beide Dateien unter dem Basis-Pfad', async () => {
    const fn = mockFetch({
      '/digitale-baeckerei/data/products.snapshot.json': antwort(SNAPSHOT),
      '/digitale-baeckerei/data/belegung.json': antwort(DATEI),
    })
    await expect(ladeProduktdaten('/digitale-baeckerei')).resolves.toEqual({
      snapshot: SNAPSHOT,
      belegung: DATEI,
    })
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('ohne Basis-Pfad liegen die Dateien unter /data/', async () => {
    const fn = mockFetch({
      '/data/products.snapshot.json': antwort(SNAPSHOT),
      '/data/belegung.json': antwort(DATEI),
    })
    await ladeProduktdaten('')
    expect(fn.mock.calls.map((c) => c[0]).sort()).toEqual([
      '/data/belegung.json',
      '/data/products.snapshot.json',
    ])
  })

  it('meldet eine fehlende Datei auf Deutsch', async () => {
    mockFetch({ '/data/belegung.json': antwort(BELEGUNG) })
    await expect(ladeProduktdaten('')).rejects.toThrow(
      'Die Produktdaten konnten nicht geladen werden (HTTP 404).'
    )
  })

  it('meldet einen Netzfehler auf Deutsch', async () => {
    mockFetch({
      '/data/products.snapshot.json': antwort(SNAPSHOT),
      '/data/belegung.json': new TypeError('Failed to fetch'),
    })
    await expect(ladeProduktdaten('')).rejects.toThrow(
      'Die Plätze im Regal konnten nicht geladen werden.'
    )
  })

  it('meldet unlesbares JSON', async () => {
    mockFetch({
      '/data/products.snapshot.json': antwort(new SyntaxError('kaputt')),
      '/data/belegung.json': antwort(BELEGUNG),
    })
    await expect(ladeProduktdaten('')).rejects.toThrow(
      'Die Produktdaten sind nicht lesbar.'
    )
  })

  it.each([
    ['falsche Version', { ...SNAPSHOT, version: 2 }],
    ['produkte fehlt', { version: 1, erstellt: 'x' }],
    ['kein Objekt', []],
  ])('lehnt einen Snapshot ab: %s', async (_name, snapshot) => {
    mockFetch({
      '/data/products.snapshot.json': antwort(snapshot),
      '/data/belegung.json': antwort(BELEGUNG),
    })
    await expect(ladeProduktdaten('')).rejects.toThrow(
      'Die Produktdaten haben nicht die erwartete Form.'
    )
  })

  it.each([
    ['altes Format (ein Raum, Version 1)', BELEGUNG],
    [
      'Version 2 (ohne Einrichtung)',
      { version: 2, raeume: { laden: { quelle: { commit: 'x' }, slots: [] } } },
    ],
    ['raeume fehlt', { version: 3 }],
    [
      'slots fehlt',
      { version: 3, raeume: { laden: { quelle: { commit: 'x' } } } },
    ],
    [
      'Eintrag ohne Produkt',
      {
        version: 3,
        raeume: { laden: { quelle: { commit: 'x' }, slots: [{ slot: 'a' }] } },
      },
    ],
  ])('lehnt eine Belegung ab: %s', async (_name, belegung) => {
    mockFetch({
      '/data/products.snapshot.json': antwort(SNAPSHOT),
      '/data/belegung.json': antwort(belegung),
    })
    await expect(ladeProduktdaten('')).rejects.toThrow(
      'Die Plätze im Regal haben nicht die erwartete Form.'
    )
  })

  it('belegungVon: die Belegung eines Raums - leer, wenn die Datei ihn nicht nennt', () => {
    expect(belegungVon(DATEI as BelegungDatei, 'laden')).toEqual({
      ...BELEGUNG,
      leer: [],
      plaetze: {},
    })
    expect(belegungVon(DATEI as BelegungDatei, 'backstube').slots).toEqual([])
    expect(belegungVon(DATEI as BelegungDatei, 'keller').slots).toEqual([])
    // Ein Name aus dem Prototyp ist kein Raum.
    expect(belegungVon(DATEI as BelegungDatei, 'toString').slots).toEqual([])
  })
})

describe('ladeProduktdaten: eine Anfrage, die hängt, hält nichts auf', () => {
  afterEach(() => jest.useRealTimers())

  it('gilt nach der Frist als nicht ladbar - mit derselben deutschen Meldung', async () => {
    jest.useFakeTimers()
    // Die Belegung antwortet nie, der Snapshot sofort.
    global.fetch = jest.fn((url: string) =>
      url.endsWith('/data/belegung.json')
        ? new Promise(() => undefined)
        : Promise.resolve({ ok: true, status: 200, json: async () => ({}) })
    ) as unknown as typeof fetch
    const ergebnis = ladeProduktdaten('').then(
      () => 'geladen',
      (err: Error) => err.message
    )
    let fertig = false
    void ergebnis.then(() => {
      fertig = true
    })
    await jest.advanceTimersByTimeAsync(DATEN_ZEIT_MS - 1)
    expect(fertig).toBe(false)
    await jest.advanceTimersByTimeAsync(2)
    await expect(ergebnis).resolves.toBe(
      'Die Plätze im Regal konnten nicht geladen werden.'
    )
  })

  it('auch ein Inhalt, der nie zu Ende kommt, läuft in die Frist', async () => {
    jest.useFakeTimers()
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: () => new Promise(() => undefined),
    })) as unknown as typeof fetch
    const ergebnis = ladeProduktdaten('').catch((err: Error) => err.message)
    await jest.advanceTimersByTimeAsync(DATEN_ZEIT_MS + 1)
    await expect(ergebnis).resolves.toMatch(/konnten nicht geladen werden/)
  })

  it('eine schnelle Antwort lässt keine Uhr zurück', async () => {
    jest.useFakeTimers()
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 404,
    })) as unknown as typeof fetch
    await expect(ladeProduktdaten('')).rejects.toThrow(/HTTP 404/)
    expect(jest.getTimerCount()).toBe(0)
  })
})
