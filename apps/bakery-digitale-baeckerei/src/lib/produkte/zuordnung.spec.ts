import type {
  Belegung,
  BelegungDatei,
  ProduktInfo,
  ProduktSnapshot,
} from './types'
import {
  DATEN_ZEIT_MS,
  WIEDERHOLEN_NACH_MS,
  belegungVon,
  eintraegeFuer,
  ladeJson,
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

  it('meldet einen Netzfehler auf Deutsch - nach den Wiederholungen', async () => {
    jest.useFakeTimers()
    try {
      const fn = mockFetch({
        '/data/products.snapshot.json': antwort(SNAPSHOT),
        '/data/belegung.json': new TypeError('Failed to fetch'),
      })
      const ergebnis = ladeProduktdaten('').catch((err: Error) => err.message)
      await jest.advanceTimersByTimeAsync(DATEN_ZEIT_MS)
      await expect(ergebnis).resolves.toBe(
        'Die Plätze im Regal konnten nicht geladen werden.'
      )
      expect(
        fn.mock.calls.filter((c) => String(c[0]) === '/data/belegung.json')
      ).toHaveLength(1 + WIEDERHOLEN_NACH_MS.length)
    } finally {
      jest.useRealTimers()
    }
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

describe('ladeJson: kurze Störungen werden wiederholt, innerhalb der Frist', () => {
  const realFetch = global.fetch
  afterEach(() => {
    global.fetch = realFetch
    jest.useRealTimers()
  })
  beforeEach(() => jest.useFakeTimers())

  const ok = (body: unknown) =>
    ({ ok: true, status: 200, json: async () => body } as Response)
  const status = (n: number) =>
    ({
      ok: false,
      status: n,
      json: async () => {
        throw new SyntaxError('kein JSON')
      },
    } as unknown as Response)

  /** fetch, das der Reihe nach diese Antworten gibt (Error = wirft). */
  const folge = (...antworten: (Response | Error | 'haengt')[]) => {
    const fn = jest.fn(async () => {
      const naechste = antworten.shift()
      if (naechste === undefined) throw new Error('zu viele Anfragen')
      if (naechste === 'haengt') return new Promise<Response>(() => undefined)
      if (naechste instanceof Error) throw naechste
      return naechste
    })
    global.fetch = fn as unknown as typeof fetch
    return fn
  }

  /** Ergebnis als Text, ohne dass die Ablehnung unbehandelt bleibt. */
  const lade = () =>
    ladeJson('/data/test.json', 'Die Testdaten').then(
      (v) => v,
      (err: Error) => `Fehler: ${err.message}`
    )

  it('Netzfehler einmal, dann geladen', async () => {
    const fn = folge(new TypeError('Failed to fetch'), ok({ a: 1 }))
    const ergebnis = lade()
    await jest.advanceTimersByTimeAsync(WIEDERHOLEN_NACH_MS[0])
    await expect(ergebnis).resolves.toEqual({ a: 1 })
    expect(fn).toHaveBeenCalledTimes(2)
    expect(jest.getTimerCount()).toBe(0)
  })

  it('503 zweimal, dann geladen', async () => {
    const fn = folge(status(503), status(503), ok({ b: 2 }))
    const ergebnis = lade()
    await jest.advanceTimersByTimeAsync(
      WIEDERHOLEN_NACH_MS[0] + WIEDERHOLEN_NACH_MS[1]
    )
    await expect(ergebnis).resolves.toEqual({ b: 2 })
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('höchstens zwei Wiederholungen: 5xx dreimal ist ein Fehler mit Status', async () => {
    const fn = folge(status(500), status(502), status(503))
    const ergebnis = lade()
    await jest.advanceTimersByTimeAsync(DATEN_ZEIT_MS)
    await expect(ergebnis).resolves.toBe(
      'Fehler: Die Testdaten konnten nicht geladen werden (HTTP 503).'
    )
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('404 wird nicht wiederholt', async () => {
    const fn = folge(status(404))
    await expect(lade()).resolves.toBe(
      'Fehler: Die Testdaten konnten nicht geladen werden (HTTP 404).'
    )
    expect(fn).toHaveBeenCalledTimes(1)
    expect(jest.getTimerCount()).toBe(0)
  })

  it('nur ein Netzfehler (TypeError) wird wiederholt, kein anderer Abbruch', async () => {
    const fn = folge(new DOMException('abgebrochen', 'AbortError'))
    await expect(lade()).resolves.toBe(
      'Fehler: Die Testdaten konnten nicht geladen werden.'
    )
    expect(fn).toHaveBeenCalledTimes(1)
    expect(jest.getTimerCount()).toBe(0)
  })

  it('unlesbares JSON wird nicht wiederholt', async () => {
    const kaputt = {
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('kaputt')
      },
    } as unknown as Response
    const fn = folge(kaputt)
    await expect(lade()).resolves.toBe(
      'Fehler: Die Testdaten sind nicht lesbar.'
    )
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('eine Anfrage, die hängt, endet nach DATEN_ZEIT_MS insgesamt - auch nach einem Netzfehler', async () => {
    const fn = folge(new TypeError('Failed to fetch'), 'haengt')
    const ergebnis = lade()
    let fertig = false
    void ergebnis.then(() => {
      fertig = true
    })
    await jest.advanceTimersByTimeAsync(DATEN_ZEIT_MS - 1)
    expect(fertig).toBe(false)
    await jest.advanceTimersByTimeAsync(1)
    await expect(ergebnis).resolves.toBe(
      'Fehler: Die Testdaten konnten nicht geladen werden.'
    )
    expect(fn).toHaveBeenCalledTimes(2)
    // Nach der Frist: keine Uhr, kein weiterer Versuch.
    expect(jest.getTimerCount()).toBe(0)
    await jest.advanceTimersByTimeAsync(DATEN_ZEIT_MS)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('die Frist läuft auch während einer Pause ab - danach kein neuer Versuch', async () => {
    // Antwortet erst kurz vor der Frist mit 503: Die Pause danach reicht über
    // die Frist hinaus.
    let antworte: (r: Response) => void = () => undefined
    const fn = jest.fn(
      () =>
        new Promise<Response>((r) => {
          antworte = r
        })
    )
    global.fetch = fn as unknown as typeof fetch
    const ergebnis = lade()
    await jest.advanceTimersByTimeAsync(DATEN_ZEIT_MS - 100)
    antworte(status(503))
    await jest.advanceTimersByTimeAsync(100)
    await expect(ergebnis).resolves.toBe(
      'Fehler: Die Testdaten konnten nicht geladen werden.'
    )
    await jest.advanceTimersByTimeAsync(DATEN_ZEIT_MS)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(jest.getTimerCount()).toBe(0)
  })
})
