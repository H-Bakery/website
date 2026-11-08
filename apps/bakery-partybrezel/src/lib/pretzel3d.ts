/**
 * Geometrie der 3D-Vorschau als reine Rechnung - ohne three.js, damit sie in
 * jest testbar ist. Die Komponente (`PretzelPreview3D`) macht aus den Arrays
 * nur noch BufferGeometry, Materialien und Licht.
 *
 * Koordinaten: y ist oben, die Brezel liegt in der x-z-Ebene auf dem Boden
 * (y = 0). Von vorn gesehen (Kamera bei +z) ist der Bauch unten (+z, nah) und
 * sind die Schlaufen oben (-z, hinten) - wie in der 2D-Vorschau.
 *
 * Eine schematische Darstellung, kein Produktfoto: Maße und Teilung sind
 * Annahmen für den Prototyp.
 */
import type {
  PartybrezelConfig,
  SizeConfig,
  ToppingConfig,
} from '../config/partybrezel.config'

import { UNSET_COLOR } from './previewColors'

export { UNSET_COLOR }

export type Vec3 = [number, number, number]

/**
 * Mittellinie im Grundriss (x rechts, y nach hinten), Einheit ≈ halbe Breite.
 * Reihenfolge entlang des Teigstrangs: linkes Ende (auf dem Bauch) → Kreuzung
 * → rechte Schlaufe → Bauch → linke Schlaufe → Kreuzung → rechtes Ende.
 */
export const PLAN_POINTS: readonly (readonly [number, number])[] = [
  [-0.36, -0.55], // 0 linkes Ende, auf den Bauch gedrückt
  [-0.2, -0.16],
  [0, 0.14], // 2 Kreuzung (Strang A oben)
  [0.24, 0.42],
  [0.55, 0.64],
  [0.88, 0.48],
  [1.0, 0.06],
  [0.82, -0.44],
  [0.42, -0.72],
  [0, -0.8], // 9 Mitte des Bauchs
  [-0.42, -0.72],
  [-0.82, -0.44],
  [-1.0, 0.06],
  [-0.88, 0.48],
  [-0.55, 0.64],
  [-0.24, 0.42],
  [0, 0.14], // 16 Kreuzung (Strang B unten)
  [0.2, -0.16],
  [0.36, -0.55], // 18 rechtes Ende
]
const IDX_CROSSING_A = 2
const IDX_LOOP_RIGHT = 4
const IDX_BELLY = 9
const IDX_LOOP_LEFT = 14
const IDX_CROSSING_B = 16

/** Strangradius am Bauch und an den Armen (Weltmaß vor der Größen-Skalierung). */
export const BELLY_RADIUS = 0.2
export const ARM_RADIUS = 0.1
/** Querschnitt: breiter als hoch (der Teig liegt auf dem Blech). */
export const WIDTH_FACTOR = 1.12
export const HEIGHT_FACTOR = 0.78
/** Dicke der Füllung zwischen Unter- und Oberteil = Abstand, um den das Oberteil gehoben ist. */
export const FILLING_THICKNESS = 0.05
/** Die Füllung steht seitlich etwas über den Teig hinaus. */
export const FILLING_OVERHANG = 1.14
/** Halbe Fuge zwischen zwei Teilen (Weltmaß). */
export const PART_GAP = 0.03

const SAMPLES_PER_SEGMENT = 24

interface Plan {
  x: number
  y: number
}

export interface PretzelCurve {
  /** Dicht abgetastete Mittellinie im Grundriss. */
  plan: Plan[]
  /** Bogenlänge je Abtastpunkt, normiert auf 0…1. */
  u: number[]
  /** Länge der Mittellinie im Grundriss. */
  length: number
  /** u an den Stützpunkten (Index wie PLAN_POINTS). */
  keyU: number[]
}

