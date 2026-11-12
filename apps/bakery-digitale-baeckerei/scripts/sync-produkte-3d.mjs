#!/usr/bin/env node
/**
 * Holt die 3D-Modelle einzelner Produkte (Nahansicht im Produkt-Sheet, DB7)
 * aus dem Daten-Repo `produkte-3d` nach public/produkte-3d/<id>.glb und
 * schreibt den Index public/data/produkte-3d.json - beides git-ignoriert.
 *
 * Das Daten-Repo liegt vorerst NUR LOKAL neben `website` und `hq`, ohne Remote
 * (DB9). Gelesen wird genau der Commit aus produkte-3d.lock.json, unabhängig
 * vom Arbeitsverzeichnis dort:
 *   git -C <dir> show <commit>:manifest.json
 *   git -C <dir> show <commit>:models/<id>/model.glb
 * Jede Datei wird gegen Größe und sha256 aus dem Lock geprüft; bei einer
 * Abweichung bricht das Skript ab.
 *
 * - **Gibt es das Daten-Repo nicht** (CI, Deploy, andere Rechner): leerer
 *   Index, eine Info-Zeile, Exit 0. Die App bietet dann keine Nahansicht an.
 *   Das darf nie einen Build brechen.
 * - DIGITALE_BAECKEREI_FIXTURE=1 (Tests, e2e, CI): das synthetische
 *   src/test/fixtures/produkt.fixture.glb und sein Index, Byte für Byte.
 * - Was in public/produkte-3d/ liegt und nicht im Index steht, wird gelöscht.
 *
 * Die echten Modelle gehören NICHT in dieses öffentliche Repo.
 *
 * Aufruf: node scripts/sync-produkte-3d.mjs
 *   (Nx: `nx run bakery-digitale-baeckerei:sync-produkte-3d`)
 *   PRODUKTE_3D_DIR=<pfad>   das Daten-Repo (sonst ../../../produkte-3d von der App aus)
 *   --out <ordner>           statt public/ (nur für Tests)
 *   --lock <datei>           statt produkte-3d.lock.json (nur für Tests)
 * Nur Node-Bordmittel und git; die Logik steht in produkte-3d-lock.js.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import lib from './produkte-3d-lock.js'

const {
  ZIEL_ORDNER,
  baueIndex,
  leererIndex,
  parseLock,
  pruefeIndex,
  pruefeManifest,
  pruefeModell,
  ueberzaehlig,
} = lib

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const arg = (name) => {
  const at = args.indexOf(name)
  return at >= 0 && args[at + 1] ? path.resolve(args[at + 1]) : null
}
const publicDir = arg('--out') ?? path.join(appDir, 'public')
const lockPath = arg('--lock') ?? path.join(appDir, 'produkte-3d.lock.json')
const modelDir = path.join(publicDir, ZIEL_ORDNER)
const indexPath = path.join(publicDir, 'data', 'produkte-3d.json')
const fixtureDir = path.join(appDir, 'src', 'test', 'fixtures')
const fixtureGlb = path.join(fixtureDir, 'produkt.fixture.glb')
const fixtureIndex = path.join(fixtureDir, 'produkte-3d.fixture.json')
const repoDir = path.resolve(
  process.env.PRODUKTE_3D_DIR ||
    path.join(appDir, '..', '..', '..', ZIEL_ORDNER)
)
const fixtureMode = process.env.DIGITALE_BAECKEREI_FIXTURE === '1'
/** Je Modell höchstens 3 MB (Vertrag des Daten-Repos) - mit Luft. */
const MAX_BUFFER = 16 * 1024 * 1024

function fail(message) {
  console.error(`sync-produkte-3d: ${message}`)
  process.exit(1)
}

const text = (err) => (err instanceof Error ? err.message : String(err))

/** Erst daneben schreiben, dann umbenennen: nie eine halbe Datei am Ziel. */
function writeAtomic(dest, data) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  const tmp = `${dest}.${process.pid}.tmp`
  fs.writeFileSync(tmp, data)
  fs.renameSync(tmp, dest)
}

/** Alles aus public/produkte-3d/ löschen, was der Index nicht nennt. */
function raeumeAuf(index) {
  let names = []
  try {
    names = fs.readdirSync(modelDir)
  } catch {
    return
  }
  for (const name of ueberzaehlig(names, index)) {
    fs.rmSync(path.join(modelDir, name), { recursive: true, force: true })
    console.log(`  ${name}: gelöscht (steht nicht im Index)`)
  }
}

