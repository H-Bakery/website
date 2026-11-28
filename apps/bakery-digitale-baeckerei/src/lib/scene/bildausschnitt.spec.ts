import {
  FREI_RAND,
  IM_BILD_RAND_PX,
  freierBereich,
  schwenkFuer,
} from './bildausschnitt'

const GRAD = Math.PI / 180
const HOCH = { breite: 390, hoehe: 844 }
const QUER = { breite: 1440, hoehe: 900 }

/**
 * Wo der Bildpunkt nach dem Schwenk steht - mit derselben Näherung wie
 * `schwenkFuer` (Winkel gegen die Bildmitte, waagerecht und senkrecht getrennt).
 */
function nachSchwenk(
  punkt: { x: number; y: number },
  s: { dYaw: number; dPitch: number } | null,
  bild: { breite: number; hoehe: number },
  fovGrad: number
): { x: number; y: number } {
  if (!s) return punkt
  const f = bild.hoehe / 2 / Math.tan((fovGrad * Math.PI) / 360)
  const cx = bild.breite / 2
  const cy = bild.hoehe / 2
  return {
    x: cx + f * Math.tan(Math.atan((punkt.x - cx) / f) + s.dYaw),
    y: cy + f * Math.tan(Math.atan((punkt.y - cy) / f) + s.dPitch),
  }
}

describe('freierBereich', () => {
  it('ohne Karte: das ganze Bild, je Seite um den eigenen Rand eingerückt', () => {
    expect(freierBereich(HOCH, null)).toEqual({
      left: FREI_RAND.links,
      top: FREI_RAND.oben,
      right: 390 - FREI_RAND.rechts,
      bottom: 844 - FREI_RAND.unten,
    })
  })

  it('hält die Pfeile am Rand und die Titelkarte oben frei', () => {
    // Pfeile: 8-56 px vom Rand; Titelkarte: höchstens 76 px hoch.
    expect(FREI_RAND.links).toBeGreaterThanOrEqual(64)
    expect(FREI_RAND.rechts).toBeGreaterThanOrEqual(64)
    expect(FREI_RAND.oben).toBeGreaterThanOrEqual(80)
    expect(FREI_RAND.unten).toBe(48)
  })

  it('eine Zahl als Rand rückt alle Seiten gleich ein (wie bisher)', () => {
    expect(freierBereich(HOCH, null, IM_BILD_RAND_PX)).toEqual({
      left: 8,
      top: 8,
      right: 382,
      bottom: 836,
    })
    expect(
      freierBereich(HOCH, { left: 0, top: 600, right: 390, bottom: 844 }, 8)
    ).toEqual({ left: 8, top: 8, right: 382, bottom: 592 })
  })

  it('Sheet unten mit den Rändern je Seite: oben, links und rechts mehr Luft', () => {
    expect(
      freierBereich(HOCH, { left: 0, top: 600, right: 390, bottom: 844 })
    ).toEqual({ left: 64, top: 80, right: 326, bottom: 552 })
  })

  it('Karte rechts mit den Rändern je Seite: Abstand zur Karte wie zum Rand', () => {
    expect(
      freierBereich(QUER, { left: 1048, top: 12, right: 1428, bottom: 300 })
    ).toEqual({ left: 64, top: 80, right: 984, bottom: 852 })
  })

  it('sehr kleines Bild: auch ungleiche Ränder bleiben ein gültiges Rechteck', () => {
    const frei = freierBereich({ breite: 100, hoehe: 100 }, null)
    expect(frei.left).toBeLessThanOrEqual(frei.right)
    expect(frei.top).toBeLessThanOrEqual(frei.bottom)
    expect(frei).toEqual({ left: 50, top: 50, right: 50, bottom: 52 })
  })

  it('Sheet unten über die ganze Breite: frei ist der Teil darüber', () => {
    const frei = freierBereich(
      HOCH,
      { left: 0, top: 600, right: 390, bottom: 844 },
      40
    )
    expect(frei).toEqual({ left: 40, top: 40, right: 350, bottom: 560 })
  })

  it('Karte rechts: frei ist der Teil links davon, in voller Höhe', () => {
    const frei = freierBereich(
      QUER,
      { left: 1048, top: 12, right: 1428, bottom: 300 },
      40
    )
    expect(frei).toEqual({ left: 40, top: 40, right: 1008, bottom: 860 })
  })

  it('Karte links: frei ist der Teil rechts davon', () => {
    const frei = freierBereich(
      QUER,
      { left: 12, top: 12, right: 392, bottom: 300 },
      40
    )
    expect(frei.left).toBe(432)
    expect(frei.right).toBe(1400)
  })

  it('bleibt auch bei einem winzigen freien Rest ein gültiges Rechteck', () => {
    const frei = freierBereich(
      HOCH,
      { left: 0, top: 30, right: 390, bottom: 844 },
      40
    )
    expect(frei.top).toBe(15)
    expect(frei.bottom).toBe(15)
    expect(frei.left).toBeLessThanOrEqual(frei.right)
  })
})

