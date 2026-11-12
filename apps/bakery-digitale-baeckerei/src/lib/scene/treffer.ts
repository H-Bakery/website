/**
 * Antippen im 3D-Laden: die reine Logik ohne three - was ein Knoten ist
 * (Platz, Möbel, Produkt oder neutrale Ware), welche Materialien einen Tipp
 * durchlassen, die Tippfläche kleiner Produkte (≈ 44 px) und der Verlauf des
 * Aufleuchtens. Getestet in treffer.spec.ts.
 *
 * Herkunft: Die Tippflächen (`pickAngle`, `proxyHalf`, `rayBoxEnter`,
 * `chooseProxy`, `isSmallBox`, `isEnclosing`) stammen aus dem Saar LiDAR
 * Explorer (github.com/Open-Kirrberg/saar-lidar-explorer, MIT, gleicher
 * Urheber), `app/src/zones/pickProxy.ts` und `app/src/zones/catalogue.ts`.
 */
import type { Vec3 } from '../../config/raeume'
import { parseProduktName } from './fills'

/** Ergebnis eines Tipps. `produkt` gesetzt → Produktkarte; sonst Ware oder Möbel. */
export interface Treffer {
  /** Platz bzw. Kennung des Knotens, ohne `produkt/`. */
  slot: string
  /** hq-Kennung des Produkts (`extras.product`). */
  produkt?: string
  /** Neutrale Ware ohne Produktkarte (`extras.ware`), z. B. ein Glas. */
  ware?: string
  /** Erster Abschnitt des Platzes: `brotregal`, `theke`, `dosenregal` … */
  moebel: string
  /** Getroffener Punkt im Zonen-Rahmen (bei einer Tippfläche: Mitte des Produkts). */
  punkt: Vec3
}

// ---- Knoten ---------------------------------------------------------------

/**
 * Platz eines Knotens: `userData.id`, sonst `userData.name` ohne `produkt/`
 * (und ohne `@<fill>`). Knoten ohne beides sind keine Ziele.
 */
export function slotVon(userData: Record<string, unknown>): string | null {
  const { id, name } = userData
  if (typeof id === 'string' && id) return id
  return parseProduktName(name)?.slot ?? null
}

/** Möbel eines Platzes = sein erster Abschnitt (`theke/vitrine/…` → `theke`). */
export function moebelVon(slot: string): string {
  const cut = slot.indexOf('/')
  return cut < 0 ? slot : slot.slice(0, cut)
}

/** Produkt oder neutrale Ware eines Knotens; beides leer = Möbel. */
export function artVon(userData: Record<string, unknown>): {
  produkt?: string
  ware?: string
} {
  const { product, ware } = userData
  if (typeof product === 'string' && product) return { produkt: product }
  if (typeof ware === 'string' && ware) return { ware }
  return {}
}

// ---- Materialien ------------------------------------------------------------

/** Materialnamen der Preisschilder im Modell (DB8: keine Preise im Bild). */
export const PREIS_MATERIALIEN: readonly string[] = [
  'preiskarte',
  'preisschrift',
]

export function istPreisMaterial(name: unknown): boolean {
  return typeof name === 'string' && PREIS_MATERIALIEN.includes(name)
}

/** Materialien, die im Modell durchsichtig sind (BLEND), mit Namen. */
const DURCHSICHTIGE: readonly string[] = ['glas', 'glow']

export interface MaterialArt {
  name?: string
  transparent?: boolean
  opacity?: number
  visible?: boolean
}

/**
 * Hält dieses Material einen Tipp auf? Glas, Leuchten und alles
 * Durchsichtige oder Ausgeblendete nicht - sonst schluckte das Vitrinenglas
 * jeden Tipp auf die Ware dahinter.
 */
export function haeltTippAuf(material: MaterialArt): boolean {
  if (material.visible === false) return false
  if (material.transparent) return false
  if (material.opacity !== undefined && material.opacity < 0.99) return false
  return !DURCHSICHTIGE.includes(material.name ?? '')
}

// ---- Tippflächen kleiner Produkte (aus pickProxy.ts) --------------------------

type V3 = readonly [number, number, number]

/** Radius in CSS-px: die Hälfte einer 44-px-Fingerfläche. */
export const TIPP_RADIUS_PX = 22
/** Produkte bis zu dieser Kantenlänge (m) bekommen eine Tippfläche. */
export const KLEIN_M = 0.45
/** Größer wird eine Tippfläche nie (halbe Kante, m): Nachbarn bleiben getrennt. */
export const TIPPFLAECHE_MAX_HALB_M = 0.16
/** So weit darf ein Produkt hinter dem getroffenen Möbelteil liegen (m). */
export const TIEFEN_SPIEL_M = 0.3
/** Weiter entfernte Treffer zählen nicht (m). */
export const TIPP_WEITE_M = 30

export const istKlein = (size: V3): boolean =>
  Math.max(size[0], size[1], size[2]) <= KLEIN_M

/**
 * Umschließende Ziele (Raum, Fassade, Gelände) verdecken nur: Sie werden nie
 * hervorgehoben, und hinter ihnen gibt es kein Tiefen-Spiel - eine dünne Wand
 * lässt keinen Tipp durch.
 */
