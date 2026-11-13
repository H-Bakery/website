#!/usr/bin/env node
/**
 * Holt die aus den 3D-Modellen gerenderten Produktbilder (DB13) aus dem
 * Daten-Repo `produkte-3d` nach public/produkte-3d/bilder/<id>/*.webp und
 * schreibt den Index produkte-3d-bilder.json neben die App - beides
 * git-ignoriert. src/lib/products.ts liest den Index beim Bauen.
 *
 * Das Daten-Repo liegt vorerst NUR LOKAL neben `website` und `hq`, ohne Remote
 * (DB9). Gelesen wird genau der Commit aus produkte-3d-bilder.lock.json,
 * unabhängig vom Arbeitsverzeichnis dort (`git show <commit>:<pfad>`):
 *   bilder/index.json     welche Bilder es gibt (Vertrag des Daten-Repos)
 *   manifest.json         sha256 der Modelle - ein Bild muss vom Modell
 *                         desselben Stands gerendert sein (modellSha256)
 *   bilder/<id>/*.webp    geprüft gegen den Index: WebP, Maße, Alpha-Kanal
 * Bei einer Abweichung bricht das Skript ab und schreibt nichts.
 *
 * - **Gibt es das Daten-Repo nicht** (CI, Deploy, andere Rechner) oder nennt
 *   das Lock noch keinen Stand (`commit: null`): leerer Index, kein Ordner
 *   public/produkte-3d, eine Info-Zeile, Exit 0. Die Seite sieht dann genau
 *   so aus wie ohne dieses Skript. Das darf nie einen Build brechen.
 * - LANDING_PRODUKTBILDER_FIXTURE=1 (Tests, e2e): die synthetischen Bilder aus
 *   src/test/fixtures/produktbilder und ihr Index, Byte für Byte.
 * - public/produkte-3d/ gehört allein diesem Skript und wird bei jedem Lauf
 *   neu angelegt: Ein echtes Bild von einem früheren Lauf bleibt nie liegen.
 *
 * Die echten Bilder gehören NICHT in dieses öffentliche Repo.
 *
 * Aufruf: node scripts/sync-produktbilder.js
 *   (Nx: `nx run bakery-landing:sync-produktbilder`; läuft vor jedem Build)
 *   PRODUKTE_3D_DIR=<pfad>   das Daten-Repo (sonst ../../../produkte-3d von der App aus)
 *   --out <ordner>           statt public/ (nur für Tests)
 *   --index <datei>          statt produkte-3d-bilder.json (nur für Tests)
 *   --lock <datei>           statt produkte-3d-bilder.lock.json (nur für Tests)
 * Nur Node-Bordmittel und git; Vertrag und Prüfungen stehen in
 * libs/shared/produkte-3d.
 */

const fs = require('fs')
const path = require('path')
// Relativer require: Das Skript läuft mit blankem node, ohne den Alias
// `@bakery/shared/produkte-3d`.
const {
  leererBilderIndex,
  liesAusCommit,
  parseBilderLock,
  pruefeBild,
  pruefeBilderIndex,
} = require('../../../libs/shared/produkte-3d/src/index.js')

const NAME = 'sync-produktbilder'
/** Ordner unter public/ - der Pfad im Daten-Repo hängt dahinter. */
const ZIEL_ORDNER = 'produkte-3d'
const LOCK_DATEI = 'produkte-3d-bilder.lock.json'

const appDir = path.resolve(__dirname, '..')
const args = process.argv.slice(2)
const arg = (name) => {
  const at = args.indexOf(name)
  return at >= 0 && args[at + 1] ? path.resolve(args[at + 1]) : null
}
const publicDir = arg('--out') ?? path.join(appDir, 'public')
const indexPath = arg('--index') ?? path.join(appDir, 'produkte-3d-bilder.json')
const lockPath = arg('--lock') ?? path.join(appDir, LOCK_DATEI)
const zielDir = path.join(publicDir, ZIEL_ORDNER)
const fixtureDir = path.join(appDir, 'src', 'test', 'fixtures', 'produktbilder')
const repoDir = path.resolve(
  process.env.PRODUKTE_3D_DIR ||
    path.join(appDir, '..', '..', '..', ZIEL_ORDNER)
)
const fixtureMode = process.env.LANDING_PRODUKTBILDER_FIXTURE === '1'

