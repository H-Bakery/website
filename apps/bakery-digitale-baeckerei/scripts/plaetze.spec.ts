import {
  artVon,
  breiten,
  kleinstesRechteck,
  leitePlaetzeAb,
  tiefenVon,
  wareVon,
} from './plaetze'

// Erfundene Möbel aus Kisten - das echte Modell liegt nie im Repo.
const RAD = Math.PI / 180

/** Achsen eines Möbels: `richtung` = wohin „vorn“ zeigt (Grad), `neigung` (+ = hinten höher). */
function achsen(richtung: number, neigung = 0) {
  const h = richtung * RAD
  const t = neigung * RAD
  const f0 = [Math.sin(h), 0, -Math.cos(h)]
  const n = [f0[0] * Math.sin(t), Math.cos(t), f0[2] * Math.sin(t)]
  const f = [f0[0] * Math.cos(t), -Math.sin(t), f0[2] * Math.cos(t)]
  const r = [
    n[1] * f[2] - n[2] * f[1],
    n[2] * f[0] - n[0] * f[2],
    n[0] * f[1] - n[1] * f[0],
  ]
  return { r, n, f }
}

type Achsen = ReturnType<typeof achsen>

/**
 * Eckpunkte einer Kiste auf der Standfläche: Mitte quer (`u`) und in der
 * Tiefe (`v`, + = vorn), Breite × Tiefe × Höhe, `ab` = Höhe der Unterseite.
 */
function kiste(
  a: Achsen,
  ursprung: number[],
  u: number,
  v: number,
  [b, t, h]: number[],
  ab = 0
): number[] {
  const out: number[] = []
  for (const du of [-b / 2, b / 2]) {
    for (const dv of [-t / 2, t / 2]) {
      for (const dn of [ab, ab + h]) {
        for (let k = 0; k < 3; k += 1) {
          out.push(
            ursprung[k] + a.r[k] * (u + du) + a.f[k] * (v + dv) + a.n[k] * dn
          )
        }
      }
    }
  }
  return out
}

const nah = (a: number[], b: number[], stellen = 2) =>
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i], stellen))

describe('artVon: wie die Ware auf einem Platz liegt', () => {
  it('Brezelständer: Haken; Körbe: gehäuft; sonst Reihen', () => {
    expect(artVon('theke/brezelstaender/platz-01')).toBe('haken')
    expect(artVon('brotregal/koerbe/korb-1/platz-01')).toBe('korb')
    expect(artVon('brotregal/ebene-1/platz-01')).toBe('reihen')
    // Nur ganze Abschnitte zählen.
    expect(artVon('regal/koerbestapel/platz-01')).toBe('reihen')
  })
})

describe('kleinstesRechteck', () => {
  it('findet die lange Seite einer gedrehten Reihe', () => {
    const a = achsen(30)
    const punkte = [-1, 0, 1].flatMap((u) => {
      const k = kiste(a, [0, 0, 0], u, 0, [0.4, 0.2, 0.1])
      const out: number[][] = []
      for (let i = 0; i < k.length; i += 3) out.push([k[i], k[i + 2]])
      return out
    })
    const rect = kleinstesRechteck(punkte)
    expect(rect?.laenge).toBeCloseTo(2.4, 5)
    expect(rect?.breite).toBeCloseTo(0.2, 5)
    // parallel zu „rechts“ (Vorzeichen egal)
    const lang = rect?.lang ?? [0, 0]
    expect(Math.abs(lang[0] * a.r[0] + lang[1] * a.r[2])).toBeCloseTo(1, 5)
  })

  it('ohne Punkte: nichts', () => {
    expect(kleinstesRechteck([])).toBeNull()
  })
})

