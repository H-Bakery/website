import fs from 'fs'
import path from 'path'
import {
  LANDING_URL,
  baueSnapshot,
  einheitAus,
  fehlendeProdukte,
  nurBelegte,
  pruefeSnapshot,
} from './product-snapshot'

// Nur erfundene Produkte - echte Daten liegen in hq. Die Zahl bei `price`
// steht hier allein, um zu zeigen, dass sie NICHT im Snapshot landet.
const record = (over: Record<string, unknown> = {}) => ({
  file: '2-testbrot-500g.md',
  id: 'testbrot-500g',
  numeric_id: 2 as number | undefined,
  name: 'Testbrot 500g',
  category: 'brot',
  price: 1.5 as number | undefined,
  available: true as boolean | undefined,
  seasonal: false as boolean | undefined,
  image: '' as string | undefined,
  weight: undefined as string | number | undefined,
  short_description: 'Ein Brot nur für Tests.' as string | undefined,
  body: 'Der lange Text zum Testbrot.',
  ...over,
})

const ERSTELLT = '2026-01-02T03:04:05.000Z'

describe('einheitAus', () => {
  it.each([
    ['750g', '750 g'],
    ['750 g', '750 g'],
    [' 500g ', '500 g'],
    ['1,5kg', '1,5 kg'],
    ['0.5 l', '0.5 l'],
    ['6 Stück', '6 Stück'],
    [750, '750 g'],
    ['ca. 80 g je Stück', 'ca. 80 g je Stück'],
  ])('%p → %p', (weight, einheit) => {
    expect(einheitAus(weight)).toBe(einheit)
  })

  it.each([[undefined], [null], [''], ['   '], [0], [-5], [NaN], [true]])(
    'ohne brauchbares weight (%p) keine Einheit',
    (weight) => {
      expect(einheitAus(weight)).toBeUndefined()
    }
  )
})

