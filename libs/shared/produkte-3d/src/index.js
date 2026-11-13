'use strict'

/**
 * Was die statischen Apps (Landingpage, Digitale Bäckerei) über das Daten-Repo
 * `produkte-3d` gemeinsam wissen müssen - einmal:
 *
 * - **Fester Stand:** Modell-ID, Commit-Hash, eine Datei aus genau einem Commit
 *   lesen (`git show`). Das Daten-Repo liegt nur lokal, ohne Remote (DB9).
 * - **Gerenderte Produktbilder (DB13):** der Vertrag von `bilder/index.json`,
 *   die Prüfung einer WebP-Datei gegen ihren Eintrag (Maße, Transparenz), das
 *   Lock der Landingpage und der eine Leser für den Index, den ein Sync-Skript
 *   beim Bauen schreibt.
 *
 * Form wie `libs/shared/hq-products`: CommonJS mit JSDoc-Typen, läuft ohne
 * Build in einem Node-Skript (relativer `require`) und über den Alias
 * `@bakery/shared/produkte-3d` in Next und jest. Nur Node-Bordmittel. Nur zur
 * Bauzeit / auf dem Server benutzen (liest das Dateisystem, ruft git auf).
 *
 * Das Lock der 3D-Modelle selbst (sha256 je Modell, Manifest, Index der
 * Nahansicht) bleibt in apps/bakery-digitale-baeckerei/scripts/produkte-3d-lock.js.
 */
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

/** Woher die Daten heute kommen (DB9: nur lokal, kein Remote). */
const QUELLE_LOKAL = 'lokal: ../produkte-3d'
const BILDER_INDEX_VERSION = 1
/** Die Ansicht, die Karten und Produktseiten zeigen. */
const ANSICHT_HAUPT = 'haupt'
/** Obergrenze je Bild - weit über dem, was ein 800er-WebP braucht. */
const MAX_BILD_BYTES = 2 * 1024 * 1024

/**
 * @typedef {{ file: string, ansicht: string, breite: number, hoehe: number }} BildVariante
 * @typedef {{ modellSha256: string, varianten: BildVariante[] }} BildEintrag
 * @typedef {{ version: 1, bilder: Record<string, BildEintrag> }} BilderIndex
 * @typedef {{ quelle: string, commit: string | null }} BilderLock
 * @typedef {{ breite: number, hoehe: number, alpha: boolean }} WebpInfo
 */

/** @param {unknown} v @returns {v is Record<string, unknown>} */
function isRecord(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Eine Modell-ID ist die hq-Produkt-ID ohne Nummer. Sie wird zu einem
 * Dateinamen und zu einem Pfad in `git show` - darum streng.
 * @param {unknown} id
 * @returns {id is string}
 */
function istModellId(id) {
  return typeof id === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)
}

/**
 * Ein fester Stand ist ein voller Commit-Hash - kein Branch, kein Tag.
 * @param {unknown} v
 * @returns {v is string}
 */
function istCommit(v) {
  return typeof v === 'string' && /^[0-9a-f]{40}$/.test(v)
}

/** Markiert einen Ordner als Export des Daten-Repos an genau einem Commit. */
const EXPORT_DATEI = 'STAND.json'

/**
 * Ist `repoDir` ein Export (fertige Dateien statt git-Repo, so liegt der
 * Stand für den Deploy in hq)? Dann der Commit, an dem er gezogen wurde -
 * sonst `null`. Eine kaputte `STAND.json` ist ein Fehler, kein „kein Export“.
 * @param {string} repoDir
 * @returns {string | null}
 */
function exportStand(repoDir) {
  const datei = path.join(repoDir, EXPORT_DATEI)
  let text
  try {
    text = fs.readFileSync(datei, 'utf8')
  } catch {
    return null
  }
  let stand
  try {
    stand = JSON.parse(text)
  } catch {
    throw new Error(`${EXPORT_DATEI} ist kein gültiges JSON`)
  }
  if (!stand || typeof stand !== 'object' || !istCommit(stand.commit)) {
    throw new Error(
      `${EXPORT_DATEI}: commit muss ein voller Commit-Hash sein (40 Hex-Zeichen)`
    )
  }
  return stand.commit
}

/**
 * Eine Datei aus genau einem Commit des Daten-Repos, unabhängig von dessen
 * Arbeitsverzeichnis: `git -C <repoDir> show <commit>:<pfad>`.
 *
 * Liegt in `repoDir` eine `STAND.json`, ist der Ordner ein **Export** des
 * Daten-Repos (so kommt der Stand über hq in den Deploy): Dann wird die Datei
 * direkt gelesen - aber nur, wenn der Export am verlangten Commit gezogen
 * wurde. Ein anderer Stand ist ein Fehler, nie ein stilles „nimm, was da ist“.
 * @param {string} repoDir
 * @param {string} commit
 * @param {string} pfad  relativ zur Wurzel des Daten-Repos
 * @param {{ maxBuffer?: number }} [options]
 * @returns {Buffer}
 */