function fail(message) {
  console.error(`${NAME}: ${message}`)
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

/**
 * Schreibt Bilder und Index. Vorher ist alles gelesen und geprüft; der
 * Zielordner wird neu angelegt, damit nichts von einem früheren Lauf bleibt.
 * @param {{ file: string, data: Uint8Array }[]} dateien
 * @param {string | Buffer} indexInhalt
 */
function schreibe(dateien, indexInhalt) {
  fs.rmSync(zielDir, { recursive: true, force: true })
  for (const { file, data } of dateien) {
    writeAtomic(path.join(zielDir, file), data)
  }
  writeAtomic(indexPath, indexInhalt)
}

function leer(grund) {
  schreibe([], `${JSON.stringify(leererBilderIndex())}\n`)
  console.log(
    `${NAME}: INFO ${grund} - keine Produktbilder, die Seite bleibt, wie sie ohne ist`
  )
  process.exit(0)
}

/**
 * Jede Variante des Index lesen und gegen ihren Eintrag prüfen.
 * @param {ReturnType<typeof pruefeBilderIndex>} index
 * @param {(file: string) => Uint8Array} lies
 */
function liesBilder(index, lies) {
  const dateien = []
  for (const [id, eintrag] of Object.entries(index.bilder)) {
    for (const variante of eintrag.varianten) {
      let data
      try {
        data = new Uint8Array(lies(variante.file))
      } catch (err) {
        fail(`${id}: ${variante.file} lässt sich nicht lesen (${text(err)})`)
      }
      const check = pruefeBild(data, variante)
      if (!check.ok) {
        fail(`${variante.file}: ${check.reason}. Nichts geschrieben.`)
      }
      dateien.push({ file: variante.file, data })
    }
  }
  return dateien
}

function bericht(index, dateien) {
  const bytes = dateien.reduce((sum, d) => sum + d.data.byteLength, 0)
  console.log(
    `  ${Object.keys(index.bilder).length} Produkte, ${
      dateien.length
    } Bilder, ${Math.round(bytes / 1024)} kB - Maße und Alpha geprüft`
  )
}

if (fixtureMode) {
  const fixtureIndex = path.join(fixtureDir, 'index.json')
  let roh
  let index
  try {
    roh = fs.readFileSync(fixtureIndex)
    index = pruefeBilderIndex(JSON.parse(roh.toString('utf8')), 'Fixture-Index')
  } catch (err) {
    fail(`Fixture-Index ungültig oder fehlt: ${text(err)}`)
  }
  console.log(
    `${NAME}: FIXTURE - synthetische Produktbilder aus ${path.relative(
      appDir,
      fixtureDir
    )}`
  )
  const dateien = liesBilder(index, (file) =>
    fs.readFileSync(path.join(fixtureDir, file))
  )
  // Der Index Byte für Byte: Tests vergleichen ihn mit dem Fixture.
  schreibe(dateien, roh)
  bericht(index, dateien)
  process.exit(0)
}

if (!fs.existsSync(repoDir)) {
  leer(`kein Daten-Repo unter ${repoDir} (PRODUKTE_3D_DIR setzt den Pfad)`)
}

let lock
try {
  lock = parseBilderLock(JSON.parse(fs.readFileSync(lockPath, 'utf8')))
} catch (err) {
  fail(text(err))
}
if (lock.commit === null) {
  leer(`${LOCK_DATEI} nennt noch keinen Stand (commit: null)`)
}

console.log(`${NAME}: ${repoDir}@${lock.commit.slice(0, 12)} (${lock.quelle})`)

const ausCommit = (pfad) => liesAusCommit(repoDir, lock.commit, pfad)
const hinweis = `Ein neuer Stand wird bewusst übernommen: commit in ${LOCK_DATEI} ändern.`

let index
try {
  index = pruefeBilderIndex(
    JSON.parse(ausCommit('bilder/index.json').toString('utf8'))
  )
} catch (err) {
  fail(
    `bilder/index.json am gesperrten Commit lässt sich nicht lesen oder ist ungültig (${text(
      err
    )}). ${hinweis}`
  )
}

// Ein Bild zeigt das Modell, aus dem es gerendert wurde. Hat sich das Modell
// danach geändert, zeigt das Bild etwas anderes als die Nahansicht.
let models
try {
  const manifest = JSON.parse(ausCommit('manifest.json').toString('utf8'))
  models = manifest && typeof manifest === 'object' ? manifest.models : null
  if (!models || typeof models !== 'object') throw new Error('models fehlt')
} catch (err) {
  fail(`manifest.json am gesperrten Commit: ${text(err)}. ${hinweis}`)
}
for (const [id, eintrag] of Object.entries(index.bilder)) {
  const modell = Object.prototype.hasOwnProperty.call(models, id)
    ? models[id]
    : null
  if (!modell || modell.sha256 !== eintrag.modellSha256) {
    fail(
      `${id}: Das Bild ist nicht vom Modell dieses Stands gerendert (modellSha256 passt nicht zu manifest.json). Im Daten-Repo neu rendern und committen. Nichts geschrieben.`
    )
  }
}

const dateien = liesBilder(index, ausCommit)
schreibe(dateien, `${JSON.stringify(index)}\n`)
bericht(index, dateien)
