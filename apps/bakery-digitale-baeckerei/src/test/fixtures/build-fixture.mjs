#!/usr/bin/env node
/**
 * Baut das synthetische Mini-Modell `twin.fixture.glb` für Unit- und
 * Playwright-Tests der Digitalen Bäckerei. Alles hier ist erfunden: Möbel als
 * Kisten, Produkte wie „Testbrot“, keine Preise. Das echte Modell gehört nicht
 * ins Repo (scripts/sync-model.mjs lädt es nach public/model/).
 *
 * Das Fixture ahmt den AUFBAU des echten Modells nach, damit dieselben
 * Code-Pfade laufen:
 *
 * - alle Knoten sind Wurzeln der Szene mit `translation` und gleichmäßigem
 *   `scale`, die Knotennamen sind Katalog-IDs (`theke/vitrine/ebene-1`);
 * - Positionen als normalisierte int16 (`KHR_mesh_quantization`), Farben als
 *   normalisierte uint8 in `COLOR_0`, alle Materialien `KHR_materials_unlit`
 *   mit `baseColorFactor` - aber ohne meshopt, also ohne Decoder lesbar;
 * - Produkte sind Knoten `produkt/<slot>` mit `extras { id, product | ware,
 *   count, fills }`, ein Platz hat zusätzlich die Variante `…@feierabend`;
 * - Brote im Brotregal sind Meshes mit mehreren Primitiven, darunter
 *   `preiskarte` und `preisschrift` (werden in der App ausgeblendet);
 * - `glas` ist durchsichtig (`alphaMode: BLEND`, doppelseitig) und steht vor
 *   und über der Ware in der Vitrine;
 * - Möbel und Ware stehen grob dort, wo sie im echten Laden stehen (Rahmen
 *   des Explorers: x Ost, y Höhe ≈ 244-246,5 m, z −Nord; Theke und Brotregal
 *   um 20° gedreht), damit die echten Blickpunkte sie sehen.
 *
 * Deterministisch: gleicher Aufruf, gleiche Bytes (fixture.spec.ts prüft die
 * eingecheckte Datei gegen diese Ausgabe). Nur Node-Bordmittel.
 *
 * Aufruf (im App-Verzeichnis oder von überall):
 *   node src/test/fixtures/build-fixture.mjs            schreibt twin.fixture.glb
 *   node src/test/fixtures/build-fixture.mjs --check    Exit 1, wenn die Datei abweicht
 *   node src/test/fixtures/build-fixture.mjs --out <f>  schreibt woandershin
 *   node src/test/fixtures/build-fixture.mjs --list     Knoten als Tabelle
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const TARGET = path.join(HERE, 'twin.fixture.glb')

// Drehung von Theke und Brotregal um die Hochachse (20°), als feste Zahlen -
// so hängt kein Byte an Math.sin der jeweiligen Plattform.
const COS = 0.9396926
const SIN = 0.3420201

/** Farben linear (wie `baseColorFactor`), die Schattierung steckt in COLOR_0. */
const MATERIALS = {
  boden: [0.55, 0.5, 0.42],
  wand: [0.8, 0.78, 0.7],
  decke: [0.9, 0.9, 0.88],
  fassade: [0.75, 0.6, 0.45],
  gelaende: [0.3, 0.4, 0.25],
  nachbar: [0.6, 0.55, 0.5],
  thekenfront: [0.35, 0.06, 0.05],
  stein: [0.3, 0.3, 0.32],
  rahmen: [0.5, 0.5, 0.52],
  regalboden: [0.75, 0.7, 0.6],
  holz: [0.45, 0.28, 0.14],
  'holz-dunkel': [0.2, 0.11, 0.06],
  korb: [0.5, 0.36, 0.16],
  'regal-hell': [0.85, 0.85, 0.82],
  metall: [0.55, 0.57, 0.6],
  kruste: [0.5, 0.24, 0.06],
  'kruste-dunkel': [0.22, 0.1, 0.04],
  'kruste-hell': [0.75, 0.5, 0.2],
  mehl: [0.9, 0.86, 0.75],
  lauge: [0.35, 0.13, 0.03],
  gebaeck: [0.8, 0.55, 0.2],
  zuckerguss: [0.95, 0.9, 0.8],
  streusel: [0.85, 0.7, 0.4],
  sahne: [0.95, 0.93, 0.85],
  nuss: [0.4, 0.25, 0.12],
  'ware-blau': [0.1, 0.25, 0.6],
  'ware-gruen': [0.15, 0.45, 0.2],
  'ware-gelb': [0.85, 0.7, 0.1],
  // Die Feierabend-Variante ist absichtlich grell und groß: wäre sie zu sehen,
  // fiele es im Bild sofort auf.
  signal: [1, 0, 0.8],
  preiskarte: [0.93, 0.92, 0.89],
  preisschrift: [0.017, 0.017, 0.017],
  glas: [0.62, 0.79, 0.82, 0.3],
}