function dist(a: Plan, b: Plan) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Zentripetale Catmull-Rom-Kurve (keine Schleifen, keine Spitzen). */
function catmullRom(p0: Plan, p1: Plan, p2: Plan, p3: Plan, s: number): Plan {
  const knot = (a: Plan, b: Plan) => Math.max(Math.sqrt(dist(a, b)), 1e-6)
  const t0 = 0
  const t1 = t0 + knot(p0, p1)
  const t2 = t1 + knot(p1, p2)
  const t3 = t2 + knot(p2, p3)
  const t = t1 + (t2 - t1) * s
  const mix = (a: Plan, b: Plan, ta: number, tb: number): Plan => {
    const wa = (tb - t) / (tb - ta)
    const wb = (t - ta) / (tb - ta)
    return { x: a.x * wa + b.x * wb, y: a.y * wa + b.y * wb }
  }
  const a1 = mix(p0, p1, t0, t1)
  const a2 = mix(p1, p2, t1, t2)
  const a3 = mix(p2, p3, t2, t3)
  const b1 = mix(a1, a2, t0, t2)
  const b2 = mix(a2, a3, t1, t3)
  return mix(b1, b2, t1, t2)
}

let cachedCurve: PretzelCurve | null = null

export function pretzelCurve(): PretzelCurve {
  if (cachedCurve) return cachedCurve
  const pts: Plan[] = PLAN_POINTS.map(([x, y]) => ({ x, y }))
  const n = pts.length
  const at = (i: number): Plan => {
    if (i < 0) return { x: 2 * pts[0].x - pts[1].x, y: 2 * pts[0].y - pts[1].y }
    if (i >= n)
      return {
        x: 2 * pts[n - 1].x - pts[n - 2].x,
        y: 2 * pts[n - 1].y - pts[n - 2].y,
      }
    return pts[i]
  }
  const plan: Plan[] = []
  const keyIndex: number[] = []
  for (let i = 0; i < n - 1; i += 1) {
    keyIndex.push(plan.length)
    for (let k = 0; k < SAMPLES_PER_SEGMENT; k += 1) {
      plan.push(
        catmullRom(
          at(i - 1),
          at(i),
          at(i + 1),
          at(i + 2),
          k / SAMPLES_PER_SEGMENT
        )
      )
    }
  }
  keyIndex.push(plan.length)
  plan.push(pts[n - 1])
  const lengths = [0]
  for (let i = 1; i < plan.length; i += 1)
    lengths.push(lengths[i - 1] + dist(plan[i - 1], plan[i]))
  const length = lengths[lengths.length - 1]
  const u = lengths.map((l) => l / length)
  cachedCurve = { plan, u, length, keyU: keyIndex.map((i) => u[i]) }
  return cachedCurve
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v))
}

function smoothstep(e0: number, e1: number, x: number) {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}

/** Grundriss-Punkt bei u (lineare Interpolation der dichten Abtastung). */
function planAt(curve: PretzelCurve, u: number): Plan {
  const v = clamp01(u)
  let lo = 0
  let hi = curve.u.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (curve.u[mid] <= v) lo = mid
    else hi = mid
  }
  const span = curve.u[hi] - curve.u[lo] || 1
  const f = (v - curve.u[lo]) / span
  const a = curve.plan[lo]
  const b = curve.plan[hi]
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }
}

/** 1 in der Mitte des Bauchs, 0 ab den Schlaufen. */
export function bellyWeight(u: number, curve = pretzelCurve()): number {
  const belly = curve.keyU[IDX_BELLY]
  const half = Math.max(
    belly - curve.keyU[IDX_LOOP_RIGHT],
    curve.keyU[IDX_LOOP_LEFT] - belly
  )
  const d = Math.abs(clamp01(u) - belly) / half
  return d < 1 ? 0.5 * (1 + Math.cos(Math.PI * d)) : 0
}

/**
 * Ausbund: der helle, aufgerissene Streifen auf dem dicken Bauch einer
 * Laugenbrezel. 0…1 je Ort auf dem Oberteil (theta: Winkel im Querschnitt,
 * π/2 = oben); leicht gewellt, damit er nicht wie gezeichnet wirkt.
 */
