/**
 * Reine Logik zu produkte-3d.lock.json und zum Manifest des Daten-Repos
 * `produkte-3d` (3D-Modelle einzelner Produkte: Nahansicht DB7/DB9,
 * Regal-Modelle DB12): Lock prüfen, Manifest lesen, den Index für die App
 * bauen.
 *
 * **Das Lock nennt keine Produkte** - dieses Repo ist öffentlich. Es hält nur
 * die Quelle, den Commit des Daten-Repos und die Prüfsumme von dessen
 * `manifest.json` an diesem Commit (wie das Lock der Produktbilder der
 * Landingpage). Der Commit legt den Inhalt jeder Datei fest; die Prüfsumme je
 * Datei steht im Manifest dieses Commits und wird beim Sync dagegen geprüft.
 * Ohne Dateisystem und ohne git, damit sie sich testen lässt
 * (produkte-3d-lock.spec.ts). CommonJS, nur Node-Bordmittel;
 * scripts/sync-produkte-3d.mjs ist die dünne Hülle darum.
 *
 * Die Prüfsumme selbst (Größe + sha256) rechnet `checkFile` aus model-lock.js -
 * dieselbe Prüfung wie beim Laden-Modell.
 */
const { checkFile, sha256Hex } = require('./model-lock.js')
// Modell-ID, Commit-Hash und Quelle gelten für alles aus dem Daten-Repo (auch
// die gerenderten Produktbilder der Landingpage) und stehen darum einmal in
// der Lib.
const {
  QUELLE_LOKAL,
  istCommit,
  istModellId,
} = require('../../../libs/shared/produkte-3d/src/index.js')

const { PAKET_DATEI } = require('./regal-modelle.js')

/** Ordner unter public/, in dem die Modelle ausgeliefert werden. */
const ZIEL_ORDNER = 'produkte-3d'
const INDEX_VERSION = 1

/**
 * @typedef {{ sha256: string, bytes: number }} Pruefsumme
 * @typedef {{ quelle: string, commit: string, manifest: { sha256: string } }} Produkte3dLock
 * @typedef {{ id: string, pfad: string, sha256: string, bytes: number, bbox_m: Bbox }} ManifestModell
 * @typedef {{ min: number[], max: number[] }} Bbox
 * @typedef {{ datei: string, bytes: number, bbox_m: Bbox }} IndexModell
 * @typedef {{ bbox_m: Bbox, dreiecke: number }} IndexRegal
 * @typedef {{ datei: string, bytes: number, modelle: Record<string, IndexRegal> }} RegalPaket
 * @typedef {{ version: 1, modelle: Record<string, IndexModell>, regal?: RegalPaket }} Produkte3dIndex
 * @typedef {{ id: string, pfad: string, sha256: string, bytes: number }} ManifestRegal
 */

/**
 * Die Regal-Modelle (DB12) liegen alle in einer Datei (regal-modelle.js); der
 * Index nennt sie unter `regal` - nur, wenn es welche gibt. Ohne Daten-Repo
 * bleibt der Index genau der leere von vorher.
 */
const REGAL_DATEI = `${ZIEL_ORDNER}/${PAKET_DATEI}`
/** Die Manifest-Versionen, die der Sync liest (2 ergänzt 1 um `regal` u. a.). */
const MANIFEST_VERSIONEN = [1, 2]

