/**
 * Prüft einen fertigen Export (`out/`), bevor er öffentlich wird: Der
 * Deploy-Workflow ruft das über scripts/pruefe-export.mjs auf und bricht ab,
 * wenn etwas nicht stimmt. Gemeldet werden nur Dateinamen und Zahlen - nie
 * Inhalte (die Logs eines öffentlichen Repos sind öffentlich).
 *
 * Geprüft wird:
 * - kein Fixture-Build (DIGITALE_BAECKEREI_FIXTURE darf nicht gesetzt sein) -
 *   sonst ginge die Testseite live;
 * - der Export ist für den erwarteten Unterpfad gebaut;
 * - `model/` enthält nur die Dateien aus dem Lock, und `twin.glb` ist genau
 *   die bereinigte Datei (`ausgeliefert` in model.lock.json), ohne Preisschilder;
 * - `data/` enthält nur Belegung und Snapshot; der Snapshot hält den Vertrag
 *   ein (`pruefeSnapshot`: nur erlaubte Felder, kein „€“) und nennt kein
 *   Produkt, das nicht im Modell liegt;
 * - in keiner Datei des Exports steht ein „€“ (DB8).
 *
 * CommonJS, nur Node-Bordmittel; getestet in export-pruefung.spec.ts.
 */
const fs = require('fs')
const path = require('path')
const { checkFile, staleFiles } = require('./model-lock')
const { zaehlePreisPrimitive } = require('./glb-bereinigen')
const { pruefeSnapshot } = require('./product-snapshot')

const FIXTURE_ENV = 'DIGITALE_BAECKEREI_FIXTURE'
const EURO = Buffer.from('€', 'utf8')
const DATEN = ['belegung.json', 'products.snapshot.json']

/** Alle Dateien unter `dir`, relativ, sortiert. @param {string} dir @returns {string[]} */
function alleDateien(dir) {
  /** @type {string[]} */
  const out = []
  /** @param {string} rel */
  const walk = (rel) => {
    for (const entry of fs.readdirSync(path.join(dir, rel), {
      withFileTypes: true,
    })) {
      const next = rel ? `${rel}/${entry.name}` : entry.name
      if (entry.isDirectory()) walk(next)
      else out.push(next)
    }
  }
  walk('')
  return out.sort()
}

/** @param {string} dir @returns {string[]} */
function namenIn(dir) {
  try {
    return fs.readdirSync(dir).sort()
  } catch {
    return []
  }
}

/**
 * @param {{
 *   outDir: string,
 *   lock: import('./model-lock').ModelLock,
 *   env?: Record<string, string | undefined>,
 *   basePath?: string,
 * }} o  `basePath` z. B. '/digitale-baeckerei' ('' oder weglassen: nicht prüfen)
 * @returns {string[]} Meldungen - leer heißt: darf raus
 */
function pruefeExport({ outDir, lock, env = {}, basePath = '' }) {
  /** @type {string[]} */
  const fehler = []

  if (env[FIXTURE_ENV] !== undefined && env[FIXTURE_ENV] !== '') {
    fehler.push(
      `${FIXTURE_ENV} ist gesetzt - ein Export mit dem Test-Modell darf nicht veröffentlicht werden`
    )
  }

  const index = path.join(outDir, 'index.html')
  if (!fs.existsSync(index)) {
    fehler.push('index.html fehlt - es gibt keinen Export')
    return fehler
  }
  if (basePath) {
    const html = fs.readFileSync(index, 'utf8')
    if (!html.includes(`"${basePath}/_next/`)) {
      fehler.push(
        `Der Export ist nicht für den Unterpfad ${basePath} gebaut (DIGITALE_BAECKEREI_BASE_PATH)`
      )
    }
  }

  // Modell: nur was im Lock steht, und genau die bereinigte Datei.
  const modelDir = path.join(outDir, 'model')
  for (const name of staleFiles(namenIn(modelDir), Object.keys(lock.files))) {
    fehler.push(`model/${name} steht nicht im Lock und darf nicht raus`)
  }
  for (const [name, entry] of Object.entries(lock.files)) {
    const file = path.join(modelDir, name)
    if (!entry.ausgeliefert) {
      fehler.push(
        `model.lock.json: ausgeliefert für ${name} fehlt - es lässt sich nicht belegen, was ausgeliefert wird`
      )
      continue
    }
    if (!fs.existsSync(file)) {
      fehler.push(`model/${name} fehlt`)
      continue
    }
    const data = new Uint8Array(fs.readFileSync(file))
    const check = checkFile(data, entry.ausgeliefert)
    if (!check.ok) {
      fehler.push(
        `model/${name} ist nicht die Datei aus dem Lock (${check.reason})`
      )
      continue
    }
    if (name.endsWith('.glb')) {
      const rest = zaehlePreisPrimitive(data)
      if (rest.primitive !== 0 || rest.materialien !== 0) {
        fehler.push(`model/${name} enthält Preisschilder`)
      }
    }
  }

  // Daten: nur Belegung und Snapshot, der Snapshot im Vertrag.
  const dataDir = path.join(outDir, 'data')
  for (const name of staleFiles(namenIn(dataDir), DATEN)) {
    fehler.push(`data/${name} gehört nicht in den Export`)
  }
  /** @param {string} name */
  const liesJson = (name) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'))
    } catch {
      fehler.push(`data/${name} fehlt oder lässt sich nicht lesen`)
      return null
    }
  }
  const belegung = liesJson('belegung.json')
  const snapshotRaw = liesJson('products.snapshot.json')
  if (snapshotRaw !== null) {
    try {
      const snapshot = pruefeSnapshot(snapshotRaw)
      const belegt = new Set(
        Array.isArray(belegung?.slots)
          ? belegung.slots.map(
              (/** @type {{ produkt?: unknown }} */ s) => s.produkt
            )
          : []
      )
      const fremd = Object.keys(snapshot.produkte).filter(
        (id) => !belegt.has(id)
      )
      if (fremd.length > 0) {
        fehler.push(
          `data/products.snapshot.json nennt ${fremd.length} Produkt(e), die nicht im Modell liegen`
        )
      }
    } catch (err) {
      // Die Meldungen von pruefeSnapshot nennen Produkt-ID und Feld, keinen Inhalt.
      fehler.push(
        `data/products.snapshot.json: ${
          err instanceof Error ? err.message : String(err)
        }`
      )
    }
  }

  // Kein „€“ - nirgends im Export.
  for (const rel of alleDateien(outDir)) {
    if (fs.readFileSync(path.join(outDir, rel)).includes(EURO)) {
      fehler.push(`${rel} enthält „€“ - vorerst keine Preise (DB8)`)
    }
  }

  return fehler
}

module.exports = { FIXTURE_ENV, pruefeExport }
