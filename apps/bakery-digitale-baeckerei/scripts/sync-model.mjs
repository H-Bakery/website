#!/usr/bin/env node
/**
 * Holt die Modelle der Digitalen Bäckerei - je Raum eines (DB11; heute der
 * Verkaufsraum, twin.glb) - am festen Commit aus model.lock.json, prüft Größe
 * und sha256 der Quelle, nimmt die Preisschilder heraus (glb-bereinigen.js;
 * DB8: keine Preise, auch nicht als Geometrie in der Datei), prüft das
 * Ergebnis gegen die zweite Prüfsumme im Lock (`ausgeliefert`) und schreibt es
 * nach public/model/ (git-ignoriert). Aus diesen Dateien leitet es die
 * Belegung ab (public/data/belegung.json, git-ignoriert, je Raum): welches
 * Produkt morgens auf welchem Platz liegt. Weicht eine Prüfsumme ab, bricht
 * das Skript ab und schreibt nichts. Liegt die ausgelieferte Datei schon
 * passend da, wird nichts geladen. Das Original der Quelle liegt nie unter
 * public/. Ein Raum, der nicht im Lock steht, wird nicht gebaut.
 *
 * Der Katalog des Explorers (catalogue.json) wird NICHT mehr geladen: er trägt
 * Preise, alles unter public/ wird ausgeliefert, und die App braucht ihn nicht
 * (Texte kommen aus hq, die Zuordnung aus dem GLB). Was in public/model/ liegt
 * und nicht im Lock steht (z. B. ein catalogue.json von früher), wird gelöscht.
 *
 * DIGITALE_BAECKEREI_FIXTURE=1 (Tests, e2e, CI): kein Download - die
 * synthetischen Modelle aus src/test/fixtures/ (`RAEUME` in fixture-info.js:
 * der Laden und die erfundene „Testbackstube“) werden genauso bereinigt (der
 * Laden trägt dafür eigene Preiskarten), nach public/model/ geschrieben und
 * die Belegung daraus abgeleitet.
 *
 * Die Modelle gehören NICHT in dieses öffentliche Repo
 * (docs/apps/digitale-baeckerei.md, „Rechte und Datenschutz“).
 *
 * Einrichtung (DB12): Aus der Ware jedes Platzes leitet das Skript dessen
 * Rahmen ab (plaetze.js; das echte Modell ist meshopt-komprimiert, dafür der
 * Decoder aus three) und legt, wenn es sie gibt, die Einrichtung aus hq über
 * die Belegung des Modells: `<hq>/config/digitale-baeckerei/einrichtung.yaml`
 * (einrichtung.js; der Ordner kommt aus HQ_DIGITALE_BAECKEREI_DIR, sonst liegt
 * er neben HQ_PRODUCTS_DIR). Ohne Datei gilt das Modell. Ein unbekannter Raum,
 * Platz oder ein unbekanntes Produkt bricht ab. Im Fixture-Modus:
 * src/test/fixtures/einrichtung.yaml. Nur mit DIGITALE_BAECKEREI_EINRICHTEN=1
 * (Einrichten-Modus, lokal) liegt die Datei zusätzlich als
 * public/data/einrichtung.quelle.yaml da, daneben die Belegung der Modelle
 * ohne Einrichtung (einrichtung.modell.json) - sonst wird beides dort
 * gelöscht, und der Export-Wächter ließe es nicht durch.
 *
 * Aufruf: node scripts/sync-model.mjs   (Nx: `nx run bakery-digitale-baeckerei:sync-model`)
 * Die Logik steht in model-lock.js, glb-bereinigen.js, belegung.js,
 * plaetze.js und einrichtung.js.
 */
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import hqProducts from '../../../libs/shared/hq-products/src/index.js'
import modelLock from './model-lock.js'
import belegungLib from './belegung.js'
import bereinigen from './glb-bereinigen.js'
import einrichtungLib from './einrichtung.js'
import geometrie from './glb-geometrie.js'
import plaetzeLib from './plaetze.js'
import productSnapshot from './product-snapshot.js'

const { parseLock, planSync, checkFile, sha256Hex, staleFiles, lockDateien } =
  modelLock
const { bereinigeGlb, zaehlePreisPrimitive } = bereinigen
const { belegungAusGlb, fasseZusammen, morgensPlatz, parseGlbJson } =
  belegungLib
