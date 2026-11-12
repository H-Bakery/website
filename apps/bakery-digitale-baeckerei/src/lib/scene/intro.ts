/**
 * Der Flug zum Start („Von der Straße zur Theke“): reine Rechnung ohne three
 * und ohne DOM (intro.spec.ts). Die Stützpunkte stehen in
 * `src/config/raeume.ts`; `createViewer.ts` führt damit die Kamera.
 *
 * - Standort und Blickziel laufen zwischen den Stützpunkten geradlinig, die
 *   Ecken sind leicht gerundet (gleitendes Mittel über ± `RUNDUNG_S` Pfadzeit).
 *   Der Standort bleibt dabei höchstens ≈ 0,25 m neben dem geprüften Weg.
 * - Die Zeit läuft am Anfang weich an und am Ende weich aus.
 * - In der letzten Sekunde blendet der Flug in die Ruhelage des Blickpunkts
 *   über, wie sie für dieses Bildformat gilt (Hochformat hat eigene Werte) -
 *   so springt nichts, wenn das Kamera-Rig übernimmt.
 */
import type { Intro, IntroPunkt, Vec3 } from '../../config/raeume'

/** Halbe Breite des gleitenden Mittels in Sekunden Pfadzeit. */
export const RUNDUNG_S = 0.09
/** So lange (s) läuft die Zeit am Anfang an … */
export const ANLAUF_S = 0.6
/** … und am Ende aus. */
export const AUSLAUF_S = 0.9
/** In den letzten Sekunden blendet der Flug in die Ruhelage des Ziels über. */
export const ENDE_BLENDE_S = 1
/** Darunter (Bilder/s, im Mittel über die erste Sekunde) wird geschnitten statt geruckelt. */
export const MIN_BILDER_JE_S = 12
/** Nach so vielen ms Flug wird die Bildrate beurteilt. */
export const BILDRATE_NACH_MS = 1000
/** Eine längere Pause zwischen zwei Bildern beendet den Flug (Tab im Hintergrund, Hänger). */
export const MAX_PAUSE_MS = 1000

/** Warum ein Flug zu Ende ging. */
export type IntroEnde = 'ende' | 'uebersprungen' | 'langsam' | 'verborgen'

/** Wohin die Kamera schaut: wie `Ansicht` aus view.ts, ohne das Bildformat. */
export interface IntroPose {
  eye: Vec3
  look: Vec3
  fov: number
}

const mische = (a: Vec3, b: Vec3, f: number): Vec3 => [
  a[0] + (b[0] - a[0]) * f,
  a[1] + (b[1] - a[1]) * f,
  a[2] + (b[2] - a[2]) * f,
]

const klemme = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max)

/** Der Zeitplan eines Flugs: Filmzeit → Pfadzeit, mindestens zwei Marken. */
function ablaufVon(intro: Intro): readonly { film: number; pfad: number }[] {
  if (intro.ablauf && intro.ablauf.length >= 2) return intro.ablauf
  const erste = intro.punkte[0]?.t ?? 0
  const letzte = intro.punkte[intro.punkte.length - 1]?.t ?? 0
  return [
    { film: 0, pfad: erste },
    { film: letzte - erste, pfad: letzte },
  ]
}

/** Dauer des Flugs in Sekunden. */
export function dauer(intro: Intro): number {
  const plan = ablaufVon(intro)
  return plan[plan.length - 1].film - plan[0].film
}

/** Der Abschnitt des Pfads (Pfadzeit), den der Flug zeigt. */
export function pfadBereich(intro: Intro): { von: number; bis: number } {
  const plan = ablaufVon(intro)
  return { von: plan[0].pfad, bis: plan[plan.length - 1].pfad }
}

/**
 * Weiches Anlaufen und Auslaufen: bildet die Filmzeit 0…`gesamt` auf sich
 * selbst ab, mit Tempo 0 an beiden Enden und gleichmäßigem Tempo dazwischen.
 */
export function weicheZeit(
  zeit: number,
  gesamt: number,
  anlauf: number = ANLAUF_S,
  auslauf: number = AUSLAUF_S
): number {
  if (!(gesamt > 0)) return 0
  const t = klemme(Number.isFinite(zeit) ? zeit : 0, 0, gesamt)
  // Sehr kurze Flüge: die Rampen teilen sich, was da ist.
  const k = Math.min(1, gesamt / (anlauf + auslauf || 1))
  const a = anlauf * k
  const b = auslauf * k
  const tempo = gesamt / (gesamt - (a + b) / 2)
  if (t < a) return (tempo * t * t) / (2 * a)
  if (t > gesamt - b) return gesamt - (tempo * (gesamt - t) ** 2) / (2 * b)
  return tempo * (t - a / 2)
}

/** Pfadzeit zu einer Filmzeit (mit weichem An- und Auslauf). */
export function pfadzeit(intro: Intro, filmS: number): number {
  const plan = ablaufVon(intro)
  const start = plan[0].film
  const t = start + weicheZeit(filmS, dauer(intro))
  let i = 0
  while (i < plan.length - 2 && t > plan[i + 1].film) i += 1
  const a = plan[i]
  const b = plan[i + 1]
  const spanne = b.film - a.film
  const f = spanne > 0 ? klemme((t - a.film) / spanne, 0, 1) : 1
  return a.pfad + (b.pfad - a.pfad) * f
}