/** @param {unknown} v @returns {v is Record<string, unknown>} */
function isRecord(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Die Felder des Locks - mehr darf nicht darin stehen (keine Produkt-IDs). */
const LOCK_FELDER = ['quelle', 'commit', 'manifest']

/**
 * Prüft die Form des Locks. Wirft mit einer Meldung, die sagt, was fehlt -
 * auch bei jedem Feld außerhalb des Vertrags: Eine Liste von Modellen (und
 * damit von Produkt-IDs) gehört nicht in dieses öffentliche Repo.
 * @param {unknown} raw
 * @returns {Produkte3dLock}
 */
function parseLock(raw) {
  const wo = 'produkte-3d.lock.json'
  if (!isRecord(raw)) throw new Error(`${wo}: kein Objekt`)
  const fremd = Object.keys(raw).filter((k) => !LOCK_FELDER.includes(k))
  if (fremd.length > 0) {
    throw new Error(
      `${wo}: Feld "${fremd[0]}" gehört nicht ins Lock - es hält nur quelle, commit und die Prüfsumme des Manifests, keine Produkte`
    )
  }
  if (typeof raw.quelle !== 'string' || raw.quelle.trim() === '') {
    throw new Error(`${wo}: quelle fehlt`)
  }
  // Ein fester Stand ist ein voller Commit-Hash - kein Branch, kein Tag.
  if (!istCommit(raw.commit)) {
    throw new Error(
      `${wo}: commit muss ein voller Commit-Hash sein (40 Hex-Zeichen)`
    )
  }
  const { manifest } = raw
  if (
    !isRecord(manifest) ||
    typeof manifest.sha256 !== 'string' ||
    !/^[0-9a-f]{64}$/.test(manifest.sha256) ||
    Object.keys(manifest).length !== 1
  ) {
    throw new Error(
      `${wo}: manifest.sha256 fehlt oder ist ungültig (sha256 von manifest.json am Commit)`
    )
  }
  return {
    quelle: raw.quelle,
    commit: raw.commit,
    manifest: { sha256: manifest.sha256 },
  }
}

/**
 * Ist das die `manifest.json`, die das Lock meint?
 * @param {Uint8Array} data
 * @param {Produkte3dLock} lock
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
function pruefeManifestDatei(data, lock) {
  const ist = sha256Hex(data)
  return ist === lock.manifest.sha256
    ? { ok: true }
    : {
        ok: false,
        reason: `sha256 von manifest.json ist ${ist}, im Lock steht ${lock.manifest.sha256}`,
      }
}

/** Pfad eines Modells im Daten-Repo (Vertrag: immer `models/<id>/model.glb`). */
function repoPfad(id) {
  if (!istModellId(id)) throw new Error(`Modell-ID "${id}" ist ungültig`)
  return `models/${id}/model.glb`
}

/** Pfad eines Regal-Modells im Daten-Repo (Vertrag: `models/<id>/regal.glb`). */
function regalPfad(id) {
  if (!istModellId(id)) throw new Error(`Modell-ID "${id}" ist ungültig`)
  return `models/${id}/regal.glb`
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
 * Liest das Manifest des Daten-Repos am gesperrten Commit und liefert je
 * Modell, was Sync und Index brauchen - samt der Prüfsumme, gegen die die
 * Datei beim Sync geprüft wird. `regal`: die Regal-Modelle (Version 2).
 * @param {unknown} manifest
 * @returns {{ modelle: ManifestModell[], regal: ManifestRegal[] }}
 */
function pruefeManifest(manifest) {
  if (!isRecord(manifest) || !MANIFEST_VERSIONEN.includes(manifest.version)) {
    throw new Error(
      `manifest.json: version ${MANIFEST_VERSIONEN.join(' oder ')} erwartet`
    )
  }
  const models = manifest.models
  if (!isRecord(models)) throw new Error('manifest.json: models fehlt')
  /** @type {ManifestModell[]} */
  const modelle = []
  for (const id of Object.keys(models).sort()) {
    const entry = models[id]
    if (!istModellId(id)) {
      throw new Error(`manifest.json: Modell-ID "${id}" ist ungültig`)
    }
    if (!isRecord(entry)) {
      throw new Error(`manifest.json: Eintrag für ${id} fehlt`)
    }
    const pfad = repoPfad(id)
    if (entry.file !== pfad) {
      throw new Error(`manifest.json: file für ${id} ist nicht ${pfad}`)
    }
    if (
      typeof entry.sha256 !== 'string' ||
      !/^[0-9a-f]{64}$/.test(entry.sha256) ||
      typeof entry.bytes !== 'number' ||
      !Number.isInteger(entry.bytes) ||
      entry.bytes <= 0
    ) {
      throw new Error(`manifest.json: sha256/bytes für ${id} sind ungültig`)
    }
    if (!istBbox(entry.bbox_m)) {
      throw new Error(`manifest.json: bbox_m für ${id} ist ungültig`)
    }
    modelle.push({
      id,
      pfad,
      sha256: entry.sha256,
      bytes: entry.bytes,
      bbox_m: { min: [...entry.bbox_m.min], max: [...entry.bbox_m.max] },
    })
  }
  /** @type {ManifestRegal[]} */
  const regal = []
  for (const id of Object.keys(models).sort()) {
    const entry = models[id]
    if (!isRecord(entry) || entry.regal === undefined) continue
    const r = entry.regal
    if (!istModellId(id)) {
      throw new Error(`manifest.json: Modell-ID "${id}" ist ungültig`)
    }
    if (
      !isRecord(r) ||
      r.file !== regalPfad(id) ||
      typeof r.sha256 !== 'string' ||
      !/^[0-9a-f]{64}$/.test(r.sha256) ||
      typeof r.bytes !== 'number' ||
      !Number.isInteger(r.bytes) ||
      r.bytes <= 0
    ) {
      throw new Error(`manifest.json: regal für ${id} ist ungültig`)
    }
    regal.push({ id, pfad: r.file, sha256: r.sha256, bytes: r.bytes })
  }
  return { modelle, regal }
}

/**
 * Stimmt der Inhalt einer Datei mit ihrer Prüfsumme aus dem Manifest überein?
 * @param {Uint8Array} data
 * @param {Pruefsumme} entry
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
 * @param {{ id: string, bytes: number, bbox_m: Bbox }[]} modelle  aus `pruefeManifest`
 * @param {{ bytes: number, modelle: Record<string, IndexRegal> } | null} [regal]  das Paket der Regal-Modelle (`packeRegale`)
 * @returns {Produkte3dIndex}
 */
function baueIndex(modelle, regal = null) {
  const index = leererIndex()
  if (regal && Object.keys(regal.modelle).length > 0) {
    index.regal = {
      datei: REGAL_DATEI,
      bytes: regal.bytes,
      modelle: regal.modelle,
    }
  }
  for (const { id, bytes, bbox_m } of [...modelle].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  )) {
    index.modelle[id] = { datei: zielDatei(id), bytes, bbox_m }
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
  const fremd = Object.keys(raw).filter(
    (key) => !['version', 'modelle', 'regal'].includes(key)
  )
  if (fremd.length > 0) {
    throw new Error(
      `produkte-3d.json: Felder außerhalb des Vertrags (${fremd.join(', ')})`
    )
  }
  if (raw.regal !== undefined) {
    const r = raw.regal
    if (
      !isRecord(r) ||
      r.datei !== REGAL_DATEI ||
      typeof r.bytes !== 'number' ||
      !Number.isInteger(r.bytes) ||
      r.bytes <= 0 ||
      !isRecord(r.modelle) ||
      Object.keys(r).some((key) => !['datei', 'bytes', 'modelle'].includes(key))
    ) {
      throw new Error('produkte-3d.json: regal ist ungültig')
    }
    for (const [id, entry] of Object.entries(r.modelle)) {
      if (
        !istModellId(id) ||
        !isRecord(entry) ||
        !istBbox(entry.bbox_m) ||
        typeof entry.dreiecke !== 'number' ||
        !Number.isInteger(entry.dreiecke) ||
        entry.dreiecke <= 0 ||
        Object.keys(entry).some((key) => !['bbox_m', 'dreiecke'].includes(key))
      ) {
        throw new Error(
          `produkte-3d.json: Regal-Modell ${
            istModellId(id) ? id : '(ungültige ID)'
          } ist ungültig`
        )
      }
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
  if (index.regal) wanted.add(PAKET_DATEI)
  return present.filter((name) => !wanted.has(name)).sort()
}

module.exports = {
  INDEX_VERSION,
  QUELLE_LOKAL,
  REGAL_DATEI,
  ZIEL_ORDNER,
  baueIndex,
  istModellId,
  leererIndex,
  parseLock,
  pruefeIndex,
  pruefeManifest,
  pruefeManifestDatei,
  pruefeModell,
  regalPfad,
  repoPfad,
  ueberzaehlig,
  zielDatei,
}