// ---------------------------------------------------------------------------
// Geometrie: Kisten. Eine Kiste hat 24 Ecken (je Seite 4), damit jede Seite
// ihre eigene Helligkeit bekommt - das „Licht“ des Fixtures.

/** Je Seite: Normale n und zwei Kanten u, v mit u × v = n (Außenseite CCW). */
const FACES = [
  { n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1], shade: 215 },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], shade: 150 },
  { n: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0], shade: 255 },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], shade: 120 },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], shade: 185 },
  { n: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0], shade: 170 },
]
const CORNERS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
]

/**
 * Die 24 Ecken einer Kiste in Weltkoordinaten.
 * @param {number[]} c Mittelpunkt [x, y, z]
 * @param {number[]} g Größe [Tiefe (lokal x), Höhe, Länge (lokal z)]
 * @param {boolean} gedreht um 20° gedreht wie Theke und Brotregal
 */
function kiste(c, g, gedreht) {
  const out = []
  for (const face of FACES) {
    for (const [su, sv] of CORNERS) {
      const local = [0, 1, 2].map(
        (i) => ((face.n[i] + su * face.u[i] + sv * face.v[i]) * g[i]) / 2
      )
      const x = gedreht ? local[0] * COS + local[2] * SIN : local[0]
      const z = gedreht ? -local[0] * SIN + local[2] * COS : local[2]
      out.push([c[0] + x, c[1] + local[1], c[2] + z])
    }
  }
  return out
}

/** Achsparallele Kiste aus zwei Ecken. */
const box = (min, max, mat) => ({
  mat,
  gedreht: false,
  c: [0, 1, 2].map((i) => (min[i] + max[i]) / 2),
  g: [0, 1, 2].map((i) => max[i] - min[i]),
})

/**
 * Ein gedrehtes Möbel (Theke, Brotregal) mit eigenem Maß: `a` läuft an der
 * Front entlang (von Platz 1 zum letzten), `q` zeigt zur Kundenseite.
 */
function rahmen(ox, oz) {
  const punkt = (a, q, y) => [ox - a * SIN + q * COS, y, oz - a * COS - q * SIN]
  /** Kiste an (a, q), Unterkante `y0`, Größe [Tiefe, Höhe, Länge]. */
  return (a, q, y0, g, mat) => ({
    mat,
    gedreht: true,
    c: punkt(a, q, y0 + g[1] / 2),
    g,
  })
}

const theke = rahmen(4.5, -0.25)
const brot = rahmen(2.8, 0.38)

// ---------------------------------------------------------------------------
// Die Szene: Name, extras, Primitive.

const nodes = []
const moebel = (name, ...teile) =>
  nodes.push({
    name,
    extras: { id: name, source: 'fixture', sigma_m: 0.1, confidence: 'high' },
    teile,
  })
/** Belegter Platz. `was` ist `{ product }` oder `{ ware }`. */
const produkt = (slot, was, count, teile, variante) =>
  nodes.push({
    name: `produkt/${slot}${variante ? `@${variante}` : ''}`,
    extras: {
      id: slot,
      source: 'fixture',
      sigma_m: 0.1,
      confidence: 'high',
      ...was,
      count,
      fills: [variante ?? 'morgens'],
    },
    teile,
  })

