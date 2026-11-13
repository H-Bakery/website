import type { Belegung, Platz } from '../produkte/types'
import { ausgerichtet, planeRaum, zaehlePlan, type ImModell } from './plan'

// Erfundene Plätze und Produkte.
const platz = (x: number, mehr: Partial<Platz> = {}): Platz => ({
  o: [x, 1, 0],
  r: [1, 0, 0],
  n: [0, 1, 0],
  f: [0, 0, 1],
  b: 0.45,
  t: 0.3,
  h: 0.2,
  art: 'reihen',
  neigung: 0,
  ...mehr,
})
const BROT = {
  bbox_m: { min: [-0.1, 0, -0.05], max: [0.1, 0.075, 0.05] },
  dreiecke: 14,
}
const REGAL = { testbrot: BROT }
const VORN = [{ eye: [0, 1.5, 3] as const, moebel: ['regal/'] }]

const PLAETZE = {
  'regal/platz-01': platz(0),
  'regal/platz-02': platz(1),
  'regal/platz-03': platz(2),
  'regal/platz-04': platz(3),
}
const IM_MODELL: Record<string, ImModell> = {
  'regal/platz-01': { produkt: 'testbrot', anzahl: 2 },
  'regal/platz-02': { produkt: 'testkuchen', anzahl: 1 },
  'regal/platz-03': { ware: 'dose' },
  'regal/platz-04': { produkt: 'testweck', anzahl: 5 },
}
const belegung = (slots: Belegung['slots'], leer: string[] = []): Belegung => ({
  version: 1,
  quelle: { commit: 'x' },
  slots,
  leer,
  plaetze: PLAETZE,
})
const WIE_IM_MODELL = belegung([
  { slot: 'regal/platz-01', produkt: 'testbrot', anzahl: 2 },
  { slot: 'regal/platz-02', produkt: 'testkuchen', anzahl: 1 },
  { slot: 'regal/platz-04', produkt: 'testweck', anzahl: 5 },
])