describe('schwenkFuer mit den Rändern je Seite (390×844, ohne Karte)', () => {
  const frei = freierBereich(HOCH, null)
  const FOV = 64

  it('ein Produkt unter dem linken Pfeil (x = 50) rückt nach rechts daneben', () => {
    const punkt = { x: 50, y: 400 }
    const s = schwenkFuer(punkt, frei, HOCH, FOV)
    expect(s?.dYaw).toBeGreaterThan(0)
    expect(nachSchwenk(punkt, s, HOCH, FOV).x).toBeGreaterThanOrEqual(64 - 0.5)
  })

  it('ein Produkt unter dem rechten Pfeil (x = 345) rückt nach links daneben', () => {
    const punkt = { x: 345, y: 400 }
    const s = schwenkFuer(punkt, frei, HOCH, FOV)
    expect(s?.dYaw).toBeLessThan(0)
    expect(nachSchwenk(punkt, s, HOCH, FOV).x).toBeLessThanOrEqual(326 + 0.5)
  })

  it('ein Produkt unter der Titelkarte (y = 48) rückt darunter', () => {
    const punkt = { x: 195, y: 48 }
    const s = schwenkFuer(punkt, frei, HOCH, FOV)
    expect(s?.dPitch).toBeGreaterThan(0)
    expect(nachSchwenk(punkt, s, HOCH, FOV).y).toBeGreaterThanOrEqual(80 - 0.5)
  })

  it('mit Rand 8 (Prüfung „im Bild“) gilt dasselbe Produkt schon als frei', () => {
    const knapp = freierBereich(HOCH, null, IM_BILD_RAND_PX)
    expect(schwenkFuer({ x: 50, y: 400 }, knapp, HOCH, FOV)).toBeNull()
    expect(schwenkFuer({ x: 195, y: 48 }, knapp, HOCH, FOV)).toBeNull()
  })
})

describe('schwenkFuer', () => {
  const frei = freierBereich(
    HOCH,
    { left: 0, top: 600, right: 390, bottom: 844 },
    40
  )

  it('im freien Bereich: nichts zu tun', () => {
    expect(schwenkFuer({ x: 195, y: 300 }, frei, HOCH, 64)).toBeNull()
    expect(schwenkFuer({ x: 40, y: 560 }, frei, HOCH, 64)).toBeNull()
  })

  it('unter dem Sheet: das Bild wandert nach oben (dPitch < 0), seitlich nichts', () => {
    const s = schwenkFuer({ x: 195, y: 700 }, frei, HOCH, 64)
    expect(s).not.toBeNull()
    expect(s?.dYaw).toBeCloseTo(0, 9)
    expect(s?.dPitch).toBeLessThan(0)
    // 700 → 560 px bei 64° auf 844 px: zwischen 5° und 15°.
    expect(Math.abs(s?.dPitch ?? 0)).toBeGreaterThan(5 * GRAD)
    expect(Math.abs(s?.dPitch ?? 0)).toBeLessThan(15 * GRAD)
  })

  it('rechts unter der Karte: das Bild wandert nach links (dYaw < 0)', () => {
    const rechts = freierBereich(
      QUER,
      { left: 1048, top: 12, right: 1428, bottom: 300 },
      40
    )
    const s = schwenkFuer({ x: 1300, y: 450 }, rechts, QUER, 62)
    expect(s?.dYaw).toBeLessThan(0)
    expect(s?.dPitch).toBeCloseTo(0, 9)
  })

  it('der Winkel stimmt: Punkt aus der Mitte an den Rand des halben Bildes', () => {
    // Senkrecht 90°: der obere Bildrand liegt 45° über der Mitte.
    const bild = { breite: 200, hoehe: 200 }
    const s = schwenkFuer(
      { x: 100, y: 100 },
      { left: 0, top: 0, right: 200, bottom: 0 },
      bild,
      90
    )
    expect(s?.dPitch).toBeCloseTo(-45 * GRAD, 9)
  })

  it('außerhalb des Bildes (links): zurück an den Rand des freien Bereichs', () => {
    const s = schwenkFuer({ x: -200, y: 300 }, frei, HOCH, 64)
    expect(s?.dYaw).toBeGreaterThan(0)
  })

  it('unbrauchbare Werte: nichts tun', () => {
    expect(schwenkFuer({ x: Number.NaN, y: 0 }, frei, HOCH, 64)).toBeNull()
    expect(
      schwenkFuer({ x: 0, y: 0 }, frei, { breite: 0, hoehe: 0 }, 64)
    ).toBeNull()
  })
})