export function ausbundAt(
  u: number,
  theta: number,
  curve = pretzelCurve()
): number {
  const s = clamp01(u) * curve.length
  const centre = Math.PI * (0.62 + 0.025 * Math.sin(s * 4.5))
  const width = Math.PI * (0.075 + 0.02 * Math.sin(s * 3.1 + 1))
  const band = 1 - smoothstep(width * 0.3, width, Math.abs(theta - centre))
  return 0.8 * band * smoothstep(0.45, 0.85, bellyWeight(u, curve))
}

/**
 * Strangradius bei u: dick am Bauch, dünn an Armen und Schlaufen, zu den
 * beiden Enden hin leicht verjüngt.
 */
export function radiusAt(u: number, curve = pretzelCurve()): number {
  let r = ARM_RADIUS + (BELLY_RADIUS - ARM_RADIUS) * bellyWeight(u, curve)
  const endDistance = Math.min(clamp01(u), 1 - clamp01(u)) * curve.length
  r *= 0.62 + 0.38 * smoothstep(0, 0.28, endDistance)
  return r
}

/** Höhe des Schnitts (zwischen Unter- und Oberteil) über dem Boden bei u. */
export function sliceHeightAt(u: number, curve = pretzelCurve()): number {
  const v = clamp01(u)
  const L = curve.length
  // Strang A liegt an der Kreuzung über Strang B (B: Unterteil + Füllung + Oberteil).
  const overB = 2 * HEIGHT_FACTOR * ARM_RADIUS + FILLING_THICKNESS + 0.015
  const dA = Math.abs(v - curve.keyU[IDX_CROSSING_A]) * L
  const crossing = overB * (1 - smoothstep(0.24, 0.62, dA))
  // Die Enden liegen auf der Flanke des Bauchs.
  const endDistance = Math.min(v, 1 - v) * L
  const ends = 0.15 * (1 - smoothstep(0, 0.42, endDistance))
  return HEIGHT_FACTOR * radiusAt(v, curve) + crossing + ends
}

