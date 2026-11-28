/**
 * Infopunkte der Räume: der eine Leser für
 * `<hq>/config/digitale-baeckerei/raeume/<raum>.yaml` und die Form von
 * `public/data/rauminfos.json` (git-ignoriert, beim Bauen geschrieben von
 * scripts/sync-rauminfos.mjs). Bis auf `leseVerzeichnis` reine Logik ohne
 * Dateisystem - getestet in rauminfos.spec.ts. CommonJS; einzige
 * Abhängigkeit: `js-yaml`.
 *
 * Ein Infopunkt gehört zu einem Stück des Modells (Ofen, Kneter …): Tippt man
 * im Bild darauf, öffnet sich dieselbe Karte wie bei einem Produkt.
 *
 * ```yaml
 * infopunkte:
 *   - knoten: ofen          # Anfang der Knoten-ID im Modell: trifft `ofen` und `ofen/…`
 *     titel: Der Ofen
 *     kurz: Ein, zwei Sätze für die Karte.
 *     text: |               # optional: der lange Text hinter „Mehr lesen“
 *       Mehr dazu.
 * ```
 *
 * Texte sind Inhalt und kommen nur aus hq: Fehlt die Datei, hat der Raum
 * keine Infopunkte - es wird nichts erfunden. Eine Datei, die nicht dem
 * Vertrag entspricht, bricht den Build ab. Die Meldungen nennen Datei, Stelle
 * und Feld, nie den Inhalt (die Logs eines öffentlichen Repos sind öffentlich).
 * Keine Preise (DB8): ein „€“ im Text ist ein Fehler.
 */
const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')

const FELDER = ['knoten', 'titel', 'kurz', 'text']
const MAX = { titel: 80, kurz: 400, text: 4000 }
/** Knoten-ID wie im Modell: Abschnitte aus Kleinbuchstaben, Ziffern, `-`, `_`, `.`. */
const KNOTEN = /^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)*$/
const RAUM_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/

/**
 * @typedef {{ knoten: string, titel: string, kurz: string, text?: string }} Infopunkt
 * @typedef {{ infopunkte: Infopunkt[] }} RaumInfos
 * @typedef {{ version: 1, raeume: Record<string, RaumInfos> }} Rauminfos
 */

