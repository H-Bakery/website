/**
 * Finanz-Endpunkte des Mock-Servers (`simple-server.js`):
 *
 *   GET /api/finance/summary            bereinigtes finance-summary.json
 *                                       + abgeleitete Reihen (`derived`)
 *   GET /api/finance/months?from=&to=   Monatsreihe Einnahmen/Ausgaben/Ergebnis
 *
 * Beide nur mit Rolle `admin` (401 ohne Token, 403 mit anderer Rolle). Die
 * Rechen- und Bereinigungslogik steht ausschließlich in
 * `src/services/finance.core.js`; hier wird nur gelesen und geantwortet.
 *
 * Datenquelle: `HQ_FINANCE_DIR` oder `<website>/../hq/data/finance`, aufgelöst
 * relativ zu dieser Datei (fünf Ebenen hoch bis zum Workspace - siehe die Tabelle der
 * kaputten Pfade in der Workspace-CLAUDE.md, die genau daran scheitern).
 * Fehlt Verzeichnis oder Datei (etwa in CI), antwortet der Server mit
 * `status: 'no-data'` und loggt das einmal - es gibt bewusst **keinen**
 * Rückfall auf Beispieldaten.
 *
 * Fehlerantworten setzen `message` **und** `error` (siehe `auth.mock.js`).
 */

'use strict'

const fs = require('fs')
const path = require('path')
const finance = require('../services/finance.core')

const SUMMARY_FILENAME = 'finance-summary.json'

/** Verzeichnis der Finanzdaten, relativ zu `apps/bakery-api/`. */
function defaultFinanceDir() {
  return path.join(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    '..',
    'hq',
    'data',
    'finance'
  )
}

/**
 * Liest und bereinigt die Zusammenfassung. Liefert das Ergebnis von
 * `finance.parseSummary()` oder `{ status: 'no-data', reason }` - wirft nie.
 * Es wird bei jeder Anfrage gelesen: die Datei entsteht durch manuelle
 * Skriptläufe im `hq`-Repo, ein Cache würde alte Stände zeigen.
 */
function loadSummary(financeDir, log) {
  const file = path.join(financeDir, SUMMARY_FILENAME)
  if (!fs.existsSync(file)) {
    log.warn(`HQ finance summary not found: ${file}`)
    return {
      status: 'no-data',
      reason: 'Finanzdaten nicht gefunden (hq/data/finance fehlt).',
    }
  }
  let text
  try {
    text = fs.readFileSync(file, 'utf-8')
  } catch (err) {
    log.warn(`HQ finance summary not readable: ${file} (${err.message})`)
    return { status: 'no-data', reason: 'Finanzdaten nicht lesbar.' }
  }
  const parsed = finance.parseSummary(text)
  if (parsed.status !== 'ok') {
    log.warn(`HQ finance summary rejected: ${parsed.reason}`)
  }
  return parsed
}

function sendNoData(res, reason) {
  // 200 mit `status`, nicht 404: der `ApiClient` würde ein 404 als Fehler
  // werfen und die Oberfläche könnte "keine Daten" nicht von "Server kaputt"
  // unterscheiden.
  res.json({
    success: true,
    status: 'no-data',
    data: null,
    message: reason,
  })
}

/**
 * Hängt die Routen an `app`. `auth` ist das Ergebnis von
 * `createAuth()` aus `auth.mock.js`; `options.financeDir` und `options.log`
 * sind für Tests.
 */
function install(app, auth, options = {}) {
  const log = options.log || console
  const financeDir =
    options.financeDir || process.env.HQ_FINANCE_DIR || defaultFinanceDir()
  const adminOnly = auth.requireRole('admin')

  app.get('/api/finance/summary', adminOnly, (req, res) => {
    const loaded = loadSummary(financeDir, log)
    if (loaded.status !== 'ok') return sendNoData(res, loaded.reason)
    res.json({
      success: true,
      status: 'ok',
      data: finance.buildSummaryResponse(loaded.summary),
    })
  })

  app.get('/api/finance/months', adminOnly, (req, res) => {
    const { from, to } = req.query
    if (!finance.isValidMonthParam(from) || !finance.isValidMonthParam(to)) {
      return res.status(400).json({
        success: false,
        error: 'validation',
        message: 'Zeitraum bitte als Monat im Format JJJJ-MM angeben.',
      })
    }
    if (from && to && String(from) > String(to)) {
      return res.status(400).json({
        success: false,
        error: 'validation',
        message: 'Der Beginn des Zeitraums liegt nach seinem Ende.',
      })
    }
    const loaded = loadSummary(financeDir, log)
    if (loaded.status !== 'ok') return sendNoData(res, loaded.reason)
    const range = { from: from || null, to: to || null }
    res.json({
      success: true,
      status: 'ok',
      data: {
        from: range.from,
        to: range.to,
        generated_at: loaded.summary.generated_at,
        months: finance.monthSeries(loaded.summary, range),
        overview: finance.overview(loaded.summary, range),
        cost_structure: finance.costStructure(loaded.summary, range),
        income_structure: finance.incomeStructure(loaded.summary, range),
      },
    })
  })

  log.log(`[finance] Endpunkte aktiv, Datenquelle: ${financeDir}`)
  return app
}

module.exports = { install, loadSummary, defaultFinanceDir }