// --- Raum und Außenraum ----------------------------------------------------
moebel(
  'verkaufsraum/boden',
  box([0.22, 244.2, -6.38], [6.84, 244.25, 1.86], 'boden')
)
moebel(
  'verkaufsraum/wandfliesen',
  box([0.17, 244.25, -6.38], [0.22, 246.53, 1.86], 'wand'),
  box([0.17, 244.25, -6.43], [6.84, 246.53, -6.38], 'wand'),
  box([0.17, 244.25, 1.86], [6.84, 246.53, 1.91], 'wand')
)
moebel(
  'verkaufsraum/rasterdecke',
  box([0.22, 246.5, -6.38], [6.84, 246.53, 1.86], 'decke')
)
moebel('fassade/wand', box([6.84, 244.1, -6.6], [7.0, 247.5, 2.1], 'fassade'))
moebel('umgebung/boden', box([-8, 244.0, -16], [20, 244.1, 12], 'gelaende'))
moebel('umgebung/nachbarhaus', box([10, 244.1, -5], [15, 250, 2], 'nachbar'))

// --- Theke mit Vitrine (Kundenseite +q) -------------------------------------
moebel('theke/korpus', theke(1.55, 0, 244.25, [0.8, 0.62, 4.2], 'thekenfront'))
moebel(
  'theke/granitablage',
  theke(1.55, 0.02, 244.87, [0.9, 0.05, 4.3], 'stein')
)
moebel(
  'theke/vitrine',
  theke(1.55, -0.37, 244.92, [0.03, 0.61, 4.1], 'rahmen'),
  // Die Scheibe steht zwischen Kundschaft und Ware: Tippen muss hindurch.
  theke(1.55, 0.37, 244.92, [0.012, 0.61, 4.1], 'glas')
)
moebel(
  'theke/vitrine/ebene-1',
  theke(1.55, 0, 245.03, [0.7, 0.02, 4.05], 'regalboden')
)
moebel(
  'theke/vitrine/ebene-2',
  theke(1.55, -0.12, 245.28, [0.42, 0.02, 4.05], 'glas')
)
moebel(
  'theke/vitrine/ebene-3',
  theke(1.55, 0, 245.52, [0.76, 0.012, 4.1], 'glas')
)
moebel(
  'theke/brezelstaender',
  theke(0.49, -0.29, 245.532, [0.05, 0.6, 0.05], 'holz-dunkel')
)

const unten = (a, mat) => [theke(a, 0.16, 245.05, [0.26, 0.11, 0.42], mat)]
const mitte = (a, mat) => [theke(a, -0.13, 245.3, [0.24, 0.12, 0.42], mat)]
const oben = (a, mat) => [theke(a, -0.2, 245.532, [0.16, 0.14, 0.16], mat)]

produkt(
  'theke/vitrine/ebene-1/platz-01',
  { product: 'musterbrezel' },
  8,
  unten(0, 'lauge')
)
produkt(
  'theke/vitrine/ebene-1/platz-02',
  { product: 'probierschnecke' },
  6,
  unten(0.6, 'zuckerguss')
)
produkt(
  'theke/vitrine/ebene-1/platz-03',
  { product: 'testhoernchen' },
  12,
  unten(1.2, 'gebaeck')
)
// Derselbe Platz am Abend: anderes Produkt, grell, größer. Der Morgens-Filter
// blendet ihn aus.
produkt(
  'theke/vitrine/ebene-1/platz-03',
  { product: 'musterweck' },
  2,
  [theke(1.2, 0.16, 245.05, [0.3, 0.3, 0.46], 'signal')],
  'feierabend'
)
produkt(
  'theke/vitrine/ebene-1/platz-04',
  { product: 'musterplunder-apfel' },
  4,
  unten(1.8, 'kruste-hell')
)
produkt(
  'theke/vitrine/ebene-1/platz-05',
  { product: 'probierstange-kaese' },
  5,
  unten(2.5, 'streusel')
)
produkt(
  'theke/vitrine/ebene-2/platz-01',
  { product: 'testkuchen-streusel' },
  8,
  mitte(0, 'streusel')
)
produkt(
  'theke/vitrine/ebene-2/platz-03',
  { product: 'mustertorte-nuss' },
  8,
  mitte(1.2, 'nuss')
)
produkt(
  'theke/vitrine/ebene-2/platz-04',
  { product: 'testkuchen-streusel' },
  6,
  mitte(1.8, 'sahne')
)
// Auf der Vitrine, also ohne Scheibe davor.
produkt(
  'theke/vitrine/ebene-3/platz-01',
  { product: 'testkekse' },
  3,
  oben(1.5, 'gebaeck')
)
// Diese Produkt-ID fehlt absichtlich im Snapshot: zu sehen, aber ohne Karte.
produkt(
  'theke/vitrine/ebene-3/platz-02',
  { product: 'phantomgebaeck' },
  1,
  oben(2.1, 'ware-blau')
)
produkt('theke/brezelstaender/platz-01', { product: 'musterbrezel' }, 1, [
  theke(0.42, -0.25, 245.68, [0.14, 0.12, 0.14], 'lauge'),
])
produkt('theke/brezelstaender/platz-02', { product: 'musterbrezel' }, 1, [
  theke(0.56, -0.33, 245.89, [0.14, 0.12, 0.14], 'lauge'),
])

