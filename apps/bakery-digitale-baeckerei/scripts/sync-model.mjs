#!/usr/bin/env node
/**
 * Holt das Modell der Digitalen Bäckerei (twin.glb) am festen Commit aus
 * model.lock.json, prüft Größe und sha256 der Quelle, nimmt die Preisschilder
 * heraus (glb-bereinigen.js; DB8: keine Preise, auch nicht als Geometrie in
 * der Datei), prüft das Ergebnis gegen die zweite Prüfsumme im Lock
 * (`ausgeliefert`) und schreibt es nach public/model/ (git-ignoriert). Aus
 * dieser Datei leitet es die Belegung ab (public/data/belegung.json,
 * git-ignoriert): welches Produkt morgens auf welchem Platz liegt. Weicht
 * eine Prüfsumme ab, bricht das Skript ab und schreibt nichts. Liegt die
 * ausgelieferte Datei schon passend da, wird nichts geladen. Das Original der
 * Quelle liegt nie unter public/.
 *
 * Der Katalog des Explorers (catalogue.json) wird NICHT mehr geladen: er trägt
 * Preise, alles unter public/ wird ausgeliefert, und die App braucht ihn nicht
 * (Texte kommen aus hq, die Zuordnung aus dem GLB). Was in public/model/ liegt
 * und nicht im Lock steht (z. B. ein catalogue.json von früher), wird gelöscht.
 *
 * DIGITALE_BAECKEREI_FIXTURE=1 (Tests, e2e, CI): kein Download - das
 * synthetische src/test/fixtures/twin.fixture.glb wird genauso bereinigt
 * (es trägt dafür eigene Preiskarten), nach public/model/twin.glb geschrieben
 * und die Belegung daraus abgeleitet.
 *
 * Das Modell gehört NICHT in dieses öffentliche Repo
 * (docs/apps/digitale-baeckerei.md, „Rechte und Datenschutz“).
 *
 * Aufruf: node scripts/sync-model.mjs   (Nx: `nx run bakery-digitale-baeckerei:sync-model`)
 * Nur Node-Bordmittel (fetch ab Node 18); die Logik steht in model-lock.js,
 * glb-bereinigen.js und belegung.js.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import modelLock from './model-lock.js'
import belegungLib from './belegung.js'
import bereinigen from './glb-bereinigen.js'

const { parseLock, planSync, checkFile, sha256Hex, staleFiles } = modelLock
const { bereinigeGlb, zaehlePreisPrimitive } = bereinigen
const { belegungAusGlb } = belegungLib

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const lockPath = path.join(appDir, 'model.lock.json')
const targetDir = path.join(appDir, 'public', 'model')
const belegungPath = path.join(appDir, 'public', 'data', 'belegung.json')
const fixturePath = path.join(
  appDir,
  'src',
  'test',
  'fixtures',
  'twin.fixture.glb'
)
const MODEL_FILE = 'twin.glb'
const TIMEOUT_MS = 120_000
const fixtureMode = process.env.DIGITALE_BAECKEREI_FIXTURE === '1'

function fail(message) {
  console.error(`sync-model: ${message}`)
  process.exit(1)
}

/** Erst daneben schreiben, dann umbenennen: nie eine halbe Datei am Ziel. */
function writeAtomic(dest, data) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  const tmp = `${dest}.${process.pid}.tmp`
  fs.writeFileSync(tmp, data)
  fs.renameSync(tmp, dest)
}

/**
 * Nimmt die Preisschilder aus dem GLB und prüft, dass keines übrig ist.
 * @param {Uint8Array} data
 * @returns {Uint8Array}
 */
function bereinige(data) {
  let result
  try {
    result = bereinigeGlb(data)
  } catch (err) {
    fail(
      `${MODEL_FILE} lässt sich nicht bereinigen (${
        err instanceof Error ? err.message : String(err)
      }). Nichts geschrieben.`
    )
  }
  const rest = zaehlePreisPrimitive(result.glb)
  if (rest.primitive !== 0 || rest.materialien !== 0) {
    fail(
      `${MODEL_FILE}: nach der Bereinigung sind noch Preisschilder im Modell`
    )
  }
  const b = result.bericht
  console.log(
    `  ${MODEL_FILE}: Preisschilder entfernt - ${b.primitive} Primitive, ${b.accessors} Accessors, ${b.bufferViews} BufferViews, ${b.materialien} Materialien; ${b.bytesVorher} → ${b.bytesNachher} Bytes`
  )
  return result.glb
}

function schreibeBelegung(glb, commit) {
  let result
  try {
    result = belegungAusGlb(glb, commit)
  } catch (err) {
    fail(
      `Belegung lässt sich nicht aus ${MODEL_FILE} lesen (${
        err instanceof Error ? err.message : String(err)
      })`
    )
  }
  for (const slot of result.doppelt) {
    console.warn(
      `sync-model: WARNUNG Platz ${slot} ist im Modell doppelt belegt`
    )
  }
  writeAtomic(belegungPath, `${JSON.stringify(result.belegung)}\n`)
  const produkte = new Set(result.belegung.slots.map((s) => s.produkt))
  console.log(
    `  belegung.json: ${result.belegung.slots.length} Plätze, ${produkte.size} Produkte (morgens)`
  )
}