describe('planeRaum', () => {
  it('ohne Regal-Modelle und ohne Einrichtung bleibt alles, wie es im Modell ist', () => {
    const plan = planeRaum({
      belegung: WIE_IM_MODELL,
      imModell: IM_MODELL,
      blickpunkte: VORN,
    })
    expect(Object.values(plan).every((p) => p.art === 'gebacken')).toBe(true)
    expect(Object.keys(plan)).toHaveLength(4)
    // auch mit einem leeren Paket
    expect(
      zaehlePlan(
        planeRaum({
          belegung: WIE_IM_MODELL,
          regal: {},
          imModell: IM_MODELL,
          blickpunkte: VORN,
        })
      )
    ).toEqual({ gelegt: 0, stuecke: 0, leer: 0, ohneModell: 0, gebacken: 4 })
  })

  it('gibt es Regal-Modelle, liegen sie auf allen Plätzen ihres Produkts - auch den unveränderten', () => {
    const plan = planeRaum({
      belegung: WIE_IM_MODELL,
      regal: REGAL,
      imModell: IM_MODELL,
      blickpunkte: VORN,
    })
    expect(plan['regal/platz-01']).toMatchObject({
      art: 'gelegt',
      produkt: 'testbrot',
      anzahl: 2,
      befund: 'passt',
      traeger: false,
    })
    expect(
      plan['regal/platz-01'].art === 'gelegt' && plan['regal/platz-01'].matrizen
    ).toHaveLength(2)
    // Produkte ohne Regal-Modell, die im Modell dort liegen: Die Ware bleibt.
    expect(plan['regal/platz-02']).toEqual({ art: 'gebacken' })
    expect(plan['regal/platz-04']).toEqual({ art: 'gebacken' })
    // neutrale Ware bleibt
    expect(plan['regal/platz-03']).toEqual({ art: 'gebacken' })
  })

  it('ein anderes Produkt mit Regal-Modell wird gelegt - auch auf einen Platz mit neutraler Ware', () => {
    const plan = planeRaum({
      belegung: belegung([
        {
          slot: 'regal/platz-02',
          produkt: 'testbrot',
          anzahl: 1,
          quelle: 'einrichtung',
        },
        {
          slot: 'regal/platz-03',
          produkt: 'testbrot',
          anzahl: 2,
          quelle: 'einrichtung',
        },
      ]),
      regal: REGAL,
      imModell: IM_MODELL,
      blickpunkte: VORN,
    })
    expect(plan['regal/platz-02']).toMatchObject({
      art: 'gelegt',
      produkt: 'testbrot',
    })
    expect(plan['regal/platz-03']).toMatchObject({ art: 'gelegt', anzahl: 2 })
  })

  it('ein anderes Produkt ohne Regal-Modell: im Bild leer - nie die Form eines anderen Produkts', () => {
    const plan = planeRaum({
      belegung: belegung([
        {
          slot: 'regal/platz-01',
          produkt: 'testkuchen',
          anzahl: 1,
          quelle: 'einrichtung',
        },
      ]),
      regal: REGAL,
      imModell: IM_MODELL,
      blickpunkte: VORN,
    })
    expect(plan['regal/platz-01']).toEqual({
      art: 'ohne-modell',
      produkt: 'testkuchen',
      traeger: false,
    })
    // … auch ganz ohne Regal-Modelle (so sähe es der öffentliche Deploy)
    const ohne = planeRaum({
      belegung: belegung([
        {
          slot: 'regal/platz-01',
          produkt: 'testkuchen',
          anzahl: 1,
          quelle: 'einrichtung',
        },
      ]),
      imModell: IM_MODELL,
      blickpunkte: VORN,
    })
    expect(ohne['regal/platz-01'].art).toBe('ohne-modell')
  })

  it('ohne Regal-Modelle: dasselbe Produkt wie im Modell bleibt gebacken, auch mit anderer Stückzahl', () => {
    const plan = planeRaum({
      belegung: belegung([
        {
          slot: 'regal/platz-01',
          produkt: 'testbrot',
          anzahl: 4,
          quelle: 'einrichtung',
        },
      ]),
      imModell: IM_MODELL,
      blickpunkte: VORN,
    })
    expect(plan['regal/platz-01']).toEqual({ art: 'gebacken' })
  })

  it('ein leerer Platz zeigt nichts; ein Platz, der in der Belegung fehlt, bleibt', () => {
    const plan = planeRaum({
      belegung: belegung([], ['regal/platz-01', 'regal/platz-03']),
      regal: REGAL,
      imModell: IM_MODELL,
      blickpunkte: VORN,
    })
    expect(plan['regal/platz-01']).toEqual({ art: 'leer' })
    expect(plan['regal/platz-03']).toEqual({ art: 'leer' })
    expect(plan['regal/platz-02']).toEqual({ art: 'gebacken' })
  })

  it('passt nicht alles, liegen so viele wie passen - der Befund sagt es', () => {
    const plan = planeRaum({
      belegung: belegung([
        {
          slot: 'regal/platz-01',
          produkt: 'testbrot',
          anzahl: 30,
          quelle: 'einrichtung',
        },
      ]),
      regal: REGAL,
      imModell: IM_MODELL,
      blickpunkte: VORN,
    })
    const p = plan['regal/platz-01']
    expect(p).toMatchObject({ art: 'gelegt', anzahl: 30, befund: 'weniger' })
    expect(p.art === 'gelegt' && p.matrizen.length).toBe(4)
  })

  it('passt kein einziges Stück: wie ohne Regal-Modell', () => {
    const eng = { ...PLAETZE, 'regal/platz-01': platz(0, { b: 0.05, t: 0.05 }) }
    const plan = planeRaum({
      belegung: { ...WIE_IM_MODELL, plaetze: eng },
      regal: REGAL,
      imModell: IM_MODELL,
      blickpunkte: VORN,
    })
    // dasselbe Produkt wie im Modell: Die Ware des Modells bleibt.
    expect(plan['regal/platz-01']).toEqual({ art: 'gebacken' })
  })

  it('das Tablett des Modells bleibt liegen', () => {
    const plan = planeRaum({
      belegung: {
        ...WIE_IM_MODELL,
        plaetze: { ...PLAETZE, 'regal/platz-01': platz(0, { traeger: true }) },
      },
      regal: REGAL,
      imModell: IM_MODELL,
      blickpunkte: VORN,
    })
    expect(plan['regal/platz-01']).toMatchObject({
      art: 'gelegt',
      traeger: true,
    })
  })

  it('ohne Rahmen für den Platz wird nichts gelegt', () => {
    const plan = planeRaum({
      belegung: { ...WIE_IM_MODELL, plaetze: {} },
      regal: REGAL,
      imModell: IM_MODELL,
      blickpunkte: VORN,
    })
    expect(plan['regal/platz-01']).toEqual({ art: 'gebacken' })
  })

  it('zaehlePlan', () => {
    const plan = planeRaum({
      belegung: belegung(
        [
          { slot: 'regal/platz-01', produkt: 'testbrot', anzahl: 2 },
          {
            slot: 'regal/platz-02',
            produkt: 'testbrot',
            anzahl: 1,
            quelle: 'einrichtung',
          },
          {
            slot: 'regal/platz-04',
            produkt: 'testkuchen',
            anzahl: 1,
            quelle: 'einrichtung',
          },
        ],
        ['regal/platz-03']
      ),
      regal: REGAL,
      imModell: IM_MODELL,
      blickpunkte: VORN,
    })
    expect(zaehlePlan(plan)).toEqual({
      gelegt: 2,
      stuecke: 3,
      leer: 1,
      ohneModell: 1,
      gebacken: 0,
    })
  })
})

