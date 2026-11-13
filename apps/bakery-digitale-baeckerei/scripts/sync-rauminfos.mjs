#!/usr/bin/env node
/**
 * Schreibt die Infopunkte der Räume nach public/data/rauminfos.json
 * (git-ignoriert): je Raum, dessen Modell in model.lock.json steht, die Datei
 * `<hq>/config/digitale-baeckerei/raeume/<raum>.yaml` - wenn es sie gibt.
 * Format und Leser: rauminfos.js.
 *
 * - Der Ordner kommt aus HQ_DIGITALE_BAECKEREI_DIR, sonst liegt er neben dem
 *   Produktverzeichnis: `<HQ_PRODUCTS_DIR>/../config/digitale-baeckerei`
 *   (ohne HQ_PRODUCTS_DIR: `<monorepo>/../hq/…`).
 * - Fehlt der Ordner oder die Datei eines Raums, hat der Raum keine
 *   Infopunkte: leere Datei, Exit 0. Texte werden nie erfunden.
 * - Eine Datei, die nicht dem Vertrag entspricht, bricht den Build ab. Die
 *   Meldung nennt Datei, Stelle und Feld - nie den Inhalt.
 * - Dateien für Räume ohne Modell im Lock bleiben liegen: Was nicht gebaut
 *   wird, kommt auch nicht als Text in den Export.
 * - DIGITALE_BAECKEREI_FIXTURE=1 (Tests, e2e, CI): liest stattdessen die
 *   synthetischen Dateien aus src/test/fixtures/raeume/ für die Räume des
 *   Fixtures - derselbe Leser, kein hq.
 *
 * Aufruf: node scripts/sync-rauminfos.mjs   (Nx: `nx run bakery-digitale-baeckerei:sync-rauminfos`)
 */
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import hqProducts from '../../../libs/shared/hq-products/src/index.js'
import modelLock from './model-lock.js'
import rauminfosLib from './rauminfos.js'

const { alsDatei, leseVerzeichnis } = rauminfosLib

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const target = path.join(appDir, 'public', 'data', 'rauminfos.json')
const fixtureMode = process.env.DIGITALE_BAECKEREI_FIXTURE === '1'

function fail(message) {
  console.error(`sync-rauminfos: ${message}`)
  process.exit(1)
}

let dir
let raumIds
if (fixtureMode) {
  const fixture = createRequire(import.meta.url)(
    '../src/test/fixtures/fixture-info.js'
  )
  dir = fixture.RAUMINFOS_DIR
  raumIds = fixture.RAEUME.map((r) => r.id)
} else {
  dir =
    process.env.HQ_DIGITALE_BAECKEREI_DIR ||
    path.join(
      hqProducts.resolveHqProductsDir(),
      '..',
      'config',
      'digitale-baeckerei'
    )
  dir = path.join(dir, 'raeume')
  try {
    raumIds = Object.keys(
      modelLock.parseLock(
        JSON.parse(
          fs.readFileSync(path.join(appDir, 'model.lock.json'), 'utf8')
        )
      ).raeume
    )
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err))
  }
}

let ergebnis
try {
  ergebnis = leseVerzeichnis(dir, raumIds)
} catch (err) {
  fail(err instanceof Error ? err.message : String(err))
}

fs.mkdirSync(path.dirname(target), { recursive: true })
const tmp = `${target}.${process.pid}.tmp`
fs.writeFileSync(tmp, alsDatei(ergebnis.rauminfos))
fs.renameSync(tmp, target)

// Nur Dateinamen und Zahlen - nie Inhalte aus hq (öffentliche Logs).
const anzahl = Object.values(ergebnis.rauminfos.raeume).reduce(
  (n, raum) => n + raum.infopunkte.length,
  0
)
console.log(
  `sync-rauminfos: ${fixtureMode ? 'FIXTURE - ' : ''}${anzahl} Infopunkte in ${
    Object.keys(ergebnis.rauminfos.raeume).length
  } von ${raumIds.length} Räumen${
    ergebnis.gelesen.length > 0
      ? ` (gelesen: ${ergebnis.gelesen.join(', ')})`
      : ' (keine Datei gefunden)'
  }`
)
console.log(`  geschrieben: ${path.relative(appDir, target)}`)
