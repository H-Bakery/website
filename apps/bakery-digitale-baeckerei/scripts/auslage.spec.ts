import {
  LUECKE_M,
  auslage,
  befundText,
  gewendet,
  ordne,
  startwert,
  stueckMasse,
} from './auslage'

// Erfundene Plätze und Stücke.
type Art = 'reihen' | 'korb' | 'haken'
const platz = (
  b: number,
  t: number,
  h: number,
  art: Art = 'reihen',
  mehr: Record<string, unknown> = {}
) => ({
  o: [10, 245, -3] as [number, number, number],
  r: [1, 0, 0] as [number, number, number],
  n: [0, 1, 0] as [number, number, number],
  f: [0, 0, 1] as [number, number, number],
  b,
  t,
  h,
  art,
  neigung: 0,
  ...mehr,
})
const bbox = (w: number, d: number, h: number) => ({
  min: [-w / 2, 0, -d / 2],
  max: [w / 2, h, d / 2],
})
/** Ort eines Stücks (Ursprung seines Modells) aus der Matrix. */
const ort = (m: number[]) => [m[12], m[13], m[14]]

describe('stueckMasse', () => {
  it('Breite, Tiefe, Höhe und der Fußpunkt - auch wenn das Modell nicht mittig steht', () => {
    expect(
      stueckMasse({ min: [-0.1, 0.01, -0.02], max: [0.3, 0.11, 0.08] })
    ).toEqual({
      w: expect.closeTo(0.4, 9),
      d: expect.closeTo(0.1, 9),
      h: expect.closeTo(0.1, 9),
      fuss: [
        expect.closeTo(0.1, 9),
        expect.closeTo(0.01, 9),
        expect.closeTo(0.03, 9),
      ],
    })
  })
})

describe('ordne: Reihen', () => {
  const stueck = { w: 0.1, d: 0.1, h: 0.05 }

  it('füllt von vorn, je Reihe gleichmäßig über die Breite verteilt', () => {
    // 0,34 breit: drei nebeneinander; 0,22 tief: zwei Reihen.
    const plan = ordne(platz(0.34, 0.22, 0.2), stueck, 4)
    expect(plan.gelegt).toBe(4)
    expect(plan.befund).toBe('passt')
    // zwei Reihen zu je zwei
    const reihen = new Map<number, number[]>()
    for (const l of plan.lagen) {
      const v = Math.round(l.v * 1000)
      reihen.set(v, [...(reihen.get(v) ?? []), l.u])
    }
    expect([...reihen.values()].map((r) => r.length)).toEqual([2, 2])
    // vorn zuerst: v zählt nach hinten, die erste Reihe liegt bei −T/2 + …
    expect(plan.lagen[0].v).toBeLessThan(plan.lagen[3].v)
    // symmetrisch um die Mitte
    expect(plan.lagen[0].u).toBeCloseTo(-plan.lagen[1].u, 9)
  })

  it('eine Reihe reicht: Die hintere bleibt leer', () => {
    const plan = ordne(platz(0.34, 0.22, 0.2), stueck, 3)
    expect(new Set(plan.lagen.map((l) => l.v)).size).toBe(1)
    expect(plan.lagen.map((l) => l.u)).toEqual([
      expect.closeTo(-0.34 / 3, 9),
      expect.closeTo(0, 9),
      expect.closeTo(0.34 / 3, 9),
    ])
  })

  it('passt nicht alles, liegen so viele wie passen', () => {
    const plan = ordne(platz(0.34, 0.22, 0.2), stueck, 10)
    expect(plan.gelegt).toBe(6)
    expect(plan.lagen).toHaveLength(6)
    expect(plan.befund).toBe('weniger')
  })

  it('dreht das Stück, wenn es nur längs passt (Baguettes im schmalen Fach)', () => {
    // 0,24 breit, 0,37 tief; das Stück ist 0,30 lang und 0,06 breit.
    const plan = ordne(platz(0.24, 0.37, 0.2), { w: 0.3, d: 0.06, h: 0.05 }, 3)
    expect(plan.gelegt).toBe(3)
    expect(plan.lagen.every((l) => l.gedreht)).toBe(true)
    expect(new Set(plan.lagen.map((l) => l.v)).size).toBe(1)
  })

  it('bleibt ungedreht, wenn beides gleich viel Platz bietet', () => {
    const plan = ordne(platz(0.3, 0.3, 0.2), { w: 0.14, d: 0.1, h: 0.05 }, 2)
    expect(plan.lagen.every((l) => !l.gedreht)).toBe(true)
  })

  it('ein einzelnes Stück darf 2 cm überstehen - mehr nicht', () => {
    expect(
      ordne(platz(0.2, 0.2, 0.2), { w: 0.215, d: 0.1, h: 0.05 }, 1)
    ).toEqual(expect.objectContaining({ gelegt: 1, befund: 'passt' }))
    expect(
      ordne(platz(0.2, 0.2, 0.2), { w: 0.23, d: 0.23, h: 0.05 }, 1)
    ).toEqual(expect.objectContaining({ gelegt: 0, befund: 'zu-gross' }))
    // Auch von mehreren liegt dann eines - und der Befund sagt es.
    expect(
      ordne(platz(0.2, 0.2, 0.2), { w: 0.215, d: 0.1, h: 0.05 }, 3)
    ).toEqual(expect.objectContaining({ gelegt: 1, befund: 'weniger' }))
  })

  it('zu hoch für die lichte Höhe: nichts liegt', () => {
    expect(ordne(platz(0.3, 0.3, 0.1), { w: 0.1, d: 0.1, h: 0.12 }, 1)).toEqual(
      expect.objectContaining({ gelegt: 0, befund: 'zu-hoch' })
    )
    // 1 cm Spiel
    expect(
      ordne(platz(0.3, 0.3, 0.1), { w: 0.1, d: 0.1, h: 0.105 }, 1).gelegt
    ).toBe(1)
  })

  it('nichts verlangt: nichts gelegt', () => {
    expect(ordne(platz(0.3, 0.3, 0.1), stueck, 0).gelegt).toBe(0)
  })

  it('in Reihen wird nicht gestapelt', () => {
    const plan = ordne(platz(0.34, 0.22, 0.5), stueck, 20)
    expect(plan.gelegt).toBe(6)
    expect(plan.lagen.every((l) => l.basis === 0)).toBe(true)
  })
})

