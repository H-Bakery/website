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

const GLB_PATH = path.join(__dirname, 'twin.fixture.glb')
const SNAPSHOT_PATH = path.join(__dirname, 'products.snapshot.fixture.json')
const GENERATOR_PATH = path.join(__dirname, 'build-fixture.mjs')

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
 * @returns {Buffer}
 */
function ausgeliefertesModell() {
  return Buffer.from(bereinigeGlb(fs.readFileSync(GLB_PATH)).glb)
}

/**
 * Enthält ein Export (`out/`) genau die synthetischen Fixtures - das bereinigte
 * Mini-Modell und den Fixture-Snapshot, Byte für Byte? Liefert sonst die
 * Meldung, was nicht stimmt. Dieselbe Prüfung für den e2e-Server
 * (`serve-fixture.js`) und den `build`-Job in CI: Das echte Modell und echte
 * Produkttexte dürfen in keinem öffentlichen Artefakt landen.
 * @param {string} outDir
 * @returns {string | null}
 */
function exportFehler(outDir) {
  const model = path.join(outDir, 'model', 'twin.glb')
  const snapshot = path.join(outDir, 'data', 'products.snapshot.json')
  if (
    !fs.existsSync(model) ||
    !fs.readFileSync(model).equals(ausgeliefertesModell())
  ) {
    return `${model} ist nicht das synthetische Fixture (bereinigt). Nur mit DIGITALE_BAECKEREI_FIXTURE=1 gebaut - nie mit dem echten Modell.`
  }
  if (
    !fs.existsSync(snapshot) ||
    !fs.readFileSync(snapshot).equals(fs.readFileSync(SNAPSHOT_PATH))
  ) {
    return `${snapshot} ist nicht der synthetische Snapshot. Nur mit DIGITALE_BAECKEREI_FIXTURE=1 gebaut - nie mit echten Produkttexten.`
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
 * Plätze mit `product`, das es im Snapshot gibt - in der Reihenfolge des Modells.
 * @param {string[]} moebel  z. B. ['theke/']
 * @returns {{ slot: string, produkt: string, name: string, einheit?: string }[]}
 */
function erwarteteEintraege(moebel) {
  const { snapshot, plaetze: alle } = ladeFixture()
  return alle
    .filter(
      (p) =>
        p.fills.includes('morgens') &&
        p.produkt &&
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
  GENERATOR_PATH,
  GLB_PATH,
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
