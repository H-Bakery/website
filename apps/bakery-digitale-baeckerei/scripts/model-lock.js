/**
 * Reine Logik zu model.lock.json: Lock prüfen, Quell-URL bauen, Prüfsumme
 * vergleichen, entscheiden, was zu laden ist. Ohne Netz und ohne Dateisystem,
 * damit sie sich testen lässt (model-lock.spec.ts). CommonJS, nur
 * Node-Bordmittel; scripts/sync-model.mjs ist die dünne Hülle darum.
 */
const { createHash } = require('crypto')

const LOCK_FORMAT = 'bakery-model-lock-v1'
const RAW_HOST = 'https://raw.githubusercontent.com'

/**
 * @typedef {{ sha256: string, bytes: number }} LockFile
 * @typedef {{
 *   format: string,
 *   source: { repo: string, commit: string, path: string },
 *   fetched: string,
 *   files: Record<string, LockFile>,
 * }} ModelLock
 * @typedef {{ ok: true } | { ok: false, reason: string }} CheckResult
 */

/** @param {unknown} v @returns {v is Record<string, unknown>} */
function isRecord(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Prüft die Form des Locks und gibt es typisiert zurück. Wirft mit einer
 * Meldung, die sagt, was fehlt - ein kaputtes Lock darf nie zu einem
 * ungeprüften Download führen.
 * @param {unknown} raw
 * @returns {ModelLock}
 */
function parseLock(raw) {
  if (!isRecord(raw)) throw new Error('model.lock.json: kein Objekt')
  if (raw.format !== LOCK_FORMAT) {
    throw new Error(`model.lock.json: format muss "${LOCK_FORMAT}" sein`)
  }
  const source = raw.source
  if (!isRecord(source)) throw new Error('model.lock.json: source fehlt')
  const { repo, commit, path } = source
  if (typeof repo !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new Error('model.lock.json: source.repo muss "owner/name" sein')
  }
  // Ein fester Stand ist ein voller Commit-Hash - kein Branch, kein Tag.
  if (typeof commit !== 'string' || !/^[0-9a-f]{40}$/.test(commit)) {
    throw new Error(
      'model.lock.json: source.commit muss ein voller Commit-Hash sein (40 Hex-Zeichen)'
    )
  }
  if (
    typeof path !== 'string' ||
    !/^[\w.-]+(\/[\w.-]+)*$/.test(path) ||
    path.split('/').includes('..')
  ) {
    throw new Error('model.lock.json: source.path ist ungültig')
  }
  if (
    typeof raw.fetched !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(raw.fetched)
  ) {
    throw new Error('model.lock.json: fetched muss ein Datum JJJJ-MM-TT sein')
  }
  const files = raw.files
  if (!isRecord(files) || Object.keys(files).length === 0) {
    throw new Error('model.lock.json: files fehlt oder ist leer')
  }
  /** @type {Record<string, LockFile>} */
  const out = {}
  for (const [name, entry] of Object.entries(files)) {
    if (!/^[\w-][\w.-]*$/.test(name)) {
      throw new Error(`model.lock.json: Dateiname "${name}" ist ungültig`)
    }
    if (!isRecord(entry)) {
      throw new Error(`model.lock.json: Eintrag für ${name} fehlt`)
    }
    const { sha256, bytes } = entry
    if (typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(sha256)) {
      throw new Error(`model.lock.json: sha256 für ${name} ist ungültig`)
    }
    if (typeof bytes !== 'number' || !Number.isInteger(bytes) || bytes <= 0) {
      throw new Error(`model.lock.json: bytes für ${name} ist ungültig`)
    }
    out[name] = { sha256, bytes }
  }
  return {
    format: LOCK_FORMAT,
    source: { repo, commit, path },
    fetched: raw.fetched,
    files: out,
  }
}

/**
 * URL einer Datei am festen Commit.
 * @param {ModelLock} lock
 * @param {string} name
 */
function fileUrl(lock, name) {
  if (!Object.prototype.hasOwnProperty.call(lock.files, name)) {
    throw new Error(`model.lock.json kennt ${name} nicht`)
  }
  const { repo, commit, path } = lock.source
  return `${RAW_HOST}/${repo}/${commit}/${path}/${name}`
}

/** @param {Uint8Array} data */
function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex')
}

/**
 * Stimmt der Inhalt mit dem Lock-Eintrag überein (Größe und sha256)?
 * @param {Uint8Array} data
 * @param {LockFile} entry
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
 * Was ist zu tun? `local` liefert den Inhalt einer schon vorhandenen Datei
 * oder null. Vorhanden und passend: nichts laden. Sonst laden.
 * @param {ModelLock} lock
 * @param {(name: string) => Uint8Array | null} local
 * @returns {{ name: string, url: string, entry: LockFile, action: 'keep' | 'fetch', reason: string }[]}
 */
function planSync(lock, local) {
  return Object.entries(lock.files).map(([name, entry]) => {
    const url = fileUrl(lock, name)
    const have = local(name)
    if (have === null) {
      return { name, url, entry, action: 'fetch', reason: 'fehlt' }
    }
    const check = checkFile(have, entry)
    return check.ok
      ? {
          name,
          url,
          entry,
          action: 'keep',
          reason: 'vorhanden, Prüfsumme stimmt',
        }
      : {
          name,
          url,
          entry,
          action: 'fetch',
          reason: `veraltet (${check.reason})`,
        }
  })
}

module.exports = {
  LOCK_FORMAT,
  parseLock,
  fileUrl,
  sha256Hex,
  checkFile,
  planSync,
}
