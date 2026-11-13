/**
 * Liest die synthetischen Fixtures (Mini-GLB, Produkt-Snapshot) - für die
 * jest-Specs hier und die Playwright-Suite `apps/bakery-digitale-baeckerei-e2e`.
 * CommonJS ohne Abhängigkeiten, damit jest, Playwright und reine Node-Skripte
 * dieselbe Datei laden.
 *
 * Kein Teil der App: die App bekommt Belegung und Snapshot aus
 * `scripts/sync-model` / `scripts/sync-products`.
 */
const fs = require('fs')
const path = require('path')
const {
  bereinigeGlb,
  leseGlb: leseContainer,
  zaehlePreisPrimitive,
} = require('../../../scripts/glb-bereinigen')
const { alsDatei, leseVerzeichnis } = require('../../../scripts/rauminfos')
const {
  belegungAusGltf,
  fasseZusammen,
  morgensPlatz,
} = require('../../../scripts/belegung')
const { leseEinrichtung, wendeAn } = require('../../../scripts/einrichtung')
const { PAKET_DATEI } = require('../../../scripts/regal-modelle')

const GLB_PATH = path.join(__dirname, 'twin.fixture.glb')
const SNAPSHOT_PATH = path.join(__dirname, 'products.snapshot.fixture.json')
const GENERATOR_PATH = path.join(__dirname, 'build-fixture.mjs')
/** Synthetisches Produkt-Modell für die Nahansicht und sein Index. */
const PRODUKT_GLB_PATH = path.join(__dirname, 'produkt.fixture.glb')
const PRODUKT_INDEX_PATH = path.join(__dirname, 'produkte-3d.fixture.json')
const PRODUKT_GENERATOR_PATH = path.join(__dirname, 'build-produkt-fixture.mjs')
/** Synthetische Regal-Modelle (DB12), gepackt wie die echten, und ihr Generator. */
const REGAL_GLB_PATH = path.join(__dirname, 'regal.fixture.glb')
const REGAL_GENERATOR_PATH = path.join(__dirname, 'build-regal-fixture.mjs')
/** Synthetische Einrichtung, in der Form der Datei in hq. */
const EINRICHTUNG_PATH = path.join(__dirname, 'einrichtung.yaml')
/**
 * Was die synthetische Einrichtung im Laden ändert - für die Tests:
 * ein anderes Produkt mit Regal-Modell (wird gelegt), neutrale Ware wird zu
 * einem Produkt ohne Regal-Modell (im Bild leer, in der Liste), ein Platz ist
 * leer.
 */
const EINGERICHTET = {
  gelegt: {
    slot: 'brotregal/ebene-1/platz-04',
    produkt: 'testbrot-500g',
    anzahl: 2,
    imModell: 'probierlaib-dinkel',
  },
  ohneModell: { slot: 'gitterregal/platz-04', produkt: 'testkekse', anzahl: 2 },
  leer: { slot: 'theke/vitrine/ebene-2/platz-04' },
}
/** Die Fixture-Produkte mit Regal-Modell. */
const MIT_REGAL = ['musterbrezel', 'musterweck', 'testbrot-500g']
/** Mini-Modell des zweiten, erfundenen Raums („Testbackstube“, DB11). */
const BACKSTUBE_GLB_PATH = path.join(__dirname, 'testbackstube.fixture.glb')
/** Synthetische Infopunkte: `<raum>.yaml`, in der Form der Dateien in hq. */
const RAUMINFOS_DIR = path.join(__dirname, 'raeume')
/**
 * Die Räume des Fixtures: id (wie in src/config/raeume.ts bzw. testraeume.ts),
 * Datei unter public/model/ und die Quelle hier. Danach bauen die
 * Sync-Skripte im Fixture-Modus - statt nach model.lock.json.
 */
