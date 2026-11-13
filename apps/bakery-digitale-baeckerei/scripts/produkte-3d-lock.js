/**
 * Reine Logik zu produkte-3d.lock.json und zum Manifest des Daten-Repos
 * `produkte-3d` (3D-Modelle einzelner Produkte für die Nahansicht, DB7/DB9):
 * Lock prüfen, Manifest gegen das Lock prüfen, den Index für die App bauen.
 * Ohne Dateisystem und ohne git, damit sie sich testen lässt
 * (produkte-3d-lock.spec.ts). CommonJS, nur Node-Bordmittel;
 * scripts/sync-produkte-3d.mjs ist die dünne Hülle darum.
 *
 * Die Prüfsumme selbst (Größe + sha256) rechnet `checkFile` aus model-lock.js -
 * dieselbe Prüfung wie beim Laden-Modell.
 */
const { checkFile } = require('./model-lock.js')
// Modell-ID, Commit-Hash und Quelle gelten für alles aus dem Daten-Repo (auch
// die gerenderten Produktbilder der Landingpage) und stehen darum einmal in
// der Lib.
const {
  QUELLE_LOKAL,
  istCommit,
  istModellId,
} = require('../../../libs/shared/produkte-3d/src/index.js')

/** Ordner unter public/, in dem die Modelle ausgeliefert werden. */
const ZIEL_ORDNER = 'produkte-3d'
const INDEX_VERSION = 1

/**
 * @typedef {{ sha256: string, bytes: number }} LockModell
 * @typedef {{ quelle: string, commit: string, modelle: Record<string, LockModell> }} Produkte3dLock
 * @typedef {{ min: number[], max: number[] }} Bbox
 * @typedef {{ datei: string, bytes: number, bbox_m: Bbox }} IndexModell
 * @typedef {{ version: 1, modelle: Record<string, IndexModell> }} Produkte3dIndex
 */

/** @param {unknown} v @returns {v is Record<string, unknown>} */
function isRecord(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Prüft die Form des Locks. Wirft mit einer Meldung, die sagt, was fehlt.
 * @param {unknown} raw
 * @returns {Produkte3dLock}
 */
function parseLock(raw) {
  const wo = 'produkte-3d.lock.json'
  if (!isRecord(raw)) throw new Error(`${wo}: kein Objekt`)
  if (typeof raw.quelle !== 'string' || raw.quelle.trim() === '') {
    throw new Error(`${wo}: quelle fehlt`)
  }
  // Ein fester Stand ist ein voller Commit-Hash - kein Branch, kein Tag.
  if (!istCommit(raw.commit)) {
    throw new Error(
      `${wo}: commit muss ein voller Commit-Hash sein (40 Hex-Zeichen)`
    )
  }
  if (!isRecord(raw.modelle)) throw new Error(`${wo}: modelle fehlt`)
  /** @type {Record<string, LockModell>} */
  const modelle = {}
  for (const [id, entry] of Object.entries(raw.modelle)) {
    if (!istModellId(id)) {
      throw new Error(`${wo}: Modell-ID "${id}" ist ungültig`)
    }
    if (!isRecord(entry)) throw new Error(`${wo}: Eintrag für ${id} fehlt`)
    const { sha256, bytes } = entry
    if (typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(sha256)) {
      throw new Error(`${wo}: sha256 für ${id} ist ungültig`)
    }
    if (typeof bytes !== 'number' || !Number.isInteger(bytes) || bytes <= 0) {
      throw new Error(`${wo}: bytes für ${id} ist ungültig`)
    }
    modelle[id] = { sha256, bytes }
  }
  return { quelle: raw.quelle, commit: raw.commit, modelle }
}

/** Pfad eines Modells im Daten-Repo (Vertrag: immer `models/<id>/model.glb`). */
function repoPfad(id) {
  if (!istModellId(id)) throw new Error(`Modell-ID "${id}" ist ungültig`)
  return `models/${id}/model.glb`
}

/** Pfad eines Modells unter public/ und in der URL (relativ zum Basis-Pfad). */
function zielDatei(id) {
  if (!istModellId(id)) throw new Error(`Modell-ID "${id}" ist ungültig`)
  return `${ZIEL_ORDNER}/${id}.glb`
}

/** @param {unknown} v @returns {v is number[]} */
function istVec3(v) {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    v.every((n) => typeof n === 'number' && Number.isFinite(n))
  )
}

/**
 * @param {unknown} v
 * @returns {v is Bbox}
 */
function istBbox(v) {
  return (
    isRecord(v) &&
    istVec3(v.min) &&
    istVec3(v.max) &&
    v.min.every((n, i) => n <= /** @type {number[]} */ (v.max)[i])
  )
}

/**
 * Prüft das Manifest des Daten-Repos am gesperrten Commit gegen das Lock und
 * liefert je gesperrtem Modell, was der Index braucht. Wirft, wenn ein
 * gesperrtes Modell fehlt oder Manifest und Lock sich widersprechen - dann
 * passt der Commit nicht zum Lock.
 * @param {unknown} manifest
 * @param {Produkte3dLock} lock
 * @returns {{ modelle: { id: string, pfad: string, bbox_m: Bbox }[], nichtImLock: string[] }}
 */