// --- Brotregal hinter der Theke ----------------------------------------------
moebel('brotregal/korpus', brot(1.6, -0.24, 244.85, [0.04, 1.35, 3.7], 'holz'))
moebel(
  'brotregal/seitenwangen',
  brot(-0.27, 0, 244.25, [0.5, 2.0, 0.04], 'holz'),
  brot(3.47, 0, 244.25, [0.5, 2.0, 0.04], 'holz')
)
moebel('brotregal/koerbe', brot(1.6, 0.12, 245.0, [0.7, 0.12, 3.56], 'holz'))
moebel(
  'brotregal/koerbe/korb-1',
  brot(0.2, 0.15, 245.12, [0.45, 0.08, 0.55], 'korb')
)
moebel(
  'brotregal/koerbe/korb-3',
  brot(1.4, 0.15, 245.12, [0.45, 0.08, 0.55], 'korb')
)
const BRETT = { 1: 245.35, 2: 245.59, 3: 245.85 }
for (const [ebene, y] of Object.entries(BRETT)) {
  moebel(
    `brotregal/ebene-${ebene}`,
    brot(1.6, -0.01, y, [0.42, 0.02, 3.56], 'regalboden')
  )
}

/** Ein Laib; mit Preiskarte ist er ein Mesh aus vier Primitiven. */
function laib(a, ebene, mat, mitKarte) {
  const y = BRETT[ebene] + 0.02
  const teile = [brot(a, 0, y, [0.2, 0.16, 0.34], mat)]
  if (mitKarte) {
    teile.push(
      brot(a, 0, y + 0.16, [0.06, 0.01, 0.3], 'mehl'),
      brot(a, 0.204, y - 0.065, [0.008, 0.06, 0.1], 'preiskarte'),
      brot(a, 0.21, y - 0.045, [0.004, 0.02, 0.07], 'preisschrift')
    )
  }
  return teile
}
produkt(
  'brotregal/ebene-1/platz-01',
  { product: 'testbrot-500g' },
  2,
  laib(0.3, 1, 'kruste', true)
)
produkt(
  'brotregal/ebene-1/platz-02',
  { product: 'testbrot-1000g' },
  1,
  laib(0.9, 1, 'kruste-dunkel', true)
)
produkt(
  'brotregal/ebene-1/platz-03',
  { product: 'musterkruste-750g' },
  2,
  laib(1.5, 1, 'kruste-hell', true)
)
produkt(
  'brotregal/ebene-1/platz-04',
  { product: 'probierlaib-dinkel' },
  3,
  laib(2.1, 1, 'kruste', false)
)
produkt(
  'brotregal/ebene-2/platz-01',
  { product: 'testkasten-koerner' },
  2,
  laib(0.3, 2, 'kruste-dunkel', true)
)
produkt(
  'brotregal/ebene-2/platz-02',
  { product: 'probierstange' },
  4,
  laib(0.9, 2, 'kruste-hell', false)
)
produkt(
  'brotregal/ebene-3/platz-01',
  { product: 'testbrot-500g' },
  3,
  laib(1.5, 3, 'kruste', false)
)
produkt('brotregal/koerbe/korb-1/platz-01', { product: 'musterweck' }, 20, [
  brot(0.2, 0.15, 245.2, [0.38, 0.1, 0.48], 'kruste-hell'),
])
produkt('brotregal/koerbe/korb-3/platz-01', { product: 'testweck-mohn' }, 20, [
  brot(1.4, 0.15, 245.2, [0.38, 0.1, 0.48], 'kruste-dunkel'),
])