/** Punkt der Mittellinie (auf Schnitthöhe) in Weltkoordinaten. */
export function centerAt(u: number, curve = pretzelCurve()): Vec3 {
  const p = planAt(curve, u)
  return [p.x, sliceHeightAt(u, curve), -p.y]
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}
function dot(a: Vec3, b: Vec3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
function normalize(a: Vec3): Vec3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

export interface Frame {
  center: Vec3
  /** Richtung des Strangs. */
  tangent: Vec3
  /** Waagerecht quer zum Strang. */
  side: Vec3
  /** Senkrecht zum Strang, nach oben. */
  up: Vec3
  radius: number
}

export function frameAt(u: number, curve = pretzelCurve()): Frame {
  const du = 0.002
  const a = centerAt(Math.max(0, u - du), curve)
  const b = centerAt(Math.min(1, u + du), curve)
  const tangent = normalize(sub(b, a))
  const side = normalize(cross(tangent, [0, 1, 0]))
  const up = normalize(cross(side, tangent))
  return {
    center: centerAt(u, curve),
    tangent,
    side,
    up,
    radius: radiusAt(u, curve),
  }
}

function along(f: Frame, a: number, b: number): Vec3 {
  return [
    f.center[0] + f.side[0] * a + f.up[0] * b,
    f.center[1] + f.side[1] * a + f.up[1] * b,
    f.center[2] + f.side[2] * a + f.up[2] * b,
  ]
}

// ---------------------------------------------------------------------------
// Teile

export interface PartSpan {
  /** 0-basierter Index des Teils. */
  part: number
  /** Anfang und Ende auf der Mittellinie (u, 0…1). */
  start: number
  end: number
}

/**
 * Teilt den Strang in `parts` Teile mit kleiner Fuge. Für 3 Teile wie die
 * 2D-Vorschau: 1 = linke Schlaufe (Bauchmitte bis kurz vor die Kreuzung),
 * 2 = rechte Schlaufe (kurz nach der Kreuzung bis Bauchmitte), 3 = die beiden
 * Arme (zwei Stücke). Andere Teilezahlen: gleich lange Abschnitte.
 * Ergebnis nach `start` sortiert.
 */
export function partSpans(parts: number, curve = pretzelCurve()): PartSpan[] {
  const n = Math.max(1, Math.floor(parts))
  const g = PART_GAP / curve.length
  if (n === 3) {
    const shift = 0.3 / curve.length
    const cutA = curve.keyU[IDX_CROSSING_A] + shift
    const cutBelly = curve.keyU[IDX_BELLY]
    const cutB = curve.keyU[IDX_CROSSING_B] - shift
    return [
      { part: 2, start: 0, end: cutA - g },
      { part: 1, start: cutA + g, end: cutBelly - g },
      { part: 0, start: cutBelly + g, end: cutB - g },
      { part: 2, start: cutB + g, end: 1 },
    ]
  }
  return Array.from({ length: n }, (_, i) => ({
    part: i,
    start: i === 0 ? 0 : i / n + g,
    end: i === n - 1 ? 1 : (i + 1) / n - g,
  }))
}

// ---------------------------------------------------------------------------
// Netze

/** Materialgruppen eines Teil-Netzes. */
export const MATERIAL_CRUST = 0
export const MATERIAL_CRUMB = 1
export const MATERIAL_FILLING = 2

export interface MeshGroup {
  start: number
  count: number
  materialIndex: number
}

export interface MeshData {
  positions: Float32Array
  normals: Float32Array
  /** 0 = helle Unterseite … 1 = dunkle Laugenkruste oben (nur für die Kruste). */
  shade: Float32Array
  /** 0…1: Anteil des hellen Ausbunds (nur für die Kruste). */
  ausbund: Float32Array
  indices: Uint32Array
  groups: MeshGroup[]
}

interface ProfilePoint {
  a: number
  b: number
  na: number
  nb: number
  shade: number
  /** Winkel im Querschnitt, nur auf der Kruste des Oberteils. */
  topTheta?: number
}

interface Layer {
  /** Offene Linienzüge, die entlang des Strangs gezogen werden. */
  strips: { points: ProfilePoint[]; material: number }[]
  /** Geschlossener Umriss für die Schnittflächen an den Enden. */
  outline: [number, number][]
  capMaterial: number
}

const ARC_STEPS = 20
const FILLING_STEPS = 28

function ellipseArc(
  A: number,
  B: number,
  offset: number,
  from: number,
  to: number,
  shade: (theta: number) => number
): ProfilePoint[] {
  const pts: ProfilePoint[] = []
  for (let k = 0; k <= ARC_STEPS; k += 1) {
    const th = from + ((to - from) * k) / ARC_STEPS
    const c = Math.cos(th)
    const s = Math.sin(th)
    const nl = Math.hypot(B * c, A * s) || 1
    pts.push({
      a: A * c,
      b: offset + B * s,
      na: (B * c) / nl,
      nb: (A * s) / nl,
      shade: shade(th),
      topTheta: offset > 0 ? th : undefined,
    })
  }
  return pts
}

function flat(
  A: number,
  b: number,
  nb: number,
  fromLeft: boolean
): ProfilePoint[] {
  const xs = fromLeft ? [-A, A] : [A, -A]
  return xs.map((a) => ({ a, b, na: 0, nb, shade: 0 }))
}

/** Unterteil, Füllung und Oberteil im Querschnitt bei Radius r. */
function layers(r: number, capMaterial: number): Layer[] {
  const A = WIDTH_FACTOR * r
  const B = HEIGHT_FACTOR * r
  const lift = FILLING_THICKNESS
  const bottomArc = ellipseArc(
    A,
    B,
    0,
    Math.PI,
    2 * Math.PI,
    (th) => 0.3 * (1 + Math.sin(th))
  )
  const topArc = ellipseArc(
    A,
    B,
    lift,
    0,
    Math.PI,
    (th) => 0.35 + 0.65 * Math.sin(th)
  )
  // Füllung: abgerundetes Rechteck (Superellipse), steht seitlich über.
  const FA = FILLING_OVERHANG * A
  const FB = lift / 2
  const filling: ProfilePoint[] = []
  for (let k = 0; k <= FILLING_STEPS; k += 1) {
    const th = (2 * Math.PI * k) / FILLING_STEPS
    const c = Math.cos(th)
    const s = Math.sin(th)
    const a = FA * Math.sign(c) * Math.sqrt(Math.abs(c))
    const b = FB + FB * Math.sign(s) * Math.sqrt(Math.abs(s))
    const ga = (a * a * a) / FA ** 4
    const gb = ((b - FB) * (b - FB) * (b - FB)) / FB ** 4
    const nl = Math.hypot(ga, gb) || 1
    filling.push({ a, b, na: ga / nl, nb: gb / nl, shade: 0 })
  }
  return [
    {
      strips: [
        { points: bottomArc, material: MATERIAL_CRUST },
        { points: flat(A, 0, 1, false), material: MATERIAL_CRUMB },
      ],
      outline: bottomArc.map((p) => [p.a, p.b] as [number, number]),
      capMaterial,
    },
    {
      strips: [{ points: filling, material: MATERIAL_FILLING }],
      outline: filling.slice(0, -1).map((p) => [p.a, p.b] as [number, number]),
      capMaterial: MATERIAL_FILLING,
    },
    {
      strips: [
        { points: topArc, material: MATERIAL_CRUST },
        { points: flat(A, lift, -1, true), material: MATERIAL_CRUMB },
      ],
      outline: topArc.map((p) => [p.a, p.b] as [number, number]),
      capMaterial,
    },
  ]
}

class MeshBuilder {
  positions: number[] = []
  normals: number[] = []
  shade: number[] = []
  ausbund: number[] = []
  tris: number[][] = [[], [], []]

  vertex(p: Vec3, n: Vec3, shade: number, ausbund = 0) {
    this.positions.push(p[0], p[1], p[2])
    this.normals.push(n[0], n[1], n[2])
    this.shade.push(shade)
    this.ausbund.push(ausbund)
    return this.positions.length / 3 - 1
  }

  /** Dreieck so gewendet, dass es nach außen zeigt (wie seine Normalen). */
  triangle(material: number, i0: number, i1: number, i2: number) {
    const P = this.positions
    const N = this.normals
    const p = (i: number): Vec3 => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]
    const face = cross(sub(p(i1), p(i0)), sub(p(i2), p(i0)))
    const n: Vec3 = [
      N[i0 * 3] + N[i1 * 3] + N[i2 * 3],
      N[i0 * 3 + 1] + N[i1 * 3 + 1] + N[i2 * 3 + 1],
      N[i0 * 3 + 2] + N[i1 * 3 + 2] + N[i2 * 3 + 2],
    ]
    if (dot(face, n) < 0) this.tris[material].push(i0, i2, i1)
    else this.tris[material].push(i0, i1, i2)
  }

  build(): MeshData {
    const indices: number[] = []
    const groups: MeshGroup[] = []
    this.tris.forEach((list, materialIndex) => {
      if (list.length === 0) return
      groups.push({ start: indices.length, count: list.length, materialIndex })
      for (const i of list) indices.push(i)
    })
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      shade: new Float32Array(this.shade),
      ausbund: new Float32Array(this.ausbund),
      indices: new Uint32Array(indices),
      groups,
    }
  }
}

