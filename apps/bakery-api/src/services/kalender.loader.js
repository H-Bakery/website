// Dünner Datei-Loader für den Kalender (`hq/config/kalender.yaml`, U9).
//
// Geprüft und gerechnet wird in `kalender.core.js`; hier wird nur gelesen
// (js-yaml mit CORE_SCHEMA wie `backzettel-config.loader.js` - Datumsangaben
// bleiben Text). Das hq-CI übernimmt diese Datei samt Kern
// (`scripts/validate/sync-from-website.sh`).

const fs = require('fs')
const kalenderCore = require('./kalender.core')
const { parseBackzettelYaml } = require('./backzettel-config.loader')

/**
 * Liest und prüft den Kalender.
 *
 * @param {string} filePath
 * @param {object} [options]
 * @param {object} [options.config] normalisierte Backzettel-Stammdaten (für
 *   `wie` gegen `days`, Teigtage gegen `dough_days`)
 * @returns {{ status: 'ok'|'missing'|'invalid', calendar: object|null,
 *   errors: Array<{path, message}>, warnings: Array<{path, message}> }}
 *   `calendar` normalisiert, nur bei `ok`.
 */
function loadKalender(filePath, options) {
  let text
  try {
    text = fs.readFileSync(filePath, 'utf8')
  } catch (e) {
    if (e && e.code === 'ENOENT') {
      return { status: 'missing', calendar: null, errors: [], warnings: [] }
    }
    return {
      status: 'invalid',
      calendar: null,
      errors: [
        {
          path: '',
          message: `Datei ${filePath} lässt sich nicht lesen: ${e.message}`,
        },
      ],
      warnings: [],
    }
  }
  const parsed = parseBackzettelYaml(text)
  if (!parsed.ok) {
    return {
      status: 'invalid',
      calendar: null,
      errors: parsed.errors,
      warnings: [],
    }
  }
  const result = kalenderCore.validateKalender(parsed.data, options)
  return {
    status: result.ok ? 'ok' : 'invalid',
    calendar: result.ok ? kalenderCore.normalizeKalender(parsed.data) : null,
    errors: result.errors,
    warnings: result.warnings,
  }
}

module.exports = { loadKalender }