describe('ausgerichtet: vorn zeigt zum Besucher', () => {
  it('lässt einen Platz, der schon zum Blickpunkt zeigt', () => {
    const p = platz(0)
    expect(ausgerichtet(p, 'regal/platz-01', VORN)).toBe(p)
  })

  it('wendet einen Platz, dessen Vorderseite vom Blickpunkt weg zeigt', () => {
    const p = platz(0)
    const g = ausgerichtet(p, 'regal/platz-01', [
      { eye: [0, 1.5, -3], moebel: ['regal/'] },
    ])
    expect(g.f).toEqual([-0, -0, -1])
    expect(g.r).toEqual([-1, -0, -0])
    expect(g.n).toEqual([0, 1, 0])
  })

  it('zählt nur die waagerechte Richtung: Ein geneigter Boden unter dem Auge bleibt', () => {
    const p = platz(0, { f: [0, -0.42, 0.91], n: [0, 0.91, 0.42], neigung: 25 })
    // Der Standort liegt hoch über dem Platz und knapp davor.
    expect(
      ausgerichtet(p, 'regal/platz-01', [
        { eye: [0, 9, 0.5], moebel: ['regal/'] },
      ])
    ).toBe(p)
  })

  it('ohne Blickpunkt für das Möbel bleibt der Platz, wie der Sync ihn abgeleitet hat', () => {
    const p = platz(0)
    expect(
      ausgerichtet(p, 'theke/platz-01', [
        { eye: [0, 1.5, -3], moebel: ['regal/'] },
      ])
    ).toBe(p)
  })

  it('am Haken zeigt die Oberseite des Stücks (der Arm) zum Besucher', () => {
    const haken = platz(0, {
      art: 'haken',
      r: [1, 0, 0],
      n: [0, 0, -1],
      f: [0, -1, 0],
    })
    const g = ausgerichtet(haken, 'regal/platz-01', VORN)
    expect(g.n).toEqual([-0, -0, 1])
    expect(g.r).toEqual([-1, -0, -0])
    expect(g.f).toEqual([0, -1, 0])
    expect(ausgerichtet(g, 'regal/platz-01', VORN)).toBe(g)
  })
})