// --- Regale und Kühlschrank (im echten Laden fast nur neutrale Ware) ---------
const bretter = (min, max, hoehen, mat) =>
  hoehen.map((y) => box([min[0], y, min[1]], [max[0], y + 0.03, max[1]], mat))

moebel(
  'dosenregal/korpus',
  box([3.64, 244.25, -5.82], [3.68, 245.82, -4.44], 'regal-hell'),
  ...bretter(
    [3.68, -5.82],
    [4.3, -4.44],
    [244.36, 244.71, 245.06, 245.41],
    'regal-hell'
  )
)
produkt('dosenregal/platz-01', { ware: 'dose' }, 28, [
  box([3.7, 244.39, -5.27], [4.26, 244.52, -4.5], 'ware-blau'),
])
produkt('dosenregal/platz-02', { ware: 'glas' }, 16, [
  box([3.83, 244.74, -5.2], [4.27, 244.87, -4.49], 'ware-gelb'),
])
produkt('dosenregal/platz-03', { product: 'probiergebaeck-dose' }, 18, [
  box([3.84, 245.09, -5.2], [4.27, 245.24, -4.49], 'gebaeck'),
])
produkt('dosenregal/platz-04', { ware: 'dose' }, 20, [
  box([3.86, 245.44, -5.18], [4.27, 245.57, -4.49], 'ware-gruen'),
])

moebel(
  'getraenkekuehlschrank/korpus',
  box([4.24, 244.25, -6.36], [5.04, 246.15, -6.32], 'metall'),
  box([4.24, 244.25, -6.32], [4.28, 246.15, -5.6], 'metall'),
  box([5.0, 244.25, -6.32], [5.04, 246.15, -5.6], 'metall'),
  box([4.28, 246.1, -6.32], [5.0, 246.15, -5.6], 'metall'),
  box([4.28, 244.25, -6.32], [5.0, 244.45, -5.6], 'metall'),
  ...bretter([4.28, -6.32], [5.0, -5.62], [245.01, 245.31], 'regal-hell'),
  // Glastür: auch hier muss ein Tipp die Ware dahinter treffen.
  box([4.24, 244.25, -5.6], [5.04, 246.15, -5.57], 'glas')
)
produkt('getraenkekuehlschrank/platz-01', { ware: 'flasche' }, 12, [
  box([4.62, 244.45, -6.13], [4.92, 244.7, -5.67], 'ware-gruen'),
])
produkt('getraenkekuehlschrank/platz-03', { product: 'testlimo-zitrone' }, 12, [
  box([4.61, 245.04, -6.12], [4.92, 245.27, -5.68], 'ware-gelb'),
])
produkt('getraenkekuehlschrank/platz-04', { ware: 'flasche' }, 12, [
  box([4.62, 245.34, -6.12], [4.92, 245.56, -5.67], 'ware-blau'),
])

moebel(
  'gitterregal/korpus',
  box([3.58, 244.25, 1.81], [4.58, 246.05, 1.85], 'metall'),
  ...bretter(
    [3.58, 1.08],
    [4.58, 1.81],
    [244.36, 244.76, 245.16, 245.56],
    'metall'
  )
)
produkt('gitterregal/platz-01', { ware: 'karton' }, 7, [
  box([3.78, 244.39, 1.13], [4.52, 244.69, 1.62], 'ware-gelb'),
])
produkt('gitterregal/platz-03', { product: 'testknusperstangen' }, 7, [
  box([3.75, 245.19, 1.12], [4.49, 245.49, 1.61], 'kruste-hell'),
])
produkt('gitterregal/platz-04', { ware: 'tuete' }, 6, [
  box([3.78, 245.59, 1.16], [4.5, 245.89, 1.62], 'ware-gruen'),
])

moebel(
  'wuerfelregal/korpus',
  box([1.12, 244.25, -3.85], [1.97, 245.92, -3.81], 'holz'),
  ...bretter(
    [1.12, -3.81],
    [1.97, -3.24],
    [244.44, 244.8, 245.17, 245.53],
    'holz'
  )
)
produkt('wuerfelregal/platz-02', { ware: 'glas' }, 3, [
  box([1.64, 244.47, -3.55], [1.9, 244.72, -3.41], 'ware-gelb'),
])
produkt('wuerfelregal/platz-05', { product: 'musterzwieback' }, 4, [
  box([1.26, 245.2, -3.56], [1.52, 245.32, -3.29], 'kruste-hell'),
])
produkt('wuerfelregal/platz-06', { ware: 'dose' }, 4, [
  box([1.6, 245.2, -3.69], [1.88, 245.32, -3.41], 'ware-blau'),
])

