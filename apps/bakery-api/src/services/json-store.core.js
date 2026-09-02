/**
 * Lesen und Schreiben der JSON-Stores des Mock-Servers.
 *
 * Bewusst dependency-freies CommonJS (nur `fs` und `path`): `simple-server.js`
 * benutzt es für den Partner- und den Liefer-Store, `tests/unit/jsonStore.test.js`
 * prüft es gegen ein Temp-Verzeichnis. Beim `serve:api:simple` sind diese
 * Dateien die *einzige* Aufzeichnung - ein Backschrank-Besuch, der hier
 * verloren geht, ist weg.
 *
 * Zwei Regeln, damit ein Absturz keine Erfassung kostet:
 *
 *   - Geschrieben wird erst in eine Nachbardatei, dann umbenannt. Stirbt der
 *     Prozess mitten im Schreiben, bleibt die alte Datei heil - sonst läge
 *     danach eine halbe JSON-Datei da.
 *   - Eine Datei, die sich nicht parsen lässt, wird nach
 *     `<datei>.corrupt-<zeit>` verschoben, nie überschrieben. Der Aufrufer
 *     arbeitet mit seinem Seed weiter, aber die Daten liegen noch in der
 *     verschobenen Datei und lassen sich von Hand zurückholen.
 */

'use strict'

const fs = require('fs')
const path = require('path')

/** Schreibt `data` als eingerücktes JSON nach `file` - erst `.tmp`, dann `rename`. */
function writeJsonAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tmp, file)
}

/** Ablageort einer kaputten Datei, z. B. `store.json.corrupt-2026-09-02T15-07-00-405Z`. */
function quarantinePath(file, now = new Date()) {
  return `${file}.corrupt-${now.toISOString().replace(/[:.]/g, '-')}`
}

/**
 * Liest und parst `file`. Rückgabe:
 *
 *   { data }                            - gelesen
 *   { data: null, missing: true }       - Datei gibt es nicht
 *   { data: null, quarantine, reason }  - kaputt; liegt jetzt unter `quarantine`
 *
 * Andere Lesefehler (Rechte, E/A) werden geworfen - da hilft kein Verschieben,
 * und die Datei soll dann auch nicht angefasst werden.
 */
function readJsonOrQuarantine(file) {
  let raw
  try {
    raw = fs.readFileSync(file, 'utf-8')
  } catch (err) {
    if (err && err.code === 'ENOENT') return { data: null, missing: true }
    throw err
  }
  try {
    return { data: JSON.parse(raw) }
  } catch (err) {
    const quarantine = quarantinePath(file)
    fs.renameSync(file, quarantine)
    return { data: null, quarantine, reason: err.message }
  }
}

module.exports = {
  writeJsonAtomic,
  quarantinePath,
  readJsonOrQuarantine,
}
