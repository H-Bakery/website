import { partybrezelConfig as config } from '../config/partybrezel.config'
import { findTopping, getSize } from './configLookup'
import { createOrderReducer, initialOrderState } from './orderState'
import {
  ARM_RADIUS,
  BELLY_RADIUS,
  ausbundAt,
  MATERIAL_CRUMB,
  MATERIAL_CRUST,
  MATERIAL_FILLING,
  UNSET_COLOR,
  centerAt,
  describePretzel3D,
  partMeshes,
  partSpans,
  pretzelCurve,
  radiusAt,
  saltCrystals,
  sizeScale,
  sliceHeightAt,
} from './pretzel3d'

const gross = getSize(config, 'gross')
const klein = getSize(config, 'klein')

function partsOf(toppings: (string | null)[]) {
  return toppings.map((id) => findTopping(config, id))
}

describe('pretzelCurve', () => {
  it('ist normiert, monoton und ohne NaN', () => {
    const c = pretzelCurve()
    expect(c.u[0]).toBe(0)
    expect(c.u[c.u.length - 1]).toBeCloseTo(1, 10)
    for (let i = 1; i < c.u.length; i += 1)
      expect(c.u[i]).toBeGreaterThanOrEqual(c.u[i - 1])
    expect(c.length).toBeGreaterThan(4)
    for (let i = 0; i <= 200; i += 1) {
      const p = centerAt(i / 200)
      expect(p.every(Number.isFinite)).toBe(true)
    }
  })

  it('hat einen dicken Bauch und dünnere Arme', () => {
    const c = pretzelCurve()
    const belly = c.keyU[9]
    expect(radiusAt(belly)).toBeCloseTo(BELLY_RADIUS, 5)
    expect(radiusAt(c.keyU[2])).toBeCloseTo(ARM_RADIUS, 5)
    expect(radiusAt(belly)).toBeGreaterThan(1.6 * radiusAt(c.keyU[3]))
    // Enden verjüngt, aber nie null
    expect(radiusAt(0)).toBeLessThan(ARM_RADIUS)
    expect(radiusAt(0)).toBeGreaterThan(0)
  })

  it('zeigt den hellen Ausbund nur auf dem Bauch', () => {
    const c = pretzelCurve()
    const band = (u: number) =>
      Math.max(
        ...Array.from({ length: 61 }, (_, k) =>
          ausbundAt(u, (Math.PI * k) / 60)
        )
      )
    expect(band(c.keyU[9])).toBeGreaterThan(0.5)
    expect(band(c.keyU[2])).toBe(0)
    expect(band(c.keyU[4])).toBe(0)
  })

  it('führt Strang A an der Kreuzung über Strang B', () => {
    const c = pretzelCurve()
    const a = centerAt(c.keyU[2])
    const b = centerAt(c.keyU[16])
    // gleicher Ort im Grundriss ...
    expect(a[0]).toBeCloseTo(b[0], 5)
    expect(a[2]).toBeCloseTo(b[2], 5)
    // ... aber A liegt oben, Unterkante von A über Oberkante von B
    expect(sliceHeightAt(c.keyU[2]) - 0.78 * ARM_RADIUS).toBeGreaterThan(
      sliceHeightAt(c.keyU[16]) + 0.05 + 0.78 * ARM_RADIUS
    )
  })
})

describe('partSpans', () => {
  it.each([1, 2, 3, 4, 5])(
    'teilt in %i Teile, lückenlos bis auf kleine Fugen',
    (n) => {
      const spans = partSpans(n)
      expect(new Set(spans.map((s) => s.part)).size).toBe(n)
      expect(spans[0].start).toBe(0)
      expect(spans[spans.length - 1].end).toBe(1)
      for (const s of spans) expect(s.end).toBeGreaterThan(s.start)
      const gapU = (2 * 0.03) / pretzelCurve().length
      for (let i = 1; i < spans.length; i += 1) {
        const gap = spans[i].start - spans[i - 1].end
        expect(gap).toBeGreaterThan(0)
        expect(gap).toBeCloseTo(gapU, 6)
      }
    }
  )

  it('nummeriert 3 Teile wie die 2D-Vorschau: 1 links, 2 rechts, 3 die Arme', () => {
    const spans = partSpans(3)
    const mid = (part: number) =>
      spans
        .filter((s) => s.part === part)
        .map((s) => centerAt((s.start + s.end) / 2))
    const [left] = mid(0)
    const [right] = mid(1)
    expect(left[0]).toBeLessThan(-0.5)
    expect(right[0]).toBeGreaterThan(0.5)
    const arms = mid(2)
    expect(arms).toHaveLength(2)
    for (const a of arms) expect(Math.abs(a[0])).toBeLessThan(0.4)
  })
})

