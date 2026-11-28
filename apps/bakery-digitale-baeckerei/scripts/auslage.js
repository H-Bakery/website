/**
 * Auslage (DB12): Wie liegen `anzahl` Stück eines Produkts auf einem Platz?
 * Aus dem Rahmen des Platzes (plaetze.js) und dem Rahmen des Regal-Modells
 * (Meter, y oben, steht auf y = 0, Schauseite +z) entsteht je Stück eine
 * Lage im Raum. Passt nicht alles, liegen so viele wie passen.
 *
 * Diese Rechnung gibt es genau einmal: Die App legt damit die Modelle in die
 * Szene (src/lib/einrichtung/), `sync-produkte-3d` meldet damit beim Bauen,
 * was nicht passt, der Einrichten-Modus zeigt damit die Vorschau. Reine Logik
 * ohne three und ohne Dateisystem; getestet in auslage.spec.ts. CommonJS.
 *
 * Die Regeln stammen aus dem Saar LiDAR Explorer (`products/fill.py`
 * `layout`, `build/bh_twin/auslage.py`; github.com/Open-Kirrberg/
 * saar-lidar-explorer, MIT, gleicher Urheber):
 * - **Reihen:** eine Lage, von vorn gefüllt, je Reihe gleichmäßig über die
 *   Breite verteilt; tiefere Reihen erst, wenn die vordere voll ist. Liegt das
 *   Stück quer nicht, wird es gedreht (lange Seite nach hinten) - so stehen
 *   Baguettes im schmalen Fach des Brotregals nebeneinander. Ein einzelnes
 *   Stück auf geneigtem Boden rutscht nach vorn an die Leiste.
 * - **Korb:** gehäuft - auf die volle untere Lage kommen bis zu zwei weitere,
 *   jede in den Mulden der Lage darunter; die Stücke dürfen bis 10 % kleiner
 *   sein.
 * - **Haken:** ein Stück je Platz, hängend (die Dicke längs des Arms, das
 *   Stück nach unten).
 * Jedes Stück bekommt eine kleine, feste Abweichung in Lage und Drehung (aus
 * dem Namen des Platzes, nie aus dem Zufall), damit eine Reihe nicht wie
 * gestempelt aussieht - nur so viel, wie in seinem Feld Luft ist.
 */

/**
 * Material des schwarzen Tabletts unter Stückware in der Vitrine. Liegt es
 * flach unter der Ware (plaetze.js: `traeger`), bleibt es beim Einrichten
 * liegen und die neue Ware steht darauf.
 */
const TRAEGER_MATERIALIEN = ['lack-schwarz']

/** Lücke zwischen Stücken (m). */
const LUECKE_M = 0.006
/** Ein einzelnes Stück darf so weit über seinen Platz ragen (m). */
const UEBERSTAND_M = 0.02
/** Körbe: Eine Lage liegt um diesen Anteil der Stückhöhe über der darunter. */
const HAUFEN_STEIGUNG = 0.55
/** Körbe: So viel kleiner dürfen gehäufte Stücke sein. */
const HAUFEN_STAUCHEN = 0.9
/** Höher als die lichte Höhe plus dies passt nicht (m). */
const HOEHE_TOLERANZ_M = 0.01
/** Ab dieser Neigung rutscht ein einzelnes Stück nach vorn (Grad). */
const RUTSCHT_AB_GRAD = 5
/** Haken: so viel breiter als die Brezel des Modells darf das Stück sein (m). */
const HAKEN_BREITER_M = 0.06
/** Haken: so viel dicker (längs des Arms) bzw. länger darf es sein (m). */
const HAKEN_DICKER_M = 0.03
const HAKEN_LAENGER_M = 0.06
/** Größte Drehung eines Stücks um seine Hochachse (Grad): Reihen, Körbe. */
const DREHUNG_REIHEN_GRAD = 5
const DREHUNG_KORB_GRAD = 14
/** Anteil der Luft im Feld, um den ein Stück verschoben sein darf. */
const VERSATZ_ANTEIL = 0.3