function raeumeAuf(keep) {
  let names = []
  try {
    names = fs.readdirSync(targetDir)
  } catch {
    return
  }
  for (const name of staleFiles(names, keep)) {
    fs.rmSync(path.join(targetDir, name), { recursive: true, force: true })
    console.log(`  ${name}: gelöscht (steht nicht im Lock)`)
  }
}

if (fixtureMode) {
  if (!fs.existsSync(fixturePath)) {
    fail(
      `DIGITALE_BAECKEREI_FIXTURE=1, aber das synthetische Modell fehlt: ${path.relative(
        appDir,
        fixturePath
      )}`
    )
  }
  const quelle = new Uint8Array(fs.readFileSync(fixturePath))
  console.log(
    `sync-model: FIXTURE - synthetisches Modell ${path.relative(
      appDir,
      fixturePath
    )}, kein Download`
  )
  const glb = bereinige(quelle)
  raeumeAuf([MODEL_FILE])
  writeAtomic(path.join(targetDir, MODEL_FILE), glb)
  console.log(`  ${MODEL_FILE}: ${glb.byteLength} Bytes geschrieben`)
  schreibeBelegung(glb, 'fixture')
  process.exit(0)
}

let lock
try {
  lock = parseLock(JSON.parse(fs.readFileSync(lockPath, 'utf8')))
} catch (err) {
  fail(err instanceof Error ? err.message : String(err))
}
if (!Object.prototype.hasOwnProperty.call(lock.files, MODEL_FILE)) {
  fail(`model.lock.json kennt ${MODEL_FILE} nicht`)
}
// Ohne zweite Prüfsumme ließe sich nicht belegen, was ausgeliefert wird.
const served = lock.files[MODEL_FILE].ausgeliefert
if (!served) {
  fail(
    `model.lock.json: files["${MODEL_FILE}"].ausgeliefert fehlt (sha256 und bytes der bereinigten Datei)`
  )
}

const plan = planSync(lock, (name) => {
  try {
    return fs.readFileSync(path.join(targetDir, name))
  } catch {
    return null
  }
})

fs.mkdirSync(targetDir, { recursive: true })
console.log(
  `sync-model: ${lock.source.repo}@${lock.source.commit.slice(0, 12)} (${
    lock.source.path
  })`
)
raeumeAuf(Object.keys(lock.files))

for (const item of plan) {
  if (item.action === 'keep') {
    console.log(`  ${item.name}: ${item.reason}`)
    continue
  }
  console.log(`  ${item.name}: ${item.reason} - lade ${item.url}`)
  let data
  try {
    const res = await fetch(item.url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'follow',
    })
    if (!res.ok) fail(`${item.name}: HTTP ${res.status} von ${item.url}`)
    data = new Uint8Array(await res.arrayBuffer())
  } catch (err) {
    fail(
      `${item.name}: Download fehlgeschlagen (${
        err instanceof Error ? err.message : String(err)
      })`
    )
  }
  const check = checkFile(data, item.entry)
  if (!check.ok) {
    fail(
      `${item.name}: Prüfsumme stimmt nicht (${check.reason}). Nichts geschrieben. ` +
        'Ein neues Modell übernimmt man bewusst: Commit und Prüfsummen in model.lock.json ändern.'
    )
  }
  console.log(
    `  ${item.name}: ${data.byteLength} Bytes, sha256 der Quelle geprüft`
  )
  let out = data
  if (item.entry.ausgeliefert) {
    out = bereinige(data)
    const nachher = checkFile(out, item.entry.ausgeliefert)
    if (!nachher.ok) {
      fail(
        `${item.name}: die bereinigte Datei passt nicht zu "ausgeliefert" im Lock (${nachher.reason}). Nichts geschrieben. ` +
          `Ist: sha256 ${sha256Hex(out)}, ${out.byteLength} Bytes. ` +
          'Nach einem neuen Modell oder einer Änderung an glb-bereinigen.js trägt man diese Werte bewusst in model.lock.json ein - und schaut sich das Modell vorher an.'
      )
    }
  }
  writeAtomic(path.join(targetDir, item.name), out)
  console.log(
    `  ${item.name}: ${out.byteLength} Bytes geschrieben, sha256 der ausgelieferten Datei geprüft`
  )
}

// Die Belegung nur aus dem geprüften, ausgelieferten GLB: noch einmal lesen
// und prüfen - auch, dass wirklich kein Preisschild mehr darin steckt.
const glb = new Uint8Array(fs.readFileSync(path.join(targetDir, MODEL_FILE)))
const check = checkFile(glb, served)
if (!check.ok) fail(`${MODEL_FILE}: Prüfsumme stimmt nicht (${check.reason})`)
const rest = zaehlePreisPrimitive(glb)
if (rest.primitive !== 0 || rest.materialien !== 0) {
  fail(`${MODEL_FILE}: im ausgelieferten Modell stecken Preisschilder`)
}
schreibeBelegung(glb, lock.source.commit)
