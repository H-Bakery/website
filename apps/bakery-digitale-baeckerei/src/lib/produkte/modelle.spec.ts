import {
  LEERER_MODELL_INDEX,
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