describe('partMeshes', () => {
  it('liefert je Teil ein gültiges Netz mit Kruste, Krume und Füllung', () => {
    const meshes = partMeshes(3)
    expect(meshes).toHaveLength(3)
    for (const m of meshes) {
      const vertices = m.positions.length / 3
      expect(m.normals.length).toBe(m.positions.length)
      expect(m.shade.length).toBe(vertices)
      expect(m.ausbund.length).toBe(vertices)
      expect(Array.from(m.positions).every(Number.isFinite)).toBe(true)
      expect(Array.from(m.normals).every(Number.isFinite)).toBe(true)
      expect(m.indices.length % 3).toBe(0)
      expect(Math.max(...Array.from(m.indices))).toBeLessThan(vertices)
      expect(m.groups.map((g) => g.materialIndex).sort()).toEqual([
        MATERIAL_CRUST,
        MATERIAL_CRUMB,
        MATERIAL_FILLING,
      ])
      const covered = m.groups.reduce((s, g) => s + g.count, 0)
      expect(covered).toBe(m.indices.length)
      // nichts unter dem Boden
      for (let i = 1; i < m.positions.length; i += 3)
        expect(m.positions[i]).toBeGreaterThan(-1e-3)
    }
  })

  it('wendet jedes Dreieck nach außen (Normale passt zur Fläche)', () => {
    for (const m of partMeshes(3)) {
      const P = m.positions
      const N = m.normals
      let wrong = 0
      for (let t = 0; t < m.indices.length; t += 3) {
        const [a, b, c] = [m.indices[t], m.indices[t + 1], m.indices[t + 2]]
        const e1 = [0, 1, 2].map((k) => P[b * 3 + k] - P[a * 3 + k])
        const e2 = [0, 1, 2].map((k) => P[c * 3 + k] - P[a * 3 + k])
        const face = [
          e1[1] * e2[2] - e1[2] * e2[1],
          e1[2] * e2[0] - e1[0] * e2[2],
          e1[0] * e2[1] - e1[1] * e2[0],
        ]
        const n = [0, 1, 2].map(
          (k) => N[a * 3 + k] + N[b * 3 + k] + N[c * 3 + k]
        )
        if (face[0] * n[0] + face[1] * n[1] + face[2] * n[2] < 0) wrong += 1
      }
      expect(wrong).toBe(0)
    }
  })

  it('rechnet jede Teilezahl nur einmal', () => {
    expect(partMeshes(3)).toBe(partMeshes(3))
  })
})

describe('saltCrystals', () => {
  it('liegen deterministisch oben auf dem Teig', () => {
    const a = saltCrystals(3)
    expect(a).toEqual(saltCrystals(3))
    expect(a.length).toBeGreaterThan(20)
    for (const s of a) {
      expect(s.position.every(Number.isFinite)).toBe(true)
      expect(s.position[1]).toBeGreaterThan(0.1)
      expect(s.size).toBeGreaterThan(0)
    }
  })
})

describe('describePretzel3D', () => {
  it('skaliert klein gegenüber groß nach dem Teiggewicht (Kubikwurzel)', () => {
    expect(sizeScale(gross, config)).toBe(1)
    expect(sizeScale(klein, config)).toBeCloseTo(
      Math.cbrt(klein.gramsPerPart / gross.gramsPerPart),
      10
    )
    expect(sizeScale(klein, config)).toBeLessThan(1)
  })

  it('folgt der Config, nicht festen Zahlen', () => {
    const custom = {
      ...config,
      sizes: config.sizes.map((s) =>
        s.id === 'klein'
          ? { ...s, gramsPerPart: 100 }
          : { ...s, gramsPerPart: 800 }
      ),
    }
    expect(sizeScale(custom.sizes[0], custom)).toBeCloseTo(0.5, 10)
  })

  it('färbt die Teile je Belag und nennt offene Teile', () => {
    const d = describePretzel3D({
      parts: partsOf(['kaese', null, 'salami']),
      size: gross,
      config,
      label: 'Brezel 1 (groß)',
    })
    expect(d.parts.map((p) => p.color)).toEqual([
      '#e9a23b',
      UNSET_COLOR,
      '#b8433f',
    ])
    expect(d.parts.map((p) => p.number)).toEqual([1, 2, 3])
    expect(d.parts[1].toppingId).toBeNull()
    expect(d.ariaLabel).toBe(
      '3D-Ansicht von Brezel 1 (groß), 3 Teile je 400 g – Teil 1: Käse, Teil 2: noch offen, Teil 3: Salami'
    )
    for (const p of d.parts) expect(p.anchor.every(Number.isFinite)).toBe(true)
    expect(d.bounds.maxX).toBeGreaterThan(d.bounds.minX)
  })

  it('zeigt im Modus je Brezel eine Farbe, je Teil gemischte Farben', () => {
    const reduce = createOrderReducer(config)
    let state = reduce(initialOrderState(config), {
      type: 'setCount',
      size: 'klein',
      count: 1,
    })
    state = reduce(state, { type: 'setMode', mode: 'per-pretzel' })
    const id = state.pretzels[0].id
    const uniform = reduce(state, {
      type: 'setPretzelTopping',
      pretzelId: id,
      toppingId: 'schinken',
    })
    const colorsOf = (toppings: (string | null)[]) =>
      describePretzel3D({
        parts: partsOf(toppings),
        size: klein,
        config,
        label: 'Brezel 1 (klein)',
      }).parts.map((p) => p.color)
    expect(new Set(colorsOf(uniform.pretzels[0].toppings))).toEqual(
      new Set(['#e07a8b'])
    )

    let mixed = reduce(state, { type: 'setMode', mode: 'per-part' })
    mixed = reduce(mixed, {
      type: 'setPartTopping',
      pretzelId: id,
      part: 0,
      toppingId: 'butter',
    })
    mixed = reduce(mixed, {
      type: 'setPartTopping',
      pretzelId: id,
      part: 1,
      toppingId: 'vegetarisch',
    })
    mixed = reduce(mixed, {
      type: 'setPartTopping',
      pretzelId: id,
      part: 2,
      toppingId: 'kaese',
    })
    expect(colorsOf(mixed.pretzels[0].toppings)).toEqual([
      '#f2d16b',
      '#4f9d69',
      '#e9a23b',
    ])
  })
})