describe('baueSnapshot', () => {
  it('baut die Vertragsform - ohne Preis, ohne Allergene, ohne Bild', () => {
    const { snapshot, uebersprungen } = baueSnapshot(
      [record({ weight: '500g' })],
      { erstellt: ERSTELLT }
    )
    expect(uebersprungen).toEqual([])
    expect(snapshot).toEqual({
      version: 1,
      erstellt: ERSTELLT,
      produkte: {
        'testbrot-500g': {
          id: 'testbrot-500g',
          name: 'Testbrot 500g',
          kategorie: 'brot',
          einheit: '500 g',
          kurztext: 'Ein Brot nur für Tests.',
          text: 'Der lange Text zum Testbrot.',
          seite: `${LANDING_URL}/products/2`,
        },
      },
    })
    const json = JSON.stringify(snapshot)
    expect(json).not.toMatch(/price|preis|allerg|1\.5/i)
  })

  it('ohne weight keine Einheit - auch wenn die ID ein Gewicht nennt', () => {
    const { snapshot } = baueSnapshot([record()], { erstellt: ERSTELLT })
    expect(snapshot.produkte['testbrot-500g']).not.toHaveProperty('einheit')
  })

  it('nimmt nur verfügbare Produkte (fehlendes available zählt als verfügbar)', () => {
    const { snapshot } = baueSnapshot(
      [
        record({ id: 'testkeks', available: false }),
        record({ id: 'testbrötchen', available: undefined }),
        record(),
      ],
      { erstellt: ERSTELLT }
    )
    expect(Object.keys(snapshot.produkte)).toEqual([
      'testbrot-500g',
      'testbrötchen',
    ])
  })

  it('fehlende Texte sind leer, ein Text nur aus Überschrift auch', () => {
    const { snapshot } = baueSnapshot(
      [
        record({ short_description: undefined, body: '' }),
        record({ id: 'testkeks', body: '# Testkeks' }),
      ],
      { erstellt: ERSTELLT }
    )
    expect(snapshot.produkte['testbrot-500g']).toMatchObject({
      kurztext: '',
      text: '',
    })
    expect(snapshot.produkte['testkeks'].text).toBe('')
  })

  it('seite nur mit einer Produktnummer; die Adresse lässt sich überschreiben', () => {
    const { snapshot } = baueSnapshot(
      [
        record({ numeric_id: undefined }),
        record({ id: 'testkeks', numeric_id: 7 }),
      ],
      { erstellt: ERSTELLT, landingUrl: 'https://beispiel.test/' }
    )
    expect(snapshot.produkte['testbrot-500g']).not.toHaveProperty('seite')
    expect(snapshot.produkte['testkeks'].seite).toBe(
      'https://beispiel.test/products/7'
    )
  })

  it('überspringt und meldet, was nicht passt', () => {
    const { snapshot, uebersprungen } = baueSnapshot(
      [
        record(),
        record({ file: '3-doppelt.md' }),
        record({ file: '4-zahl.md', id: 4 }),
        record({
          file: '5-ohne-kategorie.md',
          id: 'testkeks',
          category: undefined,
        }),
      ],
      { erstellt: ERSTELLT }
    )
    expect(Object.keys(snapshot.produkte)).toEqual(['testbrot-500g'])
    expect(uebersprungen).toEqual([
      { file: '3-doppelt.md', grund: 'id testbrot-500g doppelt' },
      { file: '4-zahl.md', grund: 'id oder name ist kein Text' },
      { file: '5-ohne-kategorie.md', grund: 'category fehlt' },
    ])
  })

  it('das Ergebnis besteht die eigene Prüfung', () => {
    const { snapshot } = baueSnapshot([record({ weight: 750 })], {
      erstellt: ERSTELLT,
    })
    expect(pruefeSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(
      snapshot
    )
  })
})

describe('pruefeSnapshot', () => {
  const gut = () => ({
    version: 1,
    erstellt: ERSTELLT,
    produkte: {
      testbrot: {
        id: 'testbrot',
        name: 'Testbrot',
        kategorie: 'brot',
        kurztext: 'Kurz.',
        text: '',
      } as Record<string, unknown>,
    },
  })

  it('lässt einen gültigen Snapshot durch', () => {
    expect(pruefeSnapshot(gut())).toEqual(gut())
  })

  it('lehnt ein Preisfeld ab', () => {
    const s = gut()
    s.produkte.testbrot.price = 1.5
    expect(() => pruefeSnapshot(s)).toThrow('Feld "price"')
  })

  it('lehnt Allergene ab', () => {
    const s = gut()
    s.produkte.testbrot.allergens = ['gluten']
    expect(() => pruefeSnapshot(s)).toThrow('Feld "allergens"')
  })

  it('lehnt „€“ in einem Text ab', () => {
    const s = gut()
    s.produkte.testbrot.text = 'Heute nur 1 €.'
    expect(() => pruefeSnapshot(s)).toThrow('€')
  })

  it.each([
    ['kein Objekt', null, 'kein Objekt'],
    ['falsche Version', { ...gut(), version: 2 }, 'version'],
    ['ohne erstellt', { ...gut(), erstellt: undefined }, 'erstellt'],
    ['ohne produkte', { ...gut(), produkte: [] }, 'produkte'],
    [
      'id passt nicht zum Schlüssel',
      { ...gut(), produkte: { anders: gut().produkte.testbrot } },
      'hat die id',
    ],
    [
      'Pflichtfeld fehlt',
      {
        ...gut(),
        produkte: { testbrot: { id: 'testbrot', name: 'Testbrot' } },
      },
      'kategorie fehlt',
    ],
    [
      'Feld ist kein Text',
      {
        ...gut(),
        produkte: { testbrot: { ...gut().produkte.testbrot, einheit: 500 } },
      },
      'einheit ist kein Text',
    ],
  ])('wirft: %s', (_name, raw, message) => {
    expect(() => pruefeSnapshot(raw)).toThrow(message)
  })
})

describe('nurBelegte', () => {
  const records = [
    record(),
    record({ id: 'testkeks', file: '3-testkeks.md', name: 'Testkeks' }),
    record({ id: 'testtorte', file: '4-testtorte.md', name: 'Testtorte' }),
  ]

  it('behält nur Produkte, die im Modell auf einem Platz liegen', () => {
    const { snapshot } = baueSnapshot(records, { erstellt: ERSTELLT })
    const r = nurBelegte(snapshot, {
      slots: [
        { produkt: 'testkeks' },
        { produkt: 'testkeks' },
        { produkt: 'gibt-es-nicht' },
        { produkt: 'toString' },
      ],
    })
    expect(Object.keys(r.snapshot.produkte)).toEqual(['testkeks'])
    expect(r.entfernt).toBe(2)
    expect(r.snapshot.version).toBe(1)
    expect(r.snapshot.erstellt).toBe(ERSTELLT)
    // Der gefilterte Snapshot besteht die Prüfung, der ursprüngliche bleibt, wie er war.
    expect(() => pruefeSnapshot(r.snapshot)).not.toThrow()
    expect(Object.keys(snapshot.produkte)).toHaveLength(3)
  })

  it('eine leere Belegung lässt nichts übrig - und meldet weiter, was fehlt', () => {
    const { snapshot } = baueSnapshot(records, { erstellt: ERSTELLT })
    const r = nurBelegte(snapshot, { slots: [] })
    expect(r.snapshot.produkte).toEqual({})
    expect(r.entfernt).toBe(3)
  })

  it('ändert nichts daran, welche Produkte des Modells als fehlend gemeldet werden', () => {
    const { snapshot } = baueSnapshot(records, { erstellt: ERSTELLT })
    const belegung = {
      slots: [{ produkt: 'testkeks' }, { produkt: 'gibt-es-nicht' }],
    }
    const gefiltert = nurBelegte(snapshot, belegung).snapshot
    expect(fehlendeProdukte(belegung, gefiltert, records)).toEqual(
      fehlendeProdukte(belegung, snapshot, records)
    )
  })
})

describe('fehlendeProdukte', () => {
  const belegung = {
    slots: [
      { produkt: 'testbrot-500g' },
      { produkt: 'testbrot-500g' },
      { produkt: 'testkeks' },
      { produkt: 'gibt-es-nicht' },
      { produkt: 'toString' },
    ],
  }

  it('zählt je Produkt einmal und trennt „fehlt in hq“ von „nicht verfügbar“', () => {
    const records = [record(), record({ id: 'testkeks', available: false })]
    const { snapshot } = baueSnapshot(records, { erstellt: ERSTELLT })
    expect(fehlendeProdukte(belegung, snapshot, records)).toEqual({
      imModell: 4,
      gefunden: 1,
      fehlt: ['gibt-es-nicht', 'toString'],
      nichtVerfuegbar: ['testkeks'],
    })
  })

  it('ohne hq-Liste (Fixture) zählt alles Offene als fehlend', () => {
    const { snapshot } = baueSnapshot([record()], { erstellt: ERSTELLT })
    expect(fehlendeProdukte(belegung, snapshot).fehlt).toEqual([
      'gibt-es-nicht',
      'testkeks',
      'toString',
    ])
  })
})

describe('LANDING_URL', () => {
  it('ist die SITE_URL der Landingpage', () => {
    // Die Angaben stehen seit der Preisliste in der gemeinsamen Lib; die
    // Landingpage (`apps/bakery-landing/src/config/legal.ts`) reicht sie durch.
    const legal = fs.readFileSync(
      path.join(__dirname, '../../../libs/shared/utils/src/lib/legal.ts'),
      'utf8'
    )
    const m = /export const SITE_URL = '([^']+)'/.exec(legal)
    expect(m?.[1]).toBe(LANDING_URL)
  })
})
