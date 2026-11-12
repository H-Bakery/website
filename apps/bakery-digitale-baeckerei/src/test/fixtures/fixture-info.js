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
 * prüft Kopf und Längen.
 * @param {Buffer} buffer
 * @returns {{ json: any, bin: Buffer }}
 */
function leseGlb(buffer) {
  if (buffer.length < 20 || buffer.readUInt32LE(0) !== 0x46546c67) {
    throw new Error('Kein GLB: Kennung "glTF" fehlt')
  }
  if (buffer.readUInt32LE(4) !== 2) throw new Error('Kein glTF 2.0')
  if (buffer.readUInt32LE(8) !== buffer.length) {
    throw new Error('GLB: Länge im Kopf passt nicht zur Datei')
  }
  const jsonLength = buffer.readUInt32LE(12)
  if (buffer.readUInt32LE(16) !== 0x4e4f534a) {
    throw new Error('GLB: erster Chunk ist nicht JSON')
  }
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8'))
  let bin = Buffer.alloc(0)
  const next = 20 + jsonLength
  if (next < buffer.length) {
    const binLength = buffer.readUInt32LE(next)
    if (buffer.readUInt32LE(next + 4) !== 0x004e4942) {
      throw new Error('GLB: zweiter Chunk ist nicht BIN')
    }
    if (next + 8 + binLength !== buffer.length) {
      throw new Error('GLB: BIN-Chunk passt nicht zur Dateilänge')
    }
    bin = buffer.subarray(next + 8, next + 8 + binLength)
  }
  return { json, bin }
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

function ladeFixture() {
  const { json, bin } = leseGlb(fs.readFileSync(GLB_PATH))
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'))
  return { json, bin, snapshot, plaetze: plaetze(json) }
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
  erwarteteEintraege,
  ladeFixture,
  leseGlb,
  plaetze,
}