const RAEUME = [
  { id: 'laden', datei: 'twin.glb', quelle: GLB_PATH },
  {
    id: 'testbackstube',
    datei: 'testbackstube.glb',
    quelle: BACKSTUBE_GLB_PATH,
  },
]
/** Die Stationen der Testbackstube: mit Infopunkt, ohne, und die Tür. */
const STATIONEN = {
  ofen: { knoten: 'ofen', titel: 'Testofen' },
  kneter: { knoten: 'kneter', titel: 'Testkneter' },
  tisch: { knoten: 'arbeitstisch', titel: 'Testtisch' },
  ohneInfo: { knoten: 'spuele' },
  tuer: { knoten: 'tuer', ziel: 'laden' },
}

/** Das eine Fixture-Produkt mit Nahansicht - und eines ohne. */
const MIT_MODELL = { produkt: 'testbrot-500g', name: 'Testbrot' }
const OHNE_MODELL = { produkt: 'testkekse', name: 'Testkekse' }

/** Produkt-ID im Modell, die im Snapshot absichtlich fehlt. */
const WAISE = {
  slot: 'theke/vitrine/ebene-3/platz-02',
  produkt: 'phantomgebaeck',
}
/** Platz mit einer zweiten Variante `…@feierabend` (anderes Produkt). */
const VARIANTE = {
  slot: 'theke/vitrine/ebene-1/platz-03',
  morgens: 'testhoernchen',
  feierabend: 'musterweck',
}

/**
 * Zerlegt einen GLB-Container (glTF 2.0 binär) in JSON- und BIN-Teil und
 * prüft Kopf und Längen - der Leser der Sync-Skripte.
 * @param {Buffer} buffer
 * @returns {{ json: any, bin: Buffer }}
 */
function leseGlb(buffer) {
  const { json, bin } = leseContainer(buffer)
  return { json, bin: bin ?? Buffer.alloc(0) }
}

/**
 * Die belegten Plätze des Modells: Knoten `produkt/<slot>[@<variante>]`.
 * @param {any} json  JSON-Teil des GLB
 * @returns {{ name: string, slot: string, variante: string | null, produkt?: string, ware?: string, anzahl?: number, fills: string[] }[]}
 */
function plaetze(json) {
  return json.nodes
    .filter((node) => String(node.name).startsWith('produkt/'))
    .map((node) => {
      const rest = node.name.slice('produkt/'.length)
      const at = rest.lastIndexOf('@')
      const extras = node.extras || {}
      return {
        name: node.name,
        slot: at < 0 ? rest : rest.slice(0, at),
        variante: at < 0 ? null : rest.slice(at + 1),
        produkt: extras.product,
        ware: extras.ware,
        anzahl: extras.count,
        fills: extras.fills || [],
      }
    })
}

/**
 * Das Mini-Modell, wie `sync-model` es im Fixture-Modus ausliefert: ohne die
 * Preisschilder (`scripts/glb-bereinigen.js`), Byte für Byte herleitbar.
 * @param {string} [raum] id aus `RAEUME`
 * @returns {Buffer}
 */
function ausgeliefertesModell(raum = 'laden') {
  const eintrag = RAEUME.find((r) => r.id === raum)
  if (!eintrag) throw new Error(`Fixture-Raum ${raum} gibt es nicht`)
  return Buffer.from(bereinigeGlb(fs.readFileSync(eintrag.quelle)).glb)
}

/**
 * `data/rauminfos.json`, wie `sync-rauminfos` sie im Fixture-Modus schreibt:
 * aus den YAML-Dateien hier, mit demselben Leser wie für hq.
 * @returns {Buffer}
 */
function rauminfosDatei() {
  const { rauminfos } = leseVerzeichnis(
    RAUMINFOS_DIR,
    RAEUME.map((r) => r.id)
  )
  return Buffer.from(alsDatei(rauminfos), 'utf8')
}

/** Die synthetische Einrichtung, gelesen mit dem Leser der Sync-Skripte. */
function einrichtung() {
  return leseEinrichtung(fs.readFileSync(EINRICHTUNG_PATH, 'utf8'))
}