function frameNormal(f: Frame, na: number, nb: number): Vec3 {
  return normalize([
    f.side[0] * na + f.up[0] * nb,
    f.side[1] * na + f.up[1] * nb,
    f.side[2] * na + f.up[2] * nb,
  ])
}

/** Zieht Unterteil, Füllung und Oberteil zwischen start und end entlang des Strangs. */
function sweepSpan(
  builder: MeshBuilder,
  start: number,
  end: number,
  curve: PretzelCurve
) {
  const steps = Math.max(4, Math.ceil(((end - start) * curve.length) / 0.03))
  const frames: Frame[] = []
  const us: number[] = []
  for (let i = 0; i <= steps; i += 1) {
    us.push(start + ((end - start) * i) / steps)
    frames.push(frameAt(us[i], curve))
  }
  const profiles = frames.map((f) => layers(f.radius, MATERIAL_CRUMB))
  const layerCount = profiles[0].length

  for (let l = 0; l < layerCount; l += 1) {
    profiles[0][l].strips.forEach((strip, s) => {
      const width = strip.points.length
      const base = builder.positions.length / 3
      frames.forEach((f, i) => {
        const arc = us[i] * curve.length
        for (const p of profiles[i][l].strips[s].points) {
          // leicht fleckige Kruste statt glatter Farbe
          const mottle =
            p.topTheta === undefined
              ? 0
              : 0.07 * Math.sin(arc * 21 + p.topTheta * 5) * Math.sin(arc * 6.3)
          builder.vertex(
            along(f, p.a, p.b),
            frameNormal(f, p.na, p.nb),
            Math.min(1, Math.max(0, p.shade + mottle)),
            p.topTheta === undefined ? 0 : ausbundAt(us[i], p.topTheta, curve)
          )
        }
      })
      for (let i = 0; i < steps; i += 1) {
        for (let k = 0; k < width - 1; k += 1) {
          const a = base + i * width + k
          const b = a + 1
          const c = a + width
          const d = c + 1
          builder.triangle(strip.material, a, c, b)
          builder.triangle(strip.material, b, c, d)
        }
      }
    })
    // Schnittflächen: Krume bzw. Füllung; an den echten Strangenden Kruste.
    for (const [f, layer, sign, isEnd] of [
      [frames[0], profiles[0][l], -1, start <= 0],
      [frames[steps], profiles[steps][l], 1, end >= 1],
    ] as [Frame, Layer, number, boolean][]) {
      const material =
        isEnd && layer.capMaterial === MATERIAL_CRUMB
          ? MATERIAL_CRUST
          : layer.capMaterial
      const n: Vec3 = [
        f.tangent[0] * sign,
        f.tangent[1] * sign,
        f.tangent[2] * sign,
      ]
      const ca =
        layer.outline.reduce((s, [a]) => s + a, 0) / layer.outline.length
      const cb =
        layer.outline.reduce((s, [, b]) => s + b, 0) / layer.outline.length
      const shade = material === MATERIAL_CRUST ? 0.5 : 0
      const center = builder.vertex(along(f, ca, cb), n, shade)
      const ring = layer.outline.map(([a, b]) =>
        builder.vertex(along(f, a, b), n, shade)
      )
      for (let k = 0; k < ring.length; k += 1)
        builder.triangle(material, center, ring[k], ring[(k + 1) % ring.length])
    }
  }
}