const { leitePlaetzeAb, wareVon } = plaetzeLib
const { brauchtDecoder, knotenGeometrie } = geometrie

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const lockPath = path.join(appDir, 'model.lock.json')
const targetDir = path.join(appDir, 'public', 'model')
const belegungPath = path.join(appDir, 'public', 'data', 'belegung.json')
/** Nur im Einrichten-Modus: die Datei aus hq, damit die App sie fortschreibt. */
const quellePath = path.join(
  appDir,
  'public',
  'data',
  'einrichtung.quelle.yaml'
)
/** Nur im Einrichten-Modus: was die Modelle zeigen, bevor die Einrichtung gilt. */
const modellPath = path.join(
  appDir,
  'public',
  'data',
  'einrichtung.modell.json'
)
// Auch im Fixture-Modus: Dort gibt es den Einrichten-Modus zum Testen
// (`?einrichten=1`), mit der synthetischen Einrichtung.
const einrichtenModus =
  process.env.DIGITALE_BAECKEREI_EINRICHTEN === '1' ||
  process.env.DIGITALE_BAECKEREI_FIXTURE === '1'
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
 * @param {string} name Dateiname für die Meldungen
 * @returns {Uint8Array}
 */
function bereinige(data, name) {
  let result
  try {
    result = bereinigeGlb(data)
  } catch (err) {
    fail(
      `${name} lässt sich nicht bereinigen (${
        err instanceof Error ? err.message : String(err)
      }). Nichts geschrieben.`
    )
  }
  const rest = zaehlePreisPrimitive(result.glb)
  if (rest.primitive !== 0 || rest.materialien !== 0) {
    fail(`${name}: nach der Bereinigung sind noch Preisschilder im Modell`)
  }
  const b = result.bericht
  console.log(
    `  ${name}: Preisschilder entfernt - ${b.primitive} Primitive, ${b.accessors} Accessors, ${b.bufferViews} BufferViews, ${b.materialien} Materialien; ${b.bytesVorher} → ${b.bytesNachher} Bytes`
  )
  return result.glb
}

/** Belegung je Raum, in der Reihenfolge des Baus. */
const belegungen = {}

let decoder = null
/** Der meshopt-Decoder aus three - nur geladen, wenn ein Modell ihn braucht. */
async function decoderFuer(glb) {
  if (!brauchtDecoder(parseGlbJson(glb))) return null
  if (!decoder) {
    try {
      const modul = await import(
        'three/examples/jsm/libs/meshopt_decoder.module.js'
      )
      await modul.MeshoptDecoder.ready
      decoder = modul.MeshoptDecoder
    } catch (err) {
      fail(
        `Der meshopt-Decoder aus three lässt sich nicht laden (${
          err instanceof Error ? err.message : String(err)
        })`
      )
    }
  }
  return decoder
}

/** Rahmen der Plätze eines Raums, abgeleitet aus der Ware im GLB. */
async function leitePlaetze(name, glb) {
  try {
    const knoten = knotenGeometrie(
      glb,
      (knotenName, extras) => morgensPlatz(knotenName, extras) !== null,
      await decoderFuer(glb)
    )
    return leitePlaetzeAb(
      knoten.map((k) => wareVon(morgensPlatz(k.name, k.extras), k.teile))
    )
  } catch (err) {
    return fail(
      `Die Plätze lassen sich nicht aus ${name} ableiten (${
        err instanceof Error ? err.message : String(err)
      })`
    )
  }
}

/** Leitet die Belegung eines Raums aus seinem ausgelieferten GLB ab. */
async function merkeBelegung(raum, name, glb, commit) {
  let result
  try {
    result = belegungAusGlb(glb, commit)
  } catch (err) {
    fail(
      `Belegung lässt sich nicht aus ${name} lesen (${
        err instanceof Error ? err.message : String(err)
      })`
    )
  }
  for (const slot of result.doppelt) {
    console.warn(
      `sync-model: WARNUNG Platz ${slot} ist im Modell ${name} doppelt belegt`
    )
  }
  const plaetze = await leitePlaetze(name, glb)
  belegungen[raum] = { ...result.belegung, leer: [], plaetze }
  const produkte = new Set(result.belegung.slots.map((s) => s.produkt))
  console.log(
    `  belegung.json: Raum ${raum} - ${
      result.belegung.slots.length
    } Plätze mit ${produkte.size} Produkten (morgens), ${
      Object.keys(plaetze).length
    } Plätze zum Einrichten`
  )
}