/**
 * Die Belegung eines Fixture-Raums, wie sie gilt: das Modell, darüber die
 * synthetische Einrichtung (ohne die Rahmen der Plätze).
 * @param {string} [raum]
 * @returns {{ slots: { slot: string, produkt: string, anzahl?: number, quelle?: string }[], leer: string[], geaendert: number }}
 */
function belegung(raum = 'laden') {
  const { json } = leseGlb(ausgeliefertesModell(raum))
  const modell = belegungAusGltf(json, 'fixture').belegung
  const bekannt = json.nodes
    .map((node) => morgensPlatz(node.name, node.extras))
    .filter((slot) => slot !== null)
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'))
  return wendeAn(modell, einrichtung().raeume[raum], {
    raum,
    bekannt,
    produkte: Object.keys(snapshot.produkte),
  })
}

/**
 * `data/einrichtung.modell.json`, wie `sync-model` sie im Fixture-Modus
 * schreibt: die Belegung der Modelle ohne Einrichtung (für den
 * Einrichten-Modus, den es im Fixture-Build zum Testen gibt).
 * @returns {Buffer}
 */
function modellBelegungDatei() {
  const jeRaum = {}
  for (const raum of RAEUME) {
    const { json } = leseGlb(ausgeliefertesModell(raum.id))
    const { quelle, slots } = belegungAusGltf(json, 'fixture').belegung
    jeRaum[raum.id] = { quelle, slots }
  }
  return Buffer.from(`${JSON.stringify(fasseZusammen(jeRaum))}\n`, 'utf8')
}

/**
 * Enthält ein Export (`out/`) genau die synthetischen Fixtures - das bereinigte
 * Mini-Modell, den Fixture-Snapshot und das eine Produkt-Modell der Nahansicht
 * samt Index, Byte für Byte? Liefert sonst die
 * Meldung, was nicht stimmt. Dieselbe Prüfung für den e2e-Server
 * (`serve-fixture.js`) und den `build`-Job in CI: Das echte Modell und echte
 * Produkttexte dürfen in keinem öffentlichen Artefakt landen.
 * @param {string} outDir
 * @returns {string | null}
 */
