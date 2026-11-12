import {
  artVon,
  blitzStaerke,
  einblenden,
  haeltTippAuf,
  istKlein,
  istPreisMaterial,
  istUmschliessend,
  moebelVon,
  slotVon,
  strahlTrifftQuader,
  TIPP_RADIUS_PX,
  tippflaecheHalb,
  tippWinkel,
  waehleTippflaeche,
  type Tippflaeche,
} from './treffer'

// Nur erfundene Plätze und Produkte - kein echtes Modell.

describe('slotVon / moebelVon / artVon', () => {
  it('nimmt userData.id als Platz', () => {
    expect(slotVon({ id: 'testregal/ebene-1/platz-01' })).toBe(
      'testregal/ebene-1/platz-01'
    )
  })

  it('fällt auf den Namen ohne produkt/ zurück', () => {
    expect(slotVon({ name: 'produkt/testregal/platz-02' })).toBe(
      'testregal/platz-02'
    )
    expect(slotVon({ name: 'produkt/testregal/platz-02@feierabend' })).toBe(
      'testregal/platz-02'
    )
  })

  it('kennt Knoten ohne Kennung nicht als Ziel', () => {
    expect(slotVon({})).toBeNull()
    expect(slotVon({ name: 'testregal/korpus' })).toBeNull()
    expect(slotVon({ id: 7 })).toBeNull()
  })

  it('liest das Möbel aus dem ersten Abschnitt', () => {
    expect(moebelVon('testtheke/vitrine/ebene-1/platz-03')).toBe('testtheke')
    expect(moebelVon('testregal')).toBe('testregal')
  })

  it('unterscheidet Produkt, Ware und Möbel', () => {
    expect(artVon({ product: 'testbrot' })).toEqual({ produkt: 'testbrot' })
    expect(artVon({ ware: 'testglas' })).toEqual({ ware: 'testglas' })
    expect(artVon({ id: 'testregal' })).toEqual({})
    expect(artVon({ product: 3 })).toEqual({})
  })
})

describe('Materialien', () => {
  it('lässt Glas, Leuchten und alles Durchsichtige durch', () => {
    expect(haeltTippAuf({ name: 'holz' })).toBe(true)
    expect(haeltTippAuf({ name: 'glas' })).toBe(false)
    expect(haeltTippAuf({ name: 'glow' })).toBe(false)
    expect(haeltTippAuf({ name: 'folie', transparent: true })).toBe(false)
    expect(haeltTippAuf({ name: 'dunst', opacity: 0.5 })).toBe(false)
    expect(haeltTippAuf({ name: 'holz', visible: false })).toBe(false)
    expect(haeltTippAuf({ name: 'riffelglas', opacity: 1 })).toBe(true)
  })

  it('erkennt die Preis-Materialien', () => {
    expect(istPreisMaterial('preiskarte')).toBe(true)
    expect(istPreisMaterial('preisschrift')).toBe(true)
    expect(istPreisMaterial('papier')).toBe(false)
    expect(istPreisMaterial(undefined)).toBe(false)
  })
})