function liesAusCommit(repoDir, commit, pfad, options = {}) {
  if (!istCommit(commit)) {
    throw new Error('commit muss ein voller Commit-Hash sein (40 Hex-Zeichen)')
  }
  const stand = exportStand(repoDir)
  if (stand !== null) {
    if (stand !== commit) {
      throw new Error(
        `der Export ist vom Stand ${stand.slice(
          0,
          12
        )}, verlangt ist ${commit.slice(0, 12)}`
      )
    }
    const wurzel = path.resolve(repoDir)
    const datei = path.resolve(wurzel, pfad)
    if (!datei.startsWith(wurzel + path.sep)) {
      throw new Error('Pfad führt aus dem Export heraus')
    }
    return fs.readFileSync(datei)
  }
  return execFileSync('git', ['-C', repoDir, 'show', `${commit}:${pfad}`], {
    maxBuffer: options.maxBuffer ?? 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/**
 * Das Lock der Produktbilder: `quelle` und `commit`. Der Commit-Hash legt den
 * Inhalt jeder Datei fest; eine Prüfsumme je Bild braucht es daneben nicht.
 * `commit: null` heißt: noch kein Stand übernommen - es gibt keine Bilder.
 * @param {unknown} raw
 * @param {string} [wo]  Name der Datei für die Meldung
 * @returns {BilderLock}
 */
function parseBilderLock(raw, wo = 'produkte-3d-bilder.lock.json') {
  if (!isRecord(raw)) throw new Error(`${wo}: kein Objekt`)
  if (typeof raw.quelle !== 'string' || raw.quelle.trim() === '') {
    throw new Error(`${wo}: quelle fehlt`)
  }
  if (raw.commit !== null && !istCommit(raw.commit)) {
    throw new Error(
      `${wo}: commit muss ein voller Commit-Hash sein (40 Hex-Zeichen) oder null`
    )
  }
  return { quelle: raw.quelle, commit: raw.commit }
}

/** Ohne Bilder: Die Seite zeigt, was sie ohne das Daten-Repo zeigt. */
function leererBilderIndex() {
  return /** @type {BilderIndex} */ ({
    version: BILDER_INDEX_VERSION,
    bilder: {},
  })
}

/**
 * Prüft die Form von `bilder/index.json` (Vertrag des Daten-Repos; der Index,
 * den die Landingpage beim Bauen liest, hat dieselbe Form) und gibt eine
 * Kopie mit genau den Feldern des Vertrags zurück. Wirft mit einer Meldung,
 * die sagt, was nicht stimmt. Jede `file` muss unter `bilder/<id>/` liegen -
 * sie wird zu einem Pfad in `git show` und zu einem Dateinamen.
 * @param {unknown} raw
 * @param {string} [wo]
 * @returns {BilderIndex}
 */
function pruefeBilderIndex(raw, wo = 'bilder/index.json') {
  if (!isRecord(raw) || raw.version !== BILDER_INDEX_VERSION) {
    throw new Error(`${wo}: version ${BILDER_INDEX_VERSION} erwartet`)
  }
  if (!isRecord(raw.bilder)) throw new Error(`${wo}: bilder fehlt`)
  const index = leererBilderIndex()
  for (const id of Object.keys(raw.bilder).sort()) {
    const eintrag = raw.bilder[id]
    if (!istModellId(id)) throw new Error(`${wo}: ID "${id}" ist ungültig`)
    if (!isRecord(eintrag)) throw new Error(`${wo}: Eintrag für ${id} fehlt`)
    const { modellSha256, varianten } = eintrag
    if (
      typeof modellSha256 !== 'string' ||
      !/^[0-9a-f]{64}$/.test(modellSha256)
    ) {
      throw new Error(`${wo}: modellSha256 für ${id} ist ungültig`)
    }
    if (!Array.isArray(varianten) || varianten.length === 0) {
      throw new Error(`${wo}: varianten für ${id} fehlen`)
    }
    const dateien = new Set()
    const geprueft = varianten.map((v) => {
      if (
        !isRecord(v) ||
        typeof v.file !== 'string' ||
        !new RegExp(`^bilder/${id}/[a-z0-9]+(-[a-z0-9]+)*\\.webp$`).test(
          v.file
        ) ||
        typeof v.ansicht !== 'string' ||
        !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v.ansicht) ||
        !istPixel(v.breite) ||
        !istPixel(v.hoehe)
      ) {
        throw new Error(`${wo}: eine Variante von ${id} ist ungültig`)
      }
      if (dateien.has(v.file)) {
        throw new Error(`${wo}: ${v.file} steht zweimal im Index`)
      }
      dateien.add(v.file)
      return {
        file: v.file,
        ansicht: v.ansicht,
        breite: v.breite,
        hoehe: v.hoehe,
      }
    })
    index.bilder[id] = { modellSha256, varianten: geprueft }
  }
  return index
}

/** @param {unknown} n @returns {n is number} */
function istPixel(n) {
  return typeof n === 'number' && Number.isInteger(n) && n > 0 && n <= 16384
}

/**
 * Maße und Transparenz aus dem Kopf einer WebP-Datei (RIFF-Container mit
 * `VP8X`, `VP8L` oder `VP8 `). Wirft, wenn das keine WebP-Datei ist.
 * @param {Uint8Array} data
 * @returns {WebpInfo}
 */
function webpInfo(data) {
  const b = Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  if (
    b.length < 30 ||
    b.toString('latin1', 0, 4) !== 'RIFF' ||
    b.toString('latin1', 8, 12) !== 'WEBP'
  ) {
    throw new Error('keine WebP-Datei')
  }
  const chunk = b.toString('latin1', 12, 16)
  if (chunk === 'VP8X') {
    return {
      breite: b.readUIntLE(24, 3) + 1,
      hoehe: b.readUIntLE(27, 3) + 1,
      alpha: (b[20] & 0x10) !== 0,
    }
  }
  if (chunk === 'VP8L') {
    if (b[20] !== 0x2f) throw new Error('WebP (VP8L): Signatur fehlt')
    const bits = b.readUInt32LE(21)
    return {
      breite: (bits & 0x3fff) + 1,
      hoehe: ((bits >>> 14) & 0x3fff) + 1,
      alpha: ((bits >>> 28) & 1) === 1,
    }
  }
  if (chunk === 'VP8 ') {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) {
      throw new Error('WebP (VP8): Startcode fehlt')
    }
    return {
      breite: b.readUInt16LE(26) & 0x3fff,
      hoehe: b.readUInt16LE(28) & 0x3fff,
      alpha: false,
    }
  }
  throw new Error(`WebP: unbekannter erster Block "${chunk}"`)
}

/**
 * Passt eine Bilddatei zu ihrem Eintrag im Index? Geprüft wird, was der
 * Vertrag hergibt: WebP, die Maße aus dem Index, transparenter Hintergrund
 * (Alpha-Kanal), nicht leer und nicht absurd groß.
 * @param {Uint8Array} data
 * @param {BildVariante} variante
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
function pruefeBild(data, variante) {
  if (data.byteLength === 0) return { ok: false, reason: 'Datei ist leer' }
  if (data.byteLength > MAX_BILD_BYTES) {
    return {
      ok: false,
      reason: `${data.byteLength} Bytes, höchstens ${MAX_BILD_BYTES}`,
    }
  }
  let info
  try {
    info = webpInfo(data)
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    }
  }
  if (info.breite !== variante.breite || info.hoehe !== variante.hoehe) {
    return {
      ok: false,
      reason: `${info.breite}×${info.hoehe} Pixel, im Index stehen ${variante.breite}×${variante.hoehe}`,
    }
  }
  if (!info.alpha) {
    return {
      ok: false,
      reason: 'kein Alpha-Kanal (Hintergrund nicht transparent)',
    }
  }
  return { ok: true }
}

/**
 * Der eine Leser für den Bilder-Index, den ein Sync-Skript beim Bauen
 * schreibt. Gibt es die Datei nicht (kein Sync gelaufen, CI ohne Daten-Repo),
 * ist der Index leer - das ist kein Fehler. Eine kaputte Datei wirft.
 * @param {string} indexPath
 * @returns {BilderIndex}
 */
function readBilderIndex(indexPath) {
  let text
  try {
    text = fs.readFileSync(indexPath, 'utf8')
  } catch (err) {
    if (isRecord(err) && err.code === 'ENOENT') return leererBilderIndex()
    throw err
  }
  return pruefeBilderIndex(JSON.parse(text), indexPath)
}

/**
 * Die Varianten einer Ansicht eines Produkts, schmalste zuerst. Leer, wenn es
 * für das Produkt kein Bild gibt - dann zeigt die Seite, was sie ohne zeigt.
 * @param {BilderIndex} index
 * @param {string} id  hq-Produkt-ID ohne Nummer
 * @param {string} [ansicht]
 * @returns {BildVariante[]}
 */
function bildVarianten(index, id, ansicht = ANSICHT_HAUPT) {
  const eintrag = Object.prototype.hasOwnProperty.call(index.bilder, id)
    ? index.bilder[id]
    : undefined
  if (!eintrag) return []
  return eintrag.varianten
    .filter((v) => v.ansicht === ansicht)
    .sort((a, b) => a.breite - b.breite)
}

module.exports = {
  ANSICHT_HAUPT,
  BILDER_INDEX_VERSION,
  MAX_BILD_BYTES,
  QUELLE_LOKAL,
  bildVarianten,
  istCommit,
  istModellId,
  leererBilderIndex,
  EXPORT_DATEI,
  exportStand,
  liesAusCommit,
  parseBilderLock,
  pruefeBild,
  pruefeBilderIndex,
  readBilderIndex,
  webpInfo,
}