/**
 * @typedef {[number, number, number]} V3
 * @typedef {import('./plaetze').Platz} Platz
 * @typedef {{ min: number[], max: number[] }} Bbox
 * @typedef {'passt' | 'weniger' | 'zu-gross' | 'zu-hoch' | 'haken'} Befund
 * @typedef {{
 *   matrizen: number[][],
 *   gelegt: number,
 *   befund: Befund,
 * }} Auslage  je Stück eine 4×4-Matrix (16 Zahlen, spaltenweise wie in three), wie viele liegen, und warum es weniger sind
 */

/** FNV-1a über den Namen des Platzes: der feste Startwert seiner Abweichungen. */
function startwert(text) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Kleiner fester Zahlengenerator (mulberry32): −1 … 1. */
function folge(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1
  }
}

/** Breite (x), Tiefe (z), Höhe (y) und Fußpunkt eines Regal-Modells. */
function stueckMasse(bbox) {
  const [x0, y0, z0] = bbox.min
  const [x1, y1, z1] = bbox.max
  return {
    w: x1 - x0,
    d: z1 - z0,
    h: y1 - y0,
    fuss: /** @type {V3} */ ([(x0 + x1) / 2, y0, (z0 + z1) / 2]),
  }
}

/** Wie viele Stücke a × b nebeneinander und hintereinander auf W × D passen. */
function raster(W, D, a, b) {
  return [
    Math.floor((W + LUECKE_M) / (a + LUECKE_M) + 1e-9),
    Math.floor((D + LUECKE_M) / (b + LUECKE_M) + 1e-9),
  ]
}

/**
 * Lagen der Stücke im Rahmen des Platzes: `u` quer (von der Mitte, + =
 * rechts), `v` in die Tiefe (+ = hinten), `basis` = Höhe des Fußes über der
 * Standfläche, `gedreht` = die lange Seite zeigt nach hinten. Dazu das Feld
 * (Breite, Tiefe), in das jedes Stück passen muss. `gelegt` kann kleiner
 * sein als `anzahl`.
 * @param {{ b: number, t: number, h: number, art: string }} platz
 * @param {{ w: number, d: number, h: number }} stueck
 * @param {number} anzahl
 * @returns {{ lagen: { u: number, v: number, basis: number, gedreht: boolean }[], feld: [number, number], gelegt: number, befund: Befund }}
 */