function pruefeManifest(manifest, lock) {
  if (!isRecord(manifest) || manifest.version !== 1) {
    throw new Error('manifest.json: version 1 erwartet')
  }
  const models = manifest.models
  if (!isRecord(models)) throw new Error('manifest.json: models fehlt')
  const modelle = []
  for (const [id, gesperrt] of Object.entries(lock.modelle)) {
    const entry = Object.prototype.hasOwnProperty.call(models, id)
      ? models[id]
      : undefined
    if (!isRecord(entry)) {
      throw new Error(
        `manifest.json am Commit ${lock.commit.slice(0, 12)} kennt ${id} nicht`
      )
    }
    const pfad = repoPfad(id)
    if (entry.file !== pfad) {
      throw new Error(`manifest.json: file für ${id} ist nicht ${pfad}`)
    }
    if (entry.sha256 !== gesperrt.sha256 || entry.bytes !== gesperrt.bytes) {
      throw new Error(
        `manifest.json und Lock widersprechen sich bei ${id} (sha256/bytes)`
      )
    }
    if (!istBbox(entry.bbox_m)) {
      throw new Error(`manifest.json: bbox_m für ${id} ist ungültig`)
    }
    modelle.push({
      id,
      pfad,
      bbox_m: { min: [...entry.bbox_m.min], max: [...entry.bbox_m.max] },
    })
  }
  const nichtImLock = Object.keys(models)
    .filter((id) => !Object.prototype.hasOwnProperty.call(lock.modelle, id))
    .sort()
  return { modelle, nichtImLock }
}

/**
 * Stimmt der Inhalt eines Modells mit dem Lock überein?
 * @param {Uint8Array} data
 * @param {LockModell} entry
 */
function pruefeModell(data, entry) {
  return checkFile(data, entry)
}

/** Ohne Modelle: Die App bietet dann keine Nahansicht an. */
function leererIndex() {
  return /** @type {Produkte3dIndex} */ ({
    version: INDEX_VERSION,
    modelle: {},
  })
}

/**
 * Der Index für die App (public/data/produkte-3d.json).
 * @param {Produkte3dLock} lock
 * @param {{ id: string, bbox_m: Bbox }[]} modelle  aus `pruefeManifest`
 * @returns {Produkte3dIndex}
 */
function baueIndex(lock, modelle) {
  const index = leererIndex()
  for (const { id, bbox_m } of [...modelle].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  )) {
    index.modelle[id] = {
      datei: zielDatei(id),
      bytes: lock.modelle[id].bytes,
      bbox_m,
    }
  }
  return index
}

/**
 * Prüft die Form eines Index (auch des synthetischen Fixture-Index) und gibt
 * ihn zurück. Jede `datei` muss genau der Pfad zu ihrer ID sein.
 * @param {unknown} raw
 * @returns {Produkte3dIndex}
 */
function pruefeIndex(raw) {
  if (!isRecord(raw) || raw.version !== INDEX_VERSION) {
    throw new Error('produkte-3d.json: version 1 erwartet')
  }
  if (!isRecord(raw.modelle)) throw new Error('produkte-3d.json: modelle fehlt')
  for (const [id, entry] of Object.entries(raw.modelle)) {
    if (!istModellId(id)) {
      throw new Error(`produkte-3d.json: Modell-ID "${id}" ist ungültig`)
    }
    if (
      !isRecord(entry) ||
      entry.datei !== zielDatei(id) ||
      typeof entry.bytes !== 'number' ||
      !Number.isInteger(entry.bytes) ||
      entry.bytes <= 0 ||
      !istBbox(entry.bbox_m)
    ) {
      throw new Error(`produkte-3d.json: Eintrag für ${id} ist ungültig`)
    }
    const fremd = Object.keys(entry).filter(
      (key) => !['datei', 'bytes', 'bbox_m'].includes(key)
    )
    if (fremd.length > 0) {
      throw new Error(
        `produkte-3d.json: ${id} hat Felder außerhalb des Vertrags (${fremd.join(
          ', '
        )})`
      )
    }
  }
  return /** @type {Produkte3dIndex} */ (/** @type {unknown} */ (raw))
}

/**
 * Was liegt im Zielordner, das der Index nicht nennt? public/produkte-3d/
 * gehört allein dem Sync-Skript und wird ausgeliefert - ein echtes Modell von
 * einem früheren Lauf darf in einem Fixture-Build nicht liegen bleiben.
 * @param {string[]} present Dateinamen im Ordner
 * @param {Produkte3dIndex} index
 * @returns {string[]}
 */
function ueberzaehlig(present, index) {
  const wanted = new Set(Object.keys(index.modelle).map((id) => `${id}.glb`))
  return present.filter((name) => !wanted.has(name)).sort()
}

module.exports = {
  INDEX_VERSION,
  QUELLE_LOKAL,
  ZIEL_ORDNER,
  baueIndex,
  istModellId,
  leererIndex,
  parseLock,
  pruefeIndex,
  pruefeManifest,
  pruefeModell,
  repoPfad,
  ueberzaehlig,
  zielDatei,
}
