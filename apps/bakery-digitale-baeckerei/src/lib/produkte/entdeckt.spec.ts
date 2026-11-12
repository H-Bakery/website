import {
  entdeckbare,
  entdecktText,
  merkeEntdeckt,
  zaehleEntdeckt,
} from './entdeckt'
import type { Belegung, ProduktInfo, ProduktSnapshot } from './types'

const produkt = (id: string, name: string): ProduktInfo => ({
  id,
  name,
  kategorie: 'brot',
  kurztext: `Ein erfundenes ${name}.`,
  text: '',
})

const SNAPSHOT: ProduktSnapshot = {
  version: 1,
  erstellt: '2026-01-01T00:00:00.000Z',
  produkte: {
    'testbrot-500g': produkt('testbrot-500g', 'Testbrot'),
    probeweck: produkt('probeweck', 'Probeweck'),
    zimtkringel: produkt('zimtkringel', 'Zimtkringel'),
    // im Snapshot, aber auf keinem Platz
    lagerware: produkt('lagerware', 'Lagerware'),
  },
}

const BELEGUNG: Belegung = {
  version: 1,
  quelle: { commit: 'fixture' },
  slots: [
    { slot: 'theke/vitrine/ebene-1/platz-01', produkt: 'testbrot-500g' },
    { slot: 'theke/vitrine/ebene-1/platz-02', produkt: 'probeweck' },
    { slot: 'brotregal/ebene-1/platz-01', produkt: 'testbrot-500g' },
    { slot: 'brotregal/ebene-1/platz-02', produkt: 'zimtkringel' },
    // liegt im Modell, aber hq kennt es nicht: keine Karte, zählt nicht
    { slot: 'brotregal/ebene-1/platz-03', produkt: 'phantomgebaeck' },
    { slot: 'brotregal/ebene-1/platz-04', produkt: 'toString' },
  ],
}

describe('entdeckbare', () => {
  it('zählt jedes Produkt der Belegung einmal, nur mit Karte', () => {
    expect(entdeckbare(BELEGUNG, SNAPSHOT).sort()).toEqual([
      'probeweck',
      'testbrot-500g',
      'zimtkringel',
    ])
  })

  it('ist leer ohne Plätze', () => {
    expect(entdeckbare({ ...BELEGUNG, slots: [] }, SNAPSHOT)).toEqual([])
  })
})

describe('merkeEntdeckt', () => {
  it('nimmt ein neues Produkt auf, ohne die alte Menge zu ändern', () => {
    const leer: ReadonlySet<string> = new Set()
    const eins = merkeEntdeckt(leer, 'probeweck')
    expect([...eins]).toEqual(['probeweck'])
    expect(leer.size).toBe(0)
    expect(eins).not.toBe(leer)
  })

  it('liefert dieselbe Menge, wenn das Produkt schon dabei ist', () => {
    const eins = merkeEntdeckt(new Set(), 'probeweck')
    expect(merkeEntdeckt(eins, 'probeweck')).toBe(eins)
  })
})

describe('zaehleEntdeckt', () => {
  const alle = entdeckbare(BELEGUNG, SNAPSHOT)

  it('zählt x von y', () => {
    expect(zaehleEntdeckt(new Set(), alle)).toEqual({ entdeckt: 0, gesamt: 3 })
    expect(zaehleEntdeckt(new Set(['probeweck']), alle)).toEqual({
      entdeckt: 1,
      gesamt: 3,
    })
    expect(zaehleEntdeckt(new Set(alle), alle)).toEqual({
      entdeckt: 3,
      gesamt: 3,
    })
  })

  it('zählt nicht mit, was es nicht (mehr) zu entdecken gibt', () => {
    expect(
      zaehleEntdeckt(new Set(['probeweck', 'lagerware', 'weg']), alle)
    ).toEqual({ entdeckt: 1, gesamt: 3 })
  })

  it('zählt doppelte ids nur einmal', () => {
    expect(zaehleEntdeckt(new Set(['a']), ['a', 'a', 'b'])).toEqual({
      entdeckt: 1,
      gesamt: 2,
    })
  })
})

describe('entdecktText', () => {
  it('nennt x von y', () => {
    expect(entdecktText({ entdeckt: 0, gesamt: 48 })).toBe(
      '0 von 48 Produkten im Laden entdeckt'
    )
    expect(entdecktText({ entdeckt: 12, gesamt: 48 })).toBe(
      '12 von 48 Produkten im Laden entdeckt'
    )
    expect(entdecktText({ entdeckt: 0, gesamt: 1 })).toBe(
      '0 von 1 Produkt im Laden entdeckt'
    )
  })

  it('sagt, wenn alles entdeckt ist', () => {
    expect(entdecktText({ entdeckt: 48, gesamt: 48 })).toBe(
      'Alle 48 Produkte im Laden entdeckt'
    )
    expect(entdecktText({ entdeckt: 1, gesamt: 1 })).toBe(
      'Das eine Produkt im Laden entdeckt'
    )
  })

  it('schweigt, wenn es nichts zu entdecken gibt', () => {
    expect(entdecktText({ entdeckt: 0, gesamt: 0 })).toBeNull()
  })
})
