/**
 * Bleibt ein gewähltes Produkt zu sehen? Die Produktkarte verdeckt unten
 * (Hochformat) oder rechts (Querformat, Desktop) einen Teil des Bildes. Liegt
 * das Produkt darunter oder außerhalb des Bildes, dreht das Rig den Blick so
 * weit, dass es im freien Teil steht - in den Grenzen des Umschauens
 * (rig.ts, `schwenken`).
 *
 * Reine Rechnung ohne three und ohne DOM (bildausschnitt.spec.ts). Alle Maße
 * in CSS-Pixeln, relativ zur linken oberen Ecke des Canvas.
 */

export interface Rechteck {
  left: number
  top: number
  right: number
  bottom: number
}

/** Abstand, den ein gewähltes Produkt zum Rand des freien Bildes hält (px). */
export const FREI_RAND_PX = 48
/** Ab diesem Anteil der Bildbreite gilt die Karte als Sheet am unteren Rand. */
const UNTEN_AB = 0.9

/**
 * Der Teil des Bildes, den die Karte `verdeckt` frei lässt, um `rand`
 * eingerückt: über einem Sheet am unteren Rand, sonst neben der Karte.
 */
export function freierBereich(
  bild: { breite: number; hoehe: number },
  verdeckt: Rechteck | null,
  rand: number = FREI_RAND_PX
): Rechteck {
  const frei: Rechteck = {
    left: 0,
    top: 0,
    right: bild.breite,
    bottom: bild.hoehe,
  }
  if (verdeckt) {
    const links = Math.max(0, verdeckt.left)
    const rechts = Math.min(bild.breite, verdeckt.right)
    const oben = Math.max(0, verdeckt.top)
    if (rechts - links >= UNTEN_AB * bild.breite) {
      frei.bottom = Math.min(frei.bottom, oben)
    } else if (links >= bild.breite - rechts) {
      frei.right = Math.min(frei.right, links)
    } else {
      frei.left = Math.max(frei.left, rechts)
    }
  }
  // Einrücken, aber nie über die Mitte hinaus (sehr kleine Bilder).
  const rx = Math.min(rand, Math.max(0, (frei.right - frei.left) / 2))
  const ry = Math.min(rand, Math.max(0, (frei.bottom - frei.top) / 2))
  return {
    left: frei.left + rx,
    top: frei.top + ry,
    right: frei.right - rx,
    bottom: frei.bottom - ry,
  }
}

/**
 * Um wie viel muss der Blick drehen, damit der Bildpunkt `punkt` in `frei`
 * liegt? Vorzeichen wie beim Ziehen (`RigKern.ziehen`): + = das Bild wandert
 * nach rechts bzw. unten. `null`: Der Punkt liegt schon im freien Bereich.
 * `fovGrad` = senkrechter Öffnungswinkel.
 */
export function schwenkFuer(
  punkt: { x: number; y: number },
  frei: Rechteck,
  bild: { breite: number; hoehe: number },
  fovGrad: number
): { dYaw: number; dPitch: number } | null {
  if (!(bild.breite > 0) || !(bild.hoehe > 0)) return null
  if (![punkt.x, punkt.y, fovGrad].every(Number.isFinite)) return null
  const zx = Math.min(Math.max(punkt.x, frei.left), frei.right)
  const zy = Math.min(Math.max(punkt.y, frei.top), frei.bottom)
  if (Math.abs(zx - punkt.x) < 0.5 && Math.abs(zy - punkt.y) < 0.5) return null
  // Brennweite in Pixeln; Winkel eines Bildpunkts gegen die Bildmitte.
  const f = bild.hoehe / 2 / Math.tan((fovGrad * Math.PI) / 360)
  const cx = bild.breite / 2
  const cy = bild.hoehe / 2
  return {
    dYaw: Math.atan((zx - cx) / f) - Math.atan((punkt.x - cx) / f),
    dPitch: Math.atan((zy - cy) / f) - Math.atan((punkt.y - cy) / f),
  }
}
