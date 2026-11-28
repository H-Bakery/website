/**
 * Reine Logik zu model.lock.json: Lock prüfen, Quell-URL bauen, Prüfsumme
 * vergleichen, entscheiden, was zu laden ist. Ohne Netz und ohne Dateisystem,
 * damit sie sich testen lässt (model-lock.spec.ts). CommonJS, nur
 * Node-Bordmittel; scripts/sync-model.mjs ist die dünne Hülle darum.
 *
 * Das Lock nennt je Raum ein Modell (DB11). Ein Raum, der in
 * src/config/raeume.ts steht, aber hier nicht: wird nicht gebaut und nicht
 * gezeigt.
 */
const { createHash } = require('crypto')

const LOCK_FORMAT = 'bakery-model-lock-v2'
/** Das Format bis P4: ein Modell, eine Quelle. Wird weiter gelesen (`migriereV1`). */
const LOCK_FORMAT_V1 = 'bakery-model-lock-v1'
/** Im alten Format gab es nur den Verkaufsraum: Datei → Raum. */
const V1_RAEUME = { 'twin.glb': 'laden' }
const RAW_HOST = 'https://raw.githubusercontent.com'

/**
 * @typedef {{ sha256: string, bytes: number }} Pruefsumme
 * @typedef {{ repo: string, commit: string, path: string, datei: string }} Quelle
 *   `datei`: Name der Datei an der Quelle (im Lock weglassbar: dann wie
 *   `datei` des Raums).
 * @typedef {Pruefsumme & {
 *   datei: string,
 *   source: Quelle,
 *   fetched: string,
 *   ausgeliefert?: Pruefsumme,
 * }} LockRaum
 *   Ein Raum = ein Modell. `datei`: Name unter public/model/ (= `modell` des
 *   Raums in src/config/raeume.ts). sha256/bytes: die Datei, wie sie an der
 *   Quelle liegt. `ausgeliefert`: die Datei, wie sie nach der Bereinigung
 *   (scripts/glb-bereinigen.js) unter public/model/ liegt und ausgeliefert
 *   wird.
 * @typedef {{ format: string, raeume: Record<string, LockRaum> }} ModelLock
 *   Schlüssel von `raeume` = id des Raums in src/config/raeume.ts.
 * @typedef {{ ok: true } | { ok: false, reason: string }} CheckResult
 */

/** @param {unknown} v @returns {v is Record<string, unknown>} */
function isRecord(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

const DATEINAME = /^[\w-][\w.-]*$/
const RAUM_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/

/**
 * @param {Record<string, unknown>} entry
 * @param {string} name
 * @returns {Pruefsumme}
 */
function parsePruefsumme(entry, name) {
  const { sha256, bytes } = entry
  if (typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(sha256)) {
    throw new Error(`model.lock.json: sha256 für ${name} ist ungültig`)
  }
  if (typeof bytes !== 'number' || !Number.isInteger(bytes) || bytes <= 0) {
    throw new Error(`model.lock.json: bytes für ${name} ist ungültig`)
  }
  return { sha256, bytes }
}

/**
 * @param {unknown} source
 * @param {string} wo
 * @returns {{ repo: string, commit: string, path: string }}
 */
function parseQuelle(source, wo) {
  if (!isRecord(source)) throw new Error(`model.lock.json: ${wo}source fehlt`)
  const { repo, commit, path } = source
  if (typeof repo !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new Error(`model.lock.json: ${wo}source.repo muss "owner/name" sein`)
  }
  // Ein fester Stand ist ein voller Commit-Hash - kein Branch, kein Tag.
  if (typeof commit !== 'string' || !/^[0-9a-f]{40}$/.test(commit)) {
    throw new Error(
      `model.lock.json: ${wo}source.commit muss ein voller Commit-Hash sein (40 Hex-Zeichen)`
    )
  }
  if (
    typeof path !== 'string' ||
    !/^[\w.-]+(\/[\w.-]+)*$/.test(path) ||
    path.split('/').includes('..')
  ) {
    throw new Error(`model.lock.json: ${wo}source.path ist ungültig`)
  }
  return { repo, commit, path }
}

/** @param {unknown} fetched @param {string} wo @returns {string} */
function parseDatum(fetched, wo) {
  if (typeof fetched !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fetched)) {
    throw new Error(
      `model.lock.json: ${wo}fetched muss ein Datum JJJJ-MM-TT sein`
    )
  }
  return fetched
}

