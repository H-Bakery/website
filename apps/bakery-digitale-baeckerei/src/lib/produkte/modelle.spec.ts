import {
  LEERER_MODELL_INDEX,
  MODELL_INDEX_ZEIT_MS,
  ladeModellIndex,
  leseModellIndex,
  modellAdresse,
  modellFuer,
} from './modelle'

const BBOX = { min: [-0.1, 0, -0.05], max: [0.1, 0.08, 0.05] }
const TESTBROT = {
  datei: 'produkte-3d/testbrot-500g.glb',
  bytes: 14580,
  bbox_m: BBOX,
}
const INDEX = { version: 1, modelle: { 'testbrot-500g': TESTBROT } }
/** Regal-Modelle der Einrichtung (DB12): alle in einer Datei. */
const REGAL = {
  datei: 'produkte-3d/_regal.glb',
  bytes: 3048,
  modelle: { 'testbrot-500g': { bbox_m: BBOX, dreiecke: 14 } },
}

const fetchMock = jest.fn()
beforeEach(() => {
  fetchMock.mockReset()
  global.fetch = fetchMock as unknown as typeof fetch
})

describe('leseModellIndex', () => {
  it('liest einen Index nach Vertrag', () => {
    expect(leseModellIndex(INDEX)).toEqual(INDEX)
  })

  it.each([
    ['nichts', undefined],
    ['null', null],
    ['eine Liste', []],
    ['eine andere Version', { version: 2, modelle: {} }],
    [
      'eine andere Version mit Regal-Modellen',
      { version: 2, modelle: {}, regal: REGAL },
    ],
    ['ohne modelle', { version: 1 }],
  ])('macht aus %s den leeren Index', (_, raw) => {
    expect(leseModellIndex(raw)).toEqual({ version: 1, modelle: {} })
  })

  it('lässt Einträge fallen, die nicht dem Vertrag entsprechen', () => {
    const index = leseModellIndex({
      version: 1,
      modelle: {
        'testbrot-500g': TESTBROT,
        fremd: { ...TESTBROT, datei: 'https://example.org/boese.glb' },
        hoch: { ...TESTBROT, datei: 'produkte-3d/../model/twin.glb' },
        leer: { ...TESTBROT, bytes: 0 },
        ohneRahmen: { datei: 'produkte-3d/x.glb', bytes: 5 },
      },
    })
    expect(Object.keys(index.modelle)).toEqual(['testbrot-500g'])
  })
})

describe('leseModellIndex: Regal-Modelle (DB12)', () => {
  it('liest das Paket der Regal-Modelle - auch ohne Nahansicht', () => {
    expect(leseModellIndex({ ...INDEX, regal: REGAL })).toEqual({
      ...INDEX,
      regal: REGAL,
    })
    expect(leseModellIndex({ version: 1, modelle: {}, regal: REGAL })).toEqual({
      version: 1,
      modelle: {},
      regal: REGAL,
    })
  })

  it('ohne „regal“ gibt es keins - der Laden zeigt die Ware seines Modells', () => {
    expect(leseModellIndex(INDEX)).not.toHaveProperty('regal')
  })

  it.each([
    ['eine fremde Adresse', { ...REGAL, datei: 'https://example.org/x.glb' }],
    ['eine andere Datei des Exports', { ...REGAL, datei: 'model/twin.glb' }],
    ['keine Größe', { ...REGAL, bytes: 0 }],
    ['keine Modelle', { ...REGAL, modelle: {} }],
    ['kein Objekt', 'regal.glb'],
  ])('lässt das Paket fallen: %s', (_, regal) => {
    const index = leseModellIndex({ ...INDEX, regal })
    expect(index).not.toHaveProperty('regal')
    // Die Nahansicht bleibt davon unberührt.
    expect(index.modelle).toEqual(INDEX.modelle)
  })

  it('lässt einzelne Regal-Modelle fallen, die nicht dem Vertrag entsprechen', () => {
    const index = leseModellIndex({
      version: 1,
      modelle: {},
      regal: {
        ...REGAL,
        modelle: {
          'testbrot-500g': { bbox_m: BBOX, dreiecke: 14 },
          'Kein Name': { bbox_m: BBOX, dreiecke: 14 },
          ohnerahmen: { dreiecke: 14 },
        },
      },
    })
    expect(Object.keys(index.regal?.modelle ?? {})).toEqual(['testbrot-500g'])
  })
})

describe('ladeModellIndex', () => {
  it('lädt data/produkte-3d.json unter dem Basis-Pfad', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => INDEX })
    await expect(ladeModellIndex('/digitale-baeckerei')).resolves.toEqual(INDEX)
    expect(fetchMock).toHaveBeenCalledWith(
      '/digitale-baeckerei/data/produkte-3d.json'
    )
  })

  it.each([
    ['404', async () => ({ ok: false, status: 404 })],
    [
      'kaputtes JSON',
      async () => ({
        ok: true,
        json: async () => {
          throw new SyntaxError('kaputt')
        },
      }),
    ],
    [
      'kein Netz',
      async () => {
        throw new TypeError('Failed to fetch')
      },
    ],
  ])('wirft nie - %s ergibt den leeren Index', async (_, antwort) => {
    fetchMock.mockImplementation(antwort)
    await expect(ladeModellIndex('')).resolves.toEqual(LEERER_MODELL_INDEX)
  })
})

describe('modellFuer und modellAdresse', () => {
  const index = leseModellIndex(INDEX)

  it('findet das Modell eines Produkts - und sonst keines', () => {
    expect(modellFuer(index, 'testbrot-500g')).toEqual(TESTBROT)
    expect(modellFuer(index, 'testkekse')).toBeUndefined()
    expect(modellFuer(LEERER_MODELL_INDEX, 'testbrot-500g')).toBeUndefined()
    // nichts aus dem Prototyp
    expect(modellFuer(index, 'toString')).toBeUndefined()
    expect(modellFuer(index, 'constructor')).toBeUndefined()
  })

  it('baut die Adresse mit und ohne Basis-Pfad', () => {
    expect(modellAdresse(TESTBROT, '')).toBe('/produkte-3d/testbrot-500g.glb')
    expect(modellAdresse(TESTBROT, '/digitale-baeckerei')).toBe(
      '/digitale-baeckerei/produkte-3d/testbrot-500g.glb'
    )
  })
})

describe('ladeModellIndex: eine Anfrage, die hängt, hält nichts auf', () => {
  afterEach(() => jest.useRealTimers())

  it('liefert nach der Frist den leeren Index - der Laden zeigt dann die Ware seines Modells', async () => {
    jest.useFakeTimers()
    fetchMock.mockReturnValue(new Promise(() => undefined))
    const ergebnis = ladeModellIndex('')
    let fertig = false
    void ergebnis.then(() => {
      fertig = true
    })
    await jest.advanceTimersByTimeAsync(MODELL_INDEX_ZEIT_MS - 1)
    expect(fertig).toBe(false)
    await jest.advanceTimersByTimeAsync(2)
    await expect(ergebnis).resolves.toEqual(LEERER_MODELL_INDEX)
  })

  it('eine schnelle Antwort lässt keine Uhr zurück', async () => {
    jest.useFakeTimers()
    fetchMock.mockResolvedValue({ ok: true, json: async () => INDEX })
    await expect(ladeModellIndex('')).resolves.toEqual(INDEX)
    expect(jest.getTimerCount()).toBe(0)
  })
})