describe('ordne: Korb', () => {
  const weck = { w: 0.08, d: 0.07, h: 0.05 }

  it('häuft: auf die volle untere Lage kommen bis zu zwei weitere in den Mulden', () => {
    const korb = platz(0.47, 0.3, 0.15, 'korb')
    const plan = ordne(korb, weck, 100)
    const jeLage = new Map<number, number>()
    for (const l of plan.lagen) {
      const k = Math.round(l.basis * 1000)
      jeLage.set(k, (jeLage.get(k) ?? 0) + 1)
    }
    const lagen = [...jeLage.entries()].sort((a, b) => a[0] - b[0])
    expect(lagen).toHaveLength(3)
    // Jede Lage ist in beiden Richtungen um eins kleiner.
    const [unten, mitte, oben] = lagen.map(([, n]) => n)
    expect(unten).toBeGreaterThan(mitte)
    expect(mitte).toBeGreaterThan(oben)
    expect(lagen[1][0]).toBeCloseTo(0.55 * 0.05 * 1000, 0)
    expect(plan.befund).toBe('weniger')
  })

  it('ein niedriger Korb bekommt keine zweite Lage', () => {
    const plan = ordne(platz(0.47, 0.3, 0.06, 'korb'), weck, 100)
    expect(plan.lagen.every((l) => l.basis === 0)).toBe(true)
  })

  it('die obere Lage kommt erst, wenn die untere voll ist', () => {
    const plan = ordne(platz(0.47, 0.3, 0.15, 'korb'), weck, 5)
    expect(plan.gelegt).toBe(5)
    expect(plan.lagen.every((l) => l.basis === 0)).toBe(true)
  })
})