const meshCache = new Map<number, MeshData[]>()

/** Je Teil ein Netz (alle Stücke des Teils zusammen), unskaliert. */
export function partMeshes(parts: number): MeshData[] {
  const cached = meshCache.get(parts)
  if (cached) return cached
  const curve = pretzelCurve()
  const spans = partSpans(parts, curve)
  const count = Math.max(1, Math.floor(parts))
  const meshes = Array.from({ length: count }, (_, part) => {
    const builder = new MeshBuilder()
    for (const span of spans.filter((s) => s.part === part))
      sweepSpan(builder, span.start, span.end, curve)
    return builder.build()
  })
  meshCache.set(parts, meshes)
  return meshes
}

// ---------------------------------------------------------------------------
// Salz

export interface SaltCrystal {
  position: Vec3
  rotation: Vec3
  size: number
}

/** Kleiner, deterministischer Zufall (gleiche Brezel bei jedem Aufruf). */
function random(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** Grobe Salzkörner auf den Oberteilen, nicht in den Fugen. */
export function saltCrystals(
  parts: number,
  count = 56,
  seed = 7
): SaltCrystal[] {
  const curve = pretzelCurve()
  const spans = partSpans(parts, curve)
  const margin = 0.05 / curve.length
  const usable = spans
    .map((s) => ({ start: s.start + margin, end: s.end - margin }))
    .filter((s) => s.end > s.start)
  const total = usable.reduce((sum, s) => sum + (s.end - s.start), 0)
  const rnd = random(seed)
  const crystals: SaltCrystal[] = []
  for (let i = 0; i < count; i += 1) {
    let pick = rnd() * total
    let u = usable[usable.length - 1].end
    for (const s of usable) {
      const len = s.end - s.start
      if (pick <= len) {
        u = s.start + pick
        break
      }
      pick -= len
    }
    const f = frameAt(u, curve)
    const th = Math.PI * (0.22 + 0.56 * rnd())
    const A = WIDTH_FACTOR * f.radius
    const B = HEIGHT_FACTOR * f.radius
    const size = 0.016 + 0.014 * rnd()
    const n = frameNormal(f, B * Math.cos(th), A * Math.sin(th))
    const p = along(f, A * Math.cos(th), FILLING_THICKNESS + B * Math.sin(th))
    crystals.push({
      position: [
        p[0] + n[0] * size * 0.3,
        p[1] + n[1] * size * 0.3,
        p[2] + n[2] * size * 0.3,
      ],
      rotation: [rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI],
      size,
    })
  }
  return crystals
}

// ---------------------------------------------------------------------------
// Beschreibung für die Komponente

export interface Pretzel3DPart {
  /** 1-basiert, wie die Nummern der 2D-Vorschau. */
  number: number
  toppingId: string | null
  /** Belag oder "noch offen". */
  text: string
  color: string
  spans: PartSpan[]
  /** Ort der Nummer: über dem Teil (bei mehreren Stücken in deren Mitte), unskaliert. */
  anchor: Vec3
}

export interface Pretzel3DDescription {
  /** Längen-Skalierung gegenüber der größten Größe (aus gramsPerPart). */
  scale: number
  parts: Pretzel3DPart[]
  /** Grundriss-Ausdehnung (unskaliert), z. B. für den Schatten. */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  ariaLabel: string
}

/**
 * Längen-Skalierung einer Größe: das Gewicht wächst mit dem Volumen, die
 * Länge also mit der Kubikwurzel. Die größte Größe der Config hat 1.
 */
export function sizeScale(size: SizeConfig, config: PartybrezelConfig): number {
  const largest = Math.max(...config.sizes.map((s) => s.gramsPerPart))
  if (!(largest > 0) || !(size.gramsPerPart > 0)) return 1
  return Math.cbrt(size.gramsPerPart / largest)
}

function anchorFor(spans: PartSpan[], curve: PretzelCurve): Vec3 {
  const sum: Vec3 = [0, 0, 0]
  for (const s of spans) {
    const f = frameAt((s.start + s.end) / 2, curve)
    const top = along(f, 0, FILLING_THICKNESS + HEIGHT_FACTOR * f.radius)
    sum[0] += top[0]
    sum[1] += top[1] + 0.14
    sum[2] += top[2]
  }
  const k = spans.length || 1
  return [sum[0] / k, sum[1] / k, sum[2] / k]
}

export function describePretzel3D(input: {
  parts: (ToppingConfig | undefined)[]
  size: SizeConfig
  config: PartybrezelConfig
  label: string
}): Pretzel3DDescription {
  const { parts, size, config, label } = input
  const curve = pretzelCurve()
  const spans = partSpans(parts.length, curve)
  const described = parts.map((t, i) => {
    const own = spans.filter((s) => s.part === i)
    return {
      number: i + 1,
      toppingId: t?.id ?? null,
      text: t ? t.label : 'noch offen',
      color: t?.color ?? UNSET_COLOR,
      spans: own,
      anchor: anchorFor(own, curve),
    }
  })
  const xs = curve.plan.map((p) => p.x)
  const zs = curve.plan.map((p) => -p.y)
  const pad = BELLY_RADIUS * WIDTH_FACTOR * FILLING_OVERHANG
  return {
    scale: sizeScale(size, config),
    parts: described,
    bounds: {
      minX: Math.min(...xs) - pad,
      maxX: Math.max(...xs) + pad,
      minZ: Math.min(...zs) - pad,
      maxZ: Math.max(...zs) + pad,
    },
    ariaLabel: `3D-Ansicht von ${label}, ${size.partsPerPretzel} Teile je ${
      size.gramsPerPart
    } g – ${described.map((p) => `Teil ${p.number}: ${p.text}`).join(', ')}`,
  }
}