function gitShow(objekt) {
  return execFileSync('git', ['-C', repoDir, 'show', objekt], {
    maxBuffer: MAX_BUFFER,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

if (fixtureMode) {
  let index
  try {
    index = pruefeIndex(JSON.parse(fs.readFileSync(fixtureIndex, 'utf8')))
  } catch (err) {
    fail(`Fixture-Index ungültig oder fehlt: ${text(err)}`)
  }
  if (!fs.existsSync(fixtureGlb)) {
    fail(
      `DIGITALE_BAECKEREI_FIXTURE=1, aber das synthetische Produkt-Modell fehlt: ${path.relative(
        appDir,
        fixtureGlb
      )}`
    )
  }
  const glb = fs.readFileSync(fixtureGlb)
  console.log(
    `sync-produkte-3d: FIXTURE - synthetisches Produkt-Modell ${path.relative(
      appDir,
      fixtureGlb
    )}`
  )
  raeumeAuf(index)
  for (const [id, eintrag] of Object.entries(index.modelle)) {
    if (eintrag.bytes !== glb.byteLength) {
      fail(
        `Fixture-Index nennt für ${id} ${eintrag.bytes} Bytes, die Datei hat ${glb.byteLength}`
      )
    }
    writeAtomic(path.join(modelDir, `${id}.glb`), glb)
    console.log(`  ${id}.glb: ${glb.byteLength} Bytes kopiert`)
  }
  // Byte für Byte: CI und der e2e-Server vergleichen den Export damit.
  fs.mkdirSync(path.dirname(indexPath), { recursive: true })
  fs.copyFileSync(fixtureIndex, indexPath)
  process.exit(0)
}

if (!fs.existsSync(repoDir)) {
  const index = leererIndex()
  raeumeAuf(index)
  writeAtomic(indexPath, `${JSON.stringify(index)}\n`)
  console.log(
    `sync-produkte-3d: INFO kein Daten-Repo unter ${repoDir} - leerer Index, die App bietet keine Nahansicht an (PRODUKTE_3D_DIR setzt den Pfad)`
  )
  process.exit(0)
}

let lock
try {
  lock = parseLock(JSON.parse(fs.readFileSync(lockPath, 'utf8')))
} catch (err) {
  fail(text(err))
}

console.log(
  `sync-produkte-3d: ${repoDir}@${lock.commit.slice(0, 12)} (${lock.quelle})`
)

let geprueft
try {
  geprueft = pruefeManifest(
    JSON.parse(gitShow(`${lock.commit}:manifest.json`).toString('utf8')),
    lock
  )
} catch (err) {
  fail(
    `manifest.json am gesperrten Commit lässt sich nicht lesen oder passt nicht zum Lock (${text(
      err
    )}). Ein neuer Stand wird bewusst übernommen: commit, sha256 und bytes in produkte-3d.lock.json ändern.`
  )
}
for (const id of geprueft.nichtImLock) {
  console.log(`  ${id}: im Manifest, aber nicht im Lock - ausgelassen`)
}

// Erst alles lesen und prüfen, dann schreiben: bei einer Abweichung bleibt
// nichts Halbes liegen.
const dateien = []
for (const { id, pfad } of geprueft.modelle) {
  let data
  try {
    data = new Uint8Array(gitShow(`${lock.commit}:${pfad}`))
  } catch (err) {
    fail(`${id}: ${pfad} lässt sich nicht lesen (${text(err)})`)
  }
  const check = pruefeModell(data, lock.modelle[id])
  if (!check.ok) {
    fail(`${id}: Prüfsumme stimmt nicht (${check.reason}). Nichts geschrieben.`)
  }
  dateien.push({ id, data })
}

const index = baueIndex(lock, geprueft.modelle)
raeumeAuf(index)
for (const { id, data } of dateien) {
  writeAtomic(path.join(modelDir, `${id}.glb`), data)
  console.log(`  ${id}.glb: ${data.byteLength} Bytes, sha256 geprüft`)
}
writeAtomic(indexPath, `${JSON.stringify(index)}\n`)
console.log(
  `  produkte-3d.json: ${
    Object.keys(index.modelle).length
  } Modelle für die Nahansicht`
)
