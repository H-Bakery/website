#!/usr/bin/env node
/**
 * Prüft den fertigen Export der Digitalen Bäckerei, bevor er öffentlich wird
 * (Deploy-Workflow, Schritt nach dem Build). Exit 1 mit deutschen Meldungen,
 * wenn etwas nicht stimmt - dann wird nichts veröffentlicht. Die Logik steht in
 * export-pruefung.js.
 *
 * Aufruf: node scripts/pruefe-export.mjs [--base-path /digitale-baeckerei] [--mit-produkte-3d] [outDir]
 *   outDir: Standard `out` neben diesem Ordner.
 *   --mit-produkte-3d: 3D-Modelle einzelner Produkte (Nahansicht, Regal-Modelle)
 *     dürfen im Export liegen und müssen dann zum Index passen. Ohne den
 *     Schalter (so läuft der Deploy, DB9) darf keines darin sein.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import modelLock from './model-lock.js'
import pruefung from './export-pruefung.js'

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const at = args.indexOf('--base-path')
const basePath = at >= 0 ? args.splice(at, 2)[1] ?? '' : ''
const mit3d = args.indexOf('--mit-produkte-3d')
if (mit3d >= 0) args.splice(mit3d, 1)
const outDir = path.resolve(args[0] ?? path.join(appDir, 'out'))

let lock
try {
  lock = modelLock.parseLock(
    JSON.parse(fs.readFileSync(path.join(appDir, 'model.lock.json'), 'utf8'))
  )
} catch (err) {
  console.error(
    `pruefe-export: ${err instanceof Error ? err.message : String(err)}`
  )
  process.exit(1)
}

const fehler = pruefung.pruefeExport({
  outDir,
  lock,
  env: process.env,
  basePath,
  produkte3d: mit3d >= 0 ? 'erlaubt' : 'verboten',
})
if (fehler.length > 0) {
  console.error(
    `pruefe-export: Der Export darf so nicht veröffentlicht werden (${fehler.length}):`
  )
  for (const zeile of fehler) console.error(`  - ${zeile}`)
  process.exit(1)
}
const modelle = Object.entries(lock.raeume)
  .map(([raum, { ausgeliefert: served }]) =>
    served
      ? `${raum} sha256 ${served.sha256.slice(0, 12)}…, ${served.bytes} Bytes`
      : raum
  )
  .join('; ')
console.log(
  `pruefe-export: in Ordnung - Modell ${modelle}, ohne Preisschilder; Snapshot und Rauminfos im Vertrag; ${
    mit3d >= 0
      ? '3D-Modelle einzelner Produkte passen zum Index'
      : 'keine 3D-Modelle einzelner Produkte'
  }; kein Einrichten-Modus; kein Test-Raum; kein „€“ im Export.`
)
