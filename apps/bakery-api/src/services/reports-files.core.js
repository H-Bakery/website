/**
 * Datei-Lese-Schicht für die Kassenberichte in `hq/data/reports/converted`.
 *
 * Trennt das Dateisystem von der Rechenlogik in `reports.core.js`: hier wird
 * nur gelesen und geparst, gerechnet wird dort. Mock-Server und
 * Management-Loader benutzen beides gemeinsam.
 *
 * Fehlt das Verzeichnis (in CI gibt es kein `hq`), wird einmal protokolliert
 * und leer geantwortet - nie geworfen. Eine einzelne kaputte Datei wird
 * übersprungen und ebenfalls protokolliert; sie darf nicht den ganzen Monat
 * mitreißen.
 */

'use strict'

const fs = require('fs')
const path = require('path')
const core = require('./reports.core')

const CONVERTED_SUBDIR = 'converted'

/**
 * Basisverzeichnis der Berichte: `HQ_REPORTS_DIR` oder
 * `<Monorepo>/../hq/data/reports`.
 */
function resolveReportsDir(monorepoRoot, env) {
  const e = env || process.env
  if (e.HQ_REPORTS_DIR) return e.HQ_REPORTS_DIR
  return path.join(monorepoRoot, '..', 'hq', 'data', 'reports')
}

function convertedDir(reportsDir) {
  return path.join(reportsDir, CONVERTED_SUBDIR)
}

const warnedDirs = new Set()

/**
 * Prüft, ob `converted/` existiert. Loggt beim ersten Fehlen einen Hinweis
 * (nicht bei jedem Aufruf - der Loader wird pro Seitenaufruf gerufen).
 */
function reportsAvailable(reportsDir, log) {
  const dir = convertedDir(reportsDir)
  if (fs.existsSync(dir)) return true
  if (!warnedDirs.has(dir)) {
    warnedDirs.add(dir)
    ;(log || console.warn)(`HQ reports directory not found: ${dir}`)
  }
  return false
}

/**
 * Alle Tagesfiles im Verzeichnis, geparst und nach Datum/Abschluss sortiert.
 * Dateien, die nicht dem Muster folgen, werden ignoriert.
 */
function listReportFiles(reportsDir, log) {
  if (!reportsAvailable(reportsDir, log)) return []
  const dir = convertedDir(reportsDir)
  return fs
    .readdirSync(dir)
    .map((name) => core.parseReportFilename(name))
    .filter(Boolean)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.closing - b.closing ||
        a.registerId.localeCompare(b.registerId)
    )
}

/** Sortierte Liste aller Tage, für die mindestens ein Abschluss vorliegt. */
function listReportDates(reportsDir, log) {
  return [...new Set(listReportFiles(reportsDir, log).map((f) => f.date))]
}

function readJson(file, log) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'))
  } catch (err) {
    ;(log || console.error)(
      `Kassenbericht nicht lesbar, wird übersprungen: ${file} (${
        err && err.message ? err.message : err
      })`
    )
    return null
  }
}

/**
 * Alle Abschlüsse eines Tages lesen: `[{ filename, registerId, closing, data }]`.
 * Leer, wenn es für den Tag keine Datei gibt.
 */
function readDayClosings(reportsDir, date, log) {
  if (!core.isValidDate(date)) return []
  const dir = convertedDir(reportsDir)
  return listReportFiles(reportsDir, log)
    .filter((f) => f.date === date)
    .map((f) => {
      const data = readJson(path.join(dir, f.filename), log)
      return data ? { ...f, data } : null
    })
    .filter(Boolean)
}

/** Ein Tag als aggregierter Bericht (`status: 'ok' | 'no-data'`). */
function readDailyReport(reportsDir, date, log) {
  return core.aggregateDay(date, readDayClosings(reportsDir, date, log))
}

/**
 * Alle vorhandenen Tage im Zeitraum (inklusive) als aggregierte Berichte.
 * Fehlende Tage stehen nicht in der Liste - wer Lücken zeigen will, nimmt
 * `core.listDates(from, to)` dazu.
 */
function readDailyReportsInRange(reportsDir, from, to, log) {
  if (!core.isValidDate(from) || !core.isValidDate(to) || from > to) return []
  const dir = convertedDir(reportsDir)
  const byDate = new Map()
  for (const f of listReportFiles(reportsDir, log)) {
    if (f.date < from || f.date > to) continue
    const data = readJson(path.join(dir, f.filename), log)
    if (!data) continue
    if (!byDate.has(f.date)) byDate.set(f.date, [])
    byDate.get(f.date).push({ ...f, data })
  }
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, closings]) => core.aggregateDay(date, closings))
}

module.exports = {
  CONVERTED_SUBDIR,
  resolveReportsDir,
  convertedDir,
  reportsAvailable,
  listReportFiles,
  listReportDates,
  readDayClosings,
  readDailyReport,
  readDailyReportsInRange,
}
