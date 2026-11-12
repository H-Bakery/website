#!/usr/bin/env node
/**
 * Lädt das Modell der Digitalen Bäckerei (twin.glb, catalogue.json) am festen
 * Commit aus model.lock.json nach public/model/ (git-ignoriert) und prüft
 * Größe und sha256. Weicht etwas ab, bricht das Skript ab und schreibt nichts.
 * Liegt eine Datei schon passend da, wird sie nicht neu geladen.
 *
 * Das Modell und der Katalog gehören NICHT in dieses öffentliche Repo
 * (docs/apps/digitale-baeckerei.md, „Rechte und Datenschutz“).
 *
 * Aufruf: node scripts/sync-model.mjs   (Nx: `nx run bakery-digitale-baeckerei:sync-model`)
 * Nur Node-Bordmittel (fetch ab Node 18); die Logik steht in model-lock.js.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import modelLock from './model-lock.js'

const { parseLock, planSync, checkFile } = modelLock

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const lockPath = path.join(appDir, 'model.lock.json')
const targetDir = path.join(appDir, 'public', 'model')
const TIMEOUT_MS = 120_000

function fail(message) {
  console.error(`sync-model: ${message}`)
  process.exit(1)
}

let lock
try {
  lock = parseLock(JSON.parse(fs.readFileSync(lockPath, 'utf8')))
} catch (err) {
  fail(err instanceof Error ? err.message : String(err))
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
  // Erst daneben schreiben, dann umbenennen: nie eine halbe Datei am Ziel.
  const dest = path.join(targetDir, item.name)
  const tmp = `${dest}.${process.pid}.tmp`
  fs.writeFileSync(tmp, data)
  fs.renameSync(tmp, dest)
  console.log(`  ${item.name}: ${data.byteLength} Bytes, sha256 geprüft`)
}