describe('leitePlaetzeAb: Reihe auf einem flachen Boden', () => {
  const a = achsen(70)
  const O = [3, 245, -1]
  // Fünf Plätze im Raster 0,30 m; die Ware füllt sie verschieden weit. Vorn
  // liegt die Kante bei v = +0,15.
  const waren = [
    { u: -0.6, b: 0.26, t: 0.3, v: 0 },
    { u: -0.3, b: 0.2, t: 0.12, v: 0.09 }, // ein einzelnes Stück, vorn
    { u: 0, b: 0.27, t: 0.3, v: 0 },
    { u: 0.3, b: 0.28, t: 0.3, v: 0 },
    { u: 0.6, b: 0.22, t: 0.3, v: 0 },
  ].map((w, i) => ({
    slot: `testregal/ebene-1/platz-0${i + 1}`,
    punkte: kiste(a, O, w.u, w.v, [w.b, w.t, 0.1]),
  }))
  const plaetze = leitePlaetzeAb(waren)

  it('jeder Platz bekommt einen Rahmen mit Einheitsachsen: rechts, oben, vorn', () => {
    expect(Object.keys(plaetze)).toHaveLength(5)
    const p = plaetze['testregal/ebene-1/platz-03']
    expect(p.art).toBe('reihen')
    expect(p.neigung).toBe(0)
    nah(p.n, [0, 1, 0], 4)
    // „rechts“ liegt längs der Reihe.
    expect(
      Math.abs(p.r[0] * a.r[0] + p.r[1] * a.r[1] + p.r[2] * a.r[2])
    ).toBeCloseTo(1, 3)
    // rechtshändig: rechts = oben × vorn
    nah(p.r, [
      p.n[1] * p.f[2] - p.n[2] * p.f[1],
      p.n[2] * p.f[0] - p.n[0] * p.f[2],
      p.n[0] * p.f[1] - p.n[1] * p.f[0],
    ])
  })

  it('vorn ist, wo die Ware liegt (das einzelne Stück liegt an der Vorderkante)', () => {
    nah(plaetze['testregal/ebene-1/platz-01'].f, a.f, 3)
  })

  it('gleich breite Plätze im Raster - auch die am Rand und der mit dem kleinen Stück', () => {
    for (const p of Object.values(plaetze)) expect(p.b).toBeCloseTo(0.29, 2)
    nah(plaetze['testregal/ebene-1/platz-02'].o, [
      O[0] + a.r[0] * -0.3,
      O[1],
      O[2] + a.r[2] * -0.3,
    ])
  })

  it('das einzelne Stück übernimmt die Tiefe seiner Nachbarn', () => {
    for (const p of Object.values(plaetze)) expect(p.t).toBeCloseTo(0.3, 3)
  })

  it('ohne Fläche darüber: die offene lichte Höhe', () => {
    expect(plaetze['testregal/ebene-1/platz-01'].h).toBeCloseTo(0.3, 3)
  })
})

describe('leitePlaetzeAb: geneigter Boden', () => {
  const a = achsen(-20, 25)
  const O = [1, 245.4, 2]
  const plaetze = leitePlaetzeAb(
    [-0.25, 0, 0.25].map((u, i) => ({
      slot: `testregal/ebene-2/platz-0${i + 1}`,
      punkte: kiste(a, O, u, 0, [0.2, 0.36, 0.09]),
    }))
  )
  const p = plaetze['testregal/ebene-2/platz-02']

  it('findet die Neigung, und vorn ist die tiefe Seite', () => {
    expect(p.neigung).toBeCloseTo(25, 0)
    nah(p.n, a.n)
    nah(p.f, a.f)
    expect(p.f[1]).toBeLessThan(0)
  })

  it('die Mitte liegt auf der Standfläche', () => {
    nah(p.o, O, 2)
    expect(p.t).toBeCloseTo(0.36, 2)
  })
})

describe('leitePlaetzeAb: mehrere Böden übereinander', () => {
  const a = achsen(0)
  const boden = (ebene: number, y: number) =>
    [-0.3, 0, 0.3].map((u, i) => ({
      slot: `testregal/ebene-${ebene}/platz-0${i + 1}`,
      punkte: kiste(a, [0, y, 0], u, 0, [0.25, 0.3, 0.1]),
    }))
  const plaetze = leitePlaetzeAb([...boden(1, 1), ...boden(2, 1.3)])

  it('die lichte Höhe reicht bis kurz unter den Boden darüber', () => {
    expect(plaetze['testregal/ebene-1/platz-01'].h).toBeCloseTo(0.27, 2)
    expect(plaetze['testregal/ebene-2/platz-01'].h).toBeCloseTo(0.3, 2)
  })

  it('nie niedriger als die Ware, die dort schon liegt', () => {
    const hoch = leitePlaetzeAb([
      {
        slot: 'testregal/ebene-1/platz-01',
        punkte: kiste(a, [0, 1, 0], 0, 0, [0.25, 0.3, 0.5]),
      },
      {
        slot: 'testregal/ebene-2/platz-01',
        punkte: kiste(a, [0, 1.3, 0], 0, 0, [0.25, 0.3, 0.1]),
      },
    ])
    expect(hoch['testregal/ebene-1/platz-01'].h).toBeCloseTo(0.5, 2)
  })
})

