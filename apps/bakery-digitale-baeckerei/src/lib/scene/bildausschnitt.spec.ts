import { FREI_RAND_PX, freierBereich, schwenkFuer } from './bildausschnitt'

const GRAD = Math.PI / 180
const HOCH = { breite: 390, hoehe: 844 }
const QUER = { breite: 1440, hoehe: 900 }

describe('freierBereich', () => {
  it('ohne Karte: das ganze Bild, um den Rand eingerückt', () => {
    expect(freierBereich(HOCH, null)).toEqual({
      left: FREI_RAND_PX,
      top: FREI_RAND_PX,
      right: 390 - FREI_RAND_PX,
      bottom: 844 - FREI_RAND_PX,
    })
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
