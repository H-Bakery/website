#!/usr/bin/env node
/**
 * Holt die 3D-Modelle einzelner Produkte (Nahansicht im Produkt-Sheet, DB7)
 * aus dem Daten-Repo `produkte-3d` nach public/produkte-3d/<id>.glb und
 * schreibt den Index public/data/produkte-3d.json - beides git-ignoriert.
 *
 * Das Daten-Repo liegt lokal neben `website` und `hq`, ohne Remote (DB9); der
 * Deploy liest seinen Export in hq (`hq/produkte-3d/` mit STAND.json, DB14 -
 * liesAusCommit erkennt ihn und verlangt denselben Commit). Gelesen wird genau der Commit aus produkte-3d.lock.json, unabhängig
 * vom Arbeitsverzeichnis dort:
 *   git -C <dir> show <commit>:manifest.json
 *   git -C <dir> show <commit>:models/<id>/model.glb
 * Das Lock nennt keine Produkte (dieses Repo ist öffentlich): nur Quelle,
 * Commit und die sha256 von manifest.json an diesem Commit. Das Manifest wird
 * gegen sie geprüft, jede Datei gegen Größe und sha256 aus dem Manifest; bei
 * einer Abweichung bricht das Skript ab.
 *
 * Regal-Modelle (DB12, Manifest Version 2): Für die Produkte, die in einem
 * Raum auf einem Platz liegen (public/data/belegung.json aus sync-model, mit
 * der Einrichtung aus hq), kommt zusätzlich `models/<id>/regal.glb` - geprüft
 * gegen die Prüfsumme im Manifest des gesperrten Commits und gegen den Vertrag
 * (regal-modelle.js), dann alle zusammen in **eine** Datei gepackt:
 * public/produkte-3d/_regal.glb, im Index unter `regal`. Mit der Belegung
 * gilt auch für die Nahansicht: nur Produkte, die in einem Raum liegen. Das
 * Skript meldet, wo eine Stückzahl nicht auf ihren Platz passt (auslage.js).
 * Mit DIGITALE_BAECKEREI_EINRICHTEN=1 (Einrichten-Modus, lokal) kommen die
 * Regal-Modelle aller Produkte.
 *
 * - **Gibt es das Daten-Repo nicht** (CI, Deploy, andere Rechner): leerer
 *   Index, eine Info-Zeile, Exit 0. Die App bietet dann keine Nahansicht an
 *   und zeigt die Ware, die im Modell des Ladens steckt.
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
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import produkte3d from '../../../libs/shared/produkte-3d/src/index.js'
import auslageLib from './auslage.js'
import belegungLib from './belegung.js'
import lib from './produkte-3d-lock.js'
import regalLib from './regal-modelle.js'
import modelLock from './model-lock.js'

const {
  ZIEL_ORDNER,
  baueIndex,
  leererIndex,
  parseLock,
  pruefeIndex,
  pruefeManifest,
  pruefeManifestDatei,
  pruefeModell,
  ueberzaehlig,
} = lib
const { liesAusCommit } = produkte3d
const { PAKET_DATEI, leseRegal, lesePaket, packeRegale } = regalLib
const { auslage, befundText } = auslageLib

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
const fixtureRegal = path.join(fixtureDir, 'regal.fixture.glb')
const belegungPath = path.join(publicDir, 'data', 'belegung.json')
const paketPath = path.join(modelDir, PAKET_DATEI)
const einrichtenModus = process.env.DIGITALE_BAECKEREI_EINRICHTEN === '1'
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
const text_ = text

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
  // Ohne Modelle bleibt kein leerer Ordner zurück: Der Export sieht dann aus
  // wie auf einer Maschine, die nie ein Daten-Repo hatte.
  if (Object.keys(index.modelle).length === 0 && !index.regal) {
    try {
      fs.rmdirSync(modelDir)
    } catch {
      /* nicht leer oder schon weg */
    }
  }
}

/**
 * Die Belegung aller Räume (sync-model) - oder `null`, wenn es sie nicht
 * gibt (ein Lauf mit --out ohne Belegung): dann keine Regal-Modelle.
 */
function leseBelegung() {
  let text
  try {
    text = fs.readFileSync(belegungPath, 'utf8')
  } catch {
    return null
  }
  try {
    const datei = JSON.parse(text)
    belegungLib.alleSlots(datei)
    return datei
  } catch (err) {
    return fail(
      `public/data/belegung.json lässt sich nicht lesen (${text_(err)})`
    )
  }
}

/**
 * Meldet, wo die Belegung nicht auf ihren Platz passt oder ein eingerichtetes
 * Produkt kein Regal-Modell hat. Nur Hinweise - der Build läuft weiter, die
 * App legt so viele Stück, wie passen.
 */
function meldeAuslage(belegung, regalModelle) {
  let hinweise = 0
  for (const [raum, eintrag] of Object.entries(belegung.raeume)) {
    for (const s of eintrag.slots) {
      const modell = Object.prototype.hasOwnProperty.call(
        regalModelle,
        s.produkt
      )
        ? regalModelle[s.produkt]
        : null
      if (!modell) {
        if (s.quelle === 'einrichtung') {
          hinweise += 1
          console.warn(
            `sync-produkte-3d: HINWEIS Raum ${raum}, ${s.slot}: für ${s.produkt} gibt es kein Regal-Modell - im Bild bleibt der Platz leer, in der Liste steht das Produkt`
          )
        }
        continue
      }
      const platz = eintrag.plaetze[s.slot]
      if (!platz) continue
      const anzahl = s.anzahl ?? 1
      const ergebnis = auslage(s.slot, platz, modell.bbox_m, anzahl)
      if (ergebnis.befund !== 'passt') {
        hinweise += 1
        console.warn(
          `sync-produkte-3d: HINWEIS Raum ${raum}, ${s.slot}: ${
            s.produkt
          } × ${anzahl} - ${befundText(
            ergebnis.befund,
            ergebnis.gelegt,
            anzahl
          )}`
        )
      }
    }
  }
  if (hinweise === 0) {
    console.log('  Auslage: jede Stückzahl passt auf ihren Platz')
  }
}

