import type { BelegungDatei, Platz } from '../produkte/types'
import {
  berechneEntwurf,
  mitAenderung,
  ohneAenderung,
  platzName,
  type Aenderungen,
} from './entwurf'

// Erfundene Plätze und Produkte.
const PLATZ: Platz = {
  o: [0, 1, 0],
  r: [1, 0, 0],
  n: [0, 1, 0],
  f: [0, 0, 1],
  b: 0.4,
  t: 0.3,
  h: 0.2,
  art: 'reihen',
  neigung: 0,
}
const MODELL: BelegungDatei = {
  version: 3,
  raeume: {
    laden: {
      quelle: { commit: 'x' },
      slots: [
        { slot: 'regal/platz-01', produkt: 'testbrot', anzahl: 2 },
        { slot: 'regal/platz-02', produkt: 'testkuchen', anzahl: 1 },
      ],
    },
  },
}
/** Der Build: mit der Einrichtung aus hq (platz-02 leer) und den Rahmen der Plätze. */
const GEBAUT: BelegungDatei = {
  version: 3,
  raeume: {
    laden: {
      quelle: { commit: 'x' },
      slots: [{ slot: 'regal/platz-01', produkt: 'testbrot', anzahl: 2 }],
      leer: ['regal/platz-02'],
      plaetze: {
        'regal/platz-01': PLATZ,
        'regal/platz-02': PLATZ,
        'regal/platz-03': PLATZ,
      },
    },
  },
}
const QUELLE = `# von Hand gepflegt
raeume:
  laden:
    regal/platz-02: leer # montags
`
const PRODUKTE = ['testbrot', 'testkuchen', 'testweck']
const entwurf = (aenderungen: Aenderungen, quelle = QUELLE) =>
  berechneEntwurf({
    quelle,
    aenderungen,
    modell: MODELL,
    gebaut: GEBAUT,
    produkte: PRODUKTE,
  })

describe('berechneEntwurf', () => {
  it('ohne Änderung: die geladene Datei Zeichen für Zeichen, die Belegung des Builds', () => {
    const e = entwurf({})
    expect(e.text).toBe(QUELLE)
    expect(e.aenderungen).toEqual([])
    expect(e.belegungen.laden.slots).toEqual(GEBAUT.raeume.laden.slots)
    expect(e.belegungen.laden.leer).toEqual(['regal/platz-02'])
    expect(e.belegungen.laden.plaetze).toBe(GEBAUT.raeume.laden.plaetze)
  })

  it('eine Änderung steht in der Datei, in der Belegung und in der Liste der Änderungen', () => {
    const e = entwurf(
      mitAenderung({}, 'laden', 'regal/platz-03', {
        produkt: 'testweck',
        anzahl: 6,
      })
    )
    expect(e.text).toContain('# von Hand gepflegt')
    expect(e.text).toContain('regal/platz-02: leer # montags')
    expect(e.text).toContain(
      '    regal/platz-03:\n      produkt: testweck\n      anzahl: 6\n'
    )
    expect(e.belegungen.laden.slots).toEqual([
      { slot: 'regal/platz-01', produkt: 'testbrot', anzahl: 2 },
      {
        slot: 'regal/platz-03',
        produkt: 'testweck',
        anzahl: 6,
        quelle: 'einrichtung',
      },
    ])
    expect(e.aenderungen).toEqual([
      {
        raum: 'laden',
        slot: 'regal/platz-03',
        jetzt: { produkt: 'testweck', anzahl: 6 },
      },
    ])
  })

  it('„wie im Modell“ nimmt einen Platz aus der Datei: Das Modell gilt wieder', () => {
    const e = entwurf(mitAenderung({}, 'laden', 'regal/platz-02', null))
    expect(e.text).not.toContain('regal/platz-02')
    expect(e.belegungen.laden.leer).toEqual([])
    expect(e.belegungen.laden.slots[1]).toEqual({
      slot: 'regal/platz-02',
      produkt: 'testkuchen',
      anzahl: 1,
    })
    expect(e.aenderungen).toEqual([
      { raum: 'laden', slot: 'regal/platz-02', vorher: 'leer' },
    ])
  })

  it('eine Änderung, die nichts ändert, zählt nicht - der Text bleibt derselbe', () => {
    const e = entwurf(mitAenderung({}, 'laden', 'regal/platz-02', 'leer'))
    expect(e.text).toBe(QUELLE)
    expect(e.aenderungen).toEqual([])
  })

  it('zurückgenommen ist wie nie geändert', () => {
    const geaendert = mitAenderung({}, 'laden', 'regal/platz-01', 'leer')
    expect(entwurf(geaendert).aenderungen).toHaveLength(1)
    const zurueck = ohneAenderung(geaendert, 'laden', 'regal/platz-01')
    expect(entwurf(zurueck).text).toBe(QUELLE)
    // die bisherigen Änderungen bleiben unangetastet
    expect(geaendert.laden).toEqual({ 'regal/platz-01': 'leer' })
  })

  it('ohne Datei in hq: Der erste Entwurf legt sie an, ohne Änderung bleibt sie leer', () => {
    expect(entwurf({}, '').text).toBe('')
    const e = entwurf(mitAenderung({}, 'laden', 'regal/platz-01', 'leer'), '')
    expect(e.text).toMatch(/^# Einrichtung der Digitalen Bäckerei/)
    expect(e.text).toContain('raeume:\n  laden:\n    regal/platz-01: leer\n')
  })

  it('wirft bei einem Platz oder Produkt, das es nicht gibt, und bei einem fremden Raum', () => {
    expect(() =>
      entwurf(mitAenderung({}, 'laden', 'regal/platz-09', 'leer'))
    ).toThrow(/den Platz "regal\/platz-09" gibt es im Modell nicht/)
    expect(() =>
      entwurf(
        mitAenderung({}, 'laden', 'regal/platz-01', {
          produkt: 'gibtsnicht',
          anzahl: 1,
        })
      )
    ).toThrow(/gibtsnicht/)
    expect(() => entwurf({}, 'raeume:\n  keller:\n    a/b: leer\n')).toThrow(
      /den Raum "keller" gibt es nicht/
    )
    expect(() => entwurf({}, 'raeume: [')).toThrow(/kein gültiges YAML/)
  })
})

describe('platzName', () => {
  it('macht aus der Kennung einen lesbaren Namen', () => {
    expect(platzName('brotregal/ebene-1/platz-01')).toBe(
      'Brotregal · Ebene 1 · Platz 1'
    )
    expect(platzName('theke/brezelstaender/platz-10')).toBe(
      'Theke · Brezelständer · Platz 10'
    )
    expect(platzName('brotregal/koerbe/korb-3/platz-01')).toBe(
      'Brotregal · Körbe · Korb 3 · Platz 1'
    )
    expect(platzName('getraenkekuehlschrank/platz-02')).toBe(
      'Getränkekühlschrank · Platz 2'
    )
  })
})