/**
 * Prüfsummen eines Eintrags (Quelle und, wenn genannt, ausgeliefert).
 * @param {Record<string, unknown>} entry
 * @param {string} name
 * @returns {Pruefsumme & { ausgeliefert?: Pruefsumme }}
 */
function parseSummen(entry, name) {
  /** @type {Pruefsumme & { ausgeliefert?: Pruefsumme }} */
  const out = parsePruefsumme(entry, name)
  if (entry.ausgeliefert !== undefined) {
    if (!isRecord(entry.ausgeliefert)) {
      throw new Error(`model.lock.json: ausgeliefert für ${name} ist ungültig`)
    }
    out.ausgeliefert = parsePruefsumme(
      entry.ausgeliefert,
      `${name} (ausgeliefert)`
    )
  }
  return out
}

/**
 * Das alte Format (ein Modell, eine Quelle für alle Dateien) in das neue
 * überführen: Jede Datei wird ein Raum mit eigener Quelle. Das alte Format
 * kannte nur den Verkaufsraum (`twin.glb` → `laden`); eine andere Datei lässt
 * sich keinem Raum zuordnen und ist ein Fehler. Geprüft wird hier nichts -
 * das macht `parseLock` am Ergebnis.
 * @param {Record<string, unknown>} raw
 * @returns {{ format: string, raeume: Record<string, unknown> }}
 */
function migriereV1(raw) {
  const files = raw.files
  if (!isRecord(files) || Object.keys(files).length === 0) {
    throw new Error('model.lock.json: files fehlt oder ist leer')
  }
  /** @type {Record<string, string>} */
  const zuordnung = V1_RAEUME
  /** @type {Record<string, unknown>} */
  const raeume = {}
  for (const [name, entry] of Object.entries(files)) {
    const raum = Object.prototype.hasOwnProperty.call(zuordnung, name)
      ? zuordnung[name]
      : undefined
    if (!raum) {
      throw new Error(
        `model.lock.json: Datei "${name}" im alten Format gehört zu keinem Raum - Format ${LOCK_FORMAT} verwenden`
      )
    }
    if (!isRecord(entry)) {
      throw new Error(`model.lock.json: Eintrag für ${name} fehlt`)
    }
    raeume[raum] = {
      datei: name,
      source: raw.source,
      fetched: raw.fetched,
      ...entry,
    }
  }
  return { format: LOCK_FORMAT, raeume }
}

/**
 * Prüft die Form des Locks und gibt es typisiert zurück. Wirft mit einer
 * Meldung, die sagt, was fehlt - ein kaputtes Lock darf nie zu einem
 * ungeprüften Download führen. Liest auch das alte Format (`migriereV1`).
 * @param {unknown} raw
 * @returns {ModelLock}
 */
function parseLock(raw) {
  if (!isRecord(raw)) throw new Error('model.lock.json: kein Objekt')
  if (raw.format === LOCK_FORMAT_V1) return parseLock(migriereV1(raw))
  if (raw.format !== LOCK_FORMAT) {
    throw new Error(`model.lock.json: format muss "${LOCK_FORMAT}" sein`)
  }
  const raeume = raw.raeume
  if (!isRecord(raeume) || Object.keys(raeume).length === 0) {
    throw new Error('model.lock.json: raeume fehlt oder ist leer')
  }
  /** @type {Record<string, LockRaum>} */
  const out = {}
  const dateien = new Set()
  for (const [id, entry] of Object.entries(raeume)) {
    if (!RAUM_ID.test(id)) {
      throw new Error(`model.lock.json: Raum "${id}" ist keine gültige id`)
    }
    if (!isRecord(entry)) {
      throw new Error(`model.lock.json: Eintrag für Raum ${id} fehlt`)
    }
    const wo = `raeume.${id}.`
    const { datei } = entry
    if (typeof datei !== 'string' || !DATEINAME.test(datei)) {
      throw new Error(`model.lock.json: ${wo}datei ist ungültig`)
    }
    // Zwei Räume mit derselben Datei überschrieben sich unter public/model/.
    if (dateien.has(datei)) {
      throw new Error(
        `model.lock.json: Datei "${datei}" steht bei mehr als einem Raum`
      )
    }
    dateien.add(datei)
    const source = parseQuelle(entry.source, wo)
    const quellDatei = isRecord(entry.source) ? entry.source.datei : undefined
    if (
      quellDatei !== undefined &&
      (typeof quellDatei !== 'string' || !DATEINAME.test(quellDatei))
    ) {
      throw new Error(`model.lock.json: ${wo}source.datei ist ungültig`)
    }
    out[id] = {
      datei,
      source: { ...source, datei: quellDatei ?? datei },
      fetched: parseDatum(entry.fetched, wo),
      ...parseSummen(entry, datei),
    }
  }
  return { format: LOCK_FORMAT, raeume: out }
}