describe('auslage: Lagen im Raum', () => {
  const brot = bbox(0.2, 0.1, 0.075)

  it('je Stück eine Matrix; die Stücke stehen auf der Standfläche, im Platz', () => {
    const p = platz(0.5, 0.3, 0.2)
    const a = auslage('regal/platz-01', p, brot, 4)
    expect(a.gelegt).toBe(4)
    expect(a.befund).toBe('passt')
    expect(a.matrizen).toHaveLength(4)
    for (const m of a.matrizen) {
      expect(m).toHaveLength(16)
      const [x, y, z] = ort(m)
      expect(y).toBeCloseTo(245, 9)
      expect(Math.abs(x - 10)).toBeLessThan(0.25)
      expect(Math.abs(z + 3)).toBeLessThan(0.15)
      // ungedreht bis auf wenige Grad, Maßstab 1
      expect(Math.hypot(m[0], m[1], m[2])).toBeCloseTo(1, 9)
      expect(m[5]).toBeCloseTo(1, 9)
      expect(m[15]).toBe(1)
    }
  })

  it('von vorn: Die erste Reihe liegt an der Vorderkante (+vorn)', () => {
    const p = platz(0.25, 0.5, 0.2)
    const a = auslage('regal/platz-01', p, brot, 1)
    // ein einzelnes Stück auf flachem Boden liegt mittig
    expect(ort(a.matrizen[0])[2]).toBeCloseTo(-3, 1)
    const zwei = auslage('regal/platz-01', platz(0.45, 0.5, 0.2), brot, 2)
    // zwei nebeneinander in der vorderen Reihe: z > Mitte
    for (const m of zwei.matrizen) expect(ort(m)[2]).toBeGreaterThan(-3 + 0.1)
  })

  it('fest: derselbe Platz ergibt dieselben Lagen, ein anderer Name andere', () => {
    const p = platz(0.6, 0.3, 0.2)
    const a = auslage('regal/platz-01', p, brot, 2)
    expect(auslage('regal/platz-01', p, brot, 2)).toEqual(a)
    expect(auslage('regal/platz-02', p, brot, 2)).not.toEqual(a)
    expect(startwert('a')).not.toBe(startwert('b'))
  })

  it('die Abweichung bleibt im Feld: Kein Stück ragt über den Platz', () => {
    const p = platz(0.45, 0.12, 0.2)
    for (const slot of ['a/1', 'a/2', 'a/3', 'a/4', 'a/5', 'a/6']) {
      for (const m of auslage(slot, p, brot, 2).matrizen) {
        // Ecken der Grundfläche im Raum
        for (const [lx, lz] of [
          [-0.1, -0.05],
          [0.1, -0.05],
          [0.1, 0.05],
          [-0.1, 0.05],
        ]) {
          const x = m[12] + m[0] * lx + m[8] * lz
          const z = m[14] + m[2] * lx + m[10] * lz
          expect(Math.abs(x - 10)).toBeLessThanOrEqual(0.225 + 1e-9)
          expect(Math.abs(z + 3)).toBeLessThanOrEqual(0.06 + 1e-9)
        }
      }
    }
  })

  it('zwischen zwei Stücken bleibt die Lücke', () => {
    const p = platz(0.2 * 2 + LUECKE_M, 0.1, 0.2)
    const a = auslage('regal/platz-01', p, brot, 2)
    expect(a.gelegt).toBe(2)
    const abstand = Math.abs(ort(a.matrizen[0])[0] - ort(a.matrizen[1])[0])
    // Die kleine Abweichung je Stück nimmt höchstens einen Teil der Lücke.
    expect(abstand).toBeGreaterThan(0.2 + LUECKE_M / 4)
  })

  it('auf geneigtem Boden rutscht ein einzelnes Stück nach vorn an die Leiste', () => {
    const t = (25 * Math.PI) / 180
    const geneigt = platz(0.24, 0.37, 0.2, 'reihen', {
      n: [0, Math.cos(t), Math.sin(t)],
      f: [0, -Math.sin(t), Math.cos(t)],
      neigung: 25,
    })
    const a = auslage('brotregal/ebene-1/platz-01', geneigt, brot, 1)
    const [x, y, z] = ort(a.matrizen[0])
    // vorn = tiefer und weiter in +z
    expect(x).toBeCloseTo(10, 9)
    expect(y).toBeLessThan(245)
    expect(z).toBeGreaterThan(-3)
    // Vorderkante des Stücks 4 mm hinter der Vorderkante des Platzes
    const entlangF = (y - 245) * -Math.sin(t) + (z + 3) * Math.cos(t)
    expect(entlangF).toBeCloseTo(0.37 / 2 - 0.004 - 0.05, 6)
    // „oben“ des Stücks ist die Normale des Bodens
    expect([a.matrizen[0][4], a.matrizen[0][5], a.matrizen[0][6]]).toEqual([
      expect.closeTo(0, 9),
      expect.closeTo(Math.cos(t), 9),
      expect.closeTo(Math.sin(t), 9),
    ])
  })

  it('gedreht liegt die lange Seite nach hinten', () => {
    const a = auslage(
      'brotregal/ebene-3/platz-01',
      platz(0.24, 0.37, 0.2),
      bbox(0.3, 0.06, 0.05),
      3
    )
    expect(a.gelegt).toBe(3)
    for (const m of a.matrizen) {
      // die x-Achse des Stücks zeigt (fast) längs „vorn“
      expect(Math.abs(m[2])).toBeGreaterThan(0.99)
    }
  })

  it('ein Modell, das nicht mittig steht, wird über seinen Fußpunkt gesetzt', () => {
    const schief = { min: [0, 0.02, 0], max: [0.2, 0.1, 0.1] }
    const a = auslage('regal/platz-01', platz(0.21, 0.11, 0.2), schief, 1)
    const m = a.matrizen[0]
    // Mitte der Grundfläche des Modells im Raum = Mitte des Platzes
    const mitte = [
      m[12] + m[0] * 0.1 + m[4] * 0.02 + m[8] * 0.05,
      m[13] + m[1] * 0.1 + m[5] * 0.02 + m[9] * 0.05,
      m[14] + m[2] * 0.1 + m[6] * 0.02 + m[10] * 0.05,
    ]
    expect(mitte[0]).toBeCloseTo(10, 2)
    expect(mitte[1]).toBeCloseTo(245, 9)
    expect(mitte[2]).toBeCloseTo(-3, 2)
  })

  it('im Korb dürfen die Stücke bis 10 % kleiner sein, sonst nie', () => {
    const korb = auslage(
      'koerbe/korb-1/platz-01',
      platz(0.47, 0.3, 0.15, 'korb'),
      bbox(0.08, 0.07, 0.05),
      30
    )
    for (const m of korb.matrizen) {
      const s = Math.hypot(m[0], m[1], m[2])
      expect(s).toBeGreaterThanOrEqual(0.9 - 1e-9)
      expect(s).toBeLessThanOrEqual(1 + 1e-9)
    }
    // die oberen Lagen liegen höher
    expect(Math.max(...korb.matrizen.map((m) => m[13]))).toBeGreaterThan(245.02)
  })

  it('passt nichts, liegt nichts - mit Befund', () => {
    expect(auslage('a/b', platz(0.1, 0.1, 0.2), brot, 2)).toEqual({
      matrizen: [],
      gelegt: 0,
      befund: 'zu-gross',
    })
  })
})