/** Eine Datei aus dem gesperrten Commit - derselbe Weg wie bei den Produktbildern. */
function gitShow(pfad) {
  return liesAusCommit(repoDir, lock.commit, pfad, { maxBuffer: MAX_BUFFER })
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
  if (index.regal) {
    let paket
    try {
      paket = fs.readFileSync(fixtureRegal)
      lesePaket(new Uint8Array(paket))
    } catch (err) {
      fail(`Fixture-Paket der Regal-Modelle ungültig oder fehlt: ${text(err)}`)
    }
    if (paket.byteLength !== index.regal.bytes) {
      fail(
        `Fixture-Index nennt für das Regal-Paket ${index.regal.bytes} Bytes, die Datei hat ${paket.byteLength}`
      )
    }
    writeAtomic(paketPath, paket)
    console.log(
      `  ${PAKET_DATEI}: ${paket.byteLength} Bytes kopiert (${
        Object.keys(index.regal.modelle).length
      } synthetische Regal-Modelle)`
    )
    const belegung = leseBelegung()
    if (belegung) meldeAuslage(belegung, index.regal.modelle)
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

// Das Manifest am gesperrten Commit: erst gegen die Prüfsumme im Lock, dann
// der Vertrag. Es nennt je Datei die Prüfsumme, gegen die unten geprüft wird.
let manifestDatei
try {
  manifestDatei = new Uint8Array(gitShow('manifest.json'))
} catch (err) {
  fail(
    `manifest.json am gesperrten Commit lässt sich nicht lesen (${text(
      err
    )}). Ein neuer Stand wird bewusst übernommen: commit und manifest.sha256 in produkte-3d.lock.json ändern.`
  )
}
{
  const check = pruefeManifestDatei(manifestDatei, lock)
  if (!check.ok) {
    fail(
      `manifest.json am gesperrten Commit passt nicht zum Lock (${check.reason}). Nichts geschrieben.`
    )
  }
}
let geprueft
try {
  geprueft = pruefeManifest(
    JSON.parse(Buffer.from(manifestDatei).toString('utf8'))
  )
} catch (err) {
  fail(`${text(err)}. Nichts geschrieben.`)
}

// Welche Produkte liegen in einem Raum? Nur für sie kommen Modelle.
const belegung = leseBelegung()
const gelegt = belegung
  ? new Set(belegungLib.alleSlots(belegung).slots.map((s) => s.produkt))
  : null
if (!belegung) {
  console.log(
    '  public/data/belegung.json fehlt - Nahansicht für alle Modelle des Manifests, keine Regal-Modelle'
  )
}

// Erst alles lesen und prüfen, dann schreiben: bei einer Abweichung bleibt
// nichts Halbes liegen.
const dateien = []
const nahansicht = geprueft.modelle.filter(
  ({ id }) => gelegt === null || gelegt.has(id)
)
for (const modell of nahansicht) {
  const { id, pfad } = modell
  let data
  try {
    data = new Uint8Array(gitShow(pfad))
  } catch (err) {
    fail(`${id}: ${pfad} lässt sich nicht lesen (${text(err)})`)
  }
  const check = pruefeModell(data, modell)
  if (!check.ok) {
    fail(
      `${id}: ${pfad} passt nicht zum Manifest (${check.reason}). Nichts geschrieben.`
    )
  }
  dateien.push({ id, data })
}

// Regal-Modelle: Prüfsumme aus dem Manifest des gesperrten Commits, dann der
// Vertrag (ein Mesh, höchstens 250 Dreiecke, unlit …), dann alle in ein Paket.
const regale = []
if (gelegt !== null) {
  for (const r of geprueft.regal) {
    if (!einrichtenModus && !gelegt.has(r.id)) continue
    let data
    try {
      data = new Uint8Array(gitShow(r.pfad))
    } catch (err) {
      fail(`${r.id}: ${r.pfad} lässt sich nicht lesen (${text(err)})`)
    }
    const check = modelLock.checkFile(data, r)
    if (!check.ok) {
      fail(
        `${r.id}: ${r.pfad} passt nicht zum Manifest (${check.reason}). Nichts geschrieben.`
      )
    }
    try {
      regale.push(leseRegal(data, r.id))
    } catch (err) {
      fail(`${text(err)}. Nichts geschrieben.`)
    }
  }
}
const paket = regale.length > 0 ? packeRegale(regale) : null

const index = baueIndex(
  nahansicht,
  paket ? { bytes: paket.glb.byteLength, modelle: paket.modelle } : null
)
raeumeAuf(index)
if (paket) {
  writeAtomic(paketPath, paket.glb)
  console.log(
    `  ${PAKET_DATEI}: ${regale.length} Regal-Modelle${
      einrichtenModus ? ' (Einrichten-Modus: alle)' : ''
    }, ${paket.glb.byteLength} Bytes, sha256 je Modell geprüft`
  )
}
if (belegung) meldeAuslage(belegung, paket ? paket.modelle : {})
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
