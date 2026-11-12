import type { Blickpunkt } from '../../config/raeume'
import {
  START_BLICKPUNKT_ID,
  START_RAUM_ID,
  findeBlickpunkt,
  findeRaum,
  raeume,
} from '../../config/raeume'
import {
  MAX_HORIZONTAL_FOV,
  ansichtFuer,
  capHorizontalFov,
  cappedPixelRatio,
  horizontalFov,
  istHochformat,
} from './view'

const testpunkt: Blickpunkt = {
  id: 'testregal',
  name: 'Testregal',
  eye: [1, 2, 3],
  look: [0, 2, 0],
  yawDeg: 20,
  pitchDeg: 12,
  fovMin: 30,
  fovMax: 60,
  portrait: { eye: [2, 2, 4], look: [0, 1.5, 0], fov: 80 },
}

describe('istHochformat', () => {
  it('erkennt Handy hochkant, nicht quer und nicht quadratisch', () => {
    expect(istHochformat(390 / 844)).toBe(true)
    expect(istHochformat(844 / 390)).toBe(false)
    expect(istHochformat(1)).toBe(false)
  })

  it('hält unbrauchbare Werte für Querformat', () => {
    expect(istHochformat(0)).toBe(false)
    expect(istHochformat(Number.NaN)).toBe(false)
  })
})

describe('ansichtFuer', () => {
  it('Querformat: Standort des Blickpunkts, weitester Winkel', () => {
    expect(ansichtFuer(testpunkt, 1440 / 900)).toEqual({
      eye: [1, 2, 3],
      look: [0, 2, 0],
      fov: 60,
      hochformat: false,
    })
  })

  it('Hochformat: die eigenen Werte', () => {
    expect(ansichtFuer(testpunkt, 390 / 844)).toEqual({
      eye: [2, 2, 4],
      look: [0, 1.5, 0],
      fov: 80,
      hochformat: true,
    })
  })

  it('Hochformat ohne eigene Werte: wie quer', () => {
    const ohne: Blickpunkt = { ...testpunkt, portrait: undefined }
    expect(ansichtFuer(ohne, 0.5)).toMatchObject({
      eye: [1, 2, 3],
      fov: 60,
      hochformat: true,
    })
  })
})

describe('horizontalFov', () => {
  it('ist bei quadratischem Bild gleich dem senkrechten', () => {
    expect(horizontalFov(60, 1)).toBeCloseTo(60, 6)
  })

  it('wird im Hochformat schmaler, im Querformat breiter', () => {
    expect(horizontalFov(60, 0.5)).toBeLessThan(60)
    expect(horizontalFov(60, 2)).toBeGreaterThan(60)
    expect(horizontalFov(90, 0.5)).toBeCloseTo(53.13, 2)
  })
})

describe('capHorizontalFov', () => {
  it('lässt übliche Seitenverhältnisse unberührt', () => {
    expect(capHorizontalFov(62, 1440 / 900)).toBe(62)
    expect(capHorizontalFov(62, 0.46)).toBe(62)
  })

  it('verkleinert den Winkel bei sehr breitem Bild auf die Grenze', () => {
    const aspect = 844 / 390
    const fov = capHorizontalFov(62, aspect)
    expect(fov).toBeLessThan(62)
    expect(horizontalFov(fov, aspect)).toBeCloseTo(MAX_HORIZONTAL_FOV, 6)
  })

  it('gilt für die Ruhelage im Querformat', () => {
    const aspect = 844 / 390
    const ansicht = ansichtFuer(testpunkt, aspect)
    expect(horizontalFov(ansicht.fov, aspect)).toBeLessThanOrEqual(
      MAX_HORIZONTAL_FOV + 1e-6
    )
  })

  it('fällt bei unbrauchbarem Seitenverhältnis auf den Winkel zurück', () => {
    expect(capHorizontalFov(62, 0)).toBe(62)
    expect(capHorizontalFov(62, Number.NaN)).toBe(62)
  })
})

describe('cappedPixelRatio', () => {
  it('begrenzt auf 2', () => {
    expect(cappedPixelRatio(3)).toBe(2)
    expect(cappedPixelRatio(2.625)).toBe(2)
    expect(cappedPixelRatio(1.5)).toBe(1.5)
  })

  it('fällt bei unbrauchbaren Werten auf 1', () => {
    expect(cappedPixelRatio(undefined)).toBe(1)
    expect(cappedPixelRatio(0)).toBe(1)
    expect(cappedPixelRatio(Number.NaN)).toBe(1)
  })
})

describe('raeume (Konfiguration)', () => {
  it('hat den Start-Blickpunkt', () => {
    const raum = findeRaum(START_RAUM_ID)
    if (!raum) throw new Error('Start-Raum fehlt')
    expect(findeBlickpunkt(raum, START_BLICKPUNKT_ID)).toBeDefined()
  })

  it('hat eindeutige IDs und stimmige Grenzen', () => {
    expect(new Set(raeume.map((r) => r.id)).size).toBe(raeume.length)
    for (const raum of raeume) {
      expect(raum.modell).toMatch(/^[\w-]+\.glb$/)
      const ids = raum.blickpunkte.map((b) => b.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const b of raum.blickpunkte) {
        expect(b.fovMin).toBeGreaterThan(5)
        expect(b.fovMin).toBeLessThan(b.fovMax)
        expect(b.fovMax).toBeLessThan(120)
        expect(b.yawDeg).toBeGreaterThanOrEqual(0)
        expect(b.pitchDeg).toBeGreaterThanOrEqual(0)
        expect(b.eye).not.toEqual(b.look)
        if (b.portrait) {
          expect(b.portrait.fov).toBeGreaterThan(b.fovMin)
          expect(b.portrait.fov).toBeLessThan(120)
          expect(b.portrait.eye).not.toEqual(b.portrait.look)
        }
      }
    }
  })
})