const fixtureInfo = () =>
  createRequire(import.meta.url)('../src/test/fixtures/fixture-info.js')

/** Wo die Einrichtung liegt: im Fixture-Modus die synthetische, sonst in hq. */
function einrichtungsPfad() {
  if (fixtureMode) return fixtureInfo().EINRICHTUNG_PATH
  const dir =
    process.env.HQ_DIGITALE_BAECKEREI_DIR ||
    path.join(
      hqProducts.resolveHqProductsDir(),
      '..',
      'config',
      'digitale-baeckerei'
    )
  return path.join(dir, einrichtungLib.DATEI)
}

/** Alle Produkt-IDs, die eine Einrichtung nennen darf. */
function bekannteProdukte() {
  if (fixtureMode) {
    return Object.keys(
      JSON.parse(fs.readFileSync(fixtureInfo().SNAPSHOT_PATH, 'utf8')).produkte
    )
  }
  const hq = hqProducts.readHqProducts()
  if (!hq.found) {
    fail(
      `${einrichtungLib.DATEI} nennt Produkte, aber das hq-Produktverzeichnis fehlt: ${hq.dir}`
    )
  }
  return Object.keys(
    productSnapshot.baueSnapshot(hq.products, { erstellt: '' }).snapshot
      .produkte
  )
}

/**
 * Legt die Einrichtung aus hq über die Belegung der Modelle. Ohne Datei
 * bleibt alles wie im Modell.
 */
function wendeEinrichtungAn() {
  // Der Einrichten-Modus braucht den Stand der Modelle, um Plätze wieder
  // „wie im Modell“ zu zeigen.
  if (einrichtenModus) {
    const modell = {}
    for (const [raum, b] of Object.entries(belegungen)) {
      modell[raum] = { quelle: b.quelle, slots: b.slots }
    }
    writeAtomic(modellPath, `${JSON.stringify(fasseZusammen(modell))}\n`)
  } else {
    fs.rmSync(modellPath, { force: true })
  }
  const datei = einrichtungsPfad()
  let text = null
  try {
    text = fs.readFileSync(datei, 'utf8')
  } catch (err) {
    // Nur „gibt es nicht“ heißt: keine Einrichtung, das Modell gilt. Jeder
    // andere Lesefehler (Rechte, ein Ordner an der Stelle …) bricht ab -
    // sonst ginge der Laden still ohne die Einrichtung des Inhabers live.
    const code = err && typeof err === 'object' ? err.code : undefined
    if (code !== 'ENOENT' && code !== 'ENOTDIR') {
      fail(
        `${einrichtungLib.DATEI} lässt sich nicht lesen (${
          code ?? (err instanceof Error ? err.message : String(err))
        }). Nichts geschrieben.`
      )
    }
  }
  if (einrichtenModus && text !== null) writeAtomic(quellePath, text)
  else fs.rmSync(quellePath, { force: true })
  if (text === null) {
    console.log(
      `  ${einrichtungLib.DATEI}: keine Datei - die Belegung aus dem Modell gilt`
    )
    return
  }
  let einrichtung
  try {
    einrichtung = einrichtungLib.leseEinrichtung(text)
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err))
  }
  const fremd = Object.keys(einrichtung.raeume).filter(
    (raum) => !Object.prototype.hasOwnProperty.call(belegungen, raum)
  )
  if (fremd.length > 0) {
    fail(
      `${einrichtungLib.DATEI}: den Raum "${
        fremd[0]
      }" gibt es nicht (gebaut: ${Object.keys(belegungen).join(
        ', '
      )}). Nichts geschrieben.`
    )
  }
  const hatEintraege = Object.values(einrichtung.raeume).some(
    (plaetze) => Object.keys(plaetze).length > 0
  )
  const produkte = hatEintraege ? bekannteProdukte() : []
  for (const [raum, belegung] of Object.entries(belegungen)) {
    let ergebnis
    try {
      ergebnis = einrichtungLib.wendeAn(belegung, einrichtung.raeume[raum], {
        raum,
        bekannt: Object.keys(belegung.plaetze),
        produkte,
      })
    } catch (err) {
      fail(err instanceof Error ? err.message : String(err))
    }
    belegungen[raum] = {
      ...belegung,
      slots: ergebnis.slots,
      leer: ergebnis.leer,
    }
    // Nur Zahlen: Die Logs eines öffentlichen Repos sind öffentlich.
    console.log(
      `  ${einrichtungLib.DATEI}: Raum ${raum} - ${ergebnis.geaendert} Plätze eingerichtet, davon ${ergebnis.leer.length} leer`
    )
  }
}

