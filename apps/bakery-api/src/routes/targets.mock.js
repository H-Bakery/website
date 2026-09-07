/**
 * Tagesziel-Ampel für den Mock-Server (`simple-server.js`, TASK-039):
 *
 *   GET /api/finance/targets                 Zielwerte je Wochentag, beide
 *                                            Stufen, Wochentagsfaktoren,
 *                                            Kostenbasis und Stand
 *   GET /api/finance/targets/status?date=    Ist/Ziel/Ampel eines Tages
 *                                            (Vorgabe: jüngster ausgewerteter
 *                                            Tag) plus Woche und Monat bis
 *                                            dahin inkl. Hochrechnung
 *   GET /api/finance/targets/period?from=&to=  Tagesreihe mit Ampel je Tag
 *                                            und Summen je Stufe
 *
 * Alle drei nur mit Rolle `admin` - die Zielwerte sind aus Personalkosten
 * abgeleitet und damit genauso vertraulich wie die Finanzdaten. Gerechnet
 * wird ausschließlich in `src/services/targets.core.js`; hier wird gelesen,
 * geprüft und geantwortet.
 *
 * Datenquellen (alle aus dem privaten `hq`-Repo, nie aus Beispieldaten):
 *   - `HQ_FINANCE_DIR/config/targets.json`   Parameter (Fenster, Schwellen …)
 *   - `HQ_FINANCE_DIR/finance-summary.json`  Kostenbasis (`mode: 'derived'`)
 *   - `HQ_REPORTS_DIR/converted/*.json`      Tagesumsätze der Kasse
 * Fehlt oder stolpert etwas davon, antwortet der Server mit
 * `status: 'no-target'` und einem Grund - nie mit einem geschätzten Ziel.
 *
 * Fehlerantworten setzen `message` **und** `error` (siehe `auth.mock.js`).
 */

'use strict'

const fs = require('fs')
const path = require('path')
const targets = require('../services/targets.core')
const finance = require('./finance.mock')
const reportsCore = require('../services/reports.core')
const reportsFiles = require('../services/reports-files.core')

const CONFIG_SUBPATH = path.join('config', 'targets.json')

/** Tagesreihe der Kasse, die die Zielrechnung braucht: nur Datum und Umsatz. */
function loadDays(reportsDir, log) {
  const dates = reportsFiles.listReportDates(reportsDir, log.warn)
  if (dates.length === 0) return []
  return reportsFiles
    .readDailyReportsInRange(
      reportsDir,
      dates[0],
      dates[dates.length - 1],
      log.error
    )
    .map((r) => ({ date: r.date, status: r.status, revenue: r.revenue }))
}

/**
 * Liest und prüft `config/targets.json`. Liefert das Ergebnis von
 * `targets.parseConfig()` oder `{ status: 'no-target', reason }` - wirft nie.
 */
function loadConfig(financeDir, log) {
  const file = path.join(financeDir, CONFIG_SUBPATH)
  if (!fs.existsSync(file)) {
    log.warn(`HQ targets config not found: ${file}`)
    return {
      status: 'no-target',
      reason:
        'Keine Zielkonfiguration gefunden (hq/data/finance/config/targets.json fehlt).',
    }
  }
  let text
  try {
    text = fs.readFileSync(file, 'utf-8')
  } catch (err) {
    log.warn(`HQ targets config not readable: ${file} (${err.message})`)
    return { status: 'no-target', reason: 'Zielkonfiguration nicht lesbar.' }
  }
  const parsed = targets.parseConfig(text)
  if (parsed.status !== 'ok') {
    log.warn(`HQ targets config rejected: ${parsed.reason}`)
  }
  return parsed
}

function sendNoTarget(res, reason, extra = {}) {
  // 200 mit `status`, nicht 404 - wie bei `/api/finance/summary`: die
  // Oberfläche muss "kein Ziel" von "Server kaputt" unterscheiden können.
  res.json({
    success: true,
    status: 'no-target',
    data: Object.keys(extra).length ? extra : null,
    message: reason,
  })
}

/** Bezeichnung und Annahme-Kennzeichen je Zielstufe - für Umschalter und Hinweise. */
function levelsMeta(built) {
  const meta = {}
  for (const key of targets.LEVELS) {
    meta[key] = {
      key,
      label: built.levels[key].label,
      assumed: built.levels[key].assumed,
    }
  }
  return meta
}

function fail(res, status, error, message) {
  return res.status(status).json({ success: false, error, message })
}

/**
 * Hängt die Routen an `app`. `auth` ist das Ergebnis von `createAuth()`;
 * `options.financeDir`, `options.reportsDir`, `options.today` und
 * `options.log` sind für Tests.
 */