describe('leitePlaetzeAb: Tablett', () => {
  const a = achsen(40)
  const O = [0, 245, 0]
  const ware = (slot: string, u: number, mitTablett: boolean) => ({
    slot,
    punkte: kiste(a, O, u, 0.1, [0.1, 0.1, 0.05], mitTablett ? 0.008 : 0),
    traeger: mitTablett ? kiste(a, O, u, 0, [0.5, 0.36, 0.008]) : null,
  })
  const plaetze = leitePlaetzeAb([
    ware('vitrine/ebene-1/platz-01', -0.52, true),
    ware('vitrine/ebene-1/platz-02', 0, true),
    ware('vitrine/ebene-1/platz-03', 0.52, false),
  ])

  it('die Ware steht auf dem Tablett, und der Platz ist so groß wie das Tablett', () => {
    const p = plaetze['vitrine/ebene-1/platz-02']
    expect(p.traeger).toBe(true)
    expect(p.o[1]).toBeCloseTo(245.008, 3)
    expect(p.b).toBeGreaterThan(0.49)
    expect(p.b).toBeLessThan(0.52)
    expect(p.t).toBeCloseTo(0.36, 3)
  })

  it('der Nachbar ohne Tablett beginnt direkt neben dem Tablett und übernimmt dessen Tiefe', () => {
    const p = plaetze['vitrine/ebene-1/platz-03']
    expect(p.traeger).toBeUndefined()
    expect(p.o[1]).toBeCloseTo(245, 3)
    expect(p.t).toBeCloseTo(0.36, 3)
    // … und wächst nur um die übliche Luft über seine Ware hinaus.
    expect(p.b).toBeCloseTo(0.2, 3)
  })

  it('schwarze Deckel oben auf der Ware sind kein Tablett', () => {
    const glaeser = leitePlaetzeAb([
      {
        slot: 'regal/platz-01',
        punkte: kiste(a, O, 0, 0, [0.3, 0.1, 0.1]),
        traeger: kiste(a, O, 0, 0, [0.3, 0.1, 0.01], 0.1),
      },
    ])
    expect(glaeser['regal/platz-01'].traeger).toBeUndefined()
    expect(glaeser['regal/platz-01'].o[1]).toBeCloseTo(245, 3)
  })
})

describe('leitePlaetzeAb: Körbe und Haken', () => {
  const a = achsen(70, 10)

  it('ein Korb mit einem Platz nimmt die Richtung der Körbe daneben', () => {
    const plaetze = leitePlaetzeAb(
      [-0.6, 0, 0.6].map((u, i) => ({
        slot: `brotregal/koerbe/korb-${i + 1}/platz-01`,
        // fast quadratisch: allein hätte der Korb keine klare lange Seite
        punkte: kiste(a, [2, 244.8, 1], u, 0, [0.31, 0.3, 0.1]),
      }))
    )
    const p = plaetze['brotregal/koerbe/korb-2/platz-01']
    expect(p.art).toBe('korb')
    expect(p.neigung).toBeCloseTo(10, 0)
    expect(p.f[0] * a.f[0] + p.f[1] * a.f[1] + p.f[2] * a.f[2]).toBeGreaterThan(
      0.9999
    )
    expect(p.b).toBeCloseTo(0.31, 2)
  })

  it('am Haken: je Platz ein Rahmen aus dem hängenden Stück', () => {
    // Eine flache Scheibe, hochkant: 0,14 breit, 0,03 dick, 0,12 hoch.
    const haengt = achsen(15)
    const punkte = kiste(haengt, [4, 245.3, -2], 0, 0, [0.14, 0.03, 0.12])
    const plaetze = leitePlaetzeAb([
      { slot: 'theke/brezelstaender/platz-01', punkte },
    ])
    const p = plaetze['theke/brezelstaender/platz-01']
    expect(p.art).toBe('haken')
    // „vorn“ zeigt nach unten, „oben“ längs des Arms (die dünne Seite).
    expect(p.f).toEqual([0, -1, 0])
    expect(Math.abs(p.n[0] * haengt.f[0] + p.n[2] * haengt.f[2])).toBeCloseTo(
      1,
      3
    )
    expect(p.b).toBeCloseTo(0.14, 3)
    expect(p.t).toBeCloseTo(0.12, 3)
    expect(p.h).toBeCloseTo(0.03, 3)
    // Ort: Oberkante, mittig.
    nah(p.o, [4, 245.42, -2], 3)
  })
})

