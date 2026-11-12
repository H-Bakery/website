import {
  DREHEN_JE_PX,
  FUELLUNG,
  NAEHE_MIN,
  NEAR,
  PITCH_MAX,
  PITCH_MIN,
  RAND_ANTEIL,
  RUNDE_MS,
  START_PITCH,
  START_YAW,
  ZOOM_MAX,
  anfangsRunde,
  begrenze,
  drehe,
  huellRadius,
  imBild,
  kameraOrt,
  naechsterZoom,
  normYaw,
  passAbstand,
  startZustand,
  zielpunkt,
  zoome,
  type Rahmen,
} from './drehteller'

/** Erfundene Rahmen: ein Laib, ein flaches Gebäck, ein hohes Glas. */
const LAIB: Rahmen = { min: [-0.1, 0, -0.05], max: [0.1, 0.075, 0.05] }
const FLACH: Rahmen = { min: [-0.07, 0, -0.05], max: [0.07, 0.03, 0.05] }
const HOCH: Rahmen = { min: [-0.04, 0, -0.04], max: [0.04, 0.2, 0.04] }
const FORMATE = [390 / 756, 844 / 300, 960 / 632]

const ecken = (r: Rahmen) =>
  [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [
    i & 1 ? r.max[0] : r.min[0],
    i & 2 ? r.max[1] : r.min[1],
    i & 4 ? r.max[2] : r.min[2],
  ])

describe('Grenzen des Drehtellers', () => {
  it('startet schräg von oben bei Zoom 1', () => {
    expect(startZustand()).toEqual({
      yaw: START_YAW,
      pitch: START_PITCH,
      zoom: 1,
    })
  })

  it('dreht um die Hochachse frei und hält den Winkel klein', () => {
    let s = startZustand()
    for (let i = 0; i < 500; i += 1) s = drehe(s, 37, 0, 0.3)
    expect(s.yaw).toBeGreaterThan(-Math.PI)
    expect(s.yaw).toBeLessThanOrEqual(Math.PI)
    expect(normYaw(3 * Math.PI)).toBeCloseTo(Math.PI)
    expect(normYaw(-Math.PI / 2)).toBeCloseTo(-Math.PI / 2)
    expect(normYaw(Number.NaN)).toBe(0)
  })

  it('nach rechts ziehen dreht das Produkt mit dem Finger', () => {
    const s = drehe(startZustand(), 10, 0, 0.3)
    expect(s.yaw).toBeCloseTo(START_YAW - 10 * DREHEN_JE_PX)
    expect(s.pitch).toBe(START_PITCH)
  })

  it('schaut nie von unten und nie genau von oben', () => {
    const hoch = drehe(startZustand(), 0, 10_000, 0.3)
    const tief = drehe(startZustand(), 0, -10_000, 0.3)
    expect(hoch.pitch).toBe(PITCH_MAX)
    expect(tief.pitch).toBe(PITCH_MIN)
    expect(PITCH_MIN).toBeGreaterThan(0)
    expect(PITCH_MAX).toBeLessThan(Math.PI / 2)
    // Die Kamera bleibt über dem Boden, auf dem das Produkt steht.
    const ziel = zielpunkt(LAIB)
    expect(kameraOrt(tief, ziel, 1)[1]).toBeGreaterThan(ziel[1])
    expect(ziel[1]).toBeGreaterThan(LAIB.min[1])
  })

  it('zoomt nur zwischen der Nähe-Grenze und „nicht winzig“', () => {
    const nah = zoome(startZustand(), 0.001, 0.3)
    const fern = zoome(startZustand(), 1000, 0.3)
    expect(nah.zoom).toBe(0.3)
    expect(fern.zoom).toBe(ZOOM_MAX)
    expect(zoome(startZustand(), 0.5, 0.3).zoom).toBeCloseTo(0.5)
    // Unsinnige Faktoren ändern nichts.
    for (const f of [0, -2, Number.NaN, Infinity]) {
      expect(zoome(startZustand(), f, 0.3).zoom).toBe(1)
    }
  })

  it('zieht jeden Zustand in die Grenzen - auch kaputte Werte', () => {
    expect(
      begrenze({ yaw: 9, pitch: Number.NaN, zoom: Number.NaN }, Number.NaN)
    ).toEqual({ yaw: normYaw(9), pitch: START_PITCH, zoom: 1 })
    // Eine Nähe-Grenze über 1 gilt als 1: Der Startblick ist immer erlaubt.
    expect(begrenze(startZustand(), 5).zoom).toBe(1)
  })
})