describe('auslage: Haken', () => {
  const haken = platz(0.15, 0.13, 0.04, 'haken', {
    r: [1, 0, 0],
    n: [0, 0, 1],
    f: [0, -1, 0],
  })
  const brezel = bbox(0.14, 0.1, 0.03)

  it('ein Stück hängt: quer, die Dicke längs des Arms, nach unten', () => {
    const a = auslage('theke/brezelstaender/platz-01', haken, brezel, 1)
    expect(a.gelegt).toBe(1)
    expect(a.befund).toBe('passt')
    const m = a.matrizen[0]
    expect(m.slice(0, 3)).toEqual([1, 0, 0])
    expect(m.slice(4, 7)).toEqual([0, 0, 1])
    expect(m.slice(8, 11)).toEqual([0, -1, 0])
    // Oberkante des Stücks (kleinstes z) am Ort, die Dicke mittig am Arm
    expect(m[12]).toBeCloseTo(10, 9)
    expect(m[13] + m[9] * -0.05).toBeCloseTo(245, 9)
    expect(m[14] + m[6] * 0.015).toBeCloseTo(-3, 9)
  })

  it('an einem Haken hängt ein Stück, auch wenn mehr verlangt sind', () => {
    const a = auslage('theke/brezelstaender/platz-01', haken, brezel, 3)
    expect(a.gelegt).toBe(1)
    expect(a.befund).toBe('haken')
  })

  it('ein Brot hängt nicht am Haken', () => {
    expect(
      auslage('theke/brezelstaender/platz-01', haken, bbox(0.3, 0.14, 0.1), 1)
    ).toEqual({ matrizen: [], gelegt: 0, befund: 'zu-gross' })
  })
})

describe('gewendet', () => {
  it('tauscht vorn und rechts, oben bleibt - Maße und Ort auch', () => {
    const p = platz(0.3, 0.2, 0.1)
    const g = gewendet(p)
    expect(g.f).toEqual([-0, -0, -1])
    expect(g.r).toEqual([-1, -0, -0])
    expect(g.n).toBe(p.n)
    expect(g.o).toBe(p.o)
    expect([g.b, g.t, g.h]).toEqual([0.3, 0.2, 0.1])
    // Die vordere Reihe liegt jetzt auf der anderen Seite.
    const brot = bbox(0.1, 0.05, 0.05)
    const vorher = auslage('a/b', platz(0.25, 0.4, 0.1), brot, 2)
    const nachher = auslage('a/b', gewendet(platz(0.25, 0.4, 0.1)), brot, 2)
    expect(ort(vorher.matrizen[0])[2]).toBeGreaterThan(-3)
    expect(ort(nachher.matrizen[0])[2]).toBeLessThan(-3)
  })
})

describe('befundText', () => {
  it('sagt, warum weniger liegen - und nichts, wenn alles passt', () => {
    expect(befundText('passt', 3, 3)).toBe('')
    expect(befundText('weniger', 2, 5)).toBe('nur 2 von 5 passen')
    expect(befundText('zu-gross', 0, 1)).toBe('zu groß für den Platz')
    expect(befundText('zu-hoch', 0, 1)).toBe('zu hoch für den Platz')
    expect(befundText('haken', 1, 3)).toMatch(/ein Stück/)
  })
})