describe('leitePlaetzeAb: Ränder', () => {
  it('ein Platz ohne Eckpunkte fehlt; ein doppelter Name zählt einmal', () => {
    const a = achsen(0)
    const punkte = kiste(a, [0, 0, 0], 0, 0, [0.2, 0.1, 0.1])
    const plaetze = leitePlaetzeAb([
      { slot: 'regal/platz-01', punkte },
      { slot: 'regal/platz-01', punkte: kiste(a, [9, 9, 9], 0, 0, [1, 1, 1]) },
      { slot: 'regal/platz-02', punkte: [] },
    ])
    expect(Object.keys(plaetze)).toEqual(['regal/platz-01'])
    expect(plaetze['regal/platz-01'].o[0]).toBeCloseTo(0, 3)
  })

  it('gleiche Eingabe, gleiche Ausgabe (gerundet, ohne −0)', () => {
    const a = achsen(33, 12)
    const waren = [-0.3, 0, 0.3].map((u, i) => ({
      slot: `regal/ebene-1/platz-0${i + 1}`,
      punkte: kiste(a, [1, 2, 3], u, 0, [0.2, 0.3, 0.1]),
    }))
    const eins = JSON.stringify(leitePlaetzeAb(waren))
    expect(JSON.stringify(leitePlaetzeAb(waren))).toBe(eins)
    expect(eins).not.toContain('-0,')
    expect(eins).not.toMatch(/\d\.\d{6,}/)
  })
})

describe('breiten: Grenzen zwischen Nachbarn', () => {
  it('ohne Raster: Mitte der Lücke, aber nicht weit über die Ware hinaus', () => {
    // Zwei Stücke weit auseinander: Keiner wächst bis zur fernen Mitte.
    const kanten = breiten([
      { u0: 0, u1: 0.1 },
      { u0: 2, u1: 2.1 },
    ])
    expect(kanten[0][0]).toBeLessThanOrEqual(0)
    expect(kanten[0][1]).toBeCloseTo(0.15, 5)
    expect(kanten[1][0]).toBeCloseTo(1.95, 5)
  })

  it('verschieden breite Felder bleiben verschieden breit', () => {
    const kanten = breiten([
      { u0: 0, u1: 0.58 },
      { u0: 0.6, u1: 1.18 },
      { u0: 1.2, u1: 1.88 },
      { u0: 1.9, u1: 2.58 },
    ])
    expect(kanten[1][1] - kanten[1][0]).toBeCloseTo(0.59, 2)
    expect(kanten[2][1] - kanten[2][0]).toBeCloseTo(0.69, 2)
  })

  it('ein einzelner Platz ist so breit wie seine Ware', () => {
    expect(breiten([{ u0: 1, u1: 1.4 }])).toEqual([[1, 1.4]])
  })
})

describe('tiefenVon', () => {
  it('ein Boden mit Versatz bleibt je Feld richtig', () => {
    const tiefen = tiefenVon([
      { f0: 0, f1: 0.37 },
      { f0: 0.12, f1: 0.49 },
      // ein kleines Stück im zweiten Feld
      { f0: 0.2, f1: 0.3 },
    ])
    expect(tiefen[0]).toEqual([0, 0.37])
    expect(tiefen[1]).toEqual([0.12, 0.49])
    expect(tiefen[2]).toEqual([0.12, 0.49])
  })
})

describe('wareVon', () => {
  it('trennt die Ware vom Material eines Tabletts', () => {
    const ware = wareVon('a/b', [
      { material: 'kruste', punkte: new Float64Array([1, 2, 3]) },
      { material: 'lack-schwarz', punkte: new Float64Array([4, 5, 6]) },
      { material: 'mehl', punkte: new Float64Array([7, 8, 9]) },
    ])
    expect(ware.slot).toBe('a/b')
    expect(Array.from(ware.punkte)).toEqual([1, 2, 3, 7, 8, 9])
    expect(Array.from(ware.traeger ?? [])).toEqual([4, 5, 6])
  })
})