function ordne(platz, stueck, anzahl) {
  const { w, d, h } = stueck
  const W = platz.b
  const D = platz.t
  const Hc = platz.h
  const korb = platz.art === 'korb'
  const leer = (befund) => ({ lagen: [], feld: [W, D], gelegt: 0, befund })
  if (!(anzahl >= 1)) return leer('passt')
  if (h > Hc + HOEHE_TOLERANZ_M) return leer('zu-hoch')

  const stauchen = korb ? HAUFEN_STAUCHEN : 1
  let best = null
  for (const [gedreht, a, b] of [
    [false, w * stauchen, d * stauchen],
    [true, d * stauchen, w * stauchen],
  ]) {
    let nx
    let ny
    let einzeln = false
    if (anzahl === 1 && a <= W + UEBERSTAND_M && b <= D + UEBERSTAND_M) {
      nx = 1
      ny = 1
      einzeln = true
    } else {
      ;[nx, ny] = raster(W, D, a, b)
      // Passt keines ins Raster, darf das erste trotzdem leicht überstehen.
      if (
        (nx < 1 || ny < 1) &&
        a <= W + UEBERSTAND_M &&
        b <= D + UEBERSTAND_M
      ) {
        nx = 1
        ny = 1
        einzeln = true
      }
    }
    if (nx < 1 || ny < 1) continue
    let platzFuer = nx * ny
    if (korb && !einzeln) {
      for (const k of [1, 2]) {
        if ((1 + k * HAUFEN_STEIGUNG) * h <= Hc + 1e-9) {
          platzFuer += Math.max(0, nx - k) * Math.max(0, ny - k)
        }
      }
    }
    // Vorrang: reicht für alle, dann mehr Platz, dann ungedreht.
    const rang = [platzFuer >= anzahl ? 1 : 0, platzFuer, gedreht ? 0 : 1]
    if (
      best === null ||
      rang[0] > best.rang[0] ||
      (rang[0] === best.rang[0] && rang[1] > best.rang[1]) ||
      (rang[0] === best.rang[0] &&
        rang[1] === best.rang[1] &&
        rang[2] > best.rang[2])
    ) {
      best = { rang, gedreht, a, b, nx, ny, platzFuer, einzeln }
    }
  }
  if (best === null) return leer('zu-gross')
  const { gedreht, a, b, nx, ny, einzeln } = best
  const gelegt = Math.min(anzahl, best.platzFuer)
  const befund = gelegt < anzahl ? 'weniger' : 'passt'
  if (einzeln) {
    return {
      lagen: [{ u: 0, v: 0, basis: 0, gedreht }],
      feld: [Math.max(a, W), Math.max(b, D)],
      gelegt: 1,
      befund,
    }
  }
  /** @type {{ u: number, v: number, basis: number, gedreht: boolean }[]} */
  const lagen = []
  // Untere Lage: Reihen von vorn, je Reihe gleichmäßig über die Breite.
  const unten = Math.min(gelegt, nx * ny)
  const reihen = Math.ceil(unten / nx)
  const je = []
  for (let r = 0; r < reihen; r += 1) {
    je.push(Math.floor(unten / reihen) + (r < unten % reihen ? 1 : 0))
  }
  const voll = reihen === ny
  const cd = voll ? (D - (reihen - 1) * LUECKE_M) / reihen : b
  je.forEach((k, r) => {
    const v = -D / 2 + cd / 2 + r * (cd + LUECKE_M)
    const cw = W / k
    for (let i = 0; i < k; i += 1) {
      lagen.push({ u: -W / 2 + (i + 0.5) * cw, v, basis: 0, gedreht })
    }
  })
  const feld = /** @type {[number, number]} */ ([W / Math.max(...je), cd])
  let rest = gelegt - unten
  if (rest > 0 && korb) {
    // Jede weitere Lage liegt in den Mulden der Lage darunter.
    for (const lage of [1, 2]) {
      const mx = nx - lage
      const my = ny - lage
      if (mx < 1 || my < 1 || rest <= 0) break
      if ((1 + lage * HAUFEN_STEIGUNG) * h > Hc + 1e-9) break
      let k = 0
      for (let j = 0; j < my && k < rest; j += 1) {
        for (let i = 0; i < mx && k < rest; i += 1) {
          lagen.push({
            u: -W / 2 + ((i + 0.5 + lage / 2) * W) / nx,
            v: -D / 2 + cd / 2 + (j + lage / 2) * (cd + LUECKE_M),
            basis: lage * HAUFEN_STEIGUNG * h,
            gedreht,
          })
          k += 1
        }
      }
      rest -= k
    }
  }
  return { lagen, feld, gelegt: lagen.length, befund }
}

/** 4×4-Matrix spaltenweise aus drei Achsen (schon skaliert) und dem Ort. */
const matrix = (x, y, z, p) => [
  x[0], x[1], x[2], 0,
  y[0], y[1], y[2], 0,
  z[0], z[1], z[2], 0,
  p[0], p[1], p[2], 1,
] // prettier-ignore

const plus = (a, b, k = 1) =>
  /** @type {V3} */ ([a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k])
const mal = (a, k) => /** @type {V3} */ ([a[0] * k, a[1] * k, a[2] * k])

/**
 * Die Auslage eines Platzes: je Stück die Lage im Raum.
 * @param {string} slot  Name des Platzes (Startwert der Abweichungen)
 * @param {Platz} platz
 * @param {Bbox} bbox  Rahmen des Regal-Modells
 * @param {number} anzahl
 * @returns {Auslage}
 */