/** @param {unknown} v @returns {v is Record<string, unknown>} */
function isRecord(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Prüft die Infopunkte eines Raums (schon als Objekt) und gibt sie bereinigt
 * zurück: `knoten` ohne Schrägstrich am Ende, Texte ohne Rand-Leerraum.
 * @param {unknown} raw
 * @param {string} wo  z. B. `backstube.yaml`
 * @returns {RaumInfos}
 */
function pruefeRaumInfos(raw, wo) {
  if (!isRecord(raw)) throw new Error(`${wo}: kein Objekt`)
  const fremd = Object.keys(raw).filter((k) => k !== 'infopunkte')
  if (fremd.length > 0) {
    throw new Error(`${wo}: unbekanntes Feld "${fremd[0]}"`)
  }
  const liste = raw.infopunkte ?? []
  if (!Array.isArray(liste)) {
    throw new Error(`${wo}: infopunkte muss eine Liste sein`)
  }
  /** @type {Infopunkt[]} */
  const infopunkte = []
  const gesehen = new Set()
  liste.forEach((eintrag, i) => {
    const stelle = `${wo}: infopunkte[${i}]`
    if (!isRecord(eintrag)) throw new Error(`${stelle} ist kein Objekt`)
    const unbekannt = Object.keys(eintrag).filter((k) => !FELDER.includes(k))
    if (unbekannt.length > 0) {
      throw new Error(`${stelle}: unbekanntes Feld "${unbekannt[0]}"`)
    }
    const knoten =
      typeof eintrag.knoten === 'string'
        ? eintrag.knoten.trim().replace(/\/+$/, '')
        : ''
    if (!KNOTEN.test(knoten)) {
      throw new Error(
        `${stelle}: knoten fehlt oder ist keine Knoten-ID (z. B. "ofen" oder "ofen/tuer")`
      )
    }
    if (gesehen.has(knoten)) {
      throw new Error(`${stelle}: knoten steht doppelt in der Datei`)
    }
    gesehen.add(knoten)
    /** @param {'titel' | 'kurz' | 'text'} feld @param {boolean} pflicht */
    const text = (feld, pflicht) => {
      const wert = eintrag[feld]
      if (wert === undefined || wert === null) {
        if (pflicht) throw new Error(`${stelle}: ${feld} fehlt`)
        return undefined
      }
      if (typeof wert !== 'string') {
        throw new Error(`${stelle}: ${feld} muss Text sein`)
      }
      const sauber = wert.trim()
      if (sauber === '') {
        if (pflicht) throw new Error(`${stelle}: ${feld} ist leer`)
        return undefined
      }
      if (sauber.length > MAX[feld]) {
        throw new Error(
          `${stelle}: ${feld} ist länger als ${MAX[feld]} Zeichen`
        )
      }
      if (sauber.includes('€')) {
        throw new Error(`${stelle}: ${feld} enthält „€“ - keine Preise (DB8)`)
      }
      return sauber
    }
    const titel = /** @type {string} */ (text('titel', true))
    const kurz = /** @type {string} */ (text('kurz', true))
    const lang = text('text', false)
    infopunkte.push(
      lang === undefined
        ? { knoten, titel, kurz }
        : { knoten, titel, kurz, text: lang }
    )
  })
  return { infopunkte }
}

/**
 * Liest den Inhalt einer `<raum>.yaml`.
 * @param {string} inhalt
 * @param {string} datei  Dateiname für Meldungen
 * @returns {RaumInfos}
 */
function leseRaumYaml(inhalt, datei) {
  let raw
  try {
    raw = yaml.load(inhalt)
  } catch {
    // Ohne die Meldung des Parsers: Sie zitiert die Zeile der Datei.
    throw new Error(`${datei}: kein gültiges YAML`)
  }
  // Eine leere Datei ist gültig: keine Infopunkte.
  if (raw === undefined || raw === null) return { infopunkte: [] }
  return pruefeRaumInfos(raw, datei)
}

/** @returns {Rauminfos} */
function leereRauminfos() {
  return { version: 1, raeume: {} }
}

/**
 * Setzt `rauminfos.json` zusammen: nur Räume mit mindestens einem Infopunkt.
 * @param {Record<string, RaumInfos>} jeRaum
 * @returns {Rauminfos}
 */
function baueRauminfos(jeRaum) {
  const out = leereRauminfos()
  for (const [raum, infos] of Object.entries(jeRaum)) {
    if (!RAUM_ID.test(raum)) {
      throw new Error(`rauminfos: "${raum}" ist keine gültige Raum-id`)
    }
    if (infos.infopunkte.length > 0) out.raeume[raum] = infos
  }
  return out
}

/**
 * Prüft eine fertige `rauminfos.json` (Export-Wächter): Form, erlaubte Felder,
 * kein „€“. Wirft mit einer Meldung ohne Inhalt.
 * @param {unknown} raw
 * @returns {Rauminfos}
 */
function pruefeRauminfos(raw) {
  if (!isRecord(raw) || raw.version !== 1 || !isRecord(raw.raeume)) {
    throw new Error('rauminfos.json hat nicht die erwartete Form')
  }
  const fremd = Object.keys(raw).filter(
    (k) => k !== 'version' && k !== 'raeume'
  )
  if (fremd.length > 0) {
    throw new Error(`rauminfos.json: unbekanntes Feld "${fremd[0]}"`)
  }
  /** @type {Record<string, RaumInfos>} */
  const jeRaum = {}
  for (const [raum, infos] of Object.entries(raw.raeume)) {
    jeRaum[raum] = pruefeRaumInfos(infos, `rauminfos.json: ${raum}`)
  }
  return baueRauminfos(jeRaum)
}

/**
 * Liest `<dir>/<raum>.yaml` für genau diese Räume - andere Dateien im Ordner
 * bleiben liegen (ein Raum ohne Modell wird nicht gebaut, also kommen auch
 * seine Texte nicht in den Export). Fehlt der Ordner oder eine Datei: keine
 * Infopunkte für diesen Raum.
 * @param {string} dir
 * @param {string[]} raumIds
 * @returns {{ rauminfos: Rauminfos, gelesen: string[] }}
 */
function leseVerzeichnis(dir, raumIds) {
  /** @type {Record<string, RaumInfos>} */
  const jeRaum = {}
  const gelesen = []
  for (const raum of raumIds) {
    const datei = `${raum}.yaml`
    const file = path.join(dir, datei)
    if (!RAUM_ID.test(raum) || !fs.existsSync(file)) continue
    jeRaum[raum] = leseRaumYaml(fs.readFileSync(file, 'utf8'), datei)
    gelesen.push(datei)
  }
  return { rauminfos: baueRauminfos(jeRaum), gelesen }
}

/** So schreiben die Skripte die Datei - eine Stelle, damit Vergleiche Byte für Byte stimmen. */
function alsDatei(/** @type {Rauminfos} */ rauminfos) {
  return `${JSON.stringify(rauminfos)}\n`
}

module.exports = {
  alsDatei,
  baueRauminfos,
  leereRauminfos,
  leseRaumYaml,
  leseVerzeichnis,
  pruefeRaumInfos,
  pruefeRauminfos,
}
