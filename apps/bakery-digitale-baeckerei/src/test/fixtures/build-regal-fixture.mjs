#!/usr/bin/env node
/**
 * Schreibt die synthetischen Regal-Modelle `regal.fixture.glb` für Unit- und
 * Playwright-Tests der Einrichtung (DB12) und ihren Abschnitt `regal` in
 * `produkte-3d.fixture.json`: drei erfundene Formen (regal-fixture.js),
 * gepackt in eine Datei - so, wie `sync-produkte-3d` die echten Regal-Modelle
 * aus dem Daten-Repo `produkte-3d` packt (scripts/regal-modelle.js).
 *
 * Deterministisch (fixture.spec.ts prüft die eingecheckten Dateien gegen
 * diese Ausgabe). Nur Node-Bordmittel.
 *
 * Aufruf:
 *   node src/test/fixtures/build-regal-fixture.mjs            schreibt beide Dateien
 *   node src/test/fixtures/build-regal-fixture.mjs --check    Exit 1, wenn eine der Dateien abweicht
 */
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { FORMEN, bauePaket, indexMitRegal } = require('./regal-fixture.js')

const HERE = path.dirname(fileURLToPath(import.meta.url))
const TARGET = path.join(HERE, 'regal.fixture.glb')
const INDEX = path.join(HERE, 'produkte-3d.fixture.json')

const { glb, regal } = bauePaket()
const index = indexMitRegal(JSON.parse(fs.readFileSync(INDEX, 'utf8')), regal)
if (process.argv.includes('--check')) {
  const gleich =
    fs.existsSync(TARGET) &&
    fs.readFileSync(TARGET).equals(glb) &&
    fs.readFileSync(INDEX, 'utf8') === index
  if (!gleich) {
    console.error(
      'regal.fixture.glb oder produkte-3d.fixture.json weicht vom Generator ab - neu erzeugen: node src/test/fixtures/build-regal-fixture.mjs'
    )
    process.exit(1)
  }
  console.log('regal.fixture.glb und Index stimmen mit dem Generator überein')
} else {
  fs.writeFileSync(TARGET, glb)
  fs.writeFileSync(INDEX, index)
  console.log(
    `${path.relative(process.cwd(), TARGET)}: ${glb.length} Bytes, ${
      FORMEN.length
    } Regal-Modelle; Index aktualisiert`
  )
}