export const istUmschliessend = (sx: number, sy: number, sz: number): boolean =>
  (sx > 3 && sz > 3 && sy > 1.5) || Math.max(sx, sz) > 12

/** Winkel (rad), den `px` CSS-px nahe der Bildmitte überspannen. */
export function tippWinkel(
  px: number,
  hoehePx: number,
  fovGrad: number
): number {
  if (!(px > 0) || !(hoehePx > 0)) return 0
  return Math.atan(((2 * px) / hoehePx) * Math.tan((fovGrad * Math.PI) / 360))
}

/** Halbe Kanten der Tippfläche: je Achse mindestens `dist · tan(winkel)`, gedeckelt. */
export function tippflaecheHalb(
  half: V3,
  dist: number,
  winkel: number,
  cap = TIPPFLAECHE_MAX_HALB_M
): [number, number, number] {
  const r = Math.min(cap, Math.max(0, dist) * Math.tan(Math.max(0, winkel)))
  return [Math.max(half[0], r), Math.max(half[1], r), Math.max(half[2], r)]
}

/** Eintritt des Strahls `o + t·d` (t ≥ 0) in den Quader, oder null. */
export function strahlTrifftQuader(
  o: V3,
  d: V3,
  min: V3,
  max: V3
): number | null {
  let t0 = 0
  let t1 = Infinity
  for (let k = 0; k < 3; k += 1) {
    if (Math.abs(d[k]) < 1e-12) {
      if (o[k] < min[k] || o[k] > max[k]) return null
      continue
    }
    let a = (min[k] - o[k]) / d[k]
    let b = (max[k] - o[k]) / d[k]
    if (a > b) [a, b] = [b, a]
    t0 = Math.max(t0, a)
    t1 = Math.min(t1, b)
    if (t0 > t1) return null
  }
  return t0
}

export interface Tippflaeche {
  /** Mitte und halbe Kanten des Produkts (Zonen-Rahmen, m). */
  c: V3
  h: V3
}

/**
 * Die Tippfläche, die der Strahl (Ursprung `o`, Einheitsrichtung `d`) trifft,
 * oder −1. `grenze` = Abstand der ersten echten Fläche (Infinity: keine);
 * Flächen, die weiter als `grenze + spiel` oder `weite` beginnen, zählen
 * nicht. Unter den getroffenen gewinnt die, deren Mitte dem Strahl am
 * nächsten liegt (nach Winkel).
 */
export function waehleTippflaeche(
  o: V3,
  d: V3,
  flaechen: readonly Tippflaeche[],
  winkel: number,
  grenze: number,
  weite: number,
  spiel = TIEFEN_SPIEL_M
): { index: number; abstand: number } {
  let best = -1
  let bestScore = Infinity
  let bestT = 0
  if (!(winkel > 0)) return { index: -1, abstand: 0 }
  const maxT = Math.min(weite, grenze + Math.max(0, spiel))
  for (let i = 0; i < flaechen.length; i += 1) {
    const { c, h } = flaechen[i]
    const vx = c[0] - o[0]
    const vy = c[1] - o[1]
    const vz = c[2] - o[2]
    const dist = Math.hypot(vx, vy, vz)
    if (dist < 1e-6) continue
    const ph = tippflaecheHalb(h, dist, winkel)
    const t = strahlTrifftQuader(
      o,
      d,
      [c[0] - ph[0], c[1] - ph[1], c[2] - ph[2]],
      [c[0] + ph[0], c[1] + ph[1], c[2] + ph[2]]
    )
    if (t === null || t > maxT) continue
    // Winkel zwischen Strahl und Richtung zur Mitte (1 − cos: monoton)
    const score = 1 - (vx * d[0] + vy * d[1] + vz * d[2]) / dist
    if (score < bestScore) {
      bestScore = score
      best = i
      bestT = t
    }
  }
  return { index: best, abstand: bestT }
}

// ---- Aufleuchten --------------------------------------------------------------

/** Dauer des kurzen Aufleuchtens nach einem Tipp (ms). */
export const BLITZ_MS = 700
/** Einblenden der dauerhaften Hervorhebung (ms). */
export const EINBLENDEN_MS = 140

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Stärke 0…1 beim Einblenden, `t` = Anteil der Einblendzeit. */
export function einblenden(t: number): number {
  const x = clamp01(t)
  return 1 - (1 - x) * (1 - x)
}

/**
 * Stärke 0…1 des Aufleuchtens, `t` = Anteil der Blitzdauer: schnell an,
 * kurz halten, ausklingen. `bleibt`: Der Platz ist zugleich ausgewählt, die
 * Hervorhebung klingt dann nicht aus.
 */
export function blitzStaerke(t: number, bleibt = false): number {
  if (!(t > 0)) return 0
  if (t < 0.15) return einblenden(t / 0.15)
  if (bleibt || t < 0.55) return 1
  if (t >= 1) return 0
  const x = (1 - t) / 0.45
  return x * x
}
