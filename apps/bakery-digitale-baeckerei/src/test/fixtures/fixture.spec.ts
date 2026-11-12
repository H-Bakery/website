import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  GENERATOR_PATH,
  GLB_PATH,
  MIT_MODELL,
  OHNE_MODELL,
  PRODUKT_GENERATOR_PATH,
  PRODUKT_GLB_PATH,
  PRODUKT_INDEX_PATH,
  SNAPSHOT_PATH,
  VARIANTE,
  WAISE,
  ausgeliefertesModell,
  erwarteteEintraege,
  exportFehler,
  ladeFixture,
  leseGlb,
  zaehlePreisPrimitive,
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
/** Die beiden Materialnamen des echten Modells, die sync-model herausnimmt. */
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

describe('produkt.fixture.glb (Nahansicht)', () => {
  const glb = fs.readFileSync(PRODUKT_GLB_PATH)
  const produkt = leseGlb(glb)
  const index = JSON.parse(fs.readFileSync(PRODUKT_INDEX_PATH, 'utf8'))

  it('ist deterministisch: der Generator liefert genau die eingecheckte Datei', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'produkt-fixture-'))
    try {
      const target = path.join(dir, 'a.glb')
      execFileSync(process.execPath, [PRODUKT_GENERATOR_PATH, '--out', target])
      expect(fs.readFileSync(target).equals(glb)).toBe(true)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('ist klein und ohne Decoder lesbar: keine Erweiterungen, schlichte Accessoren', () => {
    expect(glb.length).toBeLessThan(20_000)
    expect(produkt.json.extensionsUsed).toBeUndefined()
    expect(produkt.json.extensionsRequired).toBeUndefined()
    expect(produkt.json.images).toBeUndefined()
    expect(produkt.json.textures).toBeUndefined()
    const [position, normale, farbe] = produkt.json.accessors
    expect(position).toMatchObject({ componentType: 5126, type: 'VEC3' })
    expect(normale).toMatchObject({ componentType: 5126, type: 'VEC3' })
    expect(farbe).toMatchObject({
      componentType: 5121,
      normalized: true,
      type: 'VEC4',
    })
    expect(position.count % 3).toBe(0)
    const ende = produkt.json.bufferViews.reduce(
      (max: number, v: { byteOffset: number; byteLength: number }) =>
        Math.max(max, v.byteOffset + v.byteLength),
      0
    )
    expect(ende).toBeLessThanOrEqual(produkt.bin.length)
  })

  it('ist beleuchtet (PBR, nicht metallisch) - anders als der Laden nicht unlit', () => {
    expect(produkt.json.materials).toHaveLength(1)
    const material = produkt.json.materials[0]
    expect(material.extensions).toBeUndefined()
    expect(material.pbrMetallicRoughness.metallicFactor).toBe(0)
    expect(produkt.json.meshes[0].primitives[0].attributes).toEqual({
      POSITION: 0,
      NORMAL: 1,
      COLOR_0: 2,
    })
  })

  it('steht wie die echten Modelle: Meter, auf y = 0, Mitte der Grundfläche im Ursprung', () => {
    const { min, max } = produkt.json.accessors[0]
    expect(min[1]).toBe(0)
    expect(min[0]).toBeCloseTo(-max[0])
    expect(min[2]).toBeCloseTo(-max[2])
    // Größe eines Brotes, nicht eines Hauses.
    expect(max[0] - min[0]).toBeGreaterThan(0.03)
    expect(max[0] - min[0]).toBeLessThan(0.6)
    // Ein einzelner Knoten ohne Verschiebung: der Rahmen gilt für die Szene.
    expect(produkt.json.nodes).toEqual([{ mesh: 0 }])
  })

  it('trägt keine Metadaten: keine extras, keine Namen', () => {
    const texte = zeichenketten(produkt.json)
    expect(texte).not.toContain('extras')
    expect(texte).not.toContain('name')
    expect(texte.filter((text) => PREIS.test(text))).toEqual([])
  })

  it('der Index nennt genau dieses Modell - für ein Produkt des Snapshots', () => {
    expect(Object.keys(index.modelle)).toEqual([MIT_MODELL.produkt])
    const eintrag = index.modelle[MIT_MODELL.produkt]
    expect(eintrag.datei).toBe(`produkte-3d/${MIT_MODELL.produkt}.glb`)
    expect(eintrag.bytes).toBe(glb.length)
    const { min, max } = produkt.json.accessors[0]
    for (let k = 0; k < 3; k += 1) {
      expect(eintrag.bbox_m.min[k]).toBeCloseTo(min[k], 4)
      expect(eintrag.bbox_m.max[k]).toBeCloseTo(max[k], 4)
    }
    expect(snapshot.produkte[MIT_MODELL.produkt].name).toBe(MIT_MODELL.name)
    // Und es gibt ein Produkt ohne Modell, an dem die Suite „kein Knopf“ prüft.
    expect(snapshot.produkte[OHNE_MODELL.produkt].name).toBe(OHNE_MODELL.name)
    expect(index.modelle[OHNE_MODELL.produkt]).toBeUndefined()
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

describe('der Export-Wächter (exportFehler)', () => {
  let outDir: string
  const lege = (model: Uint8Array | null, snapshot: Uint8Array | null) => {
    fs.mkdirSync(path.join(outDir, 'model'), { recursive: true })
    fs.mkdirSync(path.join(outDir, 'data'), { recursive: true })
    if (model) fs.writeFileSync(path.join(outDir, 'model', 'twin.glb'), model)
    if (snapshot) {
      fs.writeFileSync(
        path.join(outDir, 'data', 'products.snapshot.json'),
        snapshot
      )
    }
  }
  /** Die Nahansicht im Export: Dateien in produkte-3d/ und der Index. */
  const legeProdukte = (
    dateien: Record<string, Uint8Array> = {
      [`${MIT_MODELL.produkt}.glb`]: fs.readFileSync(PRODUKT_GLB_PATH),
    },
    index: Uint8Array | null = fs.readFileSync(PRODUKT_INDEX_PATH)
  ) => {
    const dir = path.join(outDir, 'produkte-3d')
    fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(dir, { recursive: true })
    for (const [name, data] of Object.entries(dateien)) {
      fs.writeFileSync(path.join(dir, name), data)
    }
    const ziel = path.join(outDir, 'data', 'produkte-3d.json')
    fs.mkdirSync(path.dirname(ziel), { recursive: true })
    if (index) fs.writeFileSync(ziel, index)
    else fs.rmSync(ziel, { force: true })
  }
  beforeEach(() => {
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-waechter-'))
  })
  afterEach(() => {
    fs.rmSync(outDir, { recursive: true, force: true })
  })

  it('das ausgelieferte Fixture-Modell hat keine Preisschilder und ist herleitbar', () => {
    const a = ausgeliefertesModell()
    expect(zaehlePreisPrimitive(a)).toEqual({ primitive: 0, materialien: 0 })
    expect(a.equals(ausgeliefertesModell())).toBe(true)
    expect(a.equals(fs.readFileSync(GLB_PATH))).toBe(false)
  })

  it('lässt genau das bereinigte Fixture, den Fixture-Snapshot und das eine Produkt-Modell durch', () => {
    lege(ausgeliefertesModell(), fs.readFileSync(SNAPSHOT_PATH))
    legeProdukte()
    expect(exportFehler(outDir)).toBeNull()
  })

  it('lehnt jedes andere Produkt-Modell der Nahansicht ab - zu viel, zu wenig, verändert', () => {
    lege(ausgeliefertesModell(), fs.readFileSync(SNAPSHOT_PATH))
    const fixture = fs.readFileSync(PRODUKT_GLB_PATH)
    const name = `${MIT_MODELL.produkt}.glb`
    const MELDUNG = /nicht genau das synthetische Produkt-Modell/

    // gar keine Nahansicht im Export
    expect(exportFehler(outDir)).toMatch(MELDUNG)
    // ein zweites (z. B. echtes) Modell daneben
    legeProdukte({ [name]: fixture, 'echtes-brot.glb': Buffer.from('echt') })
    expect(exportFehler(outDir)).toMatch(/echtes-brot\.glb/)
    // dieselbe Datei unter anderem Namen
    legeProdukte({ 'echtes-brot.glb': fixture })
    expect(exportFehler(outDir)).toMatch(MELDUNG)
    // anderer Inhalt unter dem richtigen Namen
    legeProdukte({ [name]: Buffer.from('ein anderes Modell') })
    expect(exportFehler(outDir)).toMatch(MELDUNG)
    // anderer oder fehlender Index
    legeProdukte(undefined, Buffer.from('{"version":1,"modelle":{}}'))
    expect(exportFehler(outDir)).toMatch(MELDUNG)
    legeProdukte(undefined, null)
    expect(exportFehler(outDir)).toMatch(MELDUNG)
  })

  it('lehnt ein anderes Modell ab - auch das unbereinigte Fixture', () => {
    const snapshot = fs.readFileSync(SNAPSHOT_PATH)
    lege(fs.readFileSync(GLB_PATH), snapshot)
    expect(exportFehler(outDir)).toMatch(/twin\.glb ist nicht das synthetische/)
    lege(Buffer.from('irgendein anderes Modell'), snapshot)
    expect(exportFehler(outDir)).toMatch(/twin\.glb ist nicht das synthetische/)
  })

  it('lehnt einen anderen Snapshot und fehlende Dateien ab', () => {
    lege(ausgeliefertesModell(), Buffer.from('{"produkte":{}}'))
    expect(exportFehler(outDir)).toMatch(/nicht der synthetische Snapshot/)
    fs.rmSync(path.join(outDir, 'model', 'twin.glb'))
    expect(exportFehler(outDir)).toMatch(/twin\.glb ist nicht das synthetische/)
  })
})