function exportFehler(outDir) {
  const snapshot = path.join(outDir, 'data', 'products.snapshot.json')
  for (const raum of RAEUME) {
    const model = path.join(outDir, 'model', raum.datei)
    if (
      !fs.existsSync(model) ||
      !fs.readFileSync(model).equals(ausgeliefertesModell(raum.id))
    ) {
      return `${model} ist nicht das synthetische Fixture (bereinigt). Nur mit DIGITALE_BAECKEREI_FIXTURE=1 gebaut - nie mit dem echten Modell.`
    }
  }
  const modelDir = path.join(outDir, 'model')
  const fremd = fs
    .readdirSync(modelDir)
    .filter((name) => !RAEUME.some((r) => r.datei === name))
  if (fremd.length > 0) {
    return `${modelDir} enthält mehr als die synthetischen Modelle (${fremd.join(
      ', '
    )}). Nur mit DIGITALE_BAECKEREI_FIXTURE=1 gebaut - nie mit dem echten Modell.`
  }
  const rauminfos = path.join(outDir, 'data', 'rauminfos.json')
  if (
    !fs.existsSync(rauminfos) ||
    !fs.readFileSync(rauminfos).equals(rauminfosDatei())
  ) {
    return `${rauminfos} sind nicht die synthetischen Infopunkte. Nur mit DIGITALE_BAECKEREI_FIXTURE=1 gebaut - nie mit echten Texten aus hq.`
  }
  if (
    !fs.existsSync(snapshot) ||
    !fs.readFileSync(snapshot).equals(fs.readFileSync(SNAPSHOT_PATH))
  ) {
    return `${snapshot} ist nicht der synthetische Snapshot. Nur mit DIGITALE_BAECKEREI_FIXTURE=1 gebaut - nie mit echten Produkttexten.`
  }
  // Modelle einzelner Produkte: genau das eine synthetische der Nahansicht, das
  // Paket der synthetischen Regal-Modelle (DB12) und ihr Index - nie ein
  // echtes Modell aus dem Daten-Repo produkte-3d.
  const produktDir = path.join(outDir, 'produkte-3d')
  const dateien = fs.existsSync(produktDir)
    ? fs.readdirSync(produktDir).sort()
    : []
  const erwartet = {
    [PAKET_DATEI]: REGAL_GLB_PATH,
    [`${MIT_MODELL.produkt}.glb`]: PRODUKT_GLB_PATH,
  }
  const index = path.join(outDir, 'data', 'produkte-3d.json')
  if (
    dateien.join(',') !== Object.keys(erwartet).sort().join(',') ||
    dateien.some(
      (name) =>
        !fs
          .readFileSync(path.join(produktDir, name))
          .equals(fs.readFileSync(erwartet[name]))
    ) ||
    !fs.existsSync(index) ||
    !fs.readFileSync(index).equals(fs.readFileSync(PRODUKT_INDEX_PATH))
  ) {
    return `${produktDir} enthält nicht genau die synthetischen Produkt-Modelle samt Index (gefunden: ${
      dateien.join(', ') || 'nichts'
    }). Nur mit DIGITALE_BAECKEREI_FIXTURE=1 gebaut - nie mit echten Produkt-Modellen.`
  }
  // Einrichten-Modus (im Fixture-Build zum Testen): die synthetische
  // Einrichtung und die Belegung der Fixture-Modelle - nie eine Datei aus hq.
  const quelle = path.join(outDir, 'data', 'einrichtung.quelle.yaml')
  const modell = path.join(outDir, 'data', 'einrichtung.modell.json')
  if (
    !fs.existsSync(quelle) ||
    !fs.readFileSync(quelle).equals(fs.readFileSync(EINRICHTUNG_PATH)) ||
    !fs.existsSync(modell) ||
    !fs.readFileSync(modell).equals(modellBelegungDatei())
  ) {
    return `${path.join(
      outDir,
      'data'
    )} enthält nicht die synthetische Einrichtung (einrichtung.quelle.yaml, einrichtung.modell.json). Nur mit DIGITALE_BAECKEREI_FIXTURE=1 gebaut - nie mit der Einrichtung aus hq.`
  }
  return null
}

function ladeFixture() {
  const glb = fs.readFileSync(GLB_PATH)
  const { json, bin } = leseGlb(glb)
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'))
  return { glb, json, bin, snapshot, plaetze: plaetze(json) }
}

/**
 * Was die Liste „Alles hier“ für Möbel mit diesen Slot-Präfixen morgens zeigt:
 * die Belegung, wie sie gilt (Modell + synthetische Einrichtung), soweit der
 * Snapshot das Produkt kennt - in der Reihenfolge der Belegung.
 * @param {string[]} moebel  z. B. ['theke/']
 * @returns {{ slot: string, produkt: string, name: string, einheit?: string }[]}
 */
function erwarteteEintraege(moebel) {
  const { snapshot } = ladeFixture()
  return belegung('laden')
    .slots.filter(
      (p) =>
        snapshot.produkte[p.produkt] &&
        moebel.some((prefix) => p.slot.startsWith(prefix))
    )
    .map((p) => ({
      slot: p.slot,
      produkt: p.produkt,
      name: snapshot.produkte[p.produkt].name,
      einheit: snapshot.produkte[p.produkt].einheit,
    }))
}

module.exports = {
  BACKSTUBE_GLB_PATH,
  EINGERICHTET,
  EINRICHTUNG_PATH,
  MIT_REGAL,
  REGAL_GENERATOR_PATH,
  REGAL_GLB_PATH,
  belegung,
  einrichtung,
  modellBelegungDatei,
  RAEUME,
  RAUMINFOS_DIR,
  STATIONEN,
  rauminfosDatei,
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
  plaetze,
  zaehlePreisPrimitive,
}