function install(app, auth, options = {}) {
  const log = options.log || console
  const financeDir =
    options.financeDir ||
    process.env.HQ_FINANCE_DIR ||
    finance.defaultFinanceDir()
  const reportsDir =
    options.reportsDir ||
    reportsFiles.resolveReportsDir(path.join(__dirname, '..', '..', '..', '..'))
  const today = () =>
    typeof options.today === 'function'
      ? options.today()
      : options.today || targets.todayIso()
  const adminOnly = auth.requireRole('admin')

  /**
   * Alles, was jede Antwort braucht: Config, Kostenbasis, Faktoren, Ziele.
   * `{ ok: true, config, days, built }` oder `{ ok: false, reason, built }`.
   */
  function build() {
    const cfg = loadConfig(financeDir, log)
    if (cfg.status !== 'ok') return { ok: false, reason: cfg.reason }
    const config = cfg.config
    let summary = null
    if (config.mode === 'derived') {
      const loaded = finance.loadSummary(financeDir, log)
      if (loaded.status !== 'ok') {
        return {
          ok: false,
          reason: `Kostenbasis nicht ableitbar: ${loaded.reason}`,
        }
      }
      summary = loaded.summary
    }
    const days = loadDays(reportsDir, log)
    const built = targets.buildTargets(summary, config, days, {
      today: today(),
    })
    if (built.status !== 'ok') {
      return { ok: false, reason: built.reason, built, config, days }
    }
    return { ok: true, config, days, built }
  }

  app.get('/api/finance/targets', adminOnly, (req, res) => {
    const result = build()
    if (!result.ok) {
      // Mit Config, aber ohne Ziel (etwa: keine Berichte): Kostenbasis und
      // Stand trotzdem mitgeben, damit die Seite sagen kann, woran es liegt.
      return sendNoTarget(res, result.reason, result.built || {})
    }
    res.json({ success: true, status: 'ok', data: result.built })
  })

  app.get('/api/finance/targets/status', adminOnly, (req, res) => {
    const requested = req.query.date
    if (requested !== undefined && !targets.isValidDate(String(requested))) {
      return fail(
        res,
        400,
        'validation',
        'Bitte das Datum als JJJJ-MM-TT angeben.'
      )
    }
    const result = build()
    if (!result.ok) return sendNoTarget(res, result.reason)
    const { built, config, days } = result
    const date =
      requested !== undefined ? String(requested) : built.last_evaluated_date
    if (!date) {
      return sendNoTarget(
        res,
        'Noch kein ausgewerteter Tag - es liegt kein Kassenbericht vor.'
      )
    }
    const toDate = targets.aggregateToDate(
      date,
      days,
      { levels: built.levels },
      config,
      { today: built.today }
    )
    const day = targets.aggregatePeriod(
      date,
      date,
      days,
      { levels: built.levels },
      config,
      { today: built.today }
    ).days[0]
    res.json({
      success: true,
      status: 'ok',
      data: {
        today: built.today,
        last_evaluated_date: built.last_evaluated_date,
        config: built.config,
        thresholds: config.thresholds,
        levels_meta: levelsMeta(built),
        day,
        week: toDate.week,
        month: toDate.month,
      },
    })
  })

  app.get('/api/finance/targets/period', adminOnly, (req, res) => {
    const from = String(req.query.from || '')
    const to = String(req.query.to || '')
    if (!targets.isValidDate(from) || !targets.isValidDate(to)) {
      return fail(
        res,
        400,
        'validation',
        'Bitte from und to als JJJJ-MM-TT angeben.'
      )
    }
    if (from > to) {
      return fail(
        res,
        400,
        'validation',
        'Das Startdatum liegt nach dem Enddatum.'
      )
    }
    if (targets.listDates(from, to).length > reportsCore.MAX_RANGE_DAYS) {
      return fail(
        res,
        400,
        'range_too_large',
        `Der Zeitraum darf höchstens ${reportsCore.MAX_RANGE_DAYS} Tage umfassen.`
      )
    }
    const result = build()
    if (!result.ok) return sendNoTarget(res, result.reason)
    const { built, config, days } = result
    const period = targets.aggregatePeriod(
      from,
      to,
      days,
      { levels: built.levels },
      config,
      { today: built.today }
    )
    res.json({
      success: true,
      status: 'ok',
      data: {
        ...period,
        last_evaluated_date: built.last_evaluated_date,
        config: built.config,
        thresholds: config.thresholds,
        levels_meta: levelsMeta(built),
      },
    })
  })

  log.log(
    `[targets] Endpunkte aktiv, Config: ${path.join(
      financeDir,
      CONFIG_SUBPATH
    )}`
  )
  return app
}

module.exports = { install, loadConfig, loadDays, CONFIG_SUBPATH }
