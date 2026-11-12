#!/usr/bin/env node
/**
 * Holt das Modell der Digitalen Bäckerei (twin.glb) am festen Commit aus
 * model.lock.json nach public/model/ (git-ignoriert), prüft Größe und sha256
 * und leitet aus dem geprüften GLB die Belegung ab (public/data/belegung.json,
 * git-ignoriert): welches Produkt morgens auf welchem Platz liegt. Weicht die
 * Prüfsumme ab, bricht das Skript ab und schreibt nichts. Liegt die Datei
 * schon passend da, wird sie nicht neu geladen.
 *
 * Der Katalog des Explorers (catalogue.json) wird NICHT mehr geladen: er trägt
 * Preise, alles unter public/ wird ausgeliefert, und die App braucht ihn nicht
 * (Texte kommen aus hq, die Zuordnung aus dem GLB). Was in public/model/ liegt
 * und nicht im Lock steht (z. B. ein catalogue.json von früher), wird gelöscht.
 *
 * DIGITALE_BAECKEREI_FIXTURE=1 (Tests, e2e, CI): kein Download - das
 * synthetische src/test/fixtures/twin.fixture.glb wird nach
 * public/model/twin.glb kopiert und die Belegung genauso daraus abgeleitet.
 *
 * Das Modell gehört NICHT in dieses öffentliche Repo
 * (docs/apps/digitale-baeckerei.md, „Rechte und Datenschutz“).
 *
 * Aufruf: node scripts/sync-model.mjs   (Nx: `nx run bakery-digitale-baeckerei:sync-model`)
 * Nur Node-Bordmittel (fetch ab Node 18); die Logik steht in model-lock.js
 * und belegung.js.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import modelLock from './model-lock.js'
import belegungLib from './belegung.js'

const { parseLock, planSync, checkFile, staleFiles } = modelLock
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
  const glb = new Uint8Array(fs.readFileSync(fixturePath))
  console.log(
    `sync-model: FIXTURE - synthetisches Modell ${path.relative(
      appDir,
      fixturePath
    )}, kein Download`
  )
  raeumeAuf([MODEL_FILE])
  writeAtomic(path.join(targetDir, MODEL_FILE), glb)
  console.log(`  ${MODEL_FILE}: ${glb.byteLength} Bytes kopiert`)
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
  writeAtomic(path.join(targetDir, item.name), data)
  console.log(`  ${item.name}: ${data.byteLength} Bytes, sha256 geprüft`)
}

// Die Belegung nur aus dem geprüften GLB: noch einmal lesen und prüfen.
const glb = new Uint8Array(fs.readFileSync(path.join(targetDir, MODEL_FILE)))
const check = checkFile(glb, lock.files[MODEL_FILE])
if (!check.ok) fail(`${MODEL_FILE}: Prüfsumme stimmt nicht (${check.reason})`)
schreibeBelegung(glb, lock.source.commit)