// ---------------------------------------------------------------------------
// glTF zusammensetzen.

const round4 = (n) => Math.round(n * 1e4) / 1e4
const materialNames = Object.keys(MATERIALS)

/** Positions-Accessoren, nach Inhalt entdoppelt (gleiche Ware teilt Geometrie). */
const positionBlocks = []
const positionIndex = new Map()
const accessors = [
  // 0: Indizes und 1: Farben gelten für jede Kiste.
  { bufferView: 0, componentType: 5123, count: 36, type: 'SCALAR' },
  {
    bufferView: 1,
    componentType: 5121,
    normalized: true,
    count: 24,
    type: 'VEC3',
  },
]
const POSITION_STRIDE = 8 // 3 × int16 + 2 Füllbytes (byteStride muss durch 4 teilbar sein)

function positionAccessor(ints) {
  const key = ints.join(',')
  let index = positionIndex.get(key)
  if (index !== undefined) return index
  const min = [32767, 32767, 32767]
  const max = [-32767, -32767, -32767]
  for (let i = 0; i < ints.length; i += 3) {
    for (let k = 0; k < 3; k += 1) {
      min[k] = Math.min(min[k], ints[i + k])
      max[k] = Math.max(max[k], ints[i + k])
    }
  }
  index = accessors.length
  accessors.push({
    bufferView: 2,
    byteOffset: positionBlocks.length * 24 * POSITION_STRIDE,
    componentType: 5122,
    normalized: true,
    count: 24,
    type: 'VEC3',
    min,
    max,
  })
  positionBlocks.push(ints)
  positionIndex.set(key, index)
  return index
}

const gltfNodes = []
const meshes = []
for (const node of nodes) {
  const ecken = node.teile.map((t) => kiste(t.c, t.g, t.gedreht))
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const p of ecken.flat()) {
    for (let k = 0; k < 3; k += 1) {
      min[k] = Math.min(min[k], p[k])
      max[k] = Math.max(max[k], p[k])
    }
  }
  const translation = [0, 1, 2].map((k) => round4((min[k] + max[k]) / 2))
  let reach = 0
  for (const p of ecken.flat()) {
    for (let k = 0; k < 3; k += 1) {
      reach = Math.max(reach, Math.abs(p[k] - translation[k]))
    }
  }
  const scale = Math.ceil(reach * 1e4) / 1e4
  const primitives = node.teile.map((teil, i) => {
    const ints = ecken[i].flatMap((p) =>
      p.map((v, k) => Math.round(((v - translation[k]) / scale) * 32767))
    )
    const material = materialNames.indexOf(teil.mat)
    if (material < 0) throw new Error(`Unbekanntes Material: ${teil.mat}`)
    return {
      attributes: { COLOR_0: 1, POSITION: positionAccessor(ints) },
      mode: 4,
      material,
      indices: 0,
    }
  })
  // Ohne Mesh-Namen (das echte Modell wiederholt dort den Knotennamen) - spart Platz.
  meshes.push({ primitives })
  gltfNodes.push({
    name: node.name,
    extras: node.extras,
    translation,
    scale: [scale, scale, scale],
    mesh: meshes.length - 1,
  })
}

// Binärteil: Indizes, Farben, Positionen.
const indexBytes = Buffer.alloc(36 * 2)
for (let f = 0; f < 6; f += 1) {
  const o = f * 4
  ;[o, o + 1, o + 2, o, o + 2, o + 3].forEach((v, i) =>
    indexBytes.writeUInt16LE(v, (f * 6 + i) * 2)
  )
}
const colourBytes = Buffer.alloc(24 * 4)
FACES.forEach((face, f) => {
  for (let c = 0; c < 4; c += 1) {
    colourBytes.fill(face.shade, (f * 4 + c) * 4, (f * 4 + c) * 4 + 3)
  }
})
const positionBytes = Buffer.alloc(positionBlocks.length * 24 * POSITION_STRIDE)
positionBlocks.forEach((ints, b) => {
  for (let i = 0; i < 24; i += 1) {
    for (let k = 0; k < 3; k += 1) {
      positionBytes.writeInt16LE(
        ints[i * 3 + k],
        (b * 24 + i) * POSITION_STRIDE + k * 2
      )
    }
  }
})
const bin = Buffer.concat([indexBytes, colourBytes, positionBytes])