/**
 * Die Dateien unter public/model/, die das Lock nennt.
 * @param {ModelLock} lock
 * @returns {string[]}
 */
function lockDateien(lock) {
  return Object.values(lock.raeume).map((raum) => raum.datei)
}

/**
 * URL des Modells eines Raums am festen Commit.
 * @param {ModelLock} lock
 * @param {string} raum id des Raums
 */
function fileUrl(lock, raum) {
  if (!Object.prototype.hasOwnProperty.call(lock.raeume, raum)) {
    throw new Error(`model.lock.json kennt den Raum ${raum} nicht`)
  }
  const { repo, commit, path, datei } = lock.raeume[raum].source
  return `${RAW_HOST}/${repo}/${commit}/${path}/${datei}`
}

/** @param {Uint8Array} data */
function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex')
}

/**
 * Stimmt der Inhalt mit dem Lock-Eintrag überein (Größe und sha256)?
 * @param {Uint8Array} data
 * @param {Pruefsumme} entry
 * @returns {CheckResult}
 */
function checkFile(data, entry) {
  if (data.byteLength !== entry.bytes) {
    return {
      ok: false,
      reason: `Größe ${data.byteLength} Bytes, erwartet ${entry.bytes}`,
    }
  }
  const actual = sha256Hex(data)
  if (actual !== entry.sha256) {
    return { ok: false, reason: `sha256 ${actual}, erwartet ${entry.sha256}` }
  }
  return { ok: true }
}

/**
 * Die Prüfsumme der Datei, wie sie ausgeliefert wird: `ausgeliefert`, sonst
 * die der Quelle (unverändert ausgeliefert).
 * @param {Pruefsumme & { ausgeliefert?: Pruefsumme }} entry
 * @returns {Pruefsumme}
 */
function ausgeliefert(entry) {
  return entry.ausgeliefert ?? { sha256: entry.sha256, bytes: entry.bytes }
}

/**
 * Was ist zu tun - je Raum des Locks? `local` liefert den Inhalt einer schon
 * vorhandenen Datei im Zielordner oder null. Vorhanden und passend zur
 * ausgelieferten Prüfsumme: nichts laden. Sonst von der Quelle laden.
 * @param {ModelLock} lock
 * @param {(name: string) => Uint8Array | null} local
 * @returns {{ raum: string, name: string, url: string, entry: LockRaum, action: 'keep' | 'fetch', reason: string }[]}
 */
function planSync(lock, local) {
  return Object.entries(lock.raeume).map(([raum, entry]) => {
    const name = entry.datei
    const url = fileUrl(lock, raum)
    const have = local(name)
    if (have === null) {
      return { raum, name, url, entry, action: 'fetch', reason: 'fehlt' }
    }
    const check = checkFile(have, ausgeliefert(entry))
    return check.ok
      ? {
          raum,
          name,
          url,
          entry,
          action: 'keep',
          reason: 'vorhanden, Prüfsumme stimmt',
        }
      : {
          raum,
          name,
          url,
          entry,
          action: 'fetch',
          reason: `veraltet (${check.reason})`,
        }
  })
}

/**
 * Was liegt im Zielordner, das nicht (mehr) im Lock steht? public/model/
 * gehört allein dem Sync-Skript und wird ausgeliefert - ein übrig gebliebener
 * Katalog mit Preisen darf dort nicht liegen bleiben.
 * @param {string[]} present Dateinamen im Ordner
 * @param {string[]} keep Dateinamen aus dem Lock
 * @returns {string[]}
 */
function staleFiles(present, keep) {
  const wanted = new Set(keep)
  return present.filter((name) => !wanted.has(name)).sort()
}

module.exports = {
  LOCK_FORMAT,
  LOCK_FORMAT_V1,
  ausgeliefert,
  lockDateien,
  migriereV1,
  parseLock,
  fileUrl,
  sha256Hex,
  checkFile,
  planSync,
  staleFiles,
}
