/**
 * Drehteller der Nahansicht: Die Kamera kreist um ein Produkt, das auf dem
 * Boden steht. Reine Rechnung ohne three (drehteller.spec.ts);
 * drehtellerControls.ts übersetzt Zeiger und Tasten, createNahansicht.ts
 * setzt die Kamera.
 *
 * - `yaw` (Bogenmaß): Richtung um die Hochachse, frei.
 * - `pitch` (Bogenmaß): Höhe der Kamera über der Waagerechten, begrenzt -
 *   man schaut nie von unten und nie genau senkrecht.
 * - `zoom`: Abstand als Vielfaches des Pass-Abstands (1 = das Produkt füllt
 *   das Bild wie beim Öffnen). Begrenzt: nie im Modell, nie winzig.
 */

export type Vec3 = [number, number, number]

/** Rahmen des Modells in Metern (Y nach oben, steht auf y = 0). */
export interface Rahmen {
  min: readonly number[]
  max: readonly number[]
}

export interface Drehteller {
  yaw: number
  pitch: number
  zoom: number
}

const GRAD = Math.PI / 180

/** Senkrechter Öffnungswinkel wie in der Vorschau des Daten-Repos. */
export const FOV_GRAD = 30
/** Startblick wie in der Vorschau: leicht von der Seite, schräg von oben. */
export const START_YAW = 25 * GRAD
export const START_PITCH = 32 * GRAD
/** Nie von unten (das Produkt steht auf dem Boden), nie genau von oben. */
export const PITCH_MIN = 6 * GRAD
export const PITCH_MAX = 80 * GRAD
/** Näher als auf 30 % des Startabstands geht es nicht (gut dreifache Größe). */
export const NAEHE_MIN = 0.3
/** Weiter weg geht es nicht: Das Produkt bleibt gut erkennbar. */
export const ZOOM_MAX = 1.5
/** Anteil des Bildes (Breite oder Höhe), den der Rahmen des Produkts beim Öffnen füllt (das Produkt selbst ist etwas kleiner als sein Rahmen). */
export const FUELLUNG = 0.85
/** So viel vom Bild darf es beim Drehen höchstens einnehmen - nie über den Rand. */
export const RAND_ANTEIL = 0.98
/** Bogenmaß je Pixel beim Ziehen (≈ 180° über 390 px). */
export const DREHEN_JE_PX = 0.008
/** Nahe Schnittebene der Kamera in Metern. */
export const NEAR = 0.005
/** Die eine langsame Runde beim Öffnen. */
export const RUNDE_MS = 6000

const klemme = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v))

/** Hält `yaw` in (−π, π], damit er nach vielen Runden nicht wächst. */
export function normYaw(yaw: number): number {
  if (!Number.isFinite(yaw)) return 0
  // Schon im Bereich: unverändert lassen (kein Rundungsrauschen).
  if (yaw > -Math.PI && yaw <= Math.PI) return yaw
  const zwei = 2 * Math.PI
  const r = ((yaw % zwei) + zwei) % zwei
  return r > Math.PI ? r - zwei : r
}

/** Zieht einen Zustand in die Grenzen. `zoomMin` kommt aus `naechsterZoom`. */
export function begrenze(s: Drehteller, zoomMin: number): Drehteller {
  const unten = klemme(Number.isFinite(zoomMin) ? zoomMin : 1, 0.01, 1)
  return {
    yaw: normYaw(s.yaw),
    pitch: klemme(
      Number.isFinite(s.pitch) ? s.pitch : START_PITCH,
      PITCH_MIN,
      PITCH_MAX
    ),
    zoom: klemme(Number.isFinite(s.zoom) ? s.zoom : 1, unten, ZOOM_MAX),
  }
}

export function startZustand(): Drehteller {
  return { yaw: START_YAW, pitch: START_PITCH, zoom: 1 }
}

/**
 * Ziehen um (dx, dy) Pixel: nach rechts dreht das Produkt mit dem Finger
 * nach rechts, nach unten kippt der Blick weiter von oben darauf.
 */
export function drehe(
  s: Drehteller,
  dxPx: number,
  dyPx: number,
  zoomMin: number
): Drehteller {
  return begrenze(
    {
      yaw: s.yaw - dxPx * DREHEN_JE_PX,
      pitch: s.pitch + dyPx * DREHEN_JE_PX,
      zoom: s.zoom,
    },
    zoomMin
  )
}

/** Zoom um einen Faktor (< 1 = näher). */
export function zoome(
  s: Drehteller,
  faktor: number,
  zoomMin: number
): Drehteller {
  if (!Number.isFinite(faktor) || faktor <= 0) return begrenze(s, zoomMin)
  return begrenze({ ...s, zoom: s.zoom * faktor }, zoomMin)
}

/** Die acht Ecken eines Rahmens. */
function ecken(rahmen: Rahmen): Vec3[] {
  const out: Vec3[] = []
  for (const x of [rahmen.min[0], rahmen.max[0]]) {
    for (const y of [rahmen.min[1], rahmen.max[1]]) {
      for (const z of [rahmen.min[2], rahmen.max[2]]) out.push([x, y, z])
    }
  }
  return out
}

/** Der Punkt, um den die Kamera kreist: Mitte der Grundfläche, knapp unter halber Höhe. */
export function zielpunkt(rahmen: Rahmen): Vec3 {
  return [
    (rahmen.min[0] + rahmen.max[0]) / 2,
    rahmen.min[1] + (rahmen.max[1] - rahmen.min[1]) * 0.45,
    (rahmen.min[2] + rahmen.max[2]) / 2,
  ]
}