const gltf = {
  asset: {
    generator: 'bakery-digitale-baeckerei build-fixture',
    version: '2.0',
  },
  extensionsUsed: ['KHR_materials_unlit', 'KHR_mesh_quantization'],
  extensionsRequired: ['KHR_mesh_quantization'],
  scene: 0,
  scenes: [{ name: 'fixture', nodes: gltfNodes.map((_, i) => i) }],
  nodes: gltfNodes,
  meshes,
  materials: materialNames.map((name) => {
    const colour = MATERIALS[name]
    const durchsichtig = colour.length === 4
    return {
      name,
      ...(durchsichtig ? { alphaMode: 'BLEND', doubleSided: true } : {}),
      pbrMetallicRoughness: {
        baseColorFactor: durchsichtig ? colour : [...colour, 1],
        metallicFactor: 0,
      },
      extensions: { KHR_materials_unlit: {} },
    }
  }),
  accessors,
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: indexBytes.length, target: 34963 },
    {
      buffer: 0,
      byteOffset: indexBytes.length,
      byteLength: colourBytes.length,
      byteStride: 4,
      target: 34962,
    },
    {
      buffer: 0,
      byteOffset: indexBytes.length + colourBytes.length,
      byteLength: positionBytes.length,
      byteStride: POSITION_STRIDE,
      target: 34962,
    },
  ],
  buffers: [{ byteLength: bin.length }],
}

/** GLB-Container: Kopf, JSON-Chunk (mit Leerzeichen aufgefüllt), BIN-Chunk. */
function glb(json, binary) {
  const pad = (buffer, fill) => {
    const rest = (4 - (buffer.length % 4)) % 4
    return rest ? Buffer.concat([buffer, Buffer.alloc(rest, fill)]) : buffer
  }
  const jsonChunk = pad(Buffer.from(JSON.stringify(json), 'utf8'), 0x20)
  const binChunk = pad(binary, 0)
  const header = Buffer.alloc(12)
  header.writeUInt32LE(0x46546c67, 0) // 'glTF'
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8)
  const chunkHead = (length, type) => {
    const head = Buffer.alloc(8)
    head.writeUInt32LE(length, 0)
    head.writeUInt32LE(type, 4)
    return head
  }
  return Buffer.concat([
    header,
    chunkHead(jsonChunk.length, 0x4e4f534a), // 'JSON'
    jsonChunk,
    chunkHead(binChunk.length, 0x004e4942), // 'BIN\0'
    binChunk,
  ])
}

const bytes = glb(gltf, bin)
const args = process.argv.slice(2)

if (args.includes('--list')) {
  for (const node of gltfNodes) {
    const { product, ware, count, fills } = node.extras
    const was = product ? `product=${product}` : ware ? `ware=${ware}` : ''
    console.log(
      [node.name, was, count ?? '', fills ? fills.join('+') : '']
        .join('\t')
        .trimEnd()
    )
  }
} else if (args.includes('--check')) {
  const current = fs.existsSync(TARGET) ? fs.readFileSync(TARGET) : null
  if (!current || !current.equals(bytes)) {
    console.error(
      'build-fixture: twin.fixture.glb weicht vom Generator ab - neu bauen: node src/test/fixtures/build-fixture.mjs'
    )
    process.exit(1)
  }
  console.log(
    `build-fixture: twin.fixture.glb ist aktuell (${bytes.length} Bytes)`
  )
} else {
  const at = args.indexOf('--out')
  const target = at >= 0 && args[at + 1] ? path.resolve(args[at + 1]) : TARGET
  fs.writeFileSync(target, bytes)
  console.log(
    `build-fixture: ${target} - ${bytes.length} Bytes, ${gltfNodes.length} Knoten, ${positionBlocks.length} Geometrien`
  )
}