describe('Tippflächen', () => {
  it('rechnet 22 px in einen Winkel um', () => {
    // 22 px von 400 px Höhe bei 90° Öffnung: tan = 2·22/400
    expect(tippWinkel(TIPP_RADIUS_PX, 400, 90)).toBeCloseTo(Math.atan(0.11), 6)
    expect(tippWinkel(0, 400, 90)).toBe(0)
    expect(tippWinkel(22, 0, 90)).toBe(0)
  })

  it('vergrößert kleine Produkte auf den Radius, aber gedeckelt', () => {
    const winkel = Math.atan(0.05)
    expect(tippflaecheHalb([0.01, 0.01, 0.01], 2, winkel)).toEqual([
      expect.closeTo(0.1, 6),
      expect.closeTo(0.1, 6),
      expect.closeTo(0.1, 6),
    ])
    // weit weg: nie größer als 16 cm
    expect(tippflaecheHalb([0.01, 0.2, 0.01], 10, winkel)).toEqual([
      0.16, 0.2, 0.16,
    ])
  })

  it('kennt kleine und umschließende Quader', () => {
    expect(istKlein([0.3, 0.1, 0.45])).toBe(true)
    expect(istKlein([0.3, 0.1, 0.5])).toBe(false)
    expect(istUmschliessend(6, 2.3, 8)).toBe(true)
    expect(istUmschliessend(1.8, 2, 3.6)).toBe(false)
    expect(istUmschliessend(40, 0.1, 2)).toBe(true)
  })

  it('findet den Eintritt eines Strahls in einen Quader', () => {
    expect(
      strahlTrifftQuader([0, 0, 5], [0, 0, -1], [-1, -1, -1], [1, 1, 1])
    ).toBeCloseTo(4)
    expect(
      strahlTrifftQuader([3, 0, 5], [0, 0, -1], [-1, -1, -1], [1, 1, 1])
    ).toBeNull()
    // Quader hinter dem Ursprung
    expect(
      strahlTrifftQuader([0, 0, 5], [0, 0, 1], [-1, -1, -1], [1, 1, 1])
    ).toBeNull()
  })

  const winkel = Math.atan(0.05) // bei 2 m Abstand: 10 cm
  const brezel: Tippflaeche = { c: [0, 0, 0], h: [0.02, 0.02, 0.02] }
  const glas: Tippflaeche = { c: [0.12, 0, 0], h: [0.02, 0.02, 0.02] }

  it('wählt die Fläche, an deren Mitte der Strahl am nächsten vorbeigeht', () => {
    const wahl = waehleTippflaeche(
      [0.08, 0, 2],
      [0, 0, -1],
      [brezel, glas],
      winkel,
      Infinity,
      30
    )
    expect(wahl.index).toBe(1)
    expect(
      waehleTippflaeche(
        [0.03, 0, 2],
        [0, 0, -1],
        [brezel, glas],
        winkel,
        Infinity,
        30
      ).index
    ).toBe(0)
  })

  it('trifft außerhalb des Radius nichts', () => {
    expect(
      waehleTippflaeche(
        [0.4, 0, 2],
        [0, 0, -1],
        [brezel, glas],
        winkel,
        Infinity,
        30
      ).index
    ).toBe(-1)
    // ohne Radius gar nichts
    expect(
      waehleTippflaeche([0, 0, 2], [0, 0, -1], [brezel], 0, Infinity, 30).index
    ).toBe(-1)
  })

  it('lässt hinter einer Wand nichts durch, hinter einem Möbelteil 30 cm', () => {
    // erste Fläche 1 m vor der Kamera, das Produkt liegt 2 m entfernt
    expect(
      waehleTippflaeche([0, 0, 2], [0, 0, -1], [brezel], winkel, 1, 30, 0).index
    ).toBe(-1)
    // Regalstrebe 20 cm vor dem Produkt: mit Tiefen-Spiel erreichbar
    expect(
      waehleTippflaeche([0, 0, 2], [0, 0, -1], [brezel], winkel, 1.7, 30).index
    ).toBe(0)
    // dieselbe Strebe als Wand (kein Spiel): nicht erreichbar
    expect(
      waehleTippflaeche([0, 0, 2], [0, 0, -1], [brezel], winkel, 1.7, 30, 0)
        .index
    ).toBe(-1)
    // zu weit weg
    expect(
      waehleTippflaeche([0, 0, 2], [0, 0, -1], [brezel], winkel, Infinity, 1)
        .index
    ).toBe(-1)
  })
})

describe('Aufleuchten', () => {
  it('blendet weich ein', () => {
    expect(einblenden(0)).toBe(0)
    expect(einblenden(1)).toBe(1)
    expect(einblenden(5)).toBe(1)
    expect(einblenden(0.5)).toBeGreaterThan(0.5)
  })

  it('leuchtet kurz auf und klingt aus', () => {
    expect(blitzStaerke(0)).toBe(0)
    expect(blitzStaerke(0.3)).toBe(1)
    expect(blitzStaerke(0.8)).toBeGreaterThan(0)
    expect(blitzStaerke(0.8)).toBeLessThan(1)
    expect(blitzStaerke(1)).toBe(0)
  })

  it('klingt nicht aus, wenn der Platz ausgewählt bleibt', () => {
    expect(blitzStaerke(0.8, true)).toBe(1)
    expect(blitzStaerke(1, true)).toBe(1)
  })
})
