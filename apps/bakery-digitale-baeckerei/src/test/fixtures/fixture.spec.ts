import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  GENERATOR_PATH,
  GLB_PATH,
  SNAPSHOT_PATH,
  VARIANTE,
  WAISE,
  erwarteteEintraege,
  ladeFixture,
  leseGlb,
} from './fixture-info'

const KATEGORIEN = [
  'brot',
  'broetchen',
  'baguette',
  'teilchen',
  'snacks',
  'kuchen',
  'torten',
]
/** Nichts im Fixture darf nach einem Preis aussehen (DB8). */
const PREIS = /€|EUR|price|preis_eur/i
/** Die beiden Materialnamen des echten Modells, die die App ausblendet. */
const PREIS_MATERIALIEN = ['preiskarte', 'preisschrift']

/** Alle Zeichenketten eines JSON-Baums: Schlüssel und Werte. */
function zeichenketten(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach((v) => zeichenketten(v, out))
  else if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) {
      out.push(key)
      zeichenketten(v, out)
    }
  }
  return out
}

const { json, bin, snapshot, plaetze } = ladeFixture()
const materialName = (index: number): string => json.materials[index].name
const node = (name: string) =>
  json.nodes.find((n: { name: string }) => n.name === name)

describe('twin.fixture.glb', () => {
  it('ist deterministisch: der Generator liefert genau die eingecheckte Datei', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'twin-fixture-'))
    try {
      const outputs = ['a.glb', 'b.glb'].map((name) => {
        const target = path.join(dir, name)
        execFileSync(process.execPath, [GENERATOR_PATH, '--out', target])
        return fs.readFileSync(target)
      })
      expect(outputs[0].equals(outputs[1])).toBe(true)
      expect(outputs[0].equals(fs.readFileSync(GLB_PATH))).toBe(true)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('ist ein kleiner, gültiger GLB-Container', () => {
    const bytes = fs.readFileSync(GLB_PATH)
    expect(bytes.length).toBeLessThan(60_000)
    expect(() => leseGlb(bytes)).not.toThrow()
    expect(() => leseGlb(bytes.subarray(0, bytes.length - 4))).toThrow()
    expect(json.asset.version).toBe('2.0')
    expect(json.buffers).toEqual([{ byteLength: bin.length }])
    // Ohne meshopt lesbar; quantisiert und unlit wie das echte Modell.
    expect(json.extensionsUsed).toEqual([
      'KHR_materials_unlit',
      'KHR_mesh_quantization',
    ])
    expect(json.extensionsRequired).toEqual(['KHR_mesh_quantization'])
  })

  it('hält alle Accessoren innerhalb des Binärteils', () => {
    const groesse: Record<number, number> = { 5121: 1, 5122: 2, 5123: 2 }
    const anzahl: Record<string, number> = { SCALAR: 1, VEC3: 3 }
    for (const view of json.bufferViews) {
      expect(view.byteOffset + view.byteLength).toBeLessThanOrEqual(bin.length)
    }
    for (const accessor of json.accessors) {
      const view = json.bufferViews[accessor.bufferView]
      const element = groesse[accessor.componentType] * anzahl[accessor.type]
      const stride = view.byteStride ?? element
      const end =
        (accessor.byteOffset ?? 0) + (accessor.count - 1) * stride + element
      expect(end).toBeLessThanOrEqual(view.byteLength)
    }
  })

  it('hat nur Wurzelknoten mit Verschiebung und gleichmäßigem Maßstab', () => {
    expect(json.scenes).toHaveLength(1)
    expect(json.scenes[0].nodes).toEqual(
      json.nodes.map((_: unknown, i: number) => i)
    )
    for (const n of json.nodes) {
      expect(n.children).toBeUndefined()
      expect(n.rotation).toBeUndefined()
      expect(n.translation).toHaveLength(3)
      expect(n.scale).toEqual([n.scale[0], n.scale[0], n.scale[0]])
      expect(n.scale[0]).toBeGreaterThan(0)
      expect(typeof n.mesh).toBe('number')
      expect(typeof n.extras.id).toBe('string')
    }
    const names = json.nodes.map((n: { name: string }) => n.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('nennt die Möbel wie der Katalog des echten Modells', () => {
    const names = json.nodes.map((n: { name: string }) => n.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'theke/korpus',
        'theke/vitrine',
        'theke/vitrine/ebene-1',
        'brotregal/korpus',
        'brotregal/ebene-1',
        'dosenregal/korpus',
        'getraenkekuehlschrank/korpus',
        'gitterregal/korpus',
        'wuerfelregal/korpus',
        'fassade/wand',
        'umgebung/boden',
        'verkaufsraum/boden',
      ])
    )
    // Möbel tragen ihre ID in extras, aber weder Füllung noch Produkt.
    for (const n of json.nodes) {
      if (n.name.startsWith('produkt/')) continue
      expect(n.extras.id).toBe(n.name)
      expect(n.extras.fills).toBeUndefined()
      expect(n.extras.product).toBeUndefined()
    }
  })

  it('macht jede Kiste unlit mit Vertex-Farben', () => {
    for (const material of json.materials) {
      expect(material.extensions).toEqual({ KHR_materials_unlit: {} })
      expect(material.pbrMetallicRoughness.baseColorFactor).toHaveLength(4)
    }
    for (const mesh of json.meshes) {
      for (const primitive of mesh.primitives) {
        expect(Object.keys(primitive.attributes).sort()).toEqual([
          'COLOR_0',
          'POSITION',
        ])
      }
    }
  })

  it('hat durchsichtiges, doppelseitiges Glas vor der Ware der Vitrine', () => {
    const glas = json.materials.find((m: { name: string }) => m.name === 'glas')
    expect(glas.alphaMode).toBe('BLEND')
    expect(glas.doubleSided).toBe(true)
    expect(glas.pbrMetallicRoughness.baseColorFactor[3]).toBeLessThan(1)
    // Sonst ist nichts durchsichtig.
    expect(
      json.materials.filter((m: { alphaMode?: string }) => m.alphaMode)
    ).toHaveLength(1)
    const vitrine = json.meshes[node('theke/vitrine').mesh]
    expect(
      vitrine.primitives.map((p: { material: number }) =>
        materialName(p.material)
      )
    ).toEqual(['rahmen', 'glas'])
  })

  it('belegt 12 bis 20 erfundene Produkte auf allen Möbeln', () => {
    const produkte = new Set(plaetze.map((p) => p.produkt).filter(Boolean))
    expect(produkte.size).toBeGreaterThanOrEqual(12)
    expect(produkte.size).toBeLessThanOrEqual(21) // 20 + das fehlende
    for (const moebel of [
      'theke/',
      'brotregal/',
      'dosenregal/',
      'getraenkekuehlschrank/',
      'gitterregal/',
      'wuerfelregal/',
    ]) {
      expect(erwarteteEintraege([moebel]).length).toBeGreaterThan(0)
    }
  })

  it('gibt jedem Platz extras wie im echten Modell', () => {
    for (const platz of plaetze) {
      const extras = node(platz.name).extras
      expect(extras.id).toBe(platz.slot)
      expect(Number.isInteger(extras.count)).toBe(true)
      expect(extras.count).toBeGreaterThan(0)
      // Entweder Produkt oder neutrale Ware, nie beides.
      expect(Boolean(extras.product) !== Boolean(extras.ware)).toBe(true)
      expect(extras.fills).toEqual([platz.variante ?? 'morgens'])
    }
    expect(plaetze.filter((p) => p.ware).length).toBeGreaterThanOrEqual(2)
    expect(
      plaetze.filter((p) => p.ware === 'dose').length
    ).toBeGreaterThanOrEqual(2)
  })

  it('hat genau einen Platz mit einer Feierabend-Variante', () => {
    const varianten = plaetze.filter((p) => p.variante)
    expect(varianten).toHaveLength(1)
    expect(varianten[0]).toMatchObject({
      slot: VARIANTE.slot,
      variante: 'feierabend',
      produkt: VARIANTE.feierabend,
      fills: ['feierabend'],
    })
    const morgens = plaetze.filter(
      (p) => p.slot === VARIANTE.slot && !p.variante
    )
    expect(morgens).toHaveLength(1)
    expect(morgens[0]).toMatchObject({
      produkt: VARIANTE.morgens,
      fills: ['morgens'],
    })
    // Morgens ist jeder Platz genau einmal belegt.
    const slots = plaetze.filter((p) => !p.variante).map((p) => p.slot)
    expect(new Set(slots).size).toBe(slots.length)
  })

  it('hängt Preiskarten als eigene Primitive an Brote im Brotregal', () => {
    const mitKarte = plaetze.filter((platz) => {
      const materials: string[] = json.meshes[
        node(platz.name).mesh
      ].primitives.map((p: { material: number }) => materialName(p.material))
      const karte = PREIS_MATERIALIEN.every((m) => materials.includes(m))
      if (karte) {
        expect(platz.slot).toMatch(/^brotregal\/ebene-[12]\/platz-\d\d$/)
        // Mehr als die Karte: der Laib selbst bleibt sichtbar.
        expect(
          materials.filter((m) => !PREIS_MATERIALIEN.includes(m)).length
        ).toBeGreaterThanOrEqual(1)
      }
      return karte
    })
    expect(mitKarte.length).toBeGreaterThanOrEqual(2)
    // Und es gibt Brote ohne Karte (ein Mesh, ein Primitiv).
    expect(
      json.meshes[node('produkt/brotregal/ebene-1/platz-04').mesh].primitives
    ).toHaveLength(1)
  })

  it('stellt Möbel und Ware in den Laden (Rahmen des Explorers)', () => {
    for (const n of json.nodes) {
      if (!/^(produkt|theke|brotregal|.*regal|getraenke)/.test(n.name)) continue
      const [x, y, z] = n.translation
      expect(x).toBeGreaterThan(0.2)
      expect(x).toBeLessThan(6.9)
      expect(y).toBeGreaterThan(244.2)
      expect(y).toBeLessThan(246.5)
      expect(z).toBeGreaterThan(-6.4)
      expect(z).toBeLessThan(1.9)
    }
  })
})

describe('products.snapshot.fixture.json', () => {
  const produkte = Object.entries<Record<string, unknown>>(snapshot.produkte)

  it('hat die Form ProduktSnapshot', () => {
    expect(Object.keys(snapshot).sort()).toEqual([
      'erstellt',
      'produkte',
      'version',
    ])
    expect(snapshot.version).toBe(1)
    expect(new Date(snapshot.erstellt).toISOString()).toBe(snapshot.erstellt)
    const erlaubt = [
      'id',
      'name',
      'kategorie',
      'einheit',
      'kurztext',
      'text',
      'seite',
    ]
    for (const [id, produkt] of produkte) {
      expect(produkt.id).toBe(id)
      expect(Object.keys(produkt).filter((k) => !erlaubt.includes(k))).toEqual(
        []
      )
      expect(typeof produkt.name).toBe('string')
      expect(produkt.name).not.toBe('')
      expect(KATEGORIEN).toContain(produkt.kategorie)
      expect(typeof produkt.kurztext).toBe('string')
      expect(produkt.kurztext).not.toBe('')
      expect(typeof produkt.text).toBe('string')
      if ('einheit' in produkt) expect(produkt.einheit).toMatch(/\S/)
      if ('seite' in produkt) expect(produkt.seite).toMatch(/^https:\/\//)
    }
  })

  it('deckt die Fälle ab, die die Oberfläche unterscheidet', () => {
    const alle = produkte.map(([, p]) => p)
    expect(alle.some((p) => 'einheit' in p)).toBe(true)
    expect(alle.some((p) => !('einheit' in p))).toBe(true)
    expect(alle.some((p) => p.text === '')).toBe(true)
    expect(alle.some((p) => String(p.text).length > 300)).toBe(true)
    expect(alle.filter((p) => 'seite' in p)).toHaveLength(1)
  })

  it('kennt jedes Produkt des Modells - bis auf das absichtlich fehlende', () => {
    const imModell = new Set(
      plaetze
        .map((p) => p.produkt)
        .filter((id): id is string => typeof id === 'string')
    )
    const fehlend = [...imModell].filter((id) => !snapshot.produkte[id])
    expect(fehlend).toEqual([WAISE.produkt])
    expect(plaetze.filter((p) => p.produkt === WAISE.produkt)).toEqual([
      expect.objectContaining({ slot: WAISE.slot, fills: ['morgens'] }),
    ])
    // Kein Karteileichen-Produkt: alles im Snapshot steht auch im Laden.
    expect(
      produkte.map(([id]) => id).filter((id) => !imModell.has(id))
    ).toEqual([])
  })
})

describe('keine Preise in den Fixtures (DB8)', () => {
  it('weder im Modell noch im Snapshot', () => {
    const imModell = zeichenketten(json).filter(
      (s) => !PREIS_MATERIALIEN.includes(s)
    )
    expect(imModell.filter((s) => PREIS.test(s))).toEqual([])
    expect(zeichenketten(snapshot).filter((s) => PREIS.test(s))).toEqual([])
    // Auch kein Feld, das „Preis“ heißt.
    expect(zeichenketten(snapshot).filter((s) => /preis/i.test(s))).toEqual([])
    expect(fs.readFileSync(SNAPSHOT_PATH, 'utf8')).not.toMatch(PREIS)
  })
})