function schreibeBelegung() {
  wendeEinrichtungAn()
  writeAtomic(belegungPath, `${JSON.stringify(fasseZusammen(belegungen))}\n`)
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
  const { RAEUME } = createRequire(import.meta.url)(
    '../src/test/fixtures/fixture-info.js'
  )
  console.log(
    `sync-model: FIXTURE - ${RAEUME.length} synthetische Modelle aus src/test/fixtures, kein Download`
  )
  raeumeAuf(RAEUME.map((r) => r.datei))
  for (const raum of RAEUME) {
    if (!fs.existsSync(raum.quelle)) {
      fail(
        `DIGITALE_BAECKEREI_FIXTURE=1, aber das synthetische Modell fehlt: ${path.relative(
          appDir,
          raum.quelle
        )}`
      )
    }
    const glb = bereinige(
      new Uint8Array(fs.readFileSync(raum.quelle)),
      raum.datei
    )
    writeAtomic(path.join(targetDir, raum.datei), glb)
    console.log(`  ${raum.datei}: ${glb.byteLength} Bytes geschrieben`)
    await merkeBelegung(raum.id, raum.datei, glb, 'fixture')
  }
  schreibeBelegung()
  process.exit(0)
}

let lock
try {
  lock = parseLock(JSON.parse(fs.readFileSync(lockPath, 'utf8')))
} catch (err) {
  fail(err instanceof Error ? err.message : String(err))
}
// Ohne zweite Prüfsumme ließe sich nicht belegen, was ausgeliefert wird.
for (const [raum, entry] of Object.entries(lock.raeume)) {
  if (!entry.ausgeliefert) {
    fail(
      `model.lock.json: raeume.${raum}.ausgeliefert fehlt (sha256 und bytes der bereinigten Datei)`
    )
  }
}

const plan = planSync(lock, (name) => {
  try {
    return fs.readFileSync(path.join(targetDir, name))
  } catch {
    return null
  }
})

fs.mkdirSync(targetDir, { recursive: true })
raeumeAuf(lockDateien(lock))

for (const item of plan) {
  const { source } = item.entry
  console.log(
    `sync-model: Raum ${item.raum} - ${source.repo}@${source.commit.slice(
      0,
      12
    )} (${source.path})`
  )
  if (item.action === 'keep') {
    console.log(`  ${item.name}: ${item.reason}`)
  } else {
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
    const out = bereinige(data, item.name)
    const nachher = checkFile(out, item.entry.ausgeliefert)
    if (!nachher.ok) {
      fail(
        `${item.name}: die bereinigte Datei passt nicht zu "ausgeliefert" im Lock (${nachher.reason}). Nichts geschrieben. ` +
          `Ist: sha256 ${sha256Hex(out)}, ${out.byteLength} Bytes. ` +
          'Nach einem neuen Modell oder einer Änderung an glb-bereinigen.js trägt man diese Werte bewusst in model.lock.json ein - und schaut sich das Modell vorher an.'
      )
    }
    writeAtomic(path.join(targetDir, item.name), out)
    console.log(
      `  ${item.name}: ${out.byteLength} Bytes geschrieben, sha256 der ausgelieferten Datei geprüft`
    )
  }

  // Die Belegung nur aus dem geprüften, ausgelieferten GLB: noch einmal lesen
  // und prüfen - auch, dass wirklich kein Preisschild mehr darin steckt.
  const glb = new Uint8Array(fs.readFileSync(path.join(targetDir, item.name)))
  const check = checkFile(glb, item.entry.ausgeliefert)
  if (!check.ok) fail(`${item.name}: Prüfsumme stimmt nicht (${check.reason})`)
  const rest = zaehlePreisPrimitive(glb)
  if (rest.primitive !== 0 || rest.materialien !== 0) {
    fail(`${item.name}: im ausgelieferten Modell stecken Preisschilder`)
  }
  await merkeBelegung(item.raum, item.name, glb, source.commit)
}
schreibeBelegung()
