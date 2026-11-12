#!/usr/bin/env node
/**
 * Schreibt den Produkt-Snapshot der Digitalen Bäckerei nach
 * public/data/products.snapshot.json (git-ignoriert): die verfügbaren Produkte
 * aus hq/products/*.md, die im Modell auf einem Platz liegen
 * (public/data/belegung.json aus sync-model), mit ID, Name, Kategorie,
 * Einheit, Kurztext, Text und Link zur Produktseite - OHNE Preise (DB8) und
 * ohne Allergene. Produkte, die das Modell nicht zeigt, bleiben draußen. Die
 * App liest nur diesen Snapshot.
 *
 * - hq kommt aus HQ_PRODUCTS_DIR, sonst <monorepo>/../hq/products (gelesen
 *   über libs/shared/hq-products, denselben Leser wie die Landingpage).
 * - Ohne hq bricht das Skript ab. Es gibt keine Mock-Produkte.
 * - DIGITALE_BAECKEREI_FIXTURE=1 (Tests, e2e, CI ohne hq): kopiert stattdessen
 *   den synthetischen Snapshot src/test/fixtures/products.snapshot.fixture.json
 *   Byte für Byte.
 * - Ohne die Belegung bricht das Skript ab (zuerst sync-model).
 * - Meldet (als Warnung, der Build läuft weiter), welche Produkte die Belegung
 *   zeigt, die es in hq nicht gibt.
 *
 * Aufruf: node scripts/sync-products.mjs   (Nx: `nx run bakery-digitale-baeckerei:sync-products`)
 * Die Logik steht in product-snapshot.js.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import hqProducts from '../../../libs/shared/hq-products/src/index.js'
import productSnapshot from './product-snapshot.js'

const { readHqProducts } = hqProducts
const { baueSnapshot, nurBelegte, pruefeSnapshot, fehlendeProdukte } =
  productSnapshot

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.join(appDir, 'public', 'data')
const target = path.join(dataDir, 'products.snapshot.json')
const belegungPath = path.join(dataDir, 'belegung.json')
const fixturePath = path.join(
  appDir,
  'src',
  'test',
  'fixtures',
  'products.snapshot.fixture.json'
)
const fixtureMode = process.env.DIGITALE_BAECKEREI_FIXTURE === '1'

function fail(message) {
  console.error(`sync-products: ${message}`)
  process.exit(1)
}

/** Erst daneben schreiben, dann umbenennen: nie eine halbe Datei am Ziel. */
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, `${JSON.stringify(value)}\n`)
  fs.renameSync(tmp, file)
}

/** Die Belegung aus dem Modell (sync-model) - ohne sie geht es nicht weiter. */
function leseBelegung() {
  if (!fs.existsSync(belegungPath)) {
    fail(
      'public/data/belegung.json fehlt - zuerst sync-model laufen lassen (nx run bakery-digitale-baeckerei:sync-model).'
    )
  }
  try {
    const belegung = JSON.parse(fs.readFileSync(belegungPath, 'utf8'))
    if (!Array.isArray(belegung.slots)) throw new Error('slots fehlt')
    return belegung
  } catch (err) {
    return fail(
      `public/data/belegung.json lässt sich nicht lesen (${
        err instanceof Error ? err.message : err
      })`
    )
  }
}

const belegung = leseBelegung()
let snapshot
let records = []
if (fixtureMode) {
  if (!fs.existsSync(fixturePath)) {
    fail(
      `DIGITALE_BAECKEREI_FIXTURE=1, aber der synthetische Snapshot fehlt: ${path.relative(
        appDir,
        fixturePath
      )}`
    )
  }
  try {
    snapshot = pruefeSnapshot(JSON.parse(fs.readFileSync(fixturePath, 'utf8')))
  } catch (err) {
    fail(
      `Fixture-Snapshot ungültig: ${err instanceof Error ? err.message : err}`
    )
  }
  // Byte für Byte kopieren: CI und der e2e-Server vergleichen den Export mit
  // genau dieser Datei, um echte Daten in einem Fixture-Build auszuschließen.
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.copyFileSync(fixturePath, target)
  console.log(
    `sync-products: FIXTURE - ${
      Object.keys(snapshot.produkte).length
    } synthetische Produkte aus ${path.relative(appDir, fixturePath)}`
  )
} else {
  const hq = readHqProducts()
  if (!hq.found) {
    fail(
      `Das hq-Produktverzeichnis fehlt: ${hq.dir}\n` +
        '  Die Digitale Bäckerei zeigt nur echte Produktdaten aus hq - es gibt keine Mock-Produkte.\n' +
        '  HQ_PRODUCTS_DIR auf <hq>/products setzen oder hq neben website auschecken.\n' +
        '  Für Tests ohne hq: DIGITALE_BAECKEREI_FIXTURE=1 (synthetische Daten).'
    )
  }
  records = hq.products
  const built = baueSnapshot(records, { erstellt: new Date().toISOString() })
  for (const u of built.uebersprungen) {
    console.warn(`sync-products: WARNUNG ${u.file} übersprungen (${u.grund})`)
  }
  const verfuegbar = Object.keys(built.snapshot.produkte).length
  if (verfuegbar === 0) {
    fail(`Keine verfügbaren Produkte in ${hq.dir} gefunden.`)
  }
  // Nur was im Modell auf einem Platz liegt: Den Rest könnte die App nie
  // zeigen, er läge nur als Text zum Herunterladen im Export.
  const gefiltert = nurBelegte(built.snapshot, belegung)
  try {
    snapshot = pruefeSnapshot(gefiltert.snapshot)
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err))
  }
  console.log(
    `sync-products: ${
      Object.keys(snapshot.produkte).length
    } Produkte, die im Modell liegen, aus ${hq.dir} (${
      records.length
    } Dateien gelesen, ${verfuegbar} verfügbar, ${
      gefiltert.entfernt
    } nicht im Modell und darum ausgelassen), ohne Preise`
  )
  writeJson(target, snapshot)
}

console.log(`  geschrieben: ${path.relative(appDir, target)}`)

// Was zeigt das Modell, das hq nicht hat? Nur melden - der Platz bleibt
// sichtbar, aber ohne Karte.
{
  const r = fehlendeProdukte(belegung, snapshot, records)
  console.log(
    `  Modell: ${r.gefunden} von ${r.imModell} Produkten der Belegung haben Daten`
  )
  if (r.fehlt.length > 0) {
    console.warn(
      `sync-products: WARNUNG ${r.fehlt.length} Produkte im Modell fehlen in ${
        fixtureMode ? 'der Fixture' : 'hq'
      } (sichtbar, aber ohne Karte):`
    )
    for (const id of r.fehlt) console.warn(`  - ${id}`)
  }
  if (r.nichtVerfuegbar.length > 0) {
    console.warn(
      `sync-products: WARNUNG ${r.nichtVerfuegbar.length} Produkte im Modell sind in hq nicht verfügbar (sichtbar, aber ohne Karte):`
    )
    for (const id of r.nichtVerfuegbar) console.warn(`  - ${id}`)
  }
}