describe('Bildausschnitt', () => {
  it.each([
    ['Laib', LAIB],
    ['flaches Gebäck', FLACH],
    ['hohes Glas', HOCH],
  ])(
    '%s: füllt beim Öffnen das Bild zu höchstens %s und ragt beim Drehen nie über den Rand',
    (_, rahmen) => {
      for (const aspect of FORMATE) {
        const abstand = passAbstand(rahmen, aspect)
        const ziel = zielpunkt(rahmen)
        // Startblick: nichts über FUELLUNG, und etwas reicht bis dorthin.
        let groesste = 0
        for (const e of ecken(rahmen)) {
          const p = imBild(e, ziel, START_YAW, START_PITCH, abstand, aspect)
          expect(p.tiefe).toBeGreaterThan(0)
          groesste = Math.max(groesste, Math.abs(p.x), Math.abs(p.y))
        }
        expect(groesste).toBeLessThanOrEqual(FUELLUNG + 1e-9)
        // Rundherum: alles im Bild.
        let rand = 0
        for (let grad = 0; grad < 360; grad += 15) {
          for (const e of ecken(rahmen)) {
            const p = imBild(
              e,
              ziel,
              (grad * Math.PI) / 180,
              START_PITCH,
              abstand,
              aspect
            )
            rand = Math.max(rand, Math.abs(p.x), Math.abs(p.y))
          }
        }
        expect(rand).toBeLessThanOrEqual(RAND_ANTEIL + 1e-9)
        // Nicht verschenkt: eine der beiden Grenzen ist erreicht.
        expect(
          Math.max(groesste / FUELLUNG, rand / RAND_ANTEIL)
        ).toBeGreaterThan(0.999)
      }
    }
  )

  it('rechnet ohne brauchbares Seitenverhältnis wie für ein Quadrat', () => {
    expect(passAbstand(LAIB, Number.NaN)).toBe(passAbstand(LAIB, 1))
    expect(passAbstand(LAIB, 0)).toBe(passAbstand(LAIB, 1))
  })

  it.each([
    ['Laib', LAIB],
    ['flaches Gebäck', FLACH],
    ['hohes Glas', HOCH],
  ])('%s: Die Kamera taucht auch ganz nah nie ins Modell', (_, rahmen) => {
    const r = huellRadius(rahmen)
    for (const aspect of FORMATE) {
      const abstand = passAbstand(rahmen, aspect)
      const zoomMin = naechsterZoom(rahmen, abstand)
      expect(zoomMin).toBeGreaterThanOrEqual(NAEHE_MIN)
      expect(zoomMin).toBeLessThanOrEqual(1)
      const ziel = zielpunkt(rahmen)
      for (const pitch of [PITCH_MIN, START_PITCH, PITCH_MAX]) {
        for (let grad = 0; grad < 360; grad += 45) {
          const s = begrenze(
            { yaw: (grad * Math.PI) / 180, pitch, zoom: 0 },
            zoomMin
          )
          const ort = kameraOrt(s, ziel, abstand)
          const weg = Math.hypot(
            ort[0] - ziel[0],
            ort[1] - ziel[1],
            ort[2] - ziel[2]
          )
          // Außerhalb der Hüllkugel, mit Luft für die nahe Schnittebene.
          expect(weg - r).toBeGreaterThan(NEAR)
          for (const e of ecken(rahmen)) {
            expect(
              imBild(e, ziel, s.yaw, s.pitch, weg, aspect).tiefe
            ).toBeGreaterThan(NEAR)
          }
        }
      }
    }
  })

  it('lang und dünn im schmalen Bild: die Hüllkugel allein ließe zu nah heran', () => {
    const STANGE: Rahmen = { min: [-0.3, 0, -0.005], max: [0.3, 0.01, 0.005] }
    const abstand = passAbstand(STANGE, 0.3)
    expect((huellRadius(STANGE) * 1.15) / abstand).toBeLessThan(NAEHE_MIN)
    expect(naechsterZoom(STANGE, abstand)).toBe(NAEHE_MIN)
  })

  it('hält bei unbrauchbarem Abstand den Startblick fest', () => {
    expect(naechsterZoom(LAIB, 0)).toBe(1)
    expect(naechsterZoom(LAIB, Number.NaN)).toBe(1)
  })
})

describe('Runde beim Öffnen', () => {
  it('dreht genau einmal herum und bleibt dann stehen', () => {
    expect(anfangsRunde(0)).toBe(0)
    expect(anfangsRunde(-5)).toBe(0)
    expect(anfangsRunde(RUNDE_MS / 2)).toBeCloseTo(Math.PI)
    expect(anfangsRunde(RUNDE_MS)).toBeCloseTo(2 * Math.PI)
    expect(anfangsRunde(RUNDE_MS * 10)).toBeCloseTo(2 * Math.PI)
    // Nach der Runde steht der Blick wieder dort, wo er begann.
    expect(normYaw(START_YAW + anfangsRunde(RUNDE_MS))).toBeCloseTo(START_YAW)
  })

  it('läuft sanft an und aus, immer vorwärts', () => {
    let vorher = 0
    for (let ms = 100; ms <= RUNDE_MS; ms += 100) {
      const jetzt = anfangsRunde(ms)
      expect(jetzt).toBeGreaterThan(vorher)
      vorher = jetzt
    }
    const anfang = anfangsRunde(100)
    const mitte = anfangsRunde(RUNDE_MS / 2 + 100) - anfangsRunde(RUNDE_MS / 2)
    expect(anfang).toBeLessThan(mitte / 5)
  })
})
