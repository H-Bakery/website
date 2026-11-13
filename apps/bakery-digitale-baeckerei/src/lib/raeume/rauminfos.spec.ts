import {
  LEERE_RAUMINFOS,
  findeFuerKnoten,
  gehoertZu,
  infoEintraegeFuer,
  infopunkteVon,
  istInfoKarte,
  karteVon,
  ladeRauminfos,
  leseRauminfos,
  type Infopunkt,
} from './rauminfos'

// Nur erfundene Stationen.
const OFEN: Infopunkt = {
  knoten: 'ofen',
  titel: 'Probeofen',
  kurz: 'Ein erfundener Ofen.',
  text: 'Mehr zum Probeofen.',
}
const OFENTUER: Infopunkt = {
  knoten: 'ofen/tuer',
  titel: 'Probetür',
  kurz: 'Die Tür des Probeofens.',
}
const KNETER: Infopunkt = {
  knoten: 'kneter',
  titel: 'Probekneter',
  kurz: 'Ein erfundener Kneter.',
}
const DATEI = {
  version: 1,
  raeume: { werkstatt: { infopunkte: [OFEN, OFENTUER, KNETER] } },
}

describe('gehoertZu', () => {
  it('der Anfang gilt abschnittsweise', () => {
    expect(gehoertZu('ofen', 'ofen')).toBe(true)
    expect(gehoertZu('ofen/tuer', 'ofen')).toBe(true)
    expect(gehoertZu('ofen/tuer/griff', 'ofen/tuer')).toBe(true)
    expect(gehoertZu('ofenrohr', 'ofen')).toBe(false)
    expect(gehoertZu('ofen', 'ofen/tuer')).toBe(false)
    expect(gehoertZu('kneter/korpus', 'ofen')).toBe(false)
  })

  it('ein Schrägstrich am Ende ändert nichts, ein leerer Anfang trifft nichts', () => {
    expect(gehoertZu('ofen/tuer', 'ofen/')).toBe(true)
    expect(gehoertZu('ofen', 'ofen/')).toBe(true)
    expect(gehoertZu('ofen', '')).toBe(false)
    expect(gehoertZu('ofen', '/')).toBe(false)
  })
})

describe('findeFuerKnoten', () => {
  const punkte = [OFEN, OFENTUER, KNETER]

  it('findet den Infopunkt zu einem getroffenen Stück', () => {
    expect(findeFuerKnoten(punkte, 'ofen/korpus')).toBe(OFEN)
    expect(findeFuerKnoten(punkte, 'kneter/kessel')).toBe(KNETER)
  })

  it('der genaueste Anfang gewinnt', () => {
    expect(findeFuerKnoten(punkte, 'ofen/tuer')).toBe(OFENTUER)
    expect(findeFuerKnoten(punkte, 'ofen/tuer/griff')).toBe(OFENTUER)
    expect(findeFuerKnoten([OFENTUER, OFEN], 'ofen/tuer')).toBe(OFENTUER)
  })

  it('ein Stück ohne Infopunkt hat keinen', () => {
    expect(findeFuerKnoten(punkte, 'spuele/becken')).toBeUndefined()
    expect(findeFuerKnoten([], 'ofen')).toBeUndefined()
  })
})

describe('leseRauminfos', () => {
  it('liest die Datei', () => {
    expect(leseRauminfos(DATEI)).toEqual(DATEI)
    expect(infopunkteVon(leseRauminfos(DATEI), 'werkstatt')).toHaveLength(3)
  })

  it('ein Raum, den die Datei nicht nennt, hat keine Infopunkte', () => {
    const infos = leseRauminfos(DATEI)
    expect(infopunkteVon(infos, 'laden')).toEqual([])
    // Ein Name aus dem Prototyp ist kein Raum.
    expect(infopunkteVon(infos, 'toString')).toEqual([])
  })

  it.each([
    ['kein Objekt', null],
    ['falsche Version', { version: 2, raeume: {} }],
    ['raeume fehlt', { version: 1 }],
    ['ein Snapshot', { version: 1, produkte: {} }],
  ])('unbekannte Form heißt: keine Infopunkte (%s)', (_name, raw) => {
    expect(leseRauminfos(raw)).toBe(LEERE_RAUMINFOS)
  })

  it('lässt Einträge weg, die nicht dem Vertrag entsprechen', () => {
    const infos = leseRauminfos({
      version: 1,
      raeume: {
        werkstatt: {
          infopunkte: [
            OFEN,
            { knoten: 'kneter', titel: '' },
            { titel: 'Ohne Knoten', kurz: 'x' },
            'kein Objekt',
          ],
        },
        keller: { infopunkte: 'keine Liste' },
        lager: { infopunkte: [{ knoten: 'x' }] },
      },
    })
    expect(infos.raeume).toEqual({ werkstatt: { infopunkte: [OFEN] } })
  })
})

describe('ladeRauminfos', () => {
  const antwort = (body: unknown, status = 200) =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response)

  it('lädt die Datei unter dem Basis-Pfad', async () => {
    const fn = jest.fn(async () => antwort(DATEI))
    global.fetch = fn as unknown as typeof fetch
    await expect(ladeRauminfos('/digitale-baeckerei')).resolves.toEqual(DATEI)
    expect(fn).toHaveBeenCalledWith('/digitale-baeckerei/data/rauminfos.json')
  })

  it('wirft nie: fehlt die Datei oder das Netz, gibt es keine Infopunkte', async () => {
    global.fetch = jest.fn(async () =>
      antwort(null, 404)
    ) as unknown as typeof fetch
    await expect(ladeRauminfos('')).resolves.toBe(LEERE_RAUMINFOS)
    global.fetch = jest.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    await expect(ladeRauminfos('')).resolves.toBe(LEERE_RAUMINFOS)
  })
})

describe('Karte und Liste', () => {
  it('ein Infopunkt als Karte: Titel, Kurztext, langer Text - nie die id eines Produkts', () => {
    expect(karteVon(OFEN)).toEqual({
      id: 'info:ofen',
      name: 'Probeofen',
      kurztext: 'Ein erfundener Ofen.',
      text: 'Mehr zum Probeofen.',
    })
    expect(karteVon(KNETER).text).toBe('')
    expect(istInfoKarte(karteVon(OFEN))).toBe(true)
    expect(
      istInfoKarte({ id: 'testbrot-500g', name: 'x', kurztext: '', text: '' })
    ).toBe(false)
  })

  it('die Infopunkte eines Blickpunkts: nach den Möbeln, in der Reihenfolge der Datei', () => {
    const punkte = [KNETER, OFENTUER, OFEN]
    expect(
      infoEintraegeFuer(punkte, ['ofen/']).map((e) => [e.slot, e.produkt.name])
    ).toEqual([
      ['ofen/tuer', 'Probetür'],
      ['ofen', 'Probeofen'],
    ])
    expect(
      infoEintraegeFuer(punkte, ['kneter/', 'spuele/']).map((e) => e.slot)
    ).toEqual(['kneter'])
    expect(infoEintraegeFuer(punkte, ['theke/'])).toEqual([])
  })
})