/** Der Punkt auf dem geraden Pfad (ohne Rundung) zur Pfadzeit `t`. */
export function pfadPunkt(
  punkte: readonly IntroPunkt[],
  t: number
): { eye: Vec3; look: Vec3 } {
  const erster = punkte[0]
  const letzter = punkte[punkte.length - 1]
  if (!(t > erster.t)) return { eye: erster.eye, look: erster.look }
  if (t >= letzter.t) return { eye: letzter.eye, look: letzter.look }
  let i = 0
  while (i < punkte.length - 2 && t > punkte[i + 1].t) i += 1
  const a = punkte[i]
  const b = punkte[i + 1]
  const spanne = b.t - a.t
  const f = spanne > 0 ? (t - a.t) / spanne : 1
  return { eye: mische(a.eye, b.eye, f), look: mische(a.look, b.look, f) }
}

/** ∫ Pfad dt von der ersten Marke bis `t` (je Achse), für das gleitende Mittel. */
function integral(
  punkte: readonly IntroPunkt[],
  feld: 'eye' | 'look',
  t: number
): [number, number, number] {
  const summe: [number, number, number] = [0, 0, 0]
  for (let i = 0; i < punkte.length - 1; i += 1) {
    const a = punkte[i]
    const b = punkte[i + 1]
    if (t <= a.t) break
    const bis = Math.min(t, b.t)
    const spanne = b.t - a.t
    const f = spanne > 0 ? (bis - a.t) / spanne : 1
    // Trapez: Anfangswert und Wert bei `bis` gemittelt, mal die Zeit.
    for (let k = 0; k < 3; k += 1) {
      const ende = a[feld][k] + (b[feld][k] - a[feld][k]) * f
      summe[k] += ((a[feld][k] + ende) / 2) * (bis - a.t)
    }
  }
  return summe
}

/**
 * Der Pfad mit gerundeten Ecken: das Mittel über `t` ± `halb` Sekunden. An
 * den Rändern `von`/`bis` schrumpft das Fenster auf null - Anfang und Ende
 * liegen genau auf dem Pfad.
 */
export function gerundet(
  punkte: readonly IntroPunkt[],
  t: number,
  bereich: { von: number; bis: number },
  halb: number = RUNDUNG_S
): { eye: Vec3; look: Vec3 } {
  const mitte = klemme(t, bereich.von, bereich.bis)
  const w = Math.min(halb, mitte - bereich.von, bereich.bis - mitte)
  if (!(w > 1e-6)) return pfadPunkt(punkte, mitte)
  const mittel = (feld: 'eye' | 'look'): Vec3 => {
    const a = integral(punkte, feld, mitte - w)
    const b = integral(punkte, feld, mitte + w)
    return [
      (b[0] - a[0]) / (2 * w),
      (b[1] - a[1]) / (2 * w),
      (b[2] - a[2]) / (2 * w),
    ]
  }
  return { eye: mittel('eye'), look: mittel('look') }
}

const smoothstep = (x: number): number => {
  const t = klemme(x, 0, 1)
  return t * t * (3 - 2 * t)
}

/**
 * Die Kamera zur Filmzeit `filmS`. `ende` ist die Ruhelage des Ziel-
 * Blickpunkts für das aktuelle Bildformat (`ansichtFuer`): Ihr Öffnungswinkel
 * gilt den ganzen Flug, und in der letzten Sekunde gehen Standort und
 * Blickziel in sie über - am Schluss steht die Kamera genau dort.
 */
export function introPose(
  intro: Intro,
  filmS: number,
  ende: IntroPose
): IntroPose {
  const gesamt = dauer(intro)
  const zeit = klemme(Number.isFinite(filmS) ? filmS : 0, 0, gesamt)
  if (zeit >= gesamt) {
    return { eye: ende.eye, look: ende.look, fov: ende.fov }
  }
  const p = gerundet(intro.punkte, pfadzeit(intro, zeit), pfadBereich(intro))
  const g = smoothstep((zeit - (gesamt - ENDE_BLENDE_S)) / ENDE_BLENDE_S)
  return {
    eye: g > 0 ? mische(p.eye, ende.eye, g) : p.eye,
    look: g > 0 ? mische(p.look, ende.look, g) : p.look,
    fov: ende.fov,
  }
}

/** Länge des geflogenen Wegs in Metern (gerader Pfad im gezeigten Abschnitt). */
export function pfadLaenge(intro: Intro): number {
  const { von, bis } = pfadBereich(intro)
  const marken = [
    von,
    ...intro.punkte.map((p) => p.t).filter((t) => t > von && t < bis),
    bis,
  ]
  let summe = 0
  for (let i = 0; i < marken.length - 1; i += 1) {
    const a = pfadPunkt(intro.punkte, marken[i]).eye
    const b = pfadPunkt(intro.punkte, marken[i + 1]).eye
    summe += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  }
  return summe
}

/**
 * Welcher Flug wird gezeigt? Der erste der Liste, der am Blickpunkt `ziel`
 * endet und dessen Gelände (`braucht`) das geladene Modell hat - `namen` sind
 * die Knotennamen des Modells (`umgebung/strasse`, …). Keiner: `null`.
 */
export function waehleIntro(
  intros: readonly Intro[] | undefined,
  namen: Iterable<string>,
  ziel: string
): Intro | null {
  if (!intros || intros.length === 0) return null
  const alle = [...namen]
  for (const intro of intros) {
    if (intro.ziel !== ziel || intro.punkte.length < 2) continue
    if (!(dauer(intro) > 0)) continue
    const praefix = intro.braucht
    if (praefix && !alle.some((name) => name.startsWith(praefix))) continue
    return intro
  }
  return null
}

/**
 * Ruckelt der Flug? Beurteilt wird einmal, nach der ersten Sekunde: weniger
 * als `MIN_BILDER_JE_S` Bilder je Sekunde im Mittel.
 */
export function zuLangsam(bilder: number, ms: number): boolean {
  if (!(ms >= BILDRATE_NACH_MS)) return false
  return bilder / (ms / 1000) < MIN_BILDER_JE_S
}