/** Einheitsvektor vom Ziel zur Kamera. */
export function richtung(yaw: number, pitch: number): Vec3 {
  return [
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch),
  ]
}

/** Größter Abstand einer Ecke vom Zielpunkt: Radius der Hüllkugel. */
export function huellRadius(rahmen: Rahmen): number {
  const z = zielpunkt(rahmen)
  let r = 0
  for (const e of ecken(rahmen)) {
    r = Math.max(r, Math.hypot(e[0] - z[0], e[1] - z[1], e[2] - z[2]))
  }
  return r
}

/** Blickrichtung, Rechts- und Hoch-Achse der Kamera für einen Blick. */
function achsen(yaw: number, pitch: number) {
  return {
    zurKamera: richtung(yaw, pitch),
    rechts: [Math.cos(yaw), 0, -Math.sin(yaw)] as Vec3,
    oben: [
      -Math.sin(yaw) * Math.sin(pitch),
      Math.cos(pitch),
      -Math.cos(yaw) * Math.sin(pitch),
    ] as Vec3,
  }
}

const skalar = (a: readonly number[], b: readonly number[]) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

const tangens = (aspect: number, fovGrad: number) => {
  const tanV = Math.tan((fovGrad * GRAD) / 2)
  return { tanV, tanH: tanV * aspect }
}

/**
 * Lage einer Ecke im Bild für eine Kamera im Abstand `abstand`: x und y als
 * Anteil der halben Bildbreite/-höhe (|1| = Bildrand), `tiefe` vor der Kamera.
 */
export function imBild(
  ecke: readonly number[],
  ziel: Vec3,
  yaw: number,
  pitch: number,
  abstand: number,
  aspect: number,
  fovGrad: number = FOV_GRAD
): { x: number; y: number; tiefe: number } {
  const { tanV, tanH } = tangens(aspect, fovGrad)
  const a = achsen(yaw, pitch)
  const q = [ecke[0] - ziel[0], ecke[1] - ziel[1], ecke[2] - ziel[2]]
  const tiefe = abstand - skalar(q, a.zurKamera)
  return {
    x: skalar(q, a.rechts) / (tiefe * tanH),
    y: skalar(q, a.oben) / (tiefe * tanV),
    tiefe,
  }
}

/** Der kleinste Abstand, bei dem der Rahmen aus Richtung `yaw` das Bild zu höchstens `anteil` füllt. */
function abstandFuer(
  rahmen: Rahmen,
  aspect: number,
  yaw: number,
  pitch: number,
  anteil: number,
  fovGrad: number
): number {
  const { tanV, tanH } = tangens(aspect, fovGrad)
  const a = achsen(yaw, pitch)
  const ziel = zielpunkt(rahmen)
  let abstand = 0
  for (const e of ecken(rahmen)) {
    const q = [e[0] - ziel[0], e[1] - ziel[1], e[2] - ziel[2]]
    const vorn = skalar(q, a.zurKamera)
    abstand = Math.max(
      abstand,
      Math.abs(skalar(q, a.rechts)) / (anteil * tanH) + vorn,
      Math.abs(skalar(q, a.oben)) / (anteil * tanV) + vorn
    )
  }
  return abstand
}

/**
 * Der Abstand zum Öffnen (Zoom 1): Beim Startblick füllt das Produkt das Bild
 * zu `fuellung`, und aus jeder Richtung um die Hochachse bleibt es ganz im
 * Bild (`RAND_ANTEIL`) - beim Drehen ragt nichts über den Rand.
 */
export function passAbstand(
  rahmen: Rahmen,
  aspect: number,
  pitch: number = START_PITCH,
  fuellung: number = FUELLUNG,
  fovGrad: number = FOV_GRAD
): number {
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 1
  let abstand = abstandFuer(rahmen, a, START_YAW, pitch, fuellung, fovGrad)
  for (let i = 0; i < 24; i += 1) {
    abstand = Math.max(
      abstand,
      abstandFuer(rahmen, a, i * 15 * GRAD, pitch, RAND_ANTEIL, fovGrad)
    )
  }
  return abstand
}

/**
 * Der kleinste erlaubte Zoom: Die Kamera bleibt außerhalb der Hüllkugel des
 * Produkts, mit Luft für die nahe Schnittebene - man taucht nie ins Modell.
 * Und nie näher als `NAEHE_MIN` des Startabstands: Darüber hinaus zeigt das
 * Bild nur noch unscharfe Textur.
 */
export function naechsterZoom(
  rahmen: Rahmen,
  abstand: number,
  near: number = NEAR
): number {
  const r = huellRadius(rahmen)
  const nah = r + Math.max(0.15 * r, 3 * near)
  if (!(abstand > 0)) return 1
  return klemme(Math.max(nah / abstand, NAEHE_MIN), 0.01, 1)
}

/** Standort der Kamera für einen Zustand. */
export function kameraOrt(s: Drehteller, ziel: Vec3, abstand: number): Vec3 {
  const d = richtung(s.yaw, s.pitch)
  const a = abstand * s.zoom
  return [ziel[0] + d[0] * a, ziel[1] + d[1] * a, ziel[2] + d[2] * a]
}

/**
 * Die eine langsame Runde beim Öffnen: Winkel (0 … 2π), um den der Blick
 * nach `ms` Millisekunden weitergedreht ist - sanft an, sanft aus, dann Ruhe.
 */
export function anfangsRunde(ms: number, dauer: number = RUNDE_MS): number {
  if (!(dauer > 0) || !(ms > 0)) return 0
  const t = Math.min(1, ms / dauer)
  return 2 * Math.PI * t * t * (3 - 2 * t)
}