function auslage(slot, platz, bbox, anzahl) {
  const stueck = stueckMasse(bbox)
  const { r, n, f, o } = platz
  const zufall = folge(startwert(slot))

  if (platz.art === 'haken') {
    if (!(anzahl >= 1)) return { matrizen: [], gelegt: 0, befund: 'passt' }
    // Das Stück hängt: x quer, y (seine Dicke) längs des Arms, z nach unten.
    const zuBreit = stueck.w > platz.b + HAKEN_BREITER_M
    const zuDick = stueck.h > platz.h + HAKEN_DICKER_M
    const zuLang = stueck.d > platz.t + HAKEN_LAENGER_M
    if (zuBreit || zuDick || zuLang) {
      return { matrizen: [], gelegt: 0, befund: 'zu-gross' }
    }
    const [x0, y0, z0] = bbox.min
    const [x1, y1] = bbox.max
    // Oberkante (kleinstes z) mittig an den Ort des Platzes.
    const lokal = [(x0 + x1) / 2, (y0 + y1) / 2, z0]
    const p = plus(plus(plus(o, r, -lokal[0]), n, -lokal[1]), f, -lokal[2])
    return {
      matrizen: [matrix(r, n, f, p)],
      gelegt: 1,
      befund: anzahl > 1 ? 'haken' : 'passt',
    }
  }

  const plan = ordne(platz, stueck, anzahl)
  const korb = platz.art === 'korb'
  const [cw, cd] = plan.feld
  const matrizen = plan.lagen.map((lage, index) => {
    // Grundfläche des Stücks, wie es liegt (gedreht: lange Seite nach hinten).
    let ex = lage.gedreht ? stueck.d : stueck.w
    let ez = lage.gedreht ? stueck.w : stueck.d
    // Im Korb dürfen die Stücke etwas kleiner sein, sonst nie.
    const s = korb
      ? Math.max(HAUFEN_STAUCHEN, Math.min(1, cw / ex, cd / ez))
      : 1
    ex *= s
    ez *= s
    const luftU = Math.max(0, cw - ex)
    const luftV = Math.max(0, cd - ez)
    let u = lage.u + zufall() * luftU * VERSATZ_ANTEIL
    let v = lage.v + zufall() * luftV * VERSATZ_ANTEIL
    const dreh = zufall()
    if (
      !korb &&
      plan.lagen.length === 1 &&
      Math.abs(platz.neigung) > RUTSCHT_AB_GRAD &&
      index === 0
    ) {
      // Nach vorn an die Leiste gerutscht.
      u = lage.u
      v = -platz.t / 2 + 0.004 + ez / 2
    }
    // Drehung nur, soweit das Feld Luft lässt (die Ecke wandert um sin·Länge).
    const lang = Math.max(ex, ez)
    const maxGrad = korb ? DREHUNG_KORB_GRAD : DREHUNG_REIHEN_GRAD
    const frei = Math.min(luftU, luftV) / 2
    const grenze = lang > 0 ? Math.asin(Math.min(1, frei / lang)) : 0
    const winkel =
      dreh * Math.min((maxGrad * Math.PI) / 180, grenze) +
      (lage.gedreht ? Math.PI / 2 : 0)
    const c = Math.cos(winkel)
    const si = Math.sin(winkel)
    // Drehung um die Hochachse des Platzes: x → c·r − s·f, z → s·r + c·f.
    const X = mal(plus(mal(r, c), f, -si), s)
    const Y = mal(n, s)
    const Z = mal(plus(mal(r, si), f, c), s)
    const ort = plus(plus(plus(o, r, u), n, lage.basis * s), f, -v)
    const fuss = stueck.fuss
    const p = plus(plus(plus(ort, X, -fuss[0]), Y, -fuss[1]), Z, -fuss[2])
    return matrix(X, Y, Z, p)
  })
  return { matrizen, gelegt: matrizen.length, befund: plan.befund }
}

/**
 * Derselbe Platz, von der anderen Seite gesehen: „vorn“ und „rechts“
 * getauscht, „oben“ bleibt. Die App dreht damit einen Platz, dessen Vorderseite
 * vom Standort des Blickpunkts weg zeigt.
 * @param {Platz} platz
 * @returns {Platz}
 */
function gewendet(platz) {
  return {
    ...platz,
    r: [-platz.r[0], -platz.r[1], -platz.r[2]],
    f: [-platz.f[0], -platz.f[1], -platz.f[2]],
  }
}

/** Satz für die Meldung beim Bauen und im Einrichten-Modus. */
function befundText(befund, gelegt, anzahl) {
  switch (befund) {
    case 'weniger':
      return `nur ${gelegt} von ${anzahl} passen`
    case 'zu-gross':
      return 'zu groß für den Platz'
    case 'zu-hoch':
      return 'zu hoch für den Platz'
    case 'haken':
      return `an einem Haken hängt ein Stück (statt ${anzahl})`
    default:
      return ''
  }
}

module.exports = {
  HAUFEN_STAUCHEN,
  LUECKE_M,
  TRAEGER_MATERIALIEN,
  UEBERSTAND_M,
  auslage,
  befundText,
  gewendet,
  ordne,
  startwert,
  stueckMasse,
}
