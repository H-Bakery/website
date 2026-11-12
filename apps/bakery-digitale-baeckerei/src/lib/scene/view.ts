/**
 * Welche Kamerawerte gelten für einen Blickpunkt bei einem Seitenverhältnis?
 * Reine Rechnung ohne three (view.spec.ts). Das Kamera-Rig (Umschauen, Zoom)
 * kommt in P1 und baut auf denselben Werten auf.
 */
import type { Blickpunkt, Vec3 } from '../../config/raeume'

export interface Ansicht {
  eye: Vec3
  look: Vec3
  /** Senkrechter Öffnungswinkel in Grad. */
  fov: number
  hochformat: boolean
}

/** Hochformat: das Bild ist höher als breit. */
export function istHochformat(aspect: number): boolean {
  return Number.isFinite(aspect) && aspect > 0 && aspect < 1
}

/**
 * Ruhelage eines Blickpunkts: im Hochformat die eigenen Werte (falls
 * vorhanden), sonst Standort und Blick des Blickpunkts mit dem weitesten
 * Öffnungswinkel.
 */
export function ansichtFuer(blickpunkt: Blickpunkt, aspect: number): Ansicht {
  const hochformat = istHochformat(aspect)
  if (hochformat && blickpunkt.portrait) {
    const { eye, look, fov } = blickpunkt.portrait
    return { eye, look, fov, hochformat }
  }
  return {
    eye: blickpunkt.eye,
    look: blickpunkt.look,
    fov: capHorizontalFov(blickpunkt.fovMax, aspect),
    hochformat,
  }
}

/**
 * Sehr breite Bilder (Handy quer, ≈ 2,2 : 1) sähen mit dem vollen senkrechten
 * Winkel seitlich über 100° weit - dann ragt die Wand neben dem Standort ins
 * Bild und die Ränder verzerren. Darum ist der waagerechte Winkel begrenzt.
 */
export const MAX_HORIZONTAL_FOV = 96

/** Senkrechter Winkel, verkleinert, bis der waagerechte höchstens `max` ist. */
export function capHorizontalFov(
  fovDeg: number,
  aspect: number,
  max: number = MAX_HORIZONTAL_FOV
): number {
  if (!Number.isFinite(aspect) || aspect <= 0) return fovDeg
  if (horizontalFov(fovDeg, aspect) <= max) return fovDeg
  const half = Math.tan((max * Math.PI) / 360) / aspect
  return (Math.atan(half) * 360) / Math.PI
}

/** Waagerechter Öffnungswinkel (Grad) zu einem senkrechten und dem Seitenverhältnis. */
export function horizontalFov(fovDeg: number, aspect: number): number {
  const half = Math.tan((fovDeg * Math.PI) / 360) * aspect
  return (Math.atan(half) * 360) / Math.PI
}

/** Pixeldichte fürs Rendern: nie über `max` (Leistung auf dem Handy). */
export function cappedPixelRatio(devicePixelRatio: unknown, max = 2): number {
  const dpr =
    typeof devicePixelRatio === 'number' && Number.isFinite(devicePixelRatio)
      ? devicePixelRatio
      : 1
  return Math.min(Math.max(dpr, 1), max)
}
